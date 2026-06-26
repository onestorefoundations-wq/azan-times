import { PrayerKey, PrayerOffset, TimeAdjustments } from '../../core/appConfig';
import { SettingsTabScaffold, TextInput, useTheme } from './helpers';

const ROWS: [PrayerKey, string][] = [
  ['fajr', 'Fajr'],
  ['dhuhr', 'Dhuhr'],
  ['asr', 'Asr'],
  ['maghrib', 'Maghrib'],
  ['isha', 'Isha'],
];

export default function TabPrayerOffsets({
  adjustments,
  onChange,
}: {
  adjustments: TimeAdjustments;
  onChange: (a: TimeAdjustments) => void;
}) {
  const t = useTheme();

  const update = (key: PrayerKey, patch: Partial<PrayerOffset>) =>
    onChange({ ...adjustments, [key]: { ...adjustments[key], ...patch } });

  const numField = (val: number, on: (n: number) => void) => (
    <TextInput
      type="number"
      value={Number.isFinite(val) ? val : 0}
      onChange={(e) => on(parseInt(e.target.value, 10) || 0)}
    />
  );

  return (
    <SettingsTabScaffold title="Prayer Time Adjustments">
      <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 16 }}>
        Modify Adhan offsets (mins, can be negative) and custom Iqamah wait timings (mins after Adhan).
      </div>

      <div style={{ display: 'flex', padding: '10px 12px', background: t.bgElevated, borderBottom: `1px solid ${t.borderSubtle}`, borderTopLeftRadius: 10, borderTopRightRadius: 10 }}>
        <HeaderCell text="Prayer" />
        <HeaderCell text="Adhan Offset (Mins)" />
        <HeaderCell text="Iqamah Wait (Mins)" />
      </div>

      <div style={{ border: `1px solid ${t.borderSubtle}`, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
        {ROWS.map(([key, label], i) => (
          <div
            key={key}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '10px 12px',
              borderBottom: i === ROWS.length - 1 ? 'none' : `1px solid ${t.borderSubtle}`,
            }}
          >
            <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: t.textPrimary }}>{label}</div>
            <div style={{ flex: 1, paddingRight: 12 }}>
              {numField(adjustments[key].adhanOffset, (n) => update(key, { adhanOffset: n }))}
            </div>
            <div style={{ flex: 1 }}>{numField(adjustments[key].iqamahWait, (n) => update(key, { iqamahWait: n }))}</div>
          </div>
        ))}
      </div>
    </SettingsTabScaffold>
  );

  function HeaderCell({ text }: { text: string }) {
    return <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: t.textSecondary, letterSpacing: 1 }}>{text}</div>;
  }
}
