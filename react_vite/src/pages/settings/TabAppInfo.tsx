/**
 * TabAppInfo.tsx
 * PWA & App management tab: install/uninstall, version info, manual update check.
 */
import { useEffect, useRef, useState } from 'react';
import {
  PrimaryButton,
  SettingsSectionHeader,
  SettingsTabScaffold,
  useTheme,
} from './helpers';

declare const __BUILD_TIME__: string;

// ── Types ────────────────────────────────────────────────────────

type InstallState = 'installed' | 'prompt-ready' | 'unavailable';
type UpdateState = 'idle' | 'checking' | 'up-to-date' | 'updating' | 'updated' | 'offline' | 'error';
type SwState = 'none' | 'installing' | 'waiting' | 'active';

// ── Helpers ──────────────────────────────────────────────────────

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

async function clearAllCaches() {
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.map((k) => caches.delete(k)));
}

// ── Row components ───────────────────────────────────────────────

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  const t = useTheme();
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 0',
        borderBottom: `1px solid ${t.borderSubtle}`,
        gap: 12,
      }}
    >
      <span style={{ fontSize: 13, color: t.textSecondary, flexShrink: 0 }}>{label}</span>
      <span
        style={{
          fontSize: 13,
          color: t.textPrimary,
          fontFamily: mono ? 'monospace' : undefined,
          textAlign: 'right',
          wordBreak: 'break-all',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  const t = useTheme();
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: ok ? 'rgba(20,184,166,0.15)' : 'rgba(148,163,184,0.15)',
        color: ok ? t.accentTeal : t.textSecondary,
      }}
    >
      <span style={{ fontSize: 8 }}>●</span>
      {label}
    </span>
  );
}

// ── Main component ───────────────────────────────────────────────

export default function TabAppInfo() {
  const t = useTheme();

  // ── PWA install prompt ───────────────────────────────────────
  const deferredPrompt = useRef<any>(null);
  const [installState, setInstallState] = useState<InstallState>('unavailable');

  useEffect(() => {
    // Already installed as PWA?
    const mq = window.matchMedia('(display-mode: standalone)');
    if (mq.matches) {
      setInstallState('installed');
      return;
    }
    mq.addEventListener('change', (e) => {
      if (e.matches) setInstallState('installed');
    });

    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setInstallState('prompt-ready');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', () => setInstallState('installed'));
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === 'accepted') setInstallState('installed');
    deferredPrompt.current = null;
  };

  // ── Service worker state ────────────────────────────────────
  const [swState, setSwState] = useState<SwState>('none');

  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw) return;

    const refresh = async () => {
      const reg = await sw.getRegistration();
      if (!reg) { setSwState('none'); return; }
      if (reg.installing) setSwState('installing');
      else if (reg.waiting) setSwState('waiting');
      else if (reg.active) setSwState('active');
      else setSwState('none');
    };
    void refresh();

    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, []);

  // ── Update check ────────────────────────────────────────────
  const [updateState, setUpdateState] = useState<UpdateState>('idle');
  const [deployedVersion, setDeployedVersion] = useState<string | null>(null);

  const checkForUpdate = async () => {
    if (!navigator.onLine) { setUpdateState('offline'); return; }
    setUpdateState('checking');
    try {
      // Trigger SW to check for a new service worker.
      const reg = await navigator.serviceWorker?.getRegistration();
      await reg?.update();

      // Also fetch version.json to compare build times.
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('fetch failed');
      const { v } = (await res.json()) as { v?: string };
      setDeployedVersion(v ?? null);

      if (v && v !== __BUILD_TIME__) {
        setUpdateState('updating');
        await clearAllCaches();
        setTimeout(() => window.location.reload(), 800);
      } else {
        setUpdateState('up-to-date');
        setTimeout(() => setUpdateState('idle'), 4000);
      }
    } catch {
      setUpdateState('error');
      setTimeout(() => setUpdateState('idle'), 4000);
    }
  };

  // ── Cache info ──────────────────────────────────────────────
  const [cacheSize, setCacheSize] = useState<string>('—');

  useEffect(() => {
    const measure = async () => {
      if (!('caches' in window)) return;
      try {
        // Use Storage API if available for accurate total.
        if (navigator.storage?.estimate) {
          const { usage } = await navigator.storage.estimate();
          if (usage != null) {
            setCacheSize(usage < 1024 * 1024
              ? `${Math.round(usage / 1024)} KB`
              : `${(usage / 1024 / 1024).toFixed(1)} MB`);
            return;
          }
        }
        const keys = await caches.keys();
        setCacheSize(`${keys.length} cache(s)`);
      } catch {
        setCacheSize('unknown');
      }
    };
    void measure();
  }, []);

  const clearCache = async () => {
    await clearAllCaches();
    window.location.reload();
  };

  // ── Update button label ─────────────────────────────────────
  const updateLabel: Record<UpdateState, string> = {
    idle: 'Check for Update',
    checking: 'Checking…',
    'up-to-date': '✓ Up to date',
    updating: 'Update found — reloading…',
    updated: '✓ Updated!',
    offline: 'No internet connection',
    error: 'Check failed — retry?',
  };

  const swLabel: Record<SwState, string> = {
    none: 'Not registered',
    installing: 'Installing…',
    waiting: 'Waiting to activate',
    active: 'Active',
  };

  const isOnline = navigator.onLine;

  return (
    <SettingsTabScaffold title="App & PWA Info">

      {/* ── Version ─────────────────────────────────────────── */}
      <SettingsSectionHeader title="Version" />
      <InfoRow label="Running build" value={fmt(__BUILD_TIME__)} />
      {deployedVersion && deployedVersion !== __BUILD_TIME__ && (
        <InfoRow label="Server build" value={fmt(deployedVersion)} />
      )}
      <InfoRow label="Build stamp" value={__BUILD_TIME__} mono />
      <div style={{ height: 8 }} />

      {/* ── Update ──────────────────────────────────────────── */}
      <SettingsSectionHeader title="Updates" />
      <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 12, lineHeight: 1.6 }}>
        The app auto-updates in the background when connected. Use this to check immediately.
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <PrimaryButton
          onClick={checkForUpdate}
          disabled={updateState === 'checking' || updateState === 'updating'}
        >
          {updateLabel[updateState]}
        </PrimaryButton>
        <StatusBadge ok={isOnline} label={isOnline ? 'Online' : 'Offline'} />
      </div>
      <div style={{ height: 16 }} />

      {/* ── Service Worker ──────────────────────────────────── */}
      <SettingsSectionHeader title="Service Worker" />
      <InfoRow label="Status" value={swLabel[swState]} />
      <InfoRow label="Cache used" value={cacheSize} />
      <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={clearCache}
          style={{
            padding: '10px 18px',
            borderRadius: 8,
            border: `1px solid ${t.accentRed}`,
            color: t.accentRed,
            background: 'transparent',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Clear Cache & Reload
        </button>
      </div>
      <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 8 }}>
        Clears all cached files and reloads fresh from the server. Use if the display looks outdated.
      </div>
      <div style={{ height: 16 }} />

      {/* ── Install / Uninstall ─────────────────────────────── */}
      <SettingsSectionHeader title="PWA Installation" />
      <div style={{ marginBottom: 12 }}>
        <InfoRow
          label="Install status"
          value={
            installState === 'installed' ? 'Installed as app'
            : installState === 'prompt-ready' ? 'Ready to install'
            : 'Not available (use browser menu)'
          }
        />
      </div>

      {installState === 'prompt-ready' && (
        <>
          <PrimaryButton onClick={handleInstall}>
            Install as App
          </PrimaryButton>
          <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 8 }}>
            Installs to home screen / desktop for fullscreen kiosk use.
          </div>
        </>
      )}

      {installState === 'installed' && (
        <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.7 }}>
          ✓ Running as installed PWA.
          <br />
          To uninstall: open browser menu → "Uninstall app" or remove from your device's app list.
        </div>
      )}

      {installState === 'unavailable' && (
        <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.7 }}>
          Install option not available in this browser or already dismissed.
          <br />
          On Chrome/Edge: use the install icon in the address bar, or browser menu → "Install app".
          <br />
          On iOS Safari: Share → "Add to Home Screen".
        </div>
      )}

      <div style={{ height: 16 }} />

      {/* ── App URLs ────────────────────────────────────────── */}
      <SettingsSectionHeader title="Display URL" />
      <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 8, lineHeight: 1.6 }}>
        Open this URL on any TV or device to show the prayer display. Bookmark it or install as a PWA for permanent kiosk use.
      </div>
      <InfoRow label="Current URL" value={window.location.origin} mono />

    </SettingsTabScaffold>
  );
}
