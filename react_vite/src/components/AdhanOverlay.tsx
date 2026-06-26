/**
 * AdhanOverlay.tsx
 * Port of flutter_app/lib/widgets/adhan_overlay_widget.dart.
 * Full-screen Adhan/Iqamah alert with pulsing glow and (Iqamah) countdown.
 * Rendered for 'full_screen' and 'dismissible' modes (not 'side_panel').
 */
import { PrayerConfig, PrayerState, formatCountdown } from '../core/prayerEngine';
import { hexA } from '../core/color';
import { useNow } from '../hooks/useNow';
import { getStrings, localizedPrayerName } from '../i18n';

interface Props {
  prayerState: PrayerState;
  prayer: PrayerConfig | null;
  useArabic: boolean;
  displayLanguage: string;
  onDismiss?: () => void;
}

export default function AdhanOverlay({ prayerState, prayer, useArabic, displayLanguage, onDismiss }: Props) {
  useNow(1000); // re-render each second for the countdown
  const s = getStrings(displayLanguage);
  const isAdhan = prayerState === 'adhanTime';
  const isIqamah = prayerState === 'iqamahCountdown';
  const accent = isAdhan ? '#14B8A6' : '#F59E0B';
  const badge = isAdhan ? s.adhanTime : s.iqamahTime;
  const countdownTarget = isIqamah ? prayer?.iqamahTime : prayer?.adhanTime;

  const vh = (pct: number) => `${pct}vh`;

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: '#0F172A' }}>
      {/* Pulsing radial glow */}
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: '70%',
          height: '70%',
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${hexA(accent, 0.06)} 0%, transparent 70%)`,
          animation: 'pulse-glow 2s ease-in-out infinite',
        }}
      />

      {/* Close (X) */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute right-6 top-6 flex h-12 w-12 items-center justify-center rounded-full text-white"
          style={{ background: hexA('#FFFFFF', 0.1), border: `1px solid ${hexA('#FFFFFF', 0.2)}` }}
          aria-label={s.dismiss}
        >
          ✕
        </button>
      )}

      {/* Content */}
      <div className="relative flex h-full w-full flex-col items-center justify-center px-8 text-center">
        <div style={{ fontSize: vh(10) }}>🕌</div>
        <div style={{ height: 24 }} />
        <div
          style={{
            padding: '10px 24px',
            borderRadius: 32,
            background: hexA(accent, 0.15),
            border: `1.5px solid ${accent}`,
            color: accent,
            fontSize: vh(3.5),
            fontWeight: 700,
            letterSpacing: 3,
          }}
        >
          {badge}
        </div>
        <div style={{ height: 20 }} />
        {prayer && (
          <div style={{ fontSize: vh(12), fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>
            {localizedPrayerName(s, prayer.key, prayer.name, useArabic, displayLanguage)}
          </div>
        )}

        {isIqamah && countdownTarget && (
          <>
            <div style={{ height: 24 }} />
            <div style={{ fontSize: vh(3), color: '#94A3B8' }}>{s.iqamahStartingIn}</div>
            <div className="tabular-nums" style={{ fontSize: vh(10), fontWeight: 800, color: '#F59E0B', marginTop: 8 }}>
              {formatCountdown(countdownTarget)}
            </div>
          </>
        )}

        {onDismiss && (
          <button onClick={onDismiss} className="mt-8 text-white/50" style={{ fontSize: 16 }}>
            ✕ {s.dismiss}
          </button>
        )}
      </div>
    </div>
  );
}
