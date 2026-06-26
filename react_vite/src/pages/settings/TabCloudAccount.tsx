/**
 * TabCloudAccount.tsx
 * Cloud Account & Sync. Port of tab_cloud_account.dart.
 * Operates on the live store (link/register/disconnect reload config),
 * then calls onConfigRefreshed so SettingsPage re-syncs its draft.
 */
import { useState } from 'react';
import { SupabaseSync } from '../../core/supabaseSync';
import { isLinked } from '../../core/appConfig';
import { useAppStore } from '../../store/appStore';
import SyncStatusChip from '../../components/SyncStatusChip';
import {
  PrimaryButton,
  SettingsFormField,
  SettingsFormRow,
  SettingsTabScaffold,
  TextInput,
  useTheme,
} from './helpers';

export default function TabCloudAccount({ onConfigRefreshed }: { onConfigRefreshed?: () => void }) {
  const t = useTheme();
  const config = useAppStore((s) => s.config);
  const syncStatus = useAppStore((s) => s.syncStatus);
  const onAccountChanged = useAppStore((s) => s.onAccountChanged);
  const linked = isLinked(config);

  const [mode, setMode] = useState<'link' | 'register'>('link');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Link form
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');
  // Register form
  const [regMosque, setRegMosque] = useState('');
  const [regUser, setRegUser] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPw, setRegPw] = useState('');

  const reset = (msg: string) => {
    setSuccess(msg);
    void onAccountChanged().then(() => onConfigRefreshed?.());
  };

  const link = async () => {
    if (!loginId.trim() || !loginPw) return setError('Username / Email / Mobile and Password are required.');
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await SupabaseSync.linkAccount(loginId.trim(), loginPw);
      reset(`✅ Successfully linked to ${res.mosqueName}!`);
      setLoginId('');
      setLoginPw('');
    } catch (e) {
      setError(`❌ ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const register = async () => {
    if (!regMosque.trim() || !regUser.trim() || !regPw)
      return setError('Mosque Name, Username, and Password are required.');
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await SupabaseSync.registerAccount({
        mosqueName: regMosque.trim(),
        username: regUser.trim(),
        password: regPw,
        mobile: regMobile.trim() || undefined,
        email: regEmail.trim() || undefined,
      });
      reset(`✅ Account created and linked to ${res.mosqueName}!`);
      setRegMosque('');
      setRegUser('');
      setRegMobile('');
      setRegEmail('');
      setRegPw('');
    } catch (e) {
      setError(`❌ ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Disconnect from cloud? This display will stop syncing. Local settings remain intact.')) return;
    setLoading(true);
    setError(null);
    try {
      await SupabaseSync.disconnectAccount();
      reset('✅ Successfully disconnected from cloud sync.');
    } catch (e) {
      setError(`❌ Failed to disconnect: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const banner = (msg: string, isError: boolean) => {
    const c = isError ? t.accentRed : t.accentTeal;
    return (
      <div style={{ margin: '0 0 16px', padding: '12px 14px', borderRadius: 8, background: `${c}1A`, border: `1px solid ${c}66`, color: c, fontSize: 13, fontWeight: 600 }}>
        {msg}
      </div>
    );
  };

  const infoRow = (label: string, value: string) => (
    <div style={{ display: 'flex', marginBottom: 8 }}>
      <span style={{ width: 140, fontSize: 13, fontWeight: 600, color: t.textSecondary }}>{label}</span>
      <span style={{ flex: 1, fontSize: 13, color: t.textPrimary }}>{value}</span>
    </div>
  );

  return (
    <SettingsTabScaffold title="Cloud Account & Sync">
      <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 16 }}>
        Link this display to a cloud account or create a new mosque account to sync settings across all displays.
      </div>

      {error && banner(error, true)}
      {success && banner(success, false)}

      {linked ? (
        <>
          <div style={{ padding: 20, borderRadius: 12, background: t.bgElevated, border: `1px solid ${t.borderSubtle}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <span style={{ fontSize: 24 }}>🟢</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: t.accentTeal }}>Connected to Cloud Sync</div>
                <div style={{ marginTop: 4 }}>
                  <SyncStatusChip status={syncStatus} />
                </div>
              </div>
            </div>
            <div style={{ height: 1, background: t.borderSubtle, margin: '0 0 16px' }} />
            {infoRow('Mosque Name', config.meta.linkedMosqueName ?? config.profile.name)}
            {infoRow('Admin Username', config.meta.linkedUsername ?? 'N/A')}
            {infoRow('Admin Email', config.meta.linkedEmail ?? 'Not configured')}
            {infoRow('Admin Mobile', config.meta.linkedMobile ?? 'Not configured')}
            {infoRow(
              'Last Synced',
              config.meta.lastSuccessfulSync ? new Date(config.meta.lastSuccessfulSync).toLocaleString() : 'Never',
            )}
          </div>
          <button
            onClick={loading ? undefined : disconnect}
            style={{ marginTop: 16, padding: '12px 20px', borderRadius: 8, border: `1px solid ${t.accentRed}`, color: t.accentRed }}
          >
            {loading ? 'Disconnecting…' : '🚪 Disconnect / Sign Out'}
          </button>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', marginBottom: 24 }}>
            {(['link', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                  setSuccess(null);
                }}
                style={{
                  flex: 1,
                  padding: '14px 0',
                  fontSize: 14,
                  fontWeight: 700,
                  color: mode === m ? t.accentTeal : t.textSecondary,
                  borderBottom: `2.5px solid ${mode === m ? t.accentTeal : 'transparent'}`,
                }}
              >
                {m === 'link' ? '🔗 Link Existing Account' : '📝 Create New Account'}
              </button>
            ))}
          </div>

          {mode === 'link' ? (
            <>
              <SettingsFormField label="Username / Email / Mobile Number">
                <TextInput value={loginId} placeholder="e.g. admin@mosque.com or 07700900000" onChange={(e) => setLoginId(e.target.value)} />
              </SettingsFormField>
              <SettingsFormField label="Password">
                <TextInput type="password" value={loginPw} placeholder="••••••••" onChange={(e) => setLoginPw(e.target.value)} />
              </SettingsFormField>
              <PrimaryButton onClick={loading ? undefined : link} style={{ width: '100%' }}>
                {loading ? 'Linking…' : 'Link Account & Sync Settings'}
              </PrimaryButton>
            </>
          ) : (
            <>
              <SettingsFormField label="Mosque / Masjid Name">
                <TextInput value={regMosque} placeholder="e.g. Central Masjid London" onChange={(e) => setRegMosque(e.target.value)} />
              </SettingsFormField>
              <SettingsFormField label="Admin Username">
                <TextInput value={regUser} placeholder="e.g. centraladmin" onChange={(e) => setRegUser(e.target.value)} />
              </SettingsFormField>
              <SettingsFormRow
                left={
                  <SettingsFormField label="Mobile Number (Optional)">
                    <TextInput value={regMobile} placeholder="e.g. +447700900000" onChange={(e) => setRegMobile(e.target.value)} />
                  </SettingsFormField>
                }
                right={
                  <SettingsFormField label="Email Address (Optional)">
                    <TextInput value={regEmail} placeholder="e.g. admin@masjid.com" onChange={(e) => setRegEmail(e.target.value)} />
                  </SettingsFormField>
                }
              />
              <SettingsFormField label="Password" helpText="Minimum 6 characters recommended.">
                <TextInput type="password" value={regPw} placeholder="Minimum 6 characters recommended" onChange={(e) => setRegPw(e.target.value)} />
              </SettingsFormField>
              <PrimaryButton onClick={loading ? undefined : register} style={{ width: '100%' }}>
                {loading ? 'Creating Account…' : 'Create Account & Link Display'}
              </PrimaryButton>
            </>
          )}
        </>
      )}
    </SettingsTabScaffold>
  );
}
