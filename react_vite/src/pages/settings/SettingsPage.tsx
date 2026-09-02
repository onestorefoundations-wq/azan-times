/**
 * SettingsPage.tsx
 * PIN gate → sidebar → 8 tabs → Discard/Save footer.
 * Port of flutter_app/lib/pages/settings/settings_page.dart.
 * The 6 config tabs edit a local draft; Save persists + (Phase 4) pushes to cloud.
 * Media & Cloud tabs act on the live store directly.
 */
import { CSSProperties, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppConfig } from '../../core/appConfig';
import { StorageService } from '../../core/storageService';
import { useAppStore } from '../../store/appStore';
import { SettingsThemeProvider, makeTokens, useIsNarrow } from './helpers';
import PinGate from './PinGate';
import TabGeneral from './TabGeneral';
import TabLocation from './TabLocation';
import TabPrayerOffsets from './TabPrayerOffsets';
import TabSlideshowJumuah from './TabSlideshowJumuah';
import TabTicker from './TabTicker';
import TabQuotes from './TabQuotes';
import TabSystemPrefs from './TabSystemPrefs';
import TabMediaLibrary from './TabMediaLibrary';
import TabCloudAccount from './TabCloudAccount';
import TabAppInfo from './TabAppInfo';

type TabKey =
  | 'general' | 'location' | 'prayers' | 'slideshow_jumuah'
  | 'ticker' | 'quotes' | 'system' | 'media' | 'account' | 'app';

// Grouped so the sidebar reads as three jobs -- describe the mosque, decide
// what the screen shows, look after the device -- rather than a flat list of
// ten unrelated entries.
const TAB_GROUPS: { group: string; tabs: { key: TabKey; label: string; short: string; icon: string }[] }[] = [
  {
    group: 'Mosque',
    tabs: [
      { key: 'general', label: 'General Info', short: 'General', icon: '🕌' },
      { key: 'location', label: 'Location & Calc', short: 'Location', icon: '📍' },
      { key: 'prayers', label: 'Prayer Offsets', short: 'Offsets', icon: '🕑' },
    ],
  },
  {
    group: 'Display',
    tabs: [
      { key: 'media', label: 'Media Library', short: 'Media', icon: '🖼️' },
      { key: 'slideshow_jumuah', label: "Slideshow & Jumu'ah", short: 'Slides', icon: '🎞️' },
      { key: 'ticker', label: 'Scrolling Ticker', short: 'Ticker', icon: '🔤' },
      { key: 'quotes', label: 'Quotes & Hadith', short: 'Quotes', icon: '📖' },
    ],
  },
  {
    group: 'Device',
    tabs: [
      { key: 'system', label: 'System Preferences', short: 'System', icon: '⚙️' },
      { key: 'account', label: 'Cloud & Sync', short: 'Cloud', icon: '☁️' },
      { key: 'app', label: 'App & Updates', short: 'App', icon: '📲' },
    ],
  },
];

// Phone navigation: the same ten tabs as the sidebar, split into two rows of
// five in sidebar order so the two surfaces never disagree about ordering.
const FLAT_TABS = TAB_GROUPS.flatMap((g) => g.tabs);
const BOTTOM_ROWS = [FLAT_TABS.slice(0, 5), FLAT_TABS.slice(5, 10)];

function bottomCellStyle(active: boolean, t: ReturnType<typeof makeTokens>): CSSProperties {
  return {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    padding: '7px 2px',
    color: active ? t.accentTeal : t.textSecondary,
    background: active ? 'rgba(20,184,166,0.12)' : 'transparent',
    borderTop: `2px solid ${active ? t.accentTeal : 'transparent'}`,
  };
}

const bottomLabelStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: 0.2,
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

// 5-minute auth memory across opens, matching SettingsPage.lastAuthTime.
let lastAuthTime = 0;

export default function SettingsPage() {
  const navigate = useNavigate();
  const storeConfig = useAppStore((s) => s.config);
  const saveConfig = useAppStore((s) => s.saveConfig);

  const [draft, setDraft] = useState<AppConfig>(storeConfig);
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  // On phones the rail becomes a drawer; on desktop it is always on screen.
  const narrow = useIsNarrow();
  const [navOpen, setNavOpen] = useState(false);
  const [authed, setAuthed] = useState<boolean>(
    () => !StorageService.isPinEnabled() || Date.now() - lastAuthTime < 5 * 60_000,
  );

  const isDark = !draft.meta.adminLightTheme;
  const t = useMemo(() => makeTokens(isDark), [isDark]);

  // Media & Cloud write straight to the store, so only the draft-backed tabs
  // can leave unsaved work behind.
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(storeConfig), [draft, storeConfig]);
  const activeLabel = TAB_GROUPS.flatMap((g) => g.tabs).find((x) => x.key === activeTab)?.label ?? '';

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
            gap: narrow ? 6 : 0,
            padding: narrow ? '10px 12px' : '16px 24px',
            background: t.bgSurface,
            borderBottom: `1px solid ${t.borderSubtle}`,
          }}
        >
          {narrow ? (
            // The bottom bar carries navigation on phones, so the header is
            // just "where am I" plus the two window controls.
            <span style={{ fontSize: 16, fontWeight: 700, color: t.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeLabel}
            </span>
          ) : (
            <>
              <span style={{ fontSize: 20, fontWeight: 700, color: t.textPrimary }}>🛠️ Settings Panel</span>
              <span style={{ fontSize: 13, color: t.textSecondary, marginLeft: 12 }}>/ {activeLabel}</span>
            </>
          )}
          <div style={{ flex: 1 }} />
          <button
            title="Toggle theme"
            onClick={() => setDraft((d) => ({ ...d, meta: { ...d.meta, adminLightTheme: isDark } }))}
            style={{ width: 44, height: 44, color: t.textSecondary, fontSize: 18, marginRight: narrow ? 0 : 8, flexShrink: 0 }}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
          <button
            title="Discard & Close"
            onClick={close}
            style={{ width: 44, height: 44, color: t.textSecondary, fontSize: 18, flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1" style={{ position: 'relative' }}>
          {/* Backdrop closes the drawer on phones. */}
          {narrow && navOpen && (
            <div
              onClick={() => setNavOpen(false)}
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 30 }}
            />
          )}

          {/* Sidebar: a fixed rail on desktop, a slide-over drawer on phones. */}
          <div
            style={
              narrow
                ? {
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: 0,
                    width: 250,
                    zIndex: 31,
                    background: t.bgSurface,
                    borderRight: `1px solid ${t.borderSubtle}`,
                    overflowY: 'auto',
                    paddingBottom: 12,
                    transform: navOpen ? 'translateX(0)' : 'translateX(-100%)',
                    transition: 'transform 180ms ease',
                    boxShadow: navOpen ? '0 0 24px rgba(0,0,0,0.4)' : undefined,
                  }
                : { width: 216, background: t.bgSurface, borderRight: `1px solid ${t.borderSubtle}`, overflowY: 'auto', paddingBottom: 12 }
            }
          >
            {TAB_GROUPS.map(({ group, tabs }) => (
              <div key={group}>
                <div
                  style={{
                    padding: '14px 16px 6px',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: t.textSecondary,
                    opacity: 0.7,
                  }}
                >
                  {group}
                </div>
                {tabs.map((tab) => {
                  const active = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => {
                        setActiveTab(tab.key);
                        setNavOpen(false);
                      }}
                      onMouseEnter={(e) => {
                        if (!active) e.currentTarget.style.background = t.bgElevated;
                      }}
                      onMouseLeave={(e) => {
                        if (!active) e.currentTarget.style.background = 'transparent';
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9,
                        width: '100%',
                        textAlign: 'left',
                        // Roomier rows on touch screens.
                        padding: narrow ? '13px 16px' : '10px 16px',
                        fontSize: 13,
                        fontWeight: active ? 700 : 500,
                        color: active ? t.textPrimary : t.textSecondary,
                        background: active ? 'rgba(20,184,166,0.12)' : 'transparent',
                        borderLeft: `3px solid ${active ? t.accentTeal : 'transparent'}`,
                        transition: 'background 120ms',
                      }}
                    >
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Content */}
          <div className="min-h-0 flex-1">
            {activeTab === 'general' && (
              <TabGeneral
                profile={draft.profile}
                template={draft.meta.displayTemplate}
                onChange={(profile) => setDraft({ ...draft, profile })}
                onTemplateChange={(displayTemplate) =>
                  setDraft({ ...draft, meta: { ...draft.meta, displayTemplate } })
                }
              />
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
            {activeTab === 'quotes' && (
              <TabQuotes quotes={draft.quotes} onChange={(quotes) => setDraft({ ...draft, quotes })} />
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
            {activeTab === 'app' && <TabAppInfo />}
          </div>
        </div>

        {/* Bottom navigation (phones only): two rows of five tabs, plus More
            for the labelled drawer. Thumb-reachable, unlike a top hamburger. */}
        {narrow && (
          <div style={{ background: t.bgSurface, borderTop: `1px solid ${t.borderSubtle}` }}>
            {BOTTOM_ROWS.map((row, rowIndex) => (
              <div key={rowIndex} style={{ display: 'flex', borderTop: rowIndex === 0 ? 'none' : `1px solid ${t.borderSubtle}` }}>
                {row.map((tab) => {
                  const active = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => {
                        setActiveTab(tab.key);
                        setNavOpen(false);
                      }}
                      title={tab.label}
                      style={bottomCellStyle(active, t)}
                    >
                      <span style={{ fontSize: 17, lineHeight: 1 }}>{tab.icon}</span>
                      <span style={bottomLabelStyle}>{tab.short}</span>
                    </button>
                  );
                })}
                {/* The More cell sits at the end of the second row. */}
                {rowIndex === 1 && (
                  <button
                    onClick={() => setNavOpen(true)}
                    title="All settings"
                    aria-label="Open settings menu"
                    style={{ ...bottomCellStyle(navOpen, t), flex: '0 0 54px', borderLeft: `1px solid ${t.borderSubtle}` }}
                  >
                    <span style={{ fontSize: 17, lineHeight: 1 }}>⋯</span>
                    <span style={bottomLabelStyle}>More</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: narrow ? '10px 12px' : '14px 24px',
            background: t.bgSurface,
            borderTop: `1px solid ${t.borderSubtle}`,
          }}
        >
          {!narrow && (
            <>
              <span style={{ fontSize: 12, color: dirty ? t.accentGold : t.textSecondary }}>
                {dirty ? '● Unsaved changes' : 'All changes saved'}
              </span>
              <div style={{ flex: 1 }} />
            </>
          )}
          <button
            onClick={close}
            style={{ flex: narrow ? 1 : undefined, padding: '12px 20px', minHeight: 44, borderRadius: 8, border: `1px solid ${t.borderSubtle}`, color: t.textSecondary }}
          >
            Discard
          </button>
          <button
            onClick={save}
            style={{ flex: narrow ? 2 : undefined, padding: '12px 24px', minHeight: 44, borderRadius: 8, background: t.accentTeal, color: isDark ? '#0F172A' : '#fff', fontWeight: 700 }}
          >
            {narrow && dirty ? '● Save Changes' : 'Save Changes'}
          </button>
        </div>
      </div>
    </SettingsThemeProvider>
  );
}
