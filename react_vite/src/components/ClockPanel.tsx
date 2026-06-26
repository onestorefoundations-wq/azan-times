/**
 * ClockPanel.tsx
 * Port of flutter_app/lib/widgets/clock_panel_widget.dart.
 * Masjid name, live clock (digital/analog), Gregorian + Hijri date, next prayer,
 * and live countdown. Shows an alert badge during Adhan/Iqamah.
 */
import { AppConfig, resolvedColors } from '../core/appConfig';
import { hexA } from '../core/color';
import {
  PrayerConfig,
  PrayerState,
  formatCountdown,
  formatGregorianDate,
  formatTimeWithSeconds,
  getHijriDate,
} from '../core/prayerEngine';
import { clamp, useElementSize } from '../hooks/useElementSize';
import { useNow } from '../hooks/useNow';
import { getStrings, localizedPrayerName } from '../i18n';
import AnalogClock from './AnalogClock';

interface Props {
  prayerState: PrayerState;
  activePrayer: PrayerConfig | null;
  nextPrayer: PrayerConfig | null;
  config: AppConfig;
}

export default function ClockPanel({ prayerState, activePrayer, nextPrayer, config }: Props) {
  const now = useNow(1000);
  const [ref, { width: w, height: h }] = useElementSize<HTMLDivElement>();
  const colors = resolvedColors(config.meta);
  const s = getStrings(config.features.displayLanguage);
  const f = config.features;
  const use24 = f.use24HourFormat;
  const profile = config.profile;

  const isIqamah = prayerState === 'iqamahCountdown';

  const countdownTarget = isIqamah ? activePrayer?.iqamahTime : nextPrayer?.adhanTime;
  const countdownLabel = isIqamah ? s.iqamahIn : s.adhanIn;
  const displayPrayer = activePrayer ?? nextPrayer;

  const scale    = (f.digitalClockSizePercent ?? 75) / 100;
  const nameFont = clamp(h * 0.06,  14, 44);
  const clockFont= clamp(h * 0.18 * scale, 20, 120 * scale);
  const dateFont = clamp(h * 0.045, 10, 28);
  const labelFont= clamp(h * 0.04,  10, 24);
  const nextFont = clamp(h * 0.09,  14, 64);
  const cdFont   = clamp(h * 0.08,  14, 56);
  const hPad     = w * 0.07;
  // Tighter vertical padding so everything fits
  const vPad     = clamp(h * 0.025, 6, 20);
  const divGap   = clamp(h * 0.02,  4, 14); // space above/below the divider line

  const hijri = getHijriDate(now);

  const Divider = () => (
    <div style={{ padding: `${divGap}px 0`, width: '100%' }}>
      <div style={{ height: 1, background: hexA(colors.primary, 0.12) }} />
    </div>
  );

  return (
    /*
     * Outer: full-size column. overflow:hidden ensures nothing escapes the panel.
     * We use flex-col here so the single child (inner content div) is properly
     * bounded and does NOT grow past the container height.
     */
    <div
      ref={ref}
      className="flex h-full w-full flex-col items-center justify-start text-center"
      style={{
        borderLeft: `1px solid ${hexA('#FFFFFF', 0.12)}`,
        padding: `${vPad}px ${hPad}px`,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Inner content — capped to available height so it never overflows */}
      <div
        className="flex w-full flex-col items-center"
        style={{ maxHeight: h - vPad * 2, overflow: 'hidden' }}
      >
        {/* Masjid name */}
        {profile.name && (
          <>
            <div style={{ fontSize: nameFont, fontWeight: 700, color: colors.secondary, letterSpacing: 0.8, flexShrink: 0 }}>
              {profile.name}
            </div>
            {profile.nameArabic && (
              <div style={{ fontSize: nameFont * 0.82, color: hexA(colors.primary, 0.6), marginTop: 2, flexShrink: 0 }}>
                {profile.nameArabic}
              </div>
            )}
            <Divider />
          </>
        )}

        {/* Clock — analog or digital */}
        {f.showAnalogClock ? (
          <AnalogClock
            time={now}
            primaryColor={colors.primary}
            accentColor={colors.secondary}
            size={clamp((h * 0.38 * f.analogClockSize) / 100, 50, 380)}
          />
        ) : (
          <div
            className="tabular-nums"
            style={{
              fontSize: clockFont,
              fontWeight: 800,
              color: colors.primary,
              lineHeight: 1.05,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              maxWidth: '100%',
              flexShrink: 0,
            }}
          >
            {formatTimeWithSeconds(now, use24)}
          </div>
        )}

        <div style={{ height: clamp(h * 0.012, 3, 10), flexShrink: 0 }} />

        {/* Gregorian date */}
        <div style={{ fontSize: dateFont, color: colors.dateText, fontWeight: 500, letterSpacing: 0.3, flexShrink: 0 }}>
          {formatGregorianDate(now)}
        </div>

        {/* Hijri date */}
        {hijri && (
          <div
            style={{
              fontSize: dateFont * 0.88,
              color: hexA(colors.dateText, 0.75),
              fontStyle: 'italic',
              marginTop: 2,
              flexShrink: 0,
            }}
          >
            {hijri}
          </div>
        )}

        <Divider />

        {/* Next prayer */}
        {displayPrayer && (
          <>
            <div style={{ fontSize: labelFont, color: hexA(colors.primary, 0.5), letterSpacing: 1.6, fontWeight: 600, flexShrink: 0 }}>
              {s.nextPrayer.toUpperCase()}
            </div>
            <div
              style={{ fontSize: nextFont, fontWeight: 800, color: colors.primary, letterSpacing: 0.5, marginTop: 2, flexShrink: 0 }}
            >
              {localizedPrayerName(s, displayPrayer.key, displayPrayer.name, f.useArabicLabels, f.displayLanguage)}
            </div>
            <div style={{ height: clamp(h * 0.012, 3, 10), flexShrink: 0 }} />
          </>
        )}

        {/* Countdown */}
        {countdownTarget && (
          <>
            <div
              style={{
                fontSize: labelFont,
                color: isIqamah ? '#F59E0B' : hexA(colors.primary, 0.5),
                letterSpacing: 1.4,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {countdownLabel.toUpperCase()}
            </div>
            <div
              className="tabular-nums"
              style={{
                fontSize: cdFont,
                fontWeight: 800,
                color: isIqamah ? '#F59E0B' : colors.secondary,
                marginTop: 2,
                flexShrink: 0,
              }}
            >
              {formatCountdown(countdownTarget)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
