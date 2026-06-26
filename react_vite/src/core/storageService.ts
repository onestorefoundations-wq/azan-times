/**
 * storageService.ts
 * localStorage-backed config store. Mirrors flutter_app/lib/core/storage_service.dart.
 * PIN is hashed with Web Crypto SHA-256 → hex (identical output to Dart's crypto.sha256),
 * so PINs set on Flutter and React displays interoperate.
 */

import {
  AppConfig,
  MasjidProfile,
  SyncMeta,
  appConfigFromStorageMap,
  defaultFeaturesFormat,
  defaultJumuahSettings,
  defaultMasjidProfile,
  defaultSlideshowSettings,
  defaultSyncMeta,
  defaultTickerSettings,
  defaultTimeAdjustments,
  featuresFormatToJson,
  jumuahSettingsToJson,
  masjidProfileToJson,
  slideshowSettingsToJson,
  syncMetaToJson,
  tickerSettingsToJson,
  timeAdjustmentsToJson,
} from './appConfig';

const K = {
  masjidProfile: 'masjid_profile',
  timeAdjustments: 'time_adjustments',
  featuresFormat: 'features_format',
  slideshowSettings: 'slideshow_settings',
  jumuahSettings: 'jumuah_settings',
  tickerSettings: 'ticker_settings',
  syncMeta: 'sync_meta',
  pinHash: 'local_admin_pin_hash',
  deviceId: 'device_id',
  pinEnabled: 'local_admin_pin_enabled',
} as const;

// ── SHA-256 hex (matches Dart sha256.convert(utf8.encode(pin)).toString()) ──

export const hashPin = async (pin: string): Promise<string> => {
  const data = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const saveSection = (key: string, data: Record<string, unknown>) =>
  localStorage.setItem(key, JSON.stringify(data));

const loadSection = (key: string): Record<string, any> | null => {
  const raw = localStorage.getItem(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const StorageService = {
  /** Seed defaults on first run (idempotent). */
  async init(): Promise<void> {
    if (!localStorage.getItem(K.masjidProfile))
      saveSection(K.masjidProfile, masjidProfileToJson(defaultMasjidProfile()));
    if (!localStorage.getItem(K.timeAdjustments))
      saveSection(K.timeAdjustments, timeAdjustmentsToJson(defaultTimeAdjustments()));
    if (!localStorage.getItem(K.featuresFormat))
      saveSection(K.featuresFormat, featuresFormatToJson(defaultFeaturesFormat()));
    if (!localStorage.getItem(K.slideshowSettings))
      saveSection(K.slideshowSettings, slideshowSettingsToJson(defaultSlideshowSettings()));
    if (!localStorage.getItem(K.jumuahSettings))
      saveSection(K.jumuahSettings, jumuahSettingsToJson(defaultJumuahSettings()));
    if (!localStorage.getItem(K.tickerSettings))
      saveSection(K.tickerSettings, tickerSettingsToJson(defaultTickerSettings()));
    if (!localStorage.getItem(K.syncMeta))
      saveSection(K.syncMeta, syncMetaToJson(defaultSyncMeta()));
    if (!localStorage.getItem(K.pinHash))
      localStorage.setItem(K.pinHash, await hashPin('1234'));
  },

  loadConfig(): AppConfig {
    const map = {
      masjid_profile: loadSection(K.masjidProfile),
      time_adjustments: loadSection(K.timeAdjustments),
      features_format: loadSection(K.featuresFormat),
      slideshow_settings: loadSection(K.slideshowSettings),
      jumuah_settings: loadSection(K.jumuahSettings),
      ticker_settings: loadSection(K.tickerSettings),
      sync_meta: loadSection(K.syncMeta),
    };
    const config = appConfigFromStorageMap(map);
    // Merge live PIN values so they ride along on the next cloud push.
    const livePinEnabled = localStorage.getItem(K.pinEnabled) === 'true';
    const livePinHash = localStorage.getItem(K.pinHash);
    return {
      ...config,
      meta: { ...config.meta, pinEnabled: livePinEnabled, pinHash: livePinHash },
    };
  },

  saveConfig(config: AppConfig): void {
    saveSection(K.masjidProfile, masjidProfileToJson(config.profile));
    saveSection(K.timeAdjustments, timeAdjustmentsToJson(config.adjustments));
    saveSection(K.featuresFormat, featuresFormatToJson(config.features));
    saveSection(K.slideshowSettings, slideshowSettingsToJson(config.slideshow));
    saveSection(K.jumuahSettings, jumuahSettingsToJson(config.jumuah));
    saveSection(K.tickerSettings, tickerSettingsToJson(config.ticker));
    saveSection(K.syncMeta, syncMetaToJson(config.meta));
    localStorage.setItem(K.pinEnabled, String(config.meta.pinEnabled));
    if (config.meta.pinHash) localStorage.setItem(K.pinHash, config.meta.pinHash);
  },

  saveSyncMeta(meta: SyncMeta): void {
    saveSection(K.syncMeta, syncMetaToJson(meta));
  },

  saveProfile(profile: MasjidProfile): void {
    saveSection(K.masjidProfile, masjidProfileToJson(profile));
  },

  // ── PIN ──
  async verifyPin(pin: string): Promise<boolean> {
    const stored = localStorage.getItem(K.pinHash);
    if (stored == null) return pin === '1234';
    return (await hashPin(pin)) === stored;
  },

  async setPin(pin: string): Promise<void> {
    localStorage.setItem(K.pinHash, await hashPin(pin));
  },

  isPinEnabled(): boolean {
    return localStorage.getItem(K.pinEnabled) === 'true';
  },

  setPinEnabled(enabled: boolean): void {
    localStorage.setItem(K.pinEnabled, String(enabled));
  },

  // ── Device ID ──
  getDeviceId(): string | null {
    return localStorage.getItem(K.deviceId);
  },

  setDeviceId(id: string): void {
    localStorage.setItem(K.deviceId, id);
  },
};
