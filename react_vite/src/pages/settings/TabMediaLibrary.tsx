/**
 * TabMediaLibrary.tsx
 * Backgrounds & slides in a single scrolling window -- no category tabs to hunt
 * through, every image is visible at once. Slides come first (they are what the
 * congregation actually reads); backgrounds follow. Each orientation row owns
 * its own add buttons so the upload target is never ambiguous.
 * Acts on the live store (changes apply immediately, no draft).
 */
import { useRef, useState } from 'react';
import { MediaFile, fileSizeLabel } from '../../core/mediaFile';
import { MediaLibraryService } from '../../core/mediaLibraryService';
import { allMediaFiles, useAppStore } from '../../store/appStore';
import { isLinked } from '../../core/appConfig';
import { SettingsTabScaffold, useIsNarrow, useTheme } from './helpers';
import ImageCropDialog from '../../components/ImageCropDialog';

/**
 * Frame each category is shown in, so the crop dialog outlines the real target
 * rather than a generic square.
 */
const ASPECT_FOR_CATEGORY: Record<string, number> = {
  background_landscape: 16 / 9,
  slide_landscape: 16 / 9,
  background_portrait: 9 / 16,
  slide_portrait: 9 / 16,
};

type Destination = 'cloud' | 'local';

export default function TabMediaLibrary() {
  const t = useTheme();
  const narrow = useIsNarrow();
  const config = useAppStore((s) => s.config);
  const mediaFiles = useAppStore((s) => s.mediaFiles);
  const pendingUploads = useAppStore((s) => s.pendingUploads);
  const isUploadingPending = useAppStore((s) => s.isUploadingPending);
  const refreshMediaLibrary = useAppStore((s) => s.refreshMediaLibrary);
  const importLocalFiles = useAppStore((s) => s.importLocalFiles);
  const setPendingAsBg = useAppStore((s) => s.setPendingFileAsBackground);
  const deletePending = useAppStore((s) => s.deletePendingFile);
  const isFileLocal = useAppStore((s) => s.isFileLocal);

  const linked = isLinked(config);
  const tenantId = config.profile.tenantId ?? '';
  const all = allMediaFiles({ mediaFiles, pendingUploads });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Which row + destination the open file picker is filling. Held in refs so
  // the input's onChange sees the values without a re-render round trip.
  const pickCategory = useRef('slide_landscape');
  const pickDestination = useRef<Destination>('local');

  // Files wait here while the admin fits each one to the frame.
  const [cropQueue, setCropQueue] = useState<File[]>([]);
  const [cropIndex, setCropIndex] = useState(0);
  const [cropped, setCropped] = useState<File[]>([]);
  const [cropCategory, setCropCategory] = useState('slide_landscape');
  const [cropDestination, setCropDestination] = useState<Destination>('local');

  const openPicker = (category: string, destination: Destination) => {
    pickCategory.current = category;
    pickDestination.current = destination;
    fileInput.current?.click();
  };

  const beginCrop = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setCropCategory(pickCategory.current);
    setCropDestination(pickDestination.current);
    setCropQueue(Array.from(files));
    setCropIndex(0);
    setCropped([]);
  };

  /** Called once per image, with either the cropped file or the original. */
  const advanceCrop = async (result: File) => {
    const done = [...cropped, result];
    if (cropIndex + 1 < cropQueue.length) {
      setCropped(done);
      setCropIndex(cropIndex + 1);
      return;
    }
    // Queue finished -- hand everything to the existing upload/import path.
    setCropQueue([]);
    setCropped([]);
    setCropIndex(0);
    if (cropDestination === 'cloud') await handleUpload(done, cropCategory);
    else await importLocalFiles(cropCategory, done);
  };

  const cancelCrop = () => {
    setCropQueue([]);
    setCropped([]);
    setCropIndex(0);
  };

  const handleUpload = async (files: File[] | null, category: string) => {
    if (!files || !tenantId) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of files) {
        await MediaLibraryService.uploadFile({ tenantId, blob: file, filename: file.name, category, deviceId: config.meta.deviceId });
      }
      await refreshMediaLibrary();
    } catch (e) {
      setError(`Upload failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const setBackground = async (file: MediaFile) => {
    if (file.isPendingUpload) return setPendingAsBg(file.id);
    if (!tenantId) return;
    try {
      await MediaLibraryService.setActiveBackground(tenantId, file.id);
      await refreshMediaLibrary();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const clearBackground = async (category: string) => {
    if (!tenantId) return;
    await MediaLibraryService.clearActiveBackgroundForCategory(tenantId, category);
    await refreshMediaLibrary();
  };

  const remove = async (file: MediaFile) => {
    if (!window.confirm(`Delete "${file.filename}"? This cannot be undone.`)) return;
    try {
      if (file.isPendingUpload) await deletePending(file.id);
      else {
        await MediaLibraryService.deleteFile(tenantId, file.id);
        await refreshMediaLibrary();
      }
    } catch (e) {
      setError(`Delete failed: ${(e as Error).message}`);
    }
  };

  const filesIn = (category: string) => all.filter((f) => f.category === category);

  return (
    <SettingsTabScaffold title="Media Library">
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          beginCrop(e.target.files);
          // Cleared so picking the same file twice still fires onChange.
          e.target.value = '';
        }}
      />

      {/* Status strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: t.textSecondary, marginBottom: 12, flexWrap: 'wrap' }}>
        {linked ? (
          <>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'rgba(20,184,166,0.12)', border: `1px solid ${t.accentTeal}55`, color: t.accentTeal, fontWeight: 600 }}>
              ☁️ Synced to cloud
            </span>
            {isUploadingPending && <span style={{ color: '#FB923C' }}>Uploading…</span>}
            {busy && <span style={{ color: t.accentTeal }}>Working…</span>}
          </>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%', padding: '4px 10px', borderRadius: 999, background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.45)', color: '#FB923C', fontWeight: 600 }}>
            {narrow ? '📱 Offline only — not synced' : '📱 Offline only — link an account in Cloud & Sync to share with all displays'}
          </span>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>
            {all.length} image{all.length === 1 ? '' : 's'}
          </span>
          {linked && (
            <button onClick={() => refreshMediaLibrary()} style={{ color: t.textSecondary }} title="Refresh">
              🔄
            </button>
          )}
        </span>
      </div>

      {error && (
        <div style={{ padding: 10, borderRadius: 6, background: `${t.accentRed}22`, border: `1px solid ${t.accentRed}55`, color: t.accentRed, fontSize: 12, marginBottom: 10 }}>
          {error}
        </div>
      )}

      {/* Slides first -- they are the content people actually read on screen. */}
      <SectionHeader
        icon="🖼️"
        title="Slideshow Slides"
        subtitle="Rotate on the display between prayer times"
        count={all.filter((f) => f.category.startsWith('slide')).length}
      />
      <MediaRow
        category="slide_landscape"
        files={filesIn('slide_landscape')}
        label="Landscape"
        hint="16:9 — TVs & monitors"
        kind="slide"
        linked={linked}
        onAdd={openPicker}
        isFileLocal={isFileLocal}
        onDelete={remove}
      />
      <MediaRow
        category="slide_portrait"
        files={filesIn('slide_portrait')}
        label="Portrait"
        hint="9:16 — vertical screens"
        kind="slide"
        linked={linked}
        onAdd={openPicker}
        isFileLocal={isFileLocal}
        onDelete={remove}
      />

      <SectionHeader
        icon="📺"
        title="Backgrounds"
        subtitle="Wallpaper behind the prayer times — one active per orientation"
        count={all.filter((f) => f.category.startsWith('background')).length}
      />
      <MediaRow
        category="background_landscape"
        files={filesIn('background_landscape')}
        label="Landscape"
        hint="16:9 — TVs & monitors"
        kind="background"
        linked={linked}
        onAdd={openPicker}
        isFileLocal={isFileLocal}
        onDelete={remove}
        onSetBg={setBackground}
        onClearBg={clearBackground}
      />
      <MediaRow
        category="background_portrait"
        files={filesIn('background_portrait')}
        label="Portrait"
        hint="9:16 — vertical screens"
        kind="background"
        linked={linked}
        onAdd={openPicker}
        isFileLocal={isFileLocal}
        onDelete={remove}
        onSetBg={setBackground}
        onClearBg={clearBackground}
      />

      {cropQueue[cropIndex] && (
        <ImageCropDialog
          // Keyed by position so the dialog fully resets between images rather
          // than carrying the previous one's zoom and rotation over.
          key={cropIndex}
          file={cropQueue[cropIndex]}
          aspect={ASPECT_FOR_CATEGORY[cropCategory] ?? 16 / 9}
          index={cropIndex}
          total={cropQueue.length}
          onApply={advanceCrop}
          onSkip={() => advanceCrop(cropQueue[cropIndex])}
          onCancel={cancelCrop}
        />
      )}
    </SettingsTabScaffold>
  );
}

function SectionHeader({ icon, title, subtitle, count }: { icon: string; title: string; subtitle: string; count: number }) {
  const t = useTheme();
  const narrow = useIsNarrow();
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '18px 0 10px' }}>
      <span style={{ fontSize: 15, fontWeight: 700, color: t.textPrimary }}>
        {icon} {title}
      </span>
      <span style={{ fontSize: 11, fontWeight: 700, color: t.accentTeal, background: 'rgba(20,184,166,0.14)', padding: '2px 8px', borderRadius: 999 }}>{count}</span>
      {!narrow && (
        <span style={{ fontSize: 11, color: t.textSecondary, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</span>
      )}
    </div>
  );
}

function MediaRow({
  category,
  files,
  label,
  hint,
  kind,
  linked,
  onAdd,
  isFileLocal,
  onDelete,
  onSetBg,
  onClearBg,
}: {
  category: string;
  files: MediaFile[];
  label: string;
  hint: string;
  kind: 'slide' | 'background';
  linked: boolean;
  onAdd: (category: string, destination: Destination) => void;
  isFileLocal: (id: string) => boolean;
  onDelete: (f: MediaFile) => void;
  onSetBg?: (f: MediaFile) => void;
  onClearBg?: (category: string) => void;
}) {
  const t = useTheme();
  const narrow = useIsNarrow();
  const portrait = category.endsWith('portrait');
  const isBg = kind === 'background';
  const activeBg = isBg ? files.find((f) => f.isActiveBackground) : undefined;
  // Slides carry the visual weight; backgrounds sit one size down. Phones drop
  // a step again so two cards still fit side by side.
  const base = isBg ? (portrait ? 74 : 124) : portrait ? 92 : 160;
  const width = Math.max(narrow ? Math.round(base * (portrait ? 0.85 : 0.78)) : base, 80);
  const height = portrait ? Math.round((width * 16) / 9) : Math.round((width * 9) / 16);

  return (
    <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, background: t.bgElevated, border: `1px solid ${t.borderSubtle}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary }}>{label}</span>
        {!narrow && <span style={{ fontSize: 11, color: t.textSecondary }}>{hint}</span>}
        <span style={{ fontSize: 11, color: t.textSecondary }}>· {files.length}</span>
        {isBg && (
          <span style={{ fontSize: 11, color: activeBg ? t.accentTeal : t.textSecondary }}>
            {activeBg ? `· ✅ Active: ${activeBg.filename}` : '· no background set'}
          </span>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {isBg && activeBg && (
            <button
              onClick={() => onClearBg?.(category)}
              style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, color: t.accentRed, background: `${t.accentRed}14`, border: `1px solid ${t.accentRed}44` }}
            >
              Clear active
            </button>
          )}
          {linked && (
            <button
              onClick={() => onAdd(category, 'cloud')}
              style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, color: t.accentTeal, background: 'rgba(20,184,166,0.14)', border: `1px solid ${t.accentTeal}55` }}
            >
              ☁️ Cloud
            </button>
          )}
          <button
            onClick={() => onAdd(category, 'local')}
            style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, color: '#FB923C', background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.45)' }}
          >
            📱 Device
          </button>
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {files.map((f) => (
          <FileCard
            key={f.id}
            file={f}
            width={width}
            height={height}
            showSetBg={isBg}
            local={isFileLocal(f.id)}
            onSetBg={() => onSetBg?.(f)}
            onClear={() => onClearBg?.(category)}
            onDelete={() => onDelete(f)}
          />
        ))}
        {/* An empty row collapses to a slim strip so four empty rows do not
            turn the page into a long scroll of placeholders. */}
        <button
          onClick={() => onAdd(category, linked ? 'cloud' : 'local')}
          title="Add images"
          style={{
            width: files.length === 0 ? '100%' : width,
            height: files.length === 0 ? 52 : height + 34,
            borderRadius: 10,
            border: `1.5px dashed ${t.borderSubtle}`,
            background: 'transparent',
            color: t.textSecondary,
            display: 'flex',
            flexDirection: files.length === 0 ? 'row' : 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: files.length === 0 ? 8 : 4,
            fontSize: files.length === 0 ? 13 : 11,
          }}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>+</span>
          {files.length === 0 ? 'Add images' : 'Add'}
        </button>
      </div>
    </div>
  );
}

function FileCard({
  file,
  width,
  height,
  showSetBg,
  local,
  onSetBg,
  onClear,
  onDelete,
}: {
  file: MediaFile;
  width: number;
  height: number;
  showSetBg: boolean;
  local: boolean;
  onSetBg: () => void;
  onClear: () => void;
  onDelete: () => void;
}) {
  const t = useTheme();
  const highlight = file.isPendingUpload ? '#FB923C80' : file.isActiveBackground ? t.accentTeal : t.borderSubtle;
  return (
    <div style={{ width, borderRadius: 10, background: t.bgSurface, border: `${file.isActiveBackground || file.isPendingUpload ? 2 : 1}px solid ${highlight}`, overflow: 'hidden' }}>
      <div style={{ position: 'relative' }}>
        <img src={file.localFilePath ?? file.url} alt={file.filename} style={{ width: '100%', height, objectFit: 'cover', display: 'block' }} />
        {file.isActiveBackground && (
          <span style={{ position: 'absolute', top: 5, left: 5, background: t.accentTeal, color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 5px', borderRadius: 4 }}>📺 ACTIVE</span>
        )}
        <span
          title={file.isPendingUpload ? 'Waiting to upload' : local ? 'Downloaded on this device' : 'In the cloud'}
          style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(0,0,0,0.65)', fontSize: 8, padding: '2px 5px', borderRadius: 4, color: file.isPendingUpload ? '#FB923C' : local ? '#4ADE80' : '#94A3B8' }}
        >
          {file.isPendingUpload ? '⏳' : local ? '📱' : '☁️'}
        </span>
        <button
          onClick={onDelete}
          title="Delete"
          style={{ position: 'absolute', bottom: 5, right: 5, width: 24, height: 24, borderRadius: 6, fontSize: 11, color: '#fff', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)' }}
        >
          🗑
        </button>
      </div>
      <div style={{ padding: '5px 7px' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: t.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={file.filename}>
          {file.filename}
        </div>
        {showSetBg ? (
          <button
            onClick={file.isActiveBackground ? onClear : onSetBg}
            style={{ width: '100%', marginTop: 4, padding: '4px 0', borderRadius: 5, fontSize: 10, fontWeight: 700, color: t.accentTeal, background: 'rgba(20,184,166,0.15)', border: `1px solid ${t.accentTeal}55` }}
          >
            {file.isActiveBackground ? 'Clear' : width < 110 ? 'Set BG' : 'Set as background'}
          </button>
        ) : (
          <div style={{ fontSize: 9, color: t.textSecondary }}>{fileSizeLabel(file)}</div>
        )}
      </div>
    </div>
  );
}
