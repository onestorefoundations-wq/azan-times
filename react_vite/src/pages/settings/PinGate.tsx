import { useState } from 'react';
import { StorageService } from '../../core/storageService';
import { useTheme } from './helpers';

export default function PinGate({ onOk, onCancel }: { onOk: () => void; onCancel: () => void }) {
  const t = useTheme();
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  const press = (key: string) => {
    setError(false);
    if (key === 'clear') setInput('');
    else if (key === 'back') setInput((s) => s.slice(0, -1));
    else if (input.length < 8) setInput((s) => s + key);
  };

  const submit = async () => {
    if (await StorageService.verifyPin(input)) onOk();
    else {
      setError(true);
      setInput('');
    }
  };

  const keyBtn = (k: string, label?: string, special = false) => (
    <button
      key={k}
      onClick={() => press(k)}
      style={{
        height: 56,
        borderRadius: 8,
        border: `1px solid ${t.borderSubtle}`,
        background: special ? t.bgElevated : t.bgSurface,
        color: special ? t.textSecondary : t.textPrimary,
        fontSize: special ? 13 : 18,
        fontWeight: 600,
      }}
    >
      {label ?? k}
    </button>
  );

  return (
    <div className="flex h-full w-full items-center justify-center" style={{ background: t.bgPrimary, padding: 16 }}>
      <div
        style={{
          width: 360,
          padding: 32,
          borderRadius: 20,
          background: t.bgSurface,
          border: `1px solid ${t.borderSubtle}`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ textAlign: 'center', fontSize: 48 }}>🔐</div>
        <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 700, color: t.textPrimary, marginTop: 8 }}>
          Local Admin Settings
        </div>
        <div style={{ textAlign: 'center', fontSize: 13, color: t.textSecondary, marginTop: 6 }}>
          Enter your Local Admin PIN to access settings.
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 8,
            margin: '24px 0',
            padding: '14px',
            borderRadius: 10,
            background: t.bgElevated,
            border: `1px solid ${error ? t.accentRed : t.borderSubtle}`,
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: i < input.length ? t.accentTeal : t.borderSubtle,
              }}
            />
          ))}
        </div>

        {error && <div style={{ color: t.accentRed, fontSize: 13, textAlign: 'center', marginBottom: 8 }}>Incorrect PIN. Try again.</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => keyBtn(n))}
          {keyBtn('clear', 'Clear', true)}
          {keyBtn('0')}
          {keyBtn('back', '⌫', true)}
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${t.borderSubtle}`, color: t.textSecondary }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!input}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 8,
              background: t.accentTeal,
              color: t.isDark ? '#0F172A' : '#fff',
              fontWeight: 700,
              opacity: input ? 1 : 0.5,
            }}
          >
            Enter
          </button>
        </div>
      </div>
    </div>
  );
}
