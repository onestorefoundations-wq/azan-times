import { useState } from 'react';
import { QuoteEntry, QuotesSettings } from '../../core/appConfig';
import {
  PrimaryButton,
  SettingsDropdown,
  SettingsSectionHeader,
  SettingsTabScaffold,
  SettingsToggleRow,
  TextInput,
  iconButtonStyle,
  useTheme,
} from './helpers';

/**
 * Editor for the hadith / ayah cards the Focus template rotates through.
 *
 * Deliberately separate from the ticker: ticker lines are short announcements
 * that scroll past, these are paragraphs the congregation reads while waiting,
 * and they carry an attribution the ticker has no field for.
 */
export default function TabQuotes({
  quotes,
  onChange,
}: {
  quotes: QuotesSettings;
  onChange: (q: QuotesSettings) => void;
}) {
  const t = useTheme();
  const [draftText, setDraftText] = useState('');
  const [draftSource, setDraftSource] = useState('');

  const addQuote = () => {
    const text = draftText.trim();
    if (!text) return;
    const entry: QuoteEntry = {
      // crypto.randomUUID is unavailable on some older WebViews; the timestamp
      // pair only has to be unique within one mosque's list.
      id: `q_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      text,
      source: draftSource.trim(),
    };
    onChange({ ...quotes, entries: [...quotes.entries, entry] });
    setDraftText('');
    setDraftSource('');
  };

  const removeQuote = (id: string) =>
    onChange({ ...quotes, entries: quotes.entries.filter((q) => q.id !== id) });

  const move = (index: number, delta: number) => {
    const next = [...quotes.entries];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ ...quotes, entries: next });
  };

  return (
    <SettingsTabScaffold title="Quotes & Hadith">
      <SettingsToggleRow
        label="Show Quotes Panel"
        description="Rotate hadith and ayah cards on the display. Only used by the Focus template."
        value={quotes.enabled}
        onChange={(v) => onChange({ ...quotes, enabled: v })}
      />

      <SettingsDropdown
        label="Time On Screen"
        value={quotes.rotationSeconds}
        onChange={(v) => onChange({ ...quotes, rotationSeconds: v })}
        options={[
          { value: 10, label: '10 seconds' },
          { value: 15, label: '15 seconds' },
          { value: 20, label: '20 seconds' },
          { value: 30, label: '30 seconds' },
          { value: 60, label: '1 minute' },
        ]}
      />

      <SettingsSectionHeader title="Quotes" />
      <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 16 }}>
        Each quote is shown in turn. Long passages are fine, but keep them short enough to read
        from across the hall.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        <TextInput
          value={draftText}
          placeholder="Quote text..."
          onChange={(e) => setDraftText(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <TextInput
            style={{ flex: '1 1 200px', width: 'auto' }}
            value={draftSource}
            placeholder="Source (optional), e.g. Daraqutni, Hasan"
            onChange={(e) => setDraftSource(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addQuote()}
          />
          <PrimaryButton onClick={addQuote}>Add</PrimaryButton>
        </div>
      </div>

      {quotes.entries.length === 0 ? (
        <div style={{ padding: 16, color: t.textSecondary }}>
          No quotes added yet. The display shows the next prayer and any slideshow images until one
          is added.
        </div>
      ) : (
        <div
          style={{ background: t.bgSurface, border: `1px solid ${t.borderSubtle}`, borderRadius: 8 }}
        >
          {quotes.entries.map((q, i) => (
            <div
              key={q.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                // Wraps the buttons onto their own line once the text column
                // would drop below 220px, which on a phone is the difference
                // between a readable quote and one word per line.
                flexWrap: 'wrap',
                gap: 10,
                padding: '12px 14px',
                borderBottom:
                  i === quotes.entries.length - 1 ? 'none' : `1px solid ${t.borderSubtle}`,
              }}
            >
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <div style={{ fontSize: 14, color: t.textPrimary, lineHeight: 1.45 }}>{q.text}</div>
                {q.source !== '' && (
                  <div style={{ marginTop: 4, fontSize: 12, color: t.textSecondary }}>
                    &mdash; {q.source}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 'auto' }}>
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  title="Move up"
                  style={{ ...iconButtonStyle(t.textSecondary), opacity: i === 0 ? 0.3 : 1 }}
                >
                  ↑
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === quotes.entries.length - 1}
                  title="Move down"
                  style={{ ...iconButtonStyle(t.textSecondary), opacity: i === quotes.entries.length - 1 ? 0.3 : 1 }}
                >
                  ↓
                </button>
                <button
                  onClick={() => removeQuote(q.id)}
                  title="Remove"
                  style={iconButtonStyle(t.accentRed)}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </SettingsTabScaffold>
  );
}
