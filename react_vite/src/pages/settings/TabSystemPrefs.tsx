import { useState } from 'react';
import { FeaturesFormat, SyncMeta } from '../../core/appConfig';
import { StorageService, hashPin } from '../../core/storageService';
import { getStrings } from '../../i18n';
import {
  ColorSwatchPicker,
  PrimaryButton,
  SettingsDropdown,
  SettingsFormField,
  SettingsSectionHeader,
  SettingsTabScaffold,
  SettingsToggleRow,
  TextInput,
  useTheme,
} from './helpers';

const AUDIO_FILES = ['alert1.mp3', 'alert2.mp3', 'alert3.mp3', 'alert4.mp3'];

// Order matches tab_system_prefs.dart: en/ar/ml fixed, then alphabetical.
const LANGS: [string, keyof ReturnType<typeof getStrings>][] = [
  ['en', 'langEnglish'], ['ar', 'langArabic'], ['ml', 'langMalayalam'],
  ['am', 'langAmharic'], ['az', 'langAzerbaijani'], ['bn', 'langBengali'],
  ['zh', 'langChinese'], ['nl', 'langDutch'], ['fr', 'langFrench'],
  ['de', 'langGerman'], ['gu', 'langGujarati'], ['ha', 'langHausa'],
  ['hi', 'langHindi'], ['id', 'langIndonesian'], ['it', 'langItalian'],
  ['kn', 'langKannada'], ['ku', 'langKurdish'], ['ms', 'langMalay'],
  ['ps', 'langPashto'], ['fa', 'langPersian'], ['pt', 'langPortuguese'],
  ['ru', 'langRussian'], ['si', 'langSinhala'], ['so', 'langSomali'],
  ['es', 'langSpanish'], ['sw', 'langSwahili'], ['tl', 'langTagalog'],
  ['ta', 'langTamil'], ['te', 'langTelugu'], ['tr', 'langTurkish'],
  ['ur', 'langUrdu'], ['uz', 'langUzbek'], ['yo', 'langYoruba'],
];

export default function TabSystemPrefs({
  features,
  meta,
  onFeaturesChange,
  onMetaChange,
}: {
  features: FeaturesFormat;
  meta: SyncMeta;
  onFeaturesChange: (f: FeaturesFormat) => void;
  onMetaChange: (m: SyncMeta) => void;
}) {
  const t = useTheme();
  const f = features;
  const s = getStrings('en');
  const [pin, setPin] = useState('');
  const [pinMsg, setPinMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const langOptions = LANGS.map(([code, key]) => ({ value: code, label: String(s[key]) }));

  const changePin = async () => {
    const p = pin.trim();
    if (p.length < 4) return setPinMsg({ text: '⚠️ PIN must be at least 4 digits.', ok: false });
    if (!/^\d+$/.test(p)) return setPinMsg({ text: '⚠️ PIN must be numeric only.', ok: false });
    await StorageService.setPin(p);
    setPin('');
    setPinMsg({ text: '✅ PIN changed successfully.', ok: true });
    onMetaChange({ ...meta, pinHash: await hashPin(p) });
  };

  return (
    <SettingsTabScaffold title="System Preferences">
      <SettingsToggleRow
        label="Analog Clock Display"
        description="Show an analog clock face instead of the digital clock on the TV"
        value={f.showAnalogClock}
        onChange={(v) => onFeaturesChange({ ...f, showAnalogClock: v })}
      />

      {f.showAnalogClock && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary }}>Analog Clock Size</span>
              <div style={{ fontSize: 12, color: t.textSecondary }}>Reduce to fit masjid name &amp; countdown on screen</div>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: t.accentTeal }}>{f.analogClockSize}%</span>
          </div>
          <input
            type="range"
            min={30}
            max={150}
            step={5}
            value={f.analogClockSize}
            onChange={(e) => onFeaturesChange({ ...f, analogClockSize: parseInt(e.target.value, 10) })}
            style={{ width: '100%', accentColor: t.accentTeal }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: t.textSecondary, marginTop: 2 }}>
            <span>Compact (30%)</span>
            <span>Default (65%)</span>
            <span>Large (150%)</span>
          </div>
        </div>
      )}

      {!f.showAnalogClock && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary }}>Digital Clock Size</span>
              <div style={{ fontSize: 12, color: t.textSecondary }}>Reduce to fit masjid name &amp; countdown on screen</div>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: t.accentTeal }}>{f.digitalClockSizePercent ?? 75}%</span>
          </div>
          <input
            type="range"
            min={40}
            max={120}
            step={5}
            value={f.digitalClockSizePercent ?? 75}
            onChange={(e) => onFeaturesChange({ ...f, digitalClockSizePercent: parseInt(e.target.value, 10) })}
            style={{ width: '100%', accentColor: t.accentTeal }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: t.textSecondary, marginTop: 2 }}>
            <span>Compact (40%)</span>
            <span>Default (75%)</span>
            <span>Large (120%)</span>
          </div>
        </div>
      )}

      <SettingsDropdown
        label="Display Language"
        value={f.displayLanguage}
        onChange={(v) => onFeaturesChange({ ...f, displayLanguage: v })}
        options={langOptions}
      />

      <SettingsToggleRow
        label="Use 24-Hour Time Format"
        description="Display times as 13:00 instead of 1:00 PM"
        value={f.use24HourFormat}
        onChange={(v) => onFeaturesChange({ ...f, use24HourFormat: v })}
      />
      <SettingsToggleRow
        label="Use Arabic Prayer Labels"
        description="Show الفجر, الظهر, العصر… (overrides language for prayer names)"
        value={f.useArabicLabels}
        onChange={(v) => onFeaturesChange({ ...f, useArabicLabels: v })}
      />
      <SettingsToggleRow
        label="Enable Adhan & Iqamah Sound Alerts"
        description="Play audio alert at Adhan and Iqamah times"
        value={f.audioAlertsEnabled}
        onChange={(v) => onFeaturesChange({ ...f, audioAlertsEnabled: v })}
      />

      <SettingsDropdown
        label="Adhan Audio File"
        value={AUDIO_FILES.includes(f.adhanAudio) ? f.adhanAudio : AUDIO_FILES[0]}
        onChange={(v) => onFeaturesChange({ ...f, adhanAudio: v })}
        options={AUDIO_FILES.map((a) => ({ value: a, label: a }))}
      />
      <SettingsDropdown
        label="Iqamah Audio File"
        value={AUDIO_FILES.includes(f.iqamahAudio) ? f.iqamahAudio : AUDIO_FILES[0]}
        onChange={(v) => onFeaturesChange({ ...f, iqamahAudio: v })}
        options={AUDIO_FILES.map((a) => ({ value: a, label: a }))}
      />

      <SettingsDropdown
        label="Adhan Alert Display Mode"
        value={f.adhanAlertMode}
        onChange={(v) => onFeaturesChange({ ...f, adhanAlertMode: v as FeaturesFormat['adhanAlertMode'] })}
        options={[
          { value: 'full_screen', label: 'Mode 1: Full Screen Alert (Covers entire screen)' },
          { value: 'dismissible', label: 'Mode 2: Dismissible Alert (Shows close button)' },
          { value: 'side_panel', label: 'Mode 3: Side Panel Only (No overlay, panel shows alert)' },
        ]}
      />

      <SettingsSectionHeader title="Display Appearance" />

      <SettingsDropdown
        label="Display Font Family"
        value={meta.displayFontFamily ?? 'Roboto'}
        onChange={(v) => onMetaChange({ ...meta, displayFontFamily: v })}
        options={[
          { value: 'Roboto', label: 'Roboto (Default)' },
          { value: 'Arial', label: 'Arial' },
          { value: 'Times New Roman', label: 'Times New Roman' },
          { value: 'Courier', label: 'Courier' },
          { value: 'Verdana', label: 'Verdana' },
        ]}
      />

      <ColorSwatchPicker label="Primary Text Color (Clock, Prayer Names)" currentHex={meta.primaryTextColor} onChange={(h) => onMetaChange({ ...meta, primaryTextColor: h })} />
      <ColorSwatchPicker label="Accent / Secondary Color (Highlights, Countdown)" currentHex={meta.secondaryTextColor} onChange={(h) => onMetaChange({ ...meta, secondaryTextColor: h })} />
      <ColorSwatchPicker label="Prayer Name Color (Normal Rows)" currentHex={meta.prayerNameColor} onChange={(h) => onMetaChange({ ...meta, prayerNameColor: h })} />
      <ColorSwatchPicker label="Prayer Time Color (Adhan & Iqamah Normal Rows)" currentHex={meta.prayerTimeColor} onChange={(h) => onMetaChange({ ...meta, prayerTimeColor: h })} />
      <ColorSwatchPicker label="Date & Hijri Text Color" currentHex={meta.dateTextColor} onChange={(h) => onMetaChange({ ...meta, dateTextColor: h })} />
      <ColorSwatchPicker label="Scrolling Ticker Text Color" currentHex={meta.tickerTextColor} onChange={(h) => onMetaChange({ ...meta, tickerTextColor: h })} />

      <SettingsSectionHeader title="Hardware Display Settings (Local)" />
      <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 12 }}>
        These settings apply only to this device and are not synced. Use "Force Landscape" for wall-mounted TVs.
      </div>
      <SettingsDropdown
        label="Display Orientation"
        value={meta.displayOrientation}
        onChange={(v) => onMetaChange({ ...meta, displayOrientation: v as SyncMeta['displayOrientation'] })}
        options={[
          { value: 'auto', label: 'Auto (Follow Device Rotation)' },
          { value: 'landscape', label: 'Landscape (Recommended for TVs)' },
          { value: 'portrait', label: 'Portrait (90° CW — vertical screen)' },
          { value: 'portrait-flip', label: 'Portrait Flipped (90° CCW — vertical, other way)' },
          { value: 'landscape-flip', label: 'Landscape Flipped (180° — upside-down TV)' },
        ]}
      />
      <SettingsToggleRow
        label="Show Orientation Toggle Button"
        description="Displays a floating icon on the TV screen to switch orientation without entering settings. Disable to hide it."
        value={meta.showOrientationFab}
        onChange={(v) => onMetaChange({ ...meta, showOrientationFab: v })}
      />

      <SettingsSectionHeader title="Local Admin PIN" />
      <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 12 }}>
        Optionally lock settings access with a PIN on this device. Disabled by default.
      </div>
      <SettingsToggleRow
        label="Require PIN to Open Settings"
        description="If off, settings open without a PIN (easier for testing)"
        value={meta.pinEnabled}
        onChange={(v) => {
          StorageService.setPinEnabled(v);
          onMetaChange({ ...meta, pinEnabled: v });
        }}
      />
      <SettingsFormField label="New PIN" helpText="Minimum 4 digits. Stored securely as a SHA-256 hash.">
        <div style={{ display: 'flex', gap: 12 }}>
          <TextInput type="password" inputMode="numeric" maxLength={8} value={pin} placeholder="Enter new numeric PIN" onChange={(e) => setPin(e.target.value)} />
          <PrimaryButton onClick={changePin} style={{ whiteSpace: 'nowrap' }}>
            Set PIN
          </PrimaryButton>
        </div>
      </SettingsFormField>
      {pinMsg && <div style={{ fontSize: 13, color: pinMsg.ok ? t.accentTeal : t.accentRed }}>{pinMsg.text}</div>}
    </SettingsTabScaffold>
  );
}
