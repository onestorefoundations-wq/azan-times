/**
 * helpers.tsx
 * Shared settings UI: theme tokens + form widgets. Port of
 * flutter_app/lib/pages/settings/settings_helpers.dart.
 */
import { CSSProperties, ReactNode, createContext, useContext, useState } from 'react';

// ── Theme tokens (light/dark) ──────────────────────────────────
export interface SettingsTokens {
  bgPrimary: string;
  bgSurface: string;
  bgElevated: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  accentTeal: string;
  accentBlue: string;
  accentGold: string;
  accentRed: string;
  isDark: boolean;
}

export function makeTokens(isDark: boolean): SettingsTokens {
  return {
    isDark,
    bgPrimary: isDark ? '#0F172A' : '#F1F5F9',
    bgSurface: isDark ? '#1E293B' : '#FFFFFF',
    bgElevated: isDark ? '#263549' : '#F8FAFC',
    borderSubtle: isDark ? '#334155' : '#E2E8F0',
    textPrimary: isDark ? '#E2E8F0' : '#0F172A',
    textSecondary: isDark ? '#94A3B8' : '#64748B',
    accentTeal: '#14B8A6',
    accentBlue: '#3B82F6',
    accentGold: '#FBBF24',
    accentRed: '#EF4444',
  };
}

const ThemeCtx = createContext<SettingsTokens>(makeTokens(true));
export const useTheme = () => useContext(ThemeCtx);

export function SettingsThemeProvider({ isDark, children }: { isDark: boolean; children: ReactNode }) {
  return <ThemeCtx.Provider value={makeTokens(isDark)}>{children}</ThemeCtx.Provider>;
}

// ── Inputs ─────────────────────────────────────────────────────
export function inputStyle(t: SettingsTokens): CSSProperties {
  return {
    width: '100%',
    fontSize: 14,
    color: t.textPrimary,
    background: t.bgElevated,
    padding: '12px 14px',
    borderRadius: 8,
    border: `1px solid ${t.borderSubtle}`,
    outline: 'none',
  };
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const t = useTheme();
  return (
    <input
      {...props}
      style={{ ...inputStyle(t), ...(props.style || {}) }}
      onFocus={(e) => (e.currentTarget.style.borderColor = t.accentTeal)}
      onBlur={(e) => (e.currentTarget.style.borderColor = t.borderSubtle)}
    />
  );
}

// ── Layout ─────────────────────────────────────────────────────
export function SettingsTabScaffold({ title, children }: { title: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <div className="h-full overflow-y-auto" style={{ padding: 24 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: t.textPrimary }}>{title}</div>
      <div style={{ height: 1, background: t.borderSubtle, margin: '12px 0' }} />
      {children}
    </div>
  );
}

export function SettingsFormField({
  label,
  helpText,
  children,
}: {
  label: string;
  helpText?: string;
  children: ReactNode;
}) {
  const t = useTheme();
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: t.textSecondary, letterSpacing: 0.4 }}>{label}</div>
      <div style={{ height: 6 }} />
      {children}
      {helpText && <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 5 }}>{helpText}</div>}
    </div>
  );
}

export function SettingsFormRow({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div style={{ marginBottom: 0, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 240 }}>{left}</div>
      <div style={{ flex: 1, minWidth: 240 }}>{right}</div>
    </div>
  );
}

export function SettingsSectionHeader({ title }: { title: string }) {
  const t = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0 12px' }}>
      <span style={{ fontSize: 15, fontWeight: 700, color: t.accentTeal }}>{title}</span>
      <div style={{ flex: 1, height: 1, background: t.borderSubtle }} />
    </div>
  );
}

export function SettingsToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const t = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary }}>{label}</div>
        {description && <div style={{ fontSize: 12, color: t.textSecondary }}>{description}</div>}
      </div>
      <button
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        style={{
          width: 44,
          height: 24,
          borderRadius: 999,
          background: value ? t.accentTeal : t.borderSubtle,
          position: 'relative',
          transition: 'background 150ms',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: value ? 22 : 2,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 150ms',
          }}
        />
      </button>
    </div>
  );
}

export interface DropdownOption<T extends string | number> {
  value: T;
  label: string;
}

export function SettingsDropdown<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: DropdownOption<T>[];
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  const isNumber = typeof value === 'number';
  return (
    <SettingsFormField label={label}>
      <select
        value={String(value)}
        onChange={(e) => onChange((isNumber ? Number(e.target.value) : e.target.value) as T)}
        style={{ ...inputStyle(t), cursor: 'pointer', appearance: 'auto' }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)} style={{ background: t.bgElevated, color: t.textPrimary }}>
            {o.label}
          </option>
        ))}
      </select>
    </SettingsFormField>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  const t = useTheme();
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: t.accentTeal,
        color: t.isDark ? '#0F172A' : '#fff',
        padding: '14px 24px',
        borderRadius: 8,
        fontWeight: 700,
        fontSize: 14,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'default' : 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function OutlineButton({
  children,
  onClick,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
}) {
  const t = useTheme();
  return (
    <button
      onClick={onClick}
      style={{
        color: t.textSecondary,
        border: `1px solid ${t.borderSubtle}`,
        padding: '12px 20px',
        borderRadius: 8,
        cursor: 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ── Color swatch picker ────────────────────────────────────────
const PRESETS: [string, string][] = [
  ['White', 'FFFFFF'],
  ['Teal', '14B8A6'],
  ['Gold', 'FBBF24'],
  ['Green', '22C55E'],
  ['Blue', '3B82F6'],
  ['Purple', 'A855F7'],
  ['Red', 'EF4444'],
  ['Orange', 'F97316'],
  ['Pink', 'EC4899'],
  ['Slate', '94A3B8'],
];

const isValidHex = (hex: string) => /^[0-9A-Fa-f]{6}$/.test(hex.replace('#', ''));

export function ColorSwatchPicker({
  label,
  currentHex,
  onChange,
}: {
  label: string;
  currentHex: string | null;
  onChange: (hex: string) => void;
}) {
  const t = useTheme();
  const [text, setText] = useState(currentHex ?? '');
  const current = (currentHex ?? '').replace('#', '');

  return (
    <SettingsFormField label={label}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {PRESETS.map(([name, hex]) => {
          const selected = current.toUpperCase() === hex.toUpperCase();
          return (
            <button
              key={hex}
              title={name}
              onClick={() => {
                setText(hex);
                onChange(hex);
              }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: `#${hex}`,
                border: `${selected ? 2.5 : 1}px solid ${selected ? t.accentTeal : t.borderSubtle}`,
                boxShadow: selected ? `0 0 6px ${t.accentTeal}80` : undefined,
              }}
            />
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center' }}>
        <input
          value={text}
          placeholder="e.g. FFFFFF or 14B8A6"
          onChange={(e) => {
            const v = e.target.value;
            setText(v);
            const clean = v.replace('#', '').trim();
            if (isValidHex(clean)) onChange(clean.toUpperCase());
          }}
          style={{ ...inputStyle(t), fontFamily: 'monospace', flex: 1 }}
        />
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 8,
            background: isValidHex(current) ? `#${current}` : t.borderSubtle,
            border: `1px solid ${t.borderSubtle}`,
          }}
        />
      </div>
    </SettingsFormField>
  );
}
