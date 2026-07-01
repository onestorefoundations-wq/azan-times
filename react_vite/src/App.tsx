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
 * Applies a CSS rotation so the content always fills the physical screen,
 * regardless of how the device is oriented or what orientation is forced.
 *
 * Rotation rules (transform-origin: top left):
 *   landscape  on portrait  device → CW  90°: translateX(100vw) rotate(90deg)
 *   portrait   on landscape device → CW  90°: translateX(100vw) rotate(90deg)
 *   portrait-flip on landscape     → CCW 90°: translateY(100vh) rotate(-90deg)
 *   landscape-flip on portrait     → CCW 90°: translateY(100vh) rotate(-90deg)
 *   *-flip on matching device      → 180°:   translate(100%,100%) rotate(180deg)
 *   everything else                → no transform
 *
 * Math verified: container is always 100vh × 100vw (swapped) for 90° cases,
 * and 100vw × 100vh (normal) for the 180° flip case.
 */
function orientationStyle(
  forced: import('./core/appConfig').DisplayOrientation,
  devicePortrait: boolean,
): React.CSSProperties | null {
  if (forced === 'auto') return null;

  const wantsPortrait = forced === 'portrait' || forced === 'portrait-flip';
  const wantsFlip = forced === 'portrait-flip' || forced === 'landscape-flip';
  const deviceMatchesContent = wantsPortrait === devicePortrait;

  if (!wantsFlip && deviceMatchesContent) return null; // already correct, no rotation needed

  if (deviceMatchesContent) {
    // Same axis, just flipped 180°. Container keeps original dimensions.
    return {
      position: 'fixed', top: 0, left: 0,
      width: '100vw', height: '100vh',
      transformOrigin: 'top left',
      transform: 'translate(100%, 100%) rotate(180deg)',
      overflow: 'hidden',
    };
  }

  // 90° rotation needed. Container swaps vw/vh so content fills the screen.
  const transform = wantsFlip
    ? 'translateY(100vh) rotate(-90deg)'  // CCW
    : 'translateX(100vw) rotate(90deg)';  // CW

  return {
    position: 'fixed', top: 0, left: 0,
    width: '100vh', height: '100vw',
    transformOrigin: 'top left',
    transform,
    overflow: 'hidden',
  };
}

function ForcedOrientation({ children }: { children: React.ReactNode }) {
  const forced = useAppStore((s) => s.config.meta.displayOrientation);
  const devicePortrait = useIsPortrait();

  // Try native orientation lock (works in fullscreen on Android Chrome).
  useEffect(() => {
    if (forced === 'auto') return;
    const axis = forced === 'landscape' || forced === 'landscape-flip' ? 'landscape' : 'portrait';
    const so = (screen as any).orientation;
    if (so?.lock) so.lock(axis).catch(() => {});
  }, [forced]);

  const style = orientationStyle(forced, devicePortrait);
  if (!style) return <>{children}</>;

  return <div style={style}>{children}</div>;
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
