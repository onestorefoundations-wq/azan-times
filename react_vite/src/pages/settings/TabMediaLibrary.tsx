/**
 * TabMediaLibrary.tsx
 * Backgrounds & slides. Port of tab_media_library.dart.
 * Category tabs, upload-to-cloud, import-from-device (offline queue),
 * set/clear background, per-file sync badges, download/evict, delete.
 * Acts on the live store (changes apply immediately, no draft).
 */
import { useRef, useState } from 'react';
import { MediaFile, fileSizeLabel } from '../../core/mediaFile';
import { MediaLibraryService } from '../../core/mediaLibraryService';
import { allMediaFiles, useAppStore } from '../../store/appStore';
import { isLinked } from '../../core/appConfig';
import { SettingsTabScaffold, useTheme } from './helpers';

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'background_landscape', label: 'BG Landscape' },
  { key: 'background_portrait', label: 'BG Portrait' },
  { key: 'slide_landscape', label: 'Slides Landscape' },
  { key: 'slide_portrait', label: 'Slides Portrait' },
];

export default function TabMediaLibrary() {
  const t = useTheme();
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

  const [cat, setCat] = useState('background_landscape');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);

  const filesInCat = all.filter((f) => f.category === cat);
  const isBg = cat.startsWith('background');

  const handleUpload = async (files: FileList | null) => {
    if (!files || !tenantId) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        await MediaLibraryService.uploadFile({ tenantId, blob: file, filename: file.name, category: cat, deviceId: config.meta.deviceId });
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

  const clearBackground = async () => {
    if (!tenantId) return;
    await MediaLibraryService.clearActiveBackgroundForCategory(tenantId, cat);
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

  return (
    <SettingsTabScaffold title="Media Library">
      {!linked && (
        <div style={{ padding: 16, borderRadius: 8, background: t.bgElevated, border: `1px solid ${t.borderSubtle}`, color: t.textSecondary, fontSize: 13, marginBottom: 12 }}>
          ℹ️ You can import images from your device now. Link an account (Cloud &amp; Sync) to upload to the cloud and all displays.
        </div>
      )}

      {linked && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.textSecondary, marginBottom: 8 }}>
          ☁️ Synced to account: {tenantId}
          {isUploadingPending && <span style={{ color: '#FB923C' }}>· Uploading…</span>}
          <button onClick={() => refreshMediaLibrary()} style={{ marginLeft: 'auto', color: t.textSecondary }} title="Refresh">
            🔄
          </button>
        </div>
      )}

      {error && (
        <div style={{ padding: 10, borderRadius: 6, background: `${t.accentRed}22`, border: `1px solid ${t.accentRed}55`, color: t.accentRed, fontSize: 12, marginBottom: 10 }}>
          {error}
        </div>
      )}

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
        {CATEGORIES.map((c) => {
          const active = cat === c.key;
          const count = all.filter((f) => f.category === c.key).length;
          return (
            <button
              key={c.key}
              onClick={() => setCat(c.key)}
              style={{
                flex: 1,
                padding: '8px 6px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                color: active ? t.accentTeal : t.textSecondary,
                background: active ? 'rgba(20,184,166,0.14)' : t.bgElevated,
                border: `${active ? 1.5 : 1}px solid ${active ? t.accentTeal : t.borderSubtle}`,
              }}
            >
              {c.label}
              <div style={{ fontSize: 10, opacity: 0.7 }}>{count} file{count === 1 ? '' : 's'}</div>
            </button>
          );
        })}
      </div>

      {/* Active background strip */}
      {isBg && <ActiveBgStrip cat={cat} onClear={clearBackground} />}

      {/* Grid */}
      {filesInCat.length === 0 ? (
        <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: t.bgElevated, border: `1px solid ${t.borderSubtle}`, color: t.textSecondary, fontSize: 13 }}>
          No images yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {filesInCat.map((f) => (
            <FileCard key={f.id} file={f} showSetBg={isBg} local={isFileLocal(f.id)} onSetBg={() => setBackground(f)} onClear={clearBackground} onDelete={() => remove(f)} />
          ))}
        </div>
      )}

      {/* Upload + import */}
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {linked && (
          <>
            <input ref={uploadInput} type="file" accept="image/*" multiple hidden onChange={(e) => handleUpload(e.target.files)} />
            <button
              onClick={() => uploadInput.current?.click()}
              disabled={busy}
              style={{ padding: 14, borderRadius: 8, background: 'rgba(20,184,166,0.12)', border: `1px solid ${t.accentTeal}80`, color: t.accentTeal, fontWeight: 600 }}
            >
              {busy ? 'Uploading…' : '☁️ Upload to Cloud'}
            </button>
          </>
        )}
        <input ref={importInput} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && importLocalFiles(cat, e.target.files)} />
        <button
          onClick={() => importInput.current?.click()}
          style={{ padding: 14, borderRadius: 8, background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.45)', color: '#FB923C', fontWeight: 600 }}
        >
          📱 Import from Device (works offline)
        </button>
      </div>
    </SettingsTabScaffold>
  );
}

function ActiveBgStrip({ cat, onClear }: { cat: string; onClear: () => void }) {
  const t = useTheme();
  const mediaFiles = useAppStore((s) => s.mediaFiles);
  const pendingUploads = useAppStore((s) => s.pendingUploads);
  const active =
    mediaFiles.find((f) => f.category === cat && f.isActiveBackground && !f.isDeleted) ??
    pendingUploads.find((f) => f.category === cat && f.isActiveBackground);

  if (!active) {
    return (
      <div style={{ padding: '10px 12px', borderRadius: 8, background: t.bgElevated, border: `1px solid ${t.borderSubtle}`, color: t.textSecondary, fontSize: 12, marginBottom: 12 }}>
        📺 No background set — tap an image below to activate it.
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, borderRadius: 8, background: 'rgba(20,184,166,0.08)', border: `1px solid ${t.accentTeal}66`, marginBottom: 12 }}>
      <img src={active.localFilePath ?? active.url} alt="" style={{ width: 64, height: 40, objectFit: 'cover', borderRadius: 6 }} />
      <div style={{ flex: 1 }}>
        <div style={{ color: t.accentTeal, fontSize: 12, fontWeight: 700 }}>✅ Active on TV</div>
        <div style={{ color: t.textSecondary, fontSize: 11 }}>{active.filename}</div>
      </div>
      <button onClick={onClear} style={{ color: t.accentRed, fontSize: 12 }}>
        Clear
      </button>
    </div>
  );
}

function FileCard({
  file,
  showSetBg,
  local,
  onSetBg,
  onClear,
  onDelete,
}: {
  file: MediaFile;
  showSetBg: boolean;
  local: boolean;
  onSetBg: () => void;
  onClear: () => void;
  onDelete: () => void;
}) {
  const t = useTheme();
  return (
    <div style={{ width: 140, borderRadius: 10, background: t.bgElevated, border: `${file.isActiveBackground || file.isPendingUpload ? 2 : 1}px solid ${file.isPendingUpload ? '#FB923C80' : file.isActiveBackground ? t.accentTeal : t.borderSubtle}`, overflow: 'hidden' }}>
      <div style={{ position: 'relative' }}>
        <img src={file.localFilePath ?? file.url} alt={file.filename} style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
        {file.isActiveBackground && (
          <span style={{ position: 'absolute', top: 6, left: 6, background: t.accentTeal, color: '#fff', fontSize: 9, fontWeight: 800, padding: '3px 6px', borderRadius: 4 }}>📺 ACTIVE</span>
        )}
        <span style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.65)', fontSize: 8, padding: '2px 5px', borderRadius: 4, color: file.isPendingUpload ? '#FB923C' : local ? '#4ADE80' : '#94A3B8' }}>
          {file.isPendingUpload ? '⏳ Pending' : local ? '📱 Synced' : '☁️ Cloud'}
        </span>
      </div>
      <div style={{ padding: '6px 8px' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: t.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.filename}</div>
        <div style={{ fontSize: 9, color: t.textSecondary }}>{fileSizeLabel(file)}</div>
        <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
          {showSetBg && (
            <button
              onClick={file.isActiveBackground ? onClear : onSetBg}
              style={{ flex: 1, padding: '5px 0', borderRadius: 5, fontSize: 10, fontWeight: 700, color: t.accentTeal, background: 'rgba(20,184,166,0.15)', border: `1px solid ${t.accentTeal}55` }}
            >
              {file.isActiveBackground ? 'Clear' : 'Set BG'}
            </button>
          )}
          <button onClick={onDelete} style={{ padding: '5px 8px', borderRadius: 5, fontSize: 12, color: t.accentRed, background: `${t.accentRed}1A`, border: `1px solid ${t.accentRed}55` }}>
            🗑
          </button>
        </div>
      </div>
    </div>
  );
}
