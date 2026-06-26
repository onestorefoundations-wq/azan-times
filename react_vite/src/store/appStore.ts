/**
 * appStore.ts
 * Central app state. Mirrors flutter_app/lib/providers/app_provider.dart.
 *
 * Holds AppConfig, computed prayers, the prayer state machine, the display
 * state, sync status and media. Runs a 1-second tick driving alert transitions
 * + audio, and a slideshow cycle timer (TV phase → slideshow phase → repeat).
 *
 * Timers and per-prayer dedup flags live as module-level refs (not store state)
 * so they don't trigger re-renders — same pattern as the Dart provider's
 * private fields.
 */

import { create } from 'zustand';
import {
  AppConfig,
  defaultAppConfig,
  imagesForOrientation,
  isLinked,
  SlideAsset,
  slideshowRunTotalSecs,
  tvScreenTotalSecs,
} from '../core/appConfig';
import {
  PrayerConfig,
  PrayerState,
  calculatePrayers,
  getCurrentPrayerState,
  getNextPrayer,
} from '../core/prayerEngine';
import {
  MediaFile,
  isBackground,
  isSlide,
  isLandscapeSlide,
  isPortraitSlide,
} from '../core/mediaFile';
import { StorageService } from '../core/storageService';
import { AudioService } from '../core/audioService';
import { SupabaseSync, SyncStatus } from '../core/supabaseSync';
import { MediaLibraryService } from '../core/mediaLibraryService';
import { MediaCache } from '../core/mediaCache';
import { PendingUploads, PendingEntry, mimeFromFilename } from '../core/pendingUploads';
import { DeviceService } from '../core/deviceService';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type DisplayState = 'normal' | 'adhanAlert' | 'iqamahAlert' | 'slideshow';
export type { SyncStatus };

export interface AppState {
  config: AppConfig;
  prayers: PrayerConfig[];
  prayerState: PrayerState;
  activePrayer: PrayerConfig | null;
  nextPrayer: PrayerConfig | null;
  displayState: DisplayState;
  isLoaded: boolean;
  syncStatus: SyncStatus;

  // Media (populated in Phase 5)
  mediaFiles: MediaFile[]; // cloud-synced
  pendingUploads: MediaFile[]; // local, not yet uploaded
  localCacheIndex: Record<string, string>; // mediaId → cached blob URL
  isUploadingPending: boolean;

  // Actions
  init: () => Promise<void>;
  loadConfig: () => void;
  saveConfig: (config: AppConfig) => Promise<void>;
  dismissAlert: () => void;
  setSyncStatus: (status: SyncStatus) => void;
  startSyncIfLinked: () => Promise<void>;
  onAccountChanged: () => Promise<void>;

  // Media
  refreshMediaLibrary: () => Promise<void>;
  importLocalFiles: (category: string, files: FileList | File[]) => Promise<void>;
  setPendingFileAsBackground: (localId: string) => Promise<void>;
  deletePendingFile: (localId: string) => Promise<void>;
  downloadMediaFile: (file: MediaFile, onProgress?: (p: number) => void) => Promise<void>;
  evictFromCache: (fileId: string) => Promise<void>;
  isFileLocal: (fileId: string) => boolean;
}

// ── Module-level (non-reactive) state ──────────────────────────
let tickTimer: ReturnType<typeof setInterval> | null = null;
let midnightTimer: ReturnType<typeof setTimeout> | null = null;
let slideshowTimer: ReturnType<typeof setTimeout> | null = null;
let lastAlertedAdhan: string | null = null;
let lastAlertedIqamah: string | null = null;
let alertTimeout: number | null = null; // epoch ms
let inSlideshowPhase = false;
let mediaChannel: RealtimeChannel | null = null;
let uploadingPending = false;

const MEDIA_SNAPSHOT_KEY = 'media_library_snapshot';

/** Convert a stored pending entry to a MediaFile with a displayable blob URL. */
function pendingToMediaFile(e: PendingEntry): MediaFile {
  return {
    id: e.localId,
    tenantId: e.tenantId,
    filename: e.filename,
    url: URL.createObjectURL(e.blob),
    fileSizeBytes: e.fileSize,
    mimeType: e.mimeType,
    category: e.category,
    isActiveBackground: e.isActive,
    displayOrder: 0,
    isDeleted: false,
    uploadedAt: new Date(e.createdAt),
    uploadedByDevice: e.deviceId,
    metadata: {},
    isPendingUpload: true,
    localFilePath: URL.createObjectURL(e.blob),
  };
}

// ── Pure selectors (used by components and the cycle logic) ────

export const hasSlidesAvailable = (s: Pick<AppState, 'config' | 'mediaFiles' | 'pendingUploads'>): boolean => {
  const hasMediaSlides = s.mediaFiles.some((f) => !f.isDeleted && isSlide(f));
  const hasPendingSlides = s.pendingUploads.some((f) => isSlide(f));
  const ss = s.config.slideshow;
  return (
    hasMediaSlides ||
    hasPendingSlides ||
    ss.images.length > 0 ||
    ss.landscapeImages.length > 0 ||
    ss.portraitImages.length > 0
  );
};

export const slidesForOrientation = (
  s: Pick<AppState, 'config' | 'mediaFiles' | 'pendingUploads' | 'localCacheIndex'>,
  isPortrait: boolean,
): SlideAsset[] => {
  const cloudSlides = s.mediaFiles
    .filter((f) => !f.isDeleted && (isPortrait ? isPortraitSlide(f) : isLandscapeSlide(f)))
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const pendingSlides = s.pendingUploads.filter((f) =>
    isPortrait ? isPortraitSlide(f) : isLandscapeSlide(f),
  );

  const all: SlideAsset[] = [
    ...cloudSlides.map((f) => ({
      id: f.id,
      filename: f.filename,
      localPath: s.localCacheIndex[f.id] ?? f.url,
      uploadedAt: f.uploadedAt.getTime(),
    })),
    ...pendingSlides.map((f) => ({
      id: f.id,
      filename: f.filename,
      localPath: f.localFilePath ?? f.url,
      uploadedAt: f.uploadedAt.getTime(),
    })),
  ];

  if (all.length) return all;
  return imagesForOrientation(s.config.slideshow, isPortrait);
};

export const activeBgUrlForOrientation = (
  s: Pick<AppState, 'config' | 'mediaFiles' | 'pendingUploads' | 'localCacheIndex'>,
  isPortrait: boolean,
): string | null => {
  const specificCat = isPortrait ? 'background_portrait' : 'background_landscape';

  const pendingSpecific = s.pendingUploads.find(
    (f) => f.category === specificCat && f.isActiveBackground,
  );
  if (pendingSpecific) return pendingSpecific.localFilePath ?? pendingSpecific.url;

  const specific = s.mediaFiles.find(
    (f) => f.category === specificCat && f.isActiveBackground && !f.isDeleted,
  );
  if (specific) return s.localCacheIndex[specific.id] ?? specific.url;

  const pendingAny = s.pendingUploads.find(
    (f) => f.category === 'background' && f.isActiveBackground,
  );
  if (pendingAny) return pendingAny.localFilePath ?? pendingAny.url;

  const any = s.mediaFiles.find(
    (f) => f.category === 'background' && f.isActiveBackground && !f.isDeleted,
  );
  if (any) return s.localCacheIndex[any.id] ?? any.url;

  const legacy = s.config.meta.customBackgroundPath;
  if (legacy && (legacy.startsWith('http') || legacy.startsWith('data:'))) return legacy;
  return null;
};

/** All media files: cloud + locally-imported pending uploads. */
export const allMediaFiles = (s: Pick<AppState, 'mediaFiles' | 'pendingUploads'>): MediaFile[] => [
  ...s.mediaFiles,
  ...s.pendingUploads,
];

// ── Store ──────────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const useAppStore = create<AppState>((set, get) => {
  const slideshowEnabled = (): boolean =>
    get().config.slideshow.enabled &&
    hasSlidesAvailable(get());

  const isAlertActive = (): boolean =>
    alertTimeout != null ||
    get().displayState === 'adhanAlert' ||
    get().displayState === 'iqamahAlert';

  const scheduleTvPhase = (): void => {
    inSlideshowPhase = false;
    const tvSecs = clamp(tvScreenTotalSecs(get().config.slideshow), 5, 7200);
    slideshowTimer = setTimeout(() => {
      if (!isAlertActive()) {
        inSlideshowPhase = true;
        set({ displayState: 'slideshow' });
      }
      scheduleSlideshowPhase();
    }, tvSecs * 1000);
  };

  const scheduleSlideshowPhase = (): void => {
    inSlideshowPhase = true;
    const runSecs = clamp(slideshowRunTotalSecs(get().config.slideshow), 5, 3600);
    slideshowTimer = setTimeout(() => {
      inSlideshowPhase = false;
      if (!isAlertActive()) set({ displayState: 'normal' });
      scheduleTvPhase();
    }, runSecs * 1000);
  };

  const restartSlideshowCycle = (): void => {
    if (slideshowTimer) clearTimeout(slideshowTimer);
    slideshowTimer = null;
    inSlideshowPhase = false;
    if (!slideshowEnabled()) {
      if (get().displayState === 'slideshow') set({ displayState: 'normal' });
      return;
    }
    scheduleTvPhase();
  };

  const recalc = (): void => {
    set({ prayers: calculatePrayers(get().config) });
    tick();
  };

  const tick = (): void => {
    const { prayers, config } = get();
    if (prayers.length === 0) return;

    const ss = config.slideshow;
    const { state, prayer } = getCurrentPrayerState(
      prayers,
      ss.pauseBeforeAdhanMins,
      ss.pauseAfterIqamahMins,
    );
    const next = getNextPrayer(prayers);

    let displayState = get().displayState;

    if (state === 'adhanTime' && prayer && lastAlertedAdhan !== prayer.key) {
      lastAlertedAdhan = prayer.key;
      void AudioService.playAlert(config.features.adhanAudio);
      if (displayState !== 'adhanAlert') {
        displayState = 'adhanAlert';
        alertTimeout = Date.now() + 5 * 60_000;
      }
    }
    if (state === 'iqamahCountdown' && prayer && lastAlertedIqamah !== prayer.key) {
      lastAlertedIqamah = prayer.key;
      void AudioService.playAlert(config.features.iqamahAudio);
      if (displayState !== 'iqamahAlert') {
        displayState = 'iqamahAlert';
        alertTimeout = Date.now() + 2 * 60_000;
      }
    }

    const alertIsActive = state === 'adhanTime' || state === 'iqamahCountdown';
    const activePrayer = alertIsActive && prayer?.key !== next?.key ? prayer : null;

    // Auto-dismiss alert overlay after timeout.
    if (alertTimeout != null && Date.now() > alertTimeout) {
      alertTimeout = null;
      displayState = inSlideshowPhase && slideshowEnabled() ? 'slideshow' : 'normal';
    }

    set({ prayerState: state, activePrayer, nextPrayer: next, displayState });
  };

  const scheduleMidnight = (): void => {
    if (midnightTimer) clearTimeout(midnightTimer);
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    midnightTimer = setTimeout(() => {
      recalc();
      scheduleMidnight();
    }, midnight.getTime() - now.getTime());
  };

  const applyConfigSideEffects = (): void => {
    recalc();
    AudioService.setEnabled(get().config.features.audioAlertsEnabled);
    restartSlideshowCycle();
  };

  // Background-cache cloud files not yet in the local cache index.
  const autoCacheMedia = async (): Promise<void> => {
    const files = [...get().mediaFiles];
    for (const f of files) {
      if (get().localCacheIndex[f.id]) continue;
      if (!f.url.startsWith('http')) continue;
      try {
        const path = await MediaCache.download(f.id, f.url, f.filename);
        set({ localCacheIndex: { ...get().localCacheIndex, [f.id]: path } });
      } catch {
        /* offline / CORS — SW runtime cache still covers display */
      }
    }
  };

  // Upload queued device imports to the PHP server + media_library.
  const tryAutoUploadPending = async (): Promise<void> => {
    if (uploadingPending) return;
    const tenantId = get().config.profile.tenantId;
    if (!tenantId || get().pendingUploads.length === 0) return;
    uploadingPending = true;
    set({ isUploadingPending: true });
    const entries = await PendingUploads.loadAll();
    for (const pending of entries) {
      try {
        const uploaded = await MediaLibraryService.uploadFile({
          tenantId,
          blob: pending.blob,
          filename: pending.filename,
          category: pending.category,
          deviceId: pending.deviceId,
        });
        if (pending.isActive && isBackground(uploaded)) {
          await MediaLibraryService.setActiveBackground(tenantId, uploaded.id);
        }
        await PendingUploads.remove(pending.localId);
        set({ pendingUploads: get().pendingUploads.filter((f) => f.id !== pending.localId) });
      } catch (e) {
        console.warn('[Store] pending upload failed', pending.filename, e);
      }
    }
    uploadingPending = false;
    set({ isUploadingPending: false });
    await get().refreshMediaLibrary();
  };

  const loadPendingUploads = async (): Promise<void> => {
    const entries = await PendingUploads.loadAll();
    if (entries.length) set({ pendingUploads: entries.map(pendingToMediaFile) });
  };

  const subscribeMedia = (): void => {
    const tenantId = get().config.profile.tenantId;
    if (!tenantId) return;
    if (mediaChannel) void mediaChannel.unsubscribe();
    mediaChannel = MediaLibraryService.subscribeToLibrary(tenantId, (files) => set({ mediaFiles: files }));
  };

  return {
    config: defaultAppConfig(),
    prayers: [],
    prayerState: 'idle',
    activePrayer: null,
    nextPrayer: null,
    displayState: 'normal',
    isLoaded: false,
    syncStatus: 'localOnly',
    mediaFiles: [],
    pendingUploads: [],
    localCacheIndex: {},
    isUploadingPending: false,

    async init() {
      get().loadConfig();
      if (tickTimer) clearInterval(tickTimer);
      tickTimer = setInterval(tick, 1000);
      scheduleMidnight();
      await loadPendingUploads();
      window.addEventListener('online', () => void tryAutoUploadPending());
      await get().startSyncIfLinked();
      // Re-establish realtime + pull on tab resume (mirrors didChangeAppLifecycleState).
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && isLinked(get().config)) {
          void SupabaseSync.resubscribeIfNeeded();
        }
      });
    },

    async startSyncIfLinked() {
      if (!isLinked(get().config)) {
        set({ syncStatus: 'localOnly' });
        return;
      }
      await SupabaseSync.startSync({
        onStatusChange: (s) => set({ syncStatus: s }),
        onConfigUpdated: () => {
          get().loadConfig();
          void get().refreshMediaLibrary();
        },
      });
      await get().refreshMediaLibrary();
      subscribeMedia();
      void tryAutoUploadPending();
    },

    async onAccountChanged() {
      get().loadConfig();
      await SupabaseSync.stopSync();
      if (mediaChannel) {
        void mediaChannel.unsubscribe();
        mediaChannel = null;
      }
      set({ mediaFiles: [] });
      await get().startSyncIfLinked();
    },

    async refreshMediaLibrary() {
      const tenantId = get().config.profile.tenantId;
      if (!tenantId) return;
      set({ localCacheIndex: await MediaCache.allCachedIds() });
      try {
        const fresh = await MediaLibraryService.fetchFiles(tenantId);
        set({ mediaFiles: fresh });
        localStorage.setItem(MEDIA_SNAPSHOT_KEY, JSON.stringify(fresh.map((f) => ({ ...f, uploadedAt: f.uploadedAt.toISOString() }))));
      } catch {
        // Offline: fall back to the last persisted list.
        const raw = localStorage.getItem(MEDIA_SNAPSHOT_KEY);
        if (raw) {
          try {
            const list = JSON.parse(raw) as MediaFile[];
            set({ mediaFiles: list.map((f) => ({ ...f, uploadedAt: new Date(f.uploadedAt) })) });
          } catch {
            /* ignore */
          }
        }
      }
      // Background-cache any not-yet-cached cloud files (works once SW/online).
      void autoCacheMedia();
    },

    async importLocalFiles(category, files) {
      const tenantId = get().config.profile.tenantId ?? '';
      const deviceId = get().config.meta.deviceId ?? DeviceService.getDeviceId();
      const added: MediaFile[] = [];
      for (const file of Array.from(files)) {
        const localId = PendingUploads.newLocalId();
        const entry: PendingEntry = {
          localId,
          tenantId,
          blob: file,
          filename: file.name,
          category,
          fileSize: file.size,
          mimeType: mimeFromFilename(file.name),
          isActive: false,
          deviceId,
          createdAt: Date.now(),
        };
        await PendingUploads.add(entry);
        added.push(pendingToMediaFile(entry));
      }
      set({ pendingUploads: [...get().pendingUploads, ...added] });
      void tryAutoUploadPending();
    },

    async setPendingFileAsBackground(localId) {
      for (const p of get().pendingUploads) {
        if (isBackground(p) && p.isActiveBackground) await PendingUploads.update(p.id, { isActive: false });
      }
      await PendingUploads.update(localId, { isActive: true });
      const entries = await PendingUploads.loadAll();
      set({ pendingUploads: entries.map(pendingToMediaFile) });
    },

    async deletePendingFile(localId) {
      await PendingUploads.remove(localId);
      set({ pendingUploads: get().pendingUploads.filter((f) => f.id !== localId) });
    },

    async downloadMediaFile(file, onProgress) {
      const path = await MediaCache.download(file.id, file.url, file.filename, onProgress);
      set({ localCacheIndex: { ...get().localCacheIndex, [file.id]: path } });
    },

    async evictFromCache(fileId) {
      await MediaCache.evict(fileId);
      const { [fileId]: _removed, ...rest } = get().localCacheIndex;
      set({ localCacheIndex: rest });
    },

    isFileLocal(fileId) {
      return fileId in get().localCacheIndex || get().pendingUploads.some((f) => f.id === fileId);
    },

    loadConfig() {
      const config = StorageService.loadConfig();
      set({ config, isLoaded: true });
      applyConfigSideEffects();
    },

    async saveConfig(config: AppConfig) {
      set({ config });
      StorageService.saveConfig(config);
      applyConfigSideEffects();
      if (isLinked(config)) {
        set({ syncStatus: 'syncing' });
        try {
          await SupabaseSync.pushConfigToCloud(config);
          set({ syncStatus: 'synced' });
        } catch (e) {
          console.warn('[Store] push failed', e);
          set({ syncStatus: 'syncError' });
        }
      }
    },

    dismissAlert() {
      alertTimeout = null;
      const ds = get().displayState;
      if (ds === 'adhanAlert' || ds === 'iqamahAlert') {
        set({ displayState: inSlideshowPhase && slideshowEnabled() ? 'slideshow' : 'normal' });
      }
    },

    setSyncStatus(status: SyncStatus) {
      set({ syncStatus: status });
    },
  };
});
