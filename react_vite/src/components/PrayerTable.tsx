/**
 * PrayerTable.tsx
 * Port of flutter_app/lib/widgets/prayer_table_widget.dart.
 * 3 columns: Prayer | Adhan | Iqamah, with the active/next row highlighted.
 */
import { AppConfig, resolvedColors } from '../core/appConfig';
import { PrayerConfig, formatTime } from '../core/prayerEngine';
import { hexA } from '../core/color';
import { clamp, useElementSize } from '../hooks/useElementSize';
import { getStrings, localizedPrayerName } from '../i18n';

interface Props {
  prayers: PrayerConfig[];
  nextPrayer: PrayerConfig | null;
  activePrayer: PrayerConfig | null;
  use24Hour: boolean;
  config: AppConfig;
}

export default function PrayerTable({ prayers, nextPrayer, activePrayer, use24Hour, config }: Props) {
  const [ref, { width, height }] = useElementSize<HTMLDivElement>();
  const colors = resolvedColors(config.meta);
  const s = getStrings(config.features.displayLanguage);
  const useArabic = config.features.useArabicLabels;
  const lang = config.features.displayLanguage;

  const rowCount = clamp(prayers.length + 1, 4, 8);
  const rowH = height > 0 ? height / rowCount : 48;
  const headerFont = clamp(rowH * 0.32, 10, 22);
  const bodyFont = clamp(rowH * 0.36, 11, 26);
  const hPad = clamp(width * 0.02, 6, 20);
  const radius = clamp(rowH * 0.15, 8, 14);

  const headerColor = colors.prayerName;

  return (
    <div ref={ref} className="flex h-full w-full flex-col">
      {/* Header */}
      <div className="flex items-center" style={{ height: rowH * 0.75 }}>
        <HeaderCell text={s.headerPrayer} font={headerFont} color={headerColor} hPad={hPad} flex={3} align="left" />
        <HeaderCell text={s.headerAdhan} font={headerFont} color={headerColor} hPad={hPad} flex={2} align="center" />
        <HeaderCell text={s.headerIqamah} font={headerFont} color={headerColor} hPad={hPad} flex={2} align="center" />
      </div>
      <div style={{ height: 1.5, background: 'var(--surface, #334155)', opacity: 0.4 }} />
      <div style={{ height: rowH * 0.04 }} />

      {/* Rows */}
      {prayers.map((p) => {
        const highlighted = nextPrayer?.key === p.key || activePrayer?.key === p.key;
        const accent = colors.secondary;
        const primary = colors.primary;
        const nameColor = highlighted ? primary : colors.prayerName;
        const timeColor = highlighted ? accent : colors.prayerTime;
        const iqamahColor = p.noIqamah ? '#475569' : highlighted ? '#FBBF24' : colors.prayerTime;
        const name = localizedPrayerName(s, p.key, p.name, useArabic, lang);

        return (
          <div
            key={p.key}
            className="flex flex-1 items-center transition-all duration-300"
            style={{
              margin: `${clamp(rowH * 0.04, 2, 6)}px ${hPad * 0.2}px`,
              borderRadius: radius,
              background: highlighted ? hexA(accent, 0.13) : hexA(primary, 0.04),
              border: `1.5px solid ${highlighted ? accent : hexA(primary, 0.06)}`,
            }}
          >
            <div
              style={{
                width: clamp(rowH * 0.06, 3, 6),
                alignSelf: 'stretch',
                margin: `${rowH * 0.12}px 0`,
                background: highlighted ? accent : 'transparent',
                borderTopRightRadius: 4,
                borderBottomRightRadius: 4,
              }}
            />
            <Cell text={name} font={bodyFont} flex={3} bold={highlighted} align="left" color={nameColor} hPad={hPad} />
            <Cell text={formatTime(p.adhanTime, use24Hour)} font={bodyFont} flex={2} bold={highlighted} align="center" color={timeColor} hPad={hPad} />
            <Cell
              text={p.noIqamah ? '—' : formatTime(p.iqamahTime, use24Hour)}
              font={bodyFont}
              flex={2}
              bold={highlighted}
              align="center"
              color={iqamahColor}
              hPad={hPad}
            />
          </div>
        );
      })}
    </div>
  );
}

function HeaderCell({
  text,
  font,
  color,
  hPad,
  flex,
  align,
}: {
  text: string;
  font: number;
  color: string;
  hPad: number;
  flex: number;
  align: 'left' | 'center';
}) {
  return (
    <div style={{ flex, padding: `0 ${hPad}px`, opacity: 0.5 }}>
      <div
        style={{
          fontSize: font,
          fontWeight: 700,
          color,
          letterSpacing: 1.4,
          textAlign: align,
          textTransform: 'uppercase',
        }}
      >
        {text}
      </div>
    </div>
  );
}

function Cell({
  text,
  font,
  flex,
  bold,
  align,
  color,
  hPad,
}: {
  text: string;
  font: number;
  flex: number;
  bold: boolean;
  align: 'left' | 'center';
  color: string;
  hPad: number;
}) {
  return (
    <div
      style={{
        flex,
        padding: `0 ${hPad}px`,
        display: 'flex',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          fontSize: font,
          fontWeight: bold ? 700 : 500,
          color,
          letterSpacing: bold ? 0.3 : 0,
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </span>
    </div>
  );
}
