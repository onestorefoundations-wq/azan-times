import { useState } from 'react';
import { TickerSettings } from '../../core/appConfig';
import {
  PrimaryButton,
  SettingsDropdown,
  SettingsSectionHeader,
  SettingsTabScaffold,
  SettingsToggleRow,
  TextInput,
  useTheme,
} from './helpers';

export default function TabTicker({
  ticker,
  onChange,
}: {
  ticker: TickerSettings;
  onChange: (t: TickerSettings) => void;
}) {
  const t = useTheme();
  const [draftMsg, setDraftMsg] = useState('');

  const addMessage = () => {
    const m = draftMsg.trim();
    if (!m) return;
    onChange({ ...ticker, messages: [...ticker.messages, m] });
    setDraftMsg('');
  };

  const removeMessage = (i: number) =>
    onChange({ ...ticker, messages: ticker.messages.filter((_, idx) => idx !== i) });

  return (
    <SettingsTabScaffold title="Scrolling Ticker">
      <SettingsToggleRow
        label="Enable Scrolling Ticker"
        description="Display a marquee text banner at the bottom of the screen."
        value={ticker.enabled}
        onChange={(v) => onChange({ ...ticker, enabled: v })}
      />

      <SettingsDropdown
        label="Scroll Speed"
        value={ticker.speed}
        onChange={(v) => onChange({ ...ticker, speed: v })}
        options={[
          { value: 20, label: 'Slow (20)' },
          { value: 50, label: 'Normal (50)' },
          { value: 80, label: 'Fast (80)' },
          { value: 120, label: 'Very Fast (120)' },
        ]}
      />

      <SettingsSectionHeader title="Ticker Messages" />
      <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 16 }}>
        Add text messages to scroll across the bottom of the screen.
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <TextInput
          value={draftMsg}
          placeholder="Enter a new message..."
          onChange={(e) => setDraftMsg(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addMessage()}
        />
        <PrimaryButton onClick={addMessage}>Add</PrimaryButton>
      </div>

      {ticker.messages.length === 0 ? (
        <div style={{ padding: 16, color: t.textSecondary }}>No messages added yet.</div>
      ) : (
        <div style={{ background: t.bgSurface, border: `1px solid ${t.borderSubtle}`, borderRadius: 8 }}>
          {ticker.messages.map((m, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 14px',
                borderBottom: i === ticker.messages.length - 1 ? 'none' : `1px solid ${t.borderSubtle}`,
              }}
            >
              <span style={{ flex: 1, fontSize: 14, color: t.textPrimary }}>{m}</span>
              <button onClick={() => removeMessage(i)} title="Remove" style={{ color: t.accentRed, fontSize: 18 }}>
                🗑
              </button>
            </div>
          ))}
        </div>
      )}
    </SettingsTabScaffold>
  );
}
