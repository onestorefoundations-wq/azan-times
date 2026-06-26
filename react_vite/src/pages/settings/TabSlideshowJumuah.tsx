import { JumuahSettings, SlideshowSettings } from '../../core/appConfig';
import {
  SettingsDropdown,
  SettingsFormField,
  SettingsFormRow,
  SettingsSectionHeader,
  SettingsTabScaffold,
  SettingsToggleRow,
  TextInput,
  useTheme,
} from './helpers';

export default function TabSlideshowJumuah({
  slideshow,
  jumuah,
  onSlideshowChange,
  onJumuahChange,
}: {
  slideshow: SlideshowSettings;
  jumuah: JumuahSettings;
  onSlideshowChange: (s: SlideshowSettings) => void;
  onJumuahChange: (j: JumuahSettings) => void;
}) {
  const t = useTheme();
  const s = slideshow;
  const num = (v: string, fb: number) => (v === '' ? fb : parseInt(v, 10) || 0);

  const minSec = (
    minVal: number,
    secVal: number,
    onMin: (n: number) => void,
    onSec: (n: number) => void,
  ) => (
    <div style={{ display: 'flex', gap: 8 }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <TextInput type="number" value={minVal} onChange={(e) => onMin(num(e.target.value, 0))} />
        <span style={suffix(t)}>min</span>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <TextInput type="number" value={secVal} onChange={(e) => onSec(Math.min(59, num(e.target.value, 0)))} />
        <span style={suffix(t)}>sec</span>
      </div>
    </div>
  );

  return (
    <SettingsTabScaffold title="Slideshow & Jumu'ah Override">
      <SettingsSectionHeader title="Slideshow & Screensaver" />

      <SettingsToggleRow
        label="Enable Announcement Image Slideshow"
        description="Cycles between prayer time screen and full-screen images."
        value={s.enabled}
        onChange={(v) => onSlideshowChange({ ...s, enabled: v })}
      />

      {s.enabled && (
        <div
          style={{
            marginBottom: 16,
            padding: '10px 14px',
            borderRadius: 8,
            background: t.bgElevated,
            border: `1px solid ${t.borderSubtle}`,
            color: t.accentTeal,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          📺 TV Screen ({s.tvScreenDurationMins}m {s.tvScreenExtraSecs}s) → 🖼️ Slideshow ({s.slideshowRunDurationMins}m{' '}
          {s.slideshowRunExtraSecs}s) → 📺 Repeat
        </div>
      )}

      <SettingsFormField label="TV Screen Display Time" helpText="How long to show prayer times before switching to slideshow.">
        {minSec(
          s.tvScreenDurationMins,
          s.tvScreenExtraSecs,
          (n) => onSlideshowChange({ ...s, tvScreenDurationMins: n }),
          (n) => onSlideshowChange({ ...s, tvScreenExtraSecs: n }),
        )}
      </SettingsFormField>

      <SettingsFormField label="Slideshow Run Duration" helpText="How long the slideshow plays before returning to TV screen.">
        {minSec(
          s.slideshowRunDurationMins,
          s.slideshowRunExtraSecs,
          (n) => onSlideshowChange({ ...s, slideshowRunDurationMins: n }),
          (n) => onSlideshowChange({ ...s, slideshowRunExtraSecs: n }),
        )}
      </SettingsFormField>

      <SettingsFormField label="Duration Per Image (Seconds)" helpText="How long each individual image displays within the slideshow.">
        <TextInput
          type="number"
          value={s.durationPerImageSeconds}
          onChange={(e) => onSlideshowChange({ ...s, durationPerImageSeconds: num(e.target.value, 5) })}
        />
      </SettingsFormField>

      <SettingsDropdown
        label="Slideshow Template Mode"
        value={s.displayMode}
        onChange={(v) => onSlideshowChange({ ...s, displayMode: v as SlideshowSettings['displayMode'] })}
        options={[
          { value: 'full_screen', label: 'Mode 1: Full Screen (Takes over during idle)' },
          { value: 'corner_overlay', label: 'Mode 2: Corner Overlay (Floating image)' },
          { value: 'split_screen', label: 'Mode 3: Split Screen (50/50 layout)' },
        ]}
      />

      {s.displayMode === 'corner_overlay' && (
        <SettingsFormRow
          left={
            <SettingsDropdown
              label="Corner Position"
              value={s.overlayCorner}
              onChange={(v) => onSlideshowChange({ ...s, overlayCorner: v as SlideshowSettings['overlayCorner'] })}
              options={[
                { value: 'top_right', label: 'Top Right' },
                { value: 'top_left', label: 'Top Left' },
                { value: 'bottom_right', label: 'Bottom Right' },
                { value: 'bottom_left', label: 'Bottom Left' },
              ]}
            />
          }
          right={
            <SettingsDropdown
              label="Overlay Size (% of screen)"
              value={s.overlaySizePercent}
              onChange={(v) => onSlideshowChange({ ...s, overlaySizePercent: v })}
              options={[
                { value: 15, label: 'Small (15%)' },
                { value: 20, label: 'Medium-Small (20%)' },
                { value: 25, label: 'Medium (25%)' },
                { value: 30, label: 'Medium-Large (30%)' },
                { value: 40, label: 'Large (40%)' },
              ]}
            />
          }
        />
      )}

      <SettingsFormRow
        left={
          <SettingsFormField label="Pause Before Adhan (Mins)">
            <TextInput
              type="number"
              value={s.pauseBeforeAdhanMins}
              onChange={(e) => onSlideshowChange({ ...s, pauseBeforeAdhanMins: num(e.target.value, 2) })}
            />
          </SettingsFormField>
        }
        right={
          <SettingsFormField label="Pause After Iqamah (Mins)">
            <TextInput
              type="number"
              value={s.pauseAfterIqamahMins}
              onChange={(e) => onSlideshowChange({ ...s, pauseAfterIqamahMins: num(e.target.value, 15) })}
            />
          </SettingsFormField>
        }
      />

      <div
        style={{
          padding: 16,
          margin: '12px 0',
          borderRadius: 8,
          background: 'rgba(20,184,166,0.07)',
          border: '1px solid rgba(20,184,166,0.35)',
          color: t.textSecondary,
          fontSize: 12,
        }}
      >
        <strong style={{ color: t.accentTeal }}>Slide Images — managed in Media Library.</strong> Upload slides from the
        Media Library tab. Use "Slides Landscape" for horizontal TVs and "Slides Portrait" for vertical screens.
      </div>

      <SettingsSectionHeader title="Friday Jumu'ah Override" />

      <SettingsToggleRow
        label="Override Dhuhr with Jumu'ah on Fridays"
        value={jumuah.enabled}
        onChange={(v) => onJumuahChange({ ...jumuah, enabled: v })}
      />

      <SettingsFormRow
        left={
          <SettingsFormField label="Khutbah Start Time (Adhan)">
            <TextInput value={jumuah.khutbahTime} placeholder="e.g. 13:00" onChange={(e) => onJumuahChange({ ...jumuah, khutbahTime: e.target.value })} />
          </SettingsFormField>
        }
        right={
          <SettingsFormField label="Jumu'ah Prayer / Iqamah Time">
            <TextInput value={jumuah.iqamahTime} placeholder="e.g. 13:30" onChange={(e) => onJumuahChange({ ...jumuah, iqamahTime: e.target.value })} />
          </SettingsFormField>
        }
      />

      <SettingsFormField label="Display Label">
        <TextInput value={jumuah.displayLabel} placeholder="e.g. Jumu'ah" onChange={(e) => onJumuahChange({ ...jumuah, displayLabel: e.target.value })} />
      </SettingsFormField>
    </SettingsTabScaffold>
  );
}

function suffix(t: ReturnType<typeof useTheme>): React.CSSProperties {
  return {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: 12,
    color: t.textSecondary,
    pointerEvents: 'none',
  };
}
