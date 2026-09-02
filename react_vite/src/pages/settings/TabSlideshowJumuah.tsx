import { useState } from 'react';
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

/**
 * A whole-number field that can be emptied while you are typing in it.
 *
 * These were controlled inputs coerced on every keystroke, with an empty box
 * substituting the setting's default: backspacing the 5 out of "Duration Per
 * Image" put a 5 straight back, so the field looked welded to its default. On a
 * soft keyboard, where clearing and retyping is the natural gesture, there was
 * no way past it at all.
 *
 * The draft string is held while the box is being edited and only turned into a
 * number when it parses, so an empty field stays empty. Leaving the field
 * settles it: a blank or unparseable box falls back, anything else is clamped.
 */
function NumberField({
  value,
  onCommit,
  fallback,
  min = 0,
  max,
}: {
  value: number;
  onCommit: (n: number) => void;
  fallback: number;
  min?: number;
  max?: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const settle = (n: number) => Math.max(min, Math.min(max ?? Number.MAX_SAFE_INTEGER, n));

  return (
    <TextInput
      type="number"
      inputMode="numeric"
      value={draft ?? String(value)}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = parseInt(e.target.value, 10);
        if (!Number.isNaN(n)) onCommit(settle(n));
      }}
      onBlur={() => {
        const n = parseInt(draft ?? '', 10);
        if (draft !== null) onCommit(Number.isNaN(n) ? fallback : settle(n));
        setDraft(null);
      }}
    />
  );
}

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

  const minSec = (
    minVal: number,
    secVal: number,
    onMin: (n: number) => void,
    onSec: (n: number) => void,
  ) => (
    <div style={{ display: 'flex', gap: 8 }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <NumberField value={minVal} fallback={0} onCommit={onMin} />
        <span style={suffix(t)}>min</span>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <NumberField value={secVal} fallback={0} max={59} onCommit={onSec} />
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
        <NumberField
          value={s.durationPerImageSeconds}
          fallback={5}
          min={1}
          onCommit={(n) => onSlideshowChange({ ...s, durationPerImageSeconds: n })}
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
            <NumberField
              value={s.pauseBeforeAdhanMins}
              fallback={2}
              onCommit={(n) => onSlideshowChange({ ...s, pauseBeforeAdhanMins: n })}
            />
          </SettingsFormField>
        }
        right={
          <SettingsFormField label="Pause After Iqamah (Mins)">
            <NumberField
              value={s.pauseAfterIqamahMins}
              fallback={15}
              onCommit={(n) => onSlideshowChange({ ...s, pauseAfterIqamahMins: n })}
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
        <strong style={{ color: t.accentTeal }}>Slide Images — managed in Media Library.</strong> Add them under
        Slideshow Slides: the Landscape row for horizontal TVs, the Portrait row for vertical screens.
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
