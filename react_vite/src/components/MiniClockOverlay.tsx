/**
 * MiniClockOverlay.tsx
 * Small clock + next-prayer chip shown during full-screen slideshow.
 * Port of the _MiniClockOverlay in tv_display.dart.
 */
import { AppConfig, resolvedColors } from '../core/appConfig';
import { hexA } from '../core/color';
import { PrayerConfig, formatTimeWithSeconds } from '../core/prayerEngine';
import { useNow } from '../hooks/useNow';
import { getStrings, localizedPrayerName } from '../i18n';

interface Props {
  config: AppConfig;
  nextPrayer: PrayerConfig | null;
}

export default function MiniClockOverlay({ config, nextPrayer }: Props) {
  const now = useNow(1000);
  const colors = resolvedColors(config.meta);
  const s = getStrings(config.features.displayLanguage);
  const use24 = config.features.use24HourFormat;

  return (
    <div
      className="flex flex-col items-center"
      style={{
        padding: '10px 16px',
        borderRadius: 12,
        background: hexA('#1A2D40', 0.88),
        border: `1px solid ${hexA('#FFFFFF', 0.1)}`,
      }}
    >
      <div className="tabular-nums" style={{ fontSize: 28, fontWeight: 800, color: colors.primary }}>
        {formatTimeWithSeconds(now, use24)}
      </div>
      {nextPrayer && (
        <div style={{ fontSize: 12, color: colors.secondary, fontWeight: 600 }}>
          {s.nextPrayer}:{' '}
          {localizedPrayerName(
            s,
            nextPrayer.key,
            nextPrayer.name,
            config.features.useArabicLabels,
            config.features.displayLanguage,
          )}
        </div>
      )}
    </div>
  );
}
