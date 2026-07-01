/**
 * TvDisplay.tsx
 * Main signage screen. Port of flutter_app/lib/pages/tv_display.dart.
 * Orientation-aware background + layouts (default / full-screen / split /
 * corner-overlay), adhan overlay, ticker bar, triple-tap settings, key-dismiss.
 */
import { CSSProperties, JSX, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AudioService } from '../core/audioService';
import {
  activeBgUrlForOrientation,
  slidesForOrientation,
  useAppStore,
} from '../store/appStore';
import type { DisplayOrientation } from '../core/appConfig';
import { clamp, useElementSize } from '../hooks/useElementSize';
import { useIsPortrait } from '../hooks/useOrientation';
import { getStrings } from '../i18n';
import ClockPanel from '../components/ClockPanel';
import PrayerTable from '../components/PrayerTable';
import AdhanOverlay from '../components/AdhanOverlay';
import SlideshowPanel from '../components/SlideshowPanel';
import MiniClockOverlay from '../components/MiniClockOverlay';
import Ticker from '../components/Ticker';

export default function TvDisplay() {
  const navigate = useNavigate();
  const devicePortrait = useIsPortrait();

  const config = useAppStore((s) => s.config);
  const prayers = useAppStore((s) => s.prayers);
  const activePrayer = useAppStore((s) => s.activePrayer);
  const nextPrayer = useAppStore((s) => s.nextPrayer);
  const prayerState = useAppStore((s) => s.prayerState);
  const displayState = useAppStore((s) => s.displayState);
  const isLoaded = useAppStore((s) => s.isLoaded);
  const mediaFiles = useAppStore((s) => s.mediaFiles);
  const pendingUploads = useAppStore((s) => s.pendingUploads);
  const localCacheIndex = useAppStore((s) => s.localCacheIndex);
  const dismissAlert = useAppStore((s) => s.dismissAlert);

  const tapCount = useRef(0);
  const lastTap = useRef(0);

  // Any key dismisses an active alert (matches the KeyboardListener).
  useEffect(() => {
    const onKey = () => dismissAlert();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismissAlert]);

  const openSettings = () => navigate('/settings');

  const handleTap = () => {
    AudioService.unlock(); // satisfy autoplay policy on first interaction
    const now = Date.now();
    if (now - lastTap.current > 600) tapCount.current = 1;
    else tapCount.current += 1;
    lastTap.current = now;
    if (tapCount.current >= 3) {
      tapCount.current = 0;
      openSettings();
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        <div style={{ color: 'var(--text)', opacity: 0.6 }}>{getStrings(config.features.displayLanguage).loading}</div>
      </div>
    );
  }

  // Effective orientation: forced (device-local) overrides actual device orientation.
  const forced = config.meta.displayOrientation;
  const isPortrait =
    forced === 'auto'
      ? devicePortrait
      : forced === 'portrait' || forced === 'portrait-flip';

  const features = config.features;
  const slideshow = config.slideshow;
  const alertMode = features.adhanAlertMode;
  const isAlertOverlay =
    (displayState === 'adhanAlert' || displayState === 'iqamahAlert') && alertMode !== 'side_panel';
  const isSlideshowActive = displayState === 'slideshow';

  const bgUrl = activeBgUrlForOrientation(
    { config, mediaFiles, pendingUploads, localCacheIndex },
    isPortrait,
  );
  const slides = slidesForOrientation(
    { config, mediaFiles, pendingUploads, localCacheIndex },
    isPortrait,
  );

  const tickerEnabled = config.ticker.enabled && config.ticker.messages.length > 0;

  const overlayState = displayState === 'adhanAlert' ? 'adhanTime' : 'iqamahCountdown';

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ background: 'var(--bg)', fontFamily: config.meta.displayFontFamily ?? 'Roboto', transition: 'background 0.4s ease, color 0.3s ease' }}
      onClick={handleTap}
    >
      {/* Background */}
      {bgUrl ? (
        <img src={bgUrl} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')} />
      ) : (
        <div className="absolute inset-0" style={{ background: 'var(--bg)' }} />
      )}

      {/* Content */}
      <div className="absolute inset-0">
        {isAlertOverlay ? (
          <AdhanOverlay
            prayerState={overlayState}
            prayer={activePrayer}
            useArabic={features.useArabicLabels}
            displayLanguage={features.displayLanguage}
            onDismiss={dismissAlert}
          />
        ) : (
          <MainLayout
            isPortrait={isPortrait}
            isSlideshowActive={isSlideshowActive}
            displayMode={slideshow.displayMode}
            durationPerImage={slideshow.durationPerImageSeconds}
            overlayCorner={slideshow.overlayCorner}
            overlaySizePercent={slideshow.overlaySizePercent}
            slides={slides}
            tickerEnabled={tickerEnabled}
            prayers={prayers}
            nextPrayer={nextPrayer}
            activePrayer={activePrayer}
            prayerState={prayerState}
            config={config}
          />
        )}
      </div>

      {/* Settings FAB */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          AudioService.unlock();
          openSettings();
        }}
        className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full opacity-40 hover:opacity-100"
        style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--accent)' }}
        aria-label="Settings"
      >
        ⚙
      </button>

      {/* Orientation toggle FAB — hidden when admin disables it */}
      {config.meta.showOrientationFab && (
        <OrientationFab current={config.meta.displayOrientation} />
      )}
    </div>
  );
}

// ── Main (non-alert) layout ────────────────────────────────────

interface LayoutProps {
  isPortrait: boolean;
  isSlideshowActive: boolean;
  displayMode: string;
  durationPerImage: number;
  overlayCorner: string;
  overlaySizePercent: number;
  slides: ReturnType<typeof slidesForOrientation>;
  tickerEnabled: boolean;
  prayers: Parameters<typeof PrayerTable>[0]['prayers'];
  nextPrayer: Parameters<typeof PrayerTable>[0]['nextPrayer'];
  activePrayer: Parameters<typeof PrayerTable>[0]['activePrayer'];
  prayerState: Parameters<typeof ClockPanel>[0]['prayerState'];
  config: Parameters<typeof ClockPanel>[0]['config'];
}

function MainLayout(props: LayoutProps) {
  const [ref, { width, height }] = useElementSize<HTMLDivElement>();
  const {
    isPortrait,
    isSlideshowActive,
    displayMode,
    durationPerImage,
    overlayCorner,
    overlaySizePercent,
    slides,
    tickerEnabled,
    prayers,
    nextPrayer,
    activePrayer,
    prayerState,
    config,
  } = props;

  const hInset = width * 0.022;
  const vInset = height * 0.022;

  const prayerTable = (
    <PrayerTable
      prayers={prayers}
      nextPrayer={nextPrayer}
      activePrayer={activePrayer}
      use24Hour={config.features.use24HourFormat}
      config={config}
    />
  );
  const clockPanel = (
    <ClockPanel prayerState={prayerState} activePrayer={activePrayer} nextPrayer={nextPrayer} config={config} />
  );
  const slideshowPanel = <SlideshowPanel assets={slides} durationSeconds={durationPerImage} />;

  let body: JSX.Element;

  if (isSlideshowActive && displayMode === 'full_screen') {
    body = (
      <div className="relative h-full w-full">
        {slideshowPanel}
        <div className="absolute" style={{ bottom: height * 0.06, right: width * 0.02 }}>
          <MiniClockOverlay config={config} nextPrayer={nextPrayer} />
        </div>
      </div>
    );
  } else if (isSlideshowActive && displayMode === 'split_screen') {
    body = isPortrait ? (
      <div className="flex h-full w-full flex-col">
        <div className="flex-1">{slideshowPanel}</div>
        <div style={{ height: 1.5, background: 'var(--accent)', opacity: 0.25 }} />
        <div className="flex flex-1 flex-col">
          <div className="flex-1">{clockPanel}</div>
          <div className="flex-1" style={{ padding: `${vInset * 0.5}px ${hInset}px ${vInset}px` }}>
            {prayerTable}
          </div>
        </div>
      </div>
    ) : (
      <div className="flex h-full w-full">
        <div className="flex flex-[2] flex-col">
          <div className="flex-[3]" style={{ padding: `${vInset}px ${hInset * 0.6}px ${vInset * 0.4}px ${hInset}px` }}>
            {prayerTable}
          </div>
          <div className="flex-[2]">{clockPanel}</div>
        </div>
        <div style={{ width: 1.5, background: 'var(--accent)', opacity: 0.25 }} />
        <div className="flex-[2]">{slideshowPanel}</div>
      </div>
    );
  } else {
    // Default layout (+ optional corner overlay)
    const cornerStyle: CSSProperties = {
      position: 'absolute',
      top: overlayCorner.includes('top') ? 16 : undefined,
      bottom: overlayCorner.includes('bottom') ? 60 : undefined,
      left: overlayCorner.includes('left') ? 16 : undefined,
      right: overlayCorner.includes('right') ? 16 : undefined,
      width: (width * overlaySizePercent) / 100,
      height: ((width * overlaySizePercent) / 100) * (9 / 16),
      borderRadius: 12,
      overflow: 'hidden',
    };
    body = (
      <div className="relative h-full w-full">
        {isPortrait ? (
          <div className="flex h-full w-full flex-col">
            <div className="flex-[5]">{clockPanel}</div>
            <div className="flex-[6]" style={{ padding: `${vInset * 0.4}px ${hInset}px ${vInset}px` }}>
              {prayerTable}
            </div>
          </div>
        ) : (
          <div className="flex h-full w-full">
            <div className="flex-[5]" style={{ padding: `${vInset}px ${hInset * 0.6}px ${vInset}px ${hInset}px` }}>
              {prayerTable}
            </div>
            <div className="flex-[4]">{clockPanel}</div>
          </div>
        )}
        {isSlideshowActive && displayMode === 'corner_overlay' && <div style={cornerStyle}>{slideshowPanel}</div>}
      </div>
    );
  }

  const tickerH = clamp(height * 0.065, 36, 72);

  return (
    <div ref={ref} className="flex h-full w-full flex-col">
      <div className="min-h-0 flex-1">{body}</div>
      {tickerEnabled && <Ticker config={config} heightPx={tickerH} />}
    </div>
  );
}

// ── Floating orientation toggle FAB ───────────────────────────
//
// Cycles through all 4 forced orientations (skips 'auto' — that lives in
// settings). Each tap moves to the next mode, wrapping around.
//
//   landscape  → portrait → portrait-flip → landscape-flip → landscape → …
//
// The icon rotates visually to show which way the screen is being turned.

const ORIENTATION_CYCLE: DisplayOrientation[] = [
  'landscape',
  'portrait',
  'portrait-flip',
  'landscape-flip',
];

// Rotation of the icon itself so it visually indicates the screen direction.
const ICON_ROTATE: Record<DisplayOrientation, number> = {
  auto: 0,
  landscape: 0,
  portrait: 90,
  'portrait-flip': 270,
  'landscape-flip': 180,
};

const ORIENTATION_LABELS: Record<DisplayOrientation, string> = {
  auto: 'Auto',
  landscape: 'Landscape',
  'landscape-flip': 'Landscape (flipped)',
  portrait: 'Portrait',
  'portrait-flip': 'Portrait (flipped)',
};

function OrientationFab({ current }: { current: DisplayOrientation }) {
  const config = useAppStore((s) => s.config);
  const saveConfig = useAppStore((s) => s.saveConfig);
  const [tooltip, setTooltip] = useState(false);

  const next = () => {
    const idx = ORIENTATION_CYCLE.indexOf(current);
    // If current is 'auto' (set via settings), start cycle from 'landscape'
    const nextOrientation =
      idx === -1
        ? ORIENTATION_CYCLE[0]
        : ORIENTATION_CYCLE[(idx + 1) % ORIENTATION_CYCLE.length];
    void saveConfig({ ...config, meta: { ...config.meta, displayOrientation: nextOrientation } });
  };

  const deg = ICON_ROTATE[current] ?? 0;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        next();
      }}
      onMouseEnter={() => setTooltip(true)}
      onMouseLeave={() => setTooltip(false)}
      style={{
        position: 'absolute',
        bottom: 56,
        right: 16,
        width: 40,
        height: 40,
        borderRadius: '50%',
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.3)',
        color: 'rgba(255,255,255,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        opacity: 0.35,
        transition: 'opacity 0.2s',
        padding: 0,
      }}
      onMouseOver={(e) => (e.currentTarget.style.opacity = '1')}
      onMouseOut={(e) => (e.currentTarget.style.opacity = '0.35')}
      onFocus={(e) => (e.currentTarget.style.opacity = '1')}
      onBlur={(e) => (e.currentTarget.style.opacity = '0.35')}
      aria-label={`Orientation: ${ORIENTATION_LABELS[current]} — tap to change`}
    >
      {/* Phone/screen icon rotated to show orientation */}
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transform: `rotate(${deg}deg)`, transition: 'transform 0.3s ease' }}
      >
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
        <circle cx="12" cy="18" r="1" fill="currentColor" stroke="none" />
      </svg>

      {tooltip && (
        <span
          style={{
            position: 'absolute',
            right: 44,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(0,0,0,0.75)',
            color: '#fff',
            fontSize: 11,
            padding: '4px 10px',
            borderRadius: 6,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {ORIENTATION_LABELS[current]}
        </span>
      )}
    </button>
  );
}
