/**
 * SettingsPage.tsx
 * PIN gate → sidebar → 8 tabs → Discard/Save footer.
 * Port of flutter_app/lib/pages/settings/settings_page.dart.
 * The 6 config tabs edit a local draft; Save persists + (Phase 4) pushes to cloud.
 * Media & Cloud tabs act on the live store directly.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppConfig } from '../../core/appConfig';
import { StorageService } from '../../core/storageService';
import { useAppStore } from '../../store/appStore';
import { SettingsThemeProvider, makeTokens } from './helpers';
import PinGate from './PinGate';
import TabGeneral from './TabGeneral';
import TabLocation from './TabLocation';
import TabPrayerOffsets from './TabPrayerOffsets';
import TabSlideshowJumuah from './TabSlideshowJumuah';
import TabTicker from './TabTicker';
import TabSystemPrefs from './TabSystemPrefs';
import TabMediaLibrary from './TabMediaLibrary';
import TabCloudAccount from './TabCloudAccount';

type TabKey =
  | 'general' | 'location' | 'prayers' | 'slideshow_jumuah'
  | 'ticker' | 'system' | 'media' | 'account';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'general', label: 'General Info', icon: '🕌' },
  { key: 'location', label: 'Location & Calc', icon: '📍' },
  { key: 'prayers', label: 'Prayer Offsets', icon: '🕑' },
  { key: 'slideshow_jumuah', label: "Slideshow & Jumu'ah", icon: '🖼️' },
  { key: 'ticker', label: 'Scrolling Ticker', icon: '🔤' },
  { key: 'system', label: 'System Preferences', icon: '⚙️' },
  { key: 'media', label: 'Media Library', icon: '🖼️' },
  { key: 'account', label: 'Cloud & Sync', icon: '☁️' },
];

// 5-minute auth memory across opens, matching SettingsPage.lastAuthTime.
let lastAuthTime = 0;

export default function SettingsPage() {
  const navigate = useNavigate();
  const storeConfig = useAppStore((s) => s.config);
  const saveConfig = useAppStore((s) => s.saveConfig);

  const [draft, setDraft] = useState<AppConfig>(storeConfig);
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [authed, setAuthed] = useState<boolean>(
    () => !StorageService.isPinEnabled() || Date.now() - lastAuthTime < 5 * 60_000,
  );

  const isDark = !draft.meta.adminLightTheme;
  const t = useMemo(() => makeTokens(isDark), [isDark]);

  const close = () => navigate('/');
  const save = async () => {
    await saveConfig(draft);
    close();
  };

  if (!authed) {
    return (
      <SettingsThemeProvider isDark={isDark}>
        <PinGate
          onOk={() => {
            lastAuthTime = Date.now();
            setAuthed(true);
          }}
          onCancel={close}
        />
      </SettingsThemeProvider>
    );
  }

  return (
    <SettingsThemeProvider isDark={isDark}>
      <div className="flex h-full w-full flex-col" style={{ background: t.bgPrimary }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '16px 24px',
            background: t.bgSurface,
            borderBottom: `1px solid ${t.borderSubtle}`,
          }}
        >
          <span style={{ fontSize: 20, fontWeight: 700, color: t.textPrimary }}>🛠️ Settings Panel</span>
          <div style={{ flex: 1 }} />
          <button
            title="Toggle theme"
            onClick={() => setDraft((d) => ({ ...d, meta: { ...d.meta, adminLightTheme: isDark } }))}
            style={{ color: t.textSecondary, fontSize: 18, marginRight: 16 }}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
          <button title="Discard & Close" onClick={close} style={{ color: t.textSecondary, fontSize: 18 }}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1">
          {/* Sidebar */}
          <div style={{ width: 210, background: t.bgSurface, borderRight: `1px solid ${t.borderSubtle}`, overflowY: 'auto' }}>
            {TABS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px 16px',
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    color: active ? t.textPrimary : t.textSecondary,
                    background: active ? 'rgba(20,184,166,0.12)' : 'transparent',
                    borderLeft: `3px solid ${active ? t.accentTeal : 'transparent'}`,
                  }}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="min-h-0 flex-1">
            {activeTab === 'general' && (
              <TabGeneral profile={draft.profile} onChange={(profile) => setDraft({ ...draft, profile })} />
            )}
            {activeTab === 'location' && (
              <TabLocation profile={draft.profile} onChange={(profile) => setDraft({ ...draft, profile })} />
            )}
            {activeTab === 'prayers' && (
              <TabPrayerOffsets adjustments={draft.adjustments} onChange={(adjustments) => setDraft({ ...draft, adjustments })} />
            )}
            {activeTab === 'slideshow_jumuah' && (
              <TabSlideshowJumuah
                slideshow={draft.slideshow}
                jumuah={draft.jumuah}
                onSlideshowChange={(slideshow) => setDraft({ ...draft, slideshow })}
                onJumuahChange={(jumuah) => setDraft({ ...draft, jumuah })}
              />
            )}
            {activeTab === 'ticker' && (
              <TabTicker ticker={draft.ticker} onChange={(ticker) => setDraft({ ...draft, ticker })} />
            )}
            {activeTab === 'system' && (
              <TabSystemPrefs
                features={draft.features}
                meta={draft.meta}
                onFeaturesChange={(features) => setDraft({ ...draft, features })}
                onMetaChange={(meta) => setDraft({ ...draft, meta })}
              />
            )}
            {activeTab === 'media' && <TabMediaLibrary />}
            {activeTab === 'account' && (
              <TabCloudAccount onConfigRefreshed={() => setDraft(useAppStore.getState().config)} />
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
            padding: '14px 24px',
            background: t.bgSurface,
            borderTop: `1px solid ${t.borderSubtle}`,
          }}
        >
          <button onClick={close} style={{ padding: '12px 20px', borderRadius: 8, border: `1px solid ${t.borderSubtle}`, color: t.textSecondary }}>
            Discard
          </button>
          <button onClick={save} style={{ padding: '12px 24px', borderRadius: 8, background: t.accentTeal, color: isDark ? '#0F172A' : '#fff', fontWeight: 700 }}>
            Save Changes
          </button>
        </div>
      </div>
    </SettingsThemeProvider>
  );
}
