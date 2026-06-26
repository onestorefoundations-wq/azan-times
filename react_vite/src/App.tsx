import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAppStore } from './store/appStore';
import { isRtl } from './i18n';
import { useIsPortrait } from './hooks/useOrientation';
import { AudioService } from './core/audioService';
import TvDisplay from './pages/TvDisplay';
import { initTheme } from './theme';

// Apply persisted light theme (CSS vars on :root) before first render.
initTheme();

// Code-split the settings panel (incl. Leaflet) off the display's critical path.
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));

/** Applies <html dir/lang> from the configured display language. */
function useDocumentLocale() {
  const lang = useAppStore((s) => s.config.features.displayLanguage);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl(lang) ? 'rtl' : 'ltr';
  }, [lang]);
}

/**
 * Forces display orientation for kiosk/TV use. Tries the Screen Orientation
 * API (works in fullscreen on supported devices) and falls back to a CSS
 * rotation so a portrait device can drive a landscape TV layout and vice-versa.
 */
function ForcedOrientation({ children }: { children: React.ReactNode }) {
  const forced = useAppStore((s) => s.config.meta.displayOrientation);
  const devicePortrait = useIsPortrait();

  useEffect(() => {
    if (forced === 'auto') return;
    const so = (screen as any).orientation;
    if (so?.lock) so.lock(forced === 'landscape' ? 'landscape' : 'portrait').catch(() => {});
  }, [forced]);

  const mismatch =
    (forced === 'landscape' && devicePortrait) || (forced === 'portrait' && !devicePortrait);

  if (!mismatch) return <>{children}</>;

  // Rotate 90° CW and swap dimensions so children fill the screen.
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vh',
        height: '100vw',
        transformOrigin: 'top left',
        transform: 'rotate(90deg) translateY(-100vh)',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

/** One-time "tap to enable sound" hint (browsers block autoplay until a gesture). */
function AudioUnlockHint() {
  const enabled = useAppStore((s) => s.config.features.audioAlertsEnabled);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (!enabled || unlocked) return;
    const onGesture = () => {
      AudioService.unlock();
      setUnlocked(true);
    };
    window.addEventListener('pointerdown', onGesture, { once: true });
    window.addEventListener('keydown', onGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, [enabled, unlocked]);

  if (!enabled || unlocked) return null;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        padding: '6px 14px',
        borderRadius: 999,
        background: 'rgba(30,41,59,0.9)',
        color: '#94A3B8',
        fontSize: 12,
        pointerEvents: 'none',
      }}
    >
      🔇 Tap anywhere to enable adhan sound
    </div>
  );
}

export default function App() {
  // Initialize the store once (loads config, starts the 1s tick + timers + sync).
  useEffect(() => {
    void useAppStore.getState().init();
  }, []);

  useDocumentLocale();

  return (
    <BrowserRouter>
      <ForcedOrientation>
        <Suspense fallback={<div className="h-full w-full bg-bg-primary" />}>
          <Routes>
            <Route path="/" element={<TvDisplay />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Suspense>
        <AudioUnlockHint />
      </ForcedOrientation>
    </BrowserRouter>
  );
}
