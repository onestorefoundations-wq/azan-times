/**
 * TemplateSelector.tsx
 * Picks the display layout. Sits above the theme picker in General Settings,
 * since the template decides what the theme is colouring.
 *
 * Each card is a scaled-down sketch of the real layout rather than a label, so
 * an admin can tell them apart without switching the TV back and forth.
 */
import { DisplayTemplate } from '../../core/appConfig';
import { useTheme } from './helpers';

const TEMPLATES: { id: DisplayTemplate; name: string; blurb: string }[] = [
  {
    id: 'focus',
    name: 'Focus',
    blurb: 'Times pinned along the bottom, rotating panel above.',
  },
  {
    id: 'classic',
    name: 'Classic',
    blurb: 'Clock panel beside the full prayer table.',
  },
];

export default function TemplateSelector({
  value,
  onChange,
}: {
  value: DisplayTemplate;
  onChange: (t: DisplayTemplate) => void;
}) {
  const t = useTheme();

  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: t.textSecondary,
          letterSpacing: 0.6,
          marginBottom: 12,
        }}
      >
        DISPLAY TEMPLATE
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {TEMPLATES.map((tpl) => {
          const isActive = tpl.id === value;
          return (
            <button
              key={tpl.id}
              onClick={() => onChange(tpl.id)}
              style={{
                flex: '1 1 180px',
                minWidth: 160,
                maxWidth: 240,
                textAlign: 'left',
                padding: 10,
                borderRadius: 10,
                background: t.bgElevated,
                border: `2px solid ${isActive ? 'var(--accent)' : t.borderSubtle}`,
                cursor: 'pointer',
              }}
            >
              <Sketch template={tpl.id} />
              <div
                style={{
                  marginTop: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  color: t.textPrimary,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {tpl.name}
                {isActive && <span style={{ color: 'var(--accent)' }}>✓</span>}
              </div>
              <div style={{ marginTop: 2, fontSize: 11, color: t.textSecondary, lineHeight: 1.35 }}>
                {tpl.blurb}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 16:9 mini-preview of where the blocks sit in each layout. */
function Sketch({ template }: { template: DisplayTemplate }) {
  const frame: React.CSSProperties = {
    width: '100%',
    aspectRatio: '16 / 9',
    borderRadius: 6,
    background: 'var(--bg)',
    padding: 6,
    display: 'flex',
    gap: 4,
    overflow: 'hidden',
  };
  const block = (extra: React.CSSProperties): React.CSSProperties => ({
    background: 'var(--surface)',
    borderRadius: 3,
    ...extra,
  });

  if (template === 'focus') {
    return (
      <div style={{ ...frame, flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={block({ width: '55%', height: '38%', opacity: 0.45 })} />
        </div>
        <div style={block({ height: '30%', flex: '0 0 auto' })} />
      </div>
    );
  }

  return (
    <div style={frame}>
      <div style={block({ flex: 3, opacity: 0.45 })} />
      <div style={block({ flex: 2, opacity: 0.45 })} />
    </div>
  );
}
