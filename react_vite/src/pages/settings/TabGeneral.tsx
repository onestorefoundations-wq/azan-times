import { MasjidProfile } from '../../core/appConfig';
import { SettingsFormField, SettingsTabScaffold, TextInput, useTheme } from './helpers';
import ThemeSelector from './ThemeSelector';

export default function TabGeneral({
  profile,
  onChange,
}: {
  profile: MasjidProfile;
  onChange: (p: MasjidProfile) => void;
}) {
  const t = useTheme();
  return (
    <SettingsTabScaffold title="General Settings">
      <ThemeSelector />
      <div style={{ height: 1, background: t.borderSubtle, margin: '4px 0 20px' }} />
      <SettingsFormField
        label="Masjid / Mosque Name"
        helpText="Displayed on the main TV screen and synced across all linked displays."
      >
        <TextInput
          value={profile.name}
          placeholder="e.g. Central Mosque London"
          onChange={(e) => onChange({ ...profile, name: e.target.value })}
        />
      </SettingsFormField>

      <SettingsFormField label="Arabic Mosque Name (Optional)" helpText="Shown below the English name on the TV display.">
        <TextInput
          value={profile.nameArabic ?? ''}
          dir="rtl"
          placeholder="مسجد"
          onChange={(e) => onChange({ ...profile, nameArabic: e.target.value.trim() === '' ? null : e.target.value })}
        />
      </SettingsFormField>

      <div
        style={{
          padding: 16,
          borderRadius: 10,
          background: t.bgElevated,
          border: `1px solid ${t.borderSubtle}`,
          color: t.textSecondary,
          fontSize: 13,
        }}
      >
        ☁️ To link this display to a cloud account for multi-device sync, go to the Cloud &amp; Sync tab.
      </div>
    </SettingsTabScaffold>
  );
}
