/**
 * ThemeSelector.tsx
 * Displays 12 themes grouped into Dark / Medium / Light rows.
 * Each card shows a mini TV-preview; clicking applies and persists the theme.
 */
import { useState } from 'react';
import { THEMES, Theme, getTheme, setTheme } from '../../theme';
import { useTheme } from './helpers';

const GROUPS: { key: Theme['group']; label: string; emoji: string }[] = [
  { key: 'dark',   label: 'Dark',   emoji: '🌑' },
  { key: 'medium', label: 'Medium', emoji: '🌗' },
  { key: 'light',  label: 'Light',  emoji: '☀️' },
];

export default function ThemeSelector() {
  const t = useTheme();
  const [activeId, setActiveId] = useState(() => getTheme().id);

  const handleSelect = (id: string) => {
    setTheme(id);
    setActiveId(id);
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: t.textSecondary, letterSpacing: 0.6, marginBottom: 12 }}>
        DISPLAY THEME
      </div>

      {GROUPS.map(({ key, label, emoji }) => {
        const group = THEMES.filter((th) => th.group === key);
        return (
          <div key={key} style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: t.textSecondary,
              letterSpacing: 1.2,
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span>{emoji}</span>
              <span>{label.toUpperCase()}</span>
              <div style={{ flex: 1, height: 1, background: t.borderSubtle, marginLeft: 6 }} />
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {group.map((theme) => {
                const isActive = theme.id === activeId;
                return (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    isActive={isActive}
                    borderSubtle={t.borderSubtle}
                    bgElevated={t.bgElevated}
                    onSelect={() => handleSelect(theme.id)}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 4 }}>
        Theme applies instantly to the TV display and is saved across sessions.
      </div>
    </div>
  );
}

function ThemeCard({
  theme,
  isActive,
  borderSubtle,
  bgElevated,
  onSelect,
}: {
  theme: Theme;
  isActive: boolean;
  borderSubtle: string;
  bgElevated: string;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      title={theme.name}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 7,
        padding: '9px 10px',
        borderRadius: 12,
        border: `2px solid ${isActive ? theme.accent : borderSubtle}`,
        background: isActive ? `${theme.accent}20` : bgElevated,
        cursor: 'pointer',
        transition: 'border-color 0.18s, background 0.18s, box-shadow 0.18s',
        boxShadow: isActive ? `0 0 0 3px ${theme.accent}28` : 'none',
        minWidth: 82,
      }}
    >
      {/* Mini TV preview */}
      <div style={{
        width: 70,
        height: 42,
        borderRadius: 6,
        background: theme.bg,
        border: `1.5px solid ${theme.accent}70`,
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
      }}>
        {/* Clock time */}
        <div style={{
          position: 'absolute', top: 5, right: 7,
          fontSize: 9, fontWeight: 800,
          color: theme.primaryText,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: -0.3,
        }}>
          12:00
        </div>
        {/* Prayer name block */}
        <div style={{
          position: 'absolute', top: 7, left: 5,
          display: 'flex', flexDirection: 'column', gap: 2.5,
        }}>
          <div style={{ height: 3.5, width: 24, borderRadius: 2, background: theme.prayerName, opacity: 0.8 }} />
          <div style={{ height: 3.5, width: 20, borderRadius: 2, background: theme.prayerTime, opacity: 0.6 }} />
          <div style={{ height: 3.5, width: 22, borderRadius: 2, background: theme.prayerName, opacity: 0.6 }} />
        </div>
        {/* Highlighted row */}
        <div style={{
          position: 'absolute', bottom: 9, left: 3, right: 3,
          height: 7, borderRadius: 3,
          background: `${theme.accent}30`,
          border: `1px solid ${theme.accent}80`,
        }} />
        {/* Accent dot (countdown) */}
        <div style={{
          position: 'absolute', bottom: 10, right: 6,
          width: 5, height: 5, borderRadius: '50%',
          background: theme.secondaryText,
        }} />
        {/* Ticker strip */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 5, background: theme.tickerBg,
          borderTop: `1px solid ${theme.accent}50`,
        }} />
      </div>

      <span style={{
        fontSize: 10.5,
        fontWeight: isActive ? 700 : 500,
        color: isActive ? theme.accent : '#888',
        whiteSpace: 'nowrap',
        letterSpacing: 0.1,
      }}>
        {theme.name}
      </span>

      {isActive && (
        <span style={{
          fontSize: 8.5,
          color: theme.accent,
          fontWeight: 800,
          letterSpacing: 0.6,
          marginTop: -4,
        }}>
          ✓ ACTIVE
        </span>
      )}
    </button>
  );
}
