/**
 * PublicTimes.tsx
 * The congregation's app: prayer times for the mosques this phone has scanned,
 * installable from the QR code on any mosque's display.
 *
 * Deliberately isolated from the rest of the app:
 *  - it is its own Vite entry (masjid.html) and imports neither the store, the
 *    settings bundle, AuthSession nor the router, so there is no code path from
 *    here into anything that can edit and no TV asset in its bundle;
 *  - it talks only to the `public-times` Edge Function, which returns a
 *    whitelist of display fields;
 *  - it caches each mosque's settings and recomputes times locally with the same
 *    `adhan` engine the display uses, so it keeps working with no signal — which
 *    is the point of installing it.
 *
 * One install holds many mosques rather than one app per mosque: most people
 * follow a single masjid, but travelling or a second jama'ah should be a tap,
 * not a hunt for an old link. The bottom navigation is where Qibla and anything
 * else lands later.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppConfig, appConfigFromCloudJson } from '../core/appConfig';
import { PrayerConfig, calculatePrayers, getNextPrayer } from '../core/prayerEngine';
import { FUNCTIONS_URL } from '../core/supabaseConfig';
import {
  PublicPayload,
  SavedMosque,
  forget,
  lastViewedSlug,
  listSaved,
  parseSlugInput,
  readCache,
  remember,
} from '../core/savedMosques';

/** Re-fetch at most this often; the page renders from cache in the meantime. */
const REFRESH_MS = 6 * 60 * 60 * 1000;

type Tab = 'times' | 'mosques';

const fmtTime = (d: Date, use24: boolean) =>
  d.toLocaleTimeString(undefined, {
    hour: use24 ? '2-digit' : 'numeric',
    minute: '2-digit',
    hour12: !use24,
  });

const countdown = (target: Date, now: Date): string => {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return 'now';
  const mins = Math.floor(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export default function PublicTimes({ slug: slugProp }: { slug?: string | null }) {
  // Opened from the home screen there is no slug in the path, so fall back to
  // the mosque this phone last looked at.
  const [slug, setSlug] = useState(() => (slugProp ?? lastViewedSlug() ?? '').toLowerCase());
  const [tab, setTab] = useState<Tab>('times');
  const [saved, setSaved] = useState<SavedMosque[]>(() => listSaved());

  const [payload, setPayload] = useState<PublicPayload | null>(() =>
    slug ? (readCache(slug)?.payload ?? null) : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  // A minute is enough: this page shows times and a coarse countdown.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async (target: string, force = false) => {
    if (!target) return;
    const cached = readCache(target);
    if (cached) setPayload(cached.payload);
    if (!force && cached && Date.now() - cached.fetchedAt < REFRESH_MS) return;

    try {
      const res = await fetch(`${FUNCTIONS_URL}/public-times?slug=${encodeURIComponent(target)}`);
      if (res.status === 404) {
        // Only surface this when there is nothing cached to show; a published
        // page that is briefly unreachable should not blank out.
        if (!cached) setError('No mosque found for that link.');
        return;
      }
      if (!res.ok) throw new Error(`Server returned ${res.status}`);

      const data = (await res.json()) as PublicPayload;
      remember(target, data);
      setSaved(listSaved());
      setPayload(data);
      setError(null);
    } catch (e) {
      console.warn('[PublicTimes] fetch failed', e);
      if (!cached) setError('Could not load prayer times. Check your connection.');
    }
  }, []);

  useEffect(() => {
    void load(slug);
  }, [slug, load]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load(slug);
    };
    const onOnline = () => void load(slug, true);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [slug, load]);

  /** Switch mosque without a router: update state and keep the URL shareable. */
  const openMosque = useCallback((next: string) => {
    setSlug(next);
    setPayload(readCache(next)?.payload ?? null);
    setError(null);
    setTab('times');
    try {
      window.history.pushState({}, '', `/m/${next}`);
    } catch {
      /* history is unavailable in some embedded webviews; state still switched */
    }
  }, []);

  const config: AppConfig | null = useMemo(() => {
    if (!payload) return null;
    return appConfigFromCloudJson({
      masjid_profile: payload.masjid_profile ?? undefined,
      time_adjustments: payload.time_adjustments ?? undefined,
      features_format: payload.features_format ?? undefined,
      jumuah_settings: payload.jumuah_settings ?? undefined,
    });
  }, [payload]);

  const prayers: PrayerConfig[] = useMemo(
    () => (config ? calculatePrayers(config, now) : []),
    [config, now],
  );
  // getNextPrayer reads the wall clock itself; `now` is in the dep list so the
  // highlight and countdown advance with the minute tick.
  const next = useMemo(
    () => (prayers.length ? getNextPrayer(prayers) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prayers, now],
  );

  // Nothing scanned yet: the mosque list is the only useful screen.
  const showMosques = tab === 'mosques' || (!slug && saved.length === 0);

  return (
    <div style={s.page}>
      <div style={s.card}>
        {showMosques ? (
          <MosquesView
            saved={saved}
            activeSlug={slug}
            onOpen={openMosque}
            onForget={(target) => {
              forget(target);
              setSaved(listSaved());
            }}
          />
        ) : (
          <TimesView
            payload={payload}
            config={config}
            prayers={prayers}
            next={next}
            now={now}
            error={error}
          />
        )}
      </div>

      <nav style={s.nav}>
        <NavButton label="Times" icon="🕌" active={tab === 'times'} onClick={() => setTab('times')} />
        <NavButton
          label="Mosques"
          icon="📍"
          active={tab === 'mosques'}
          onClick={() => setTab('mosques')}
          badge={saved.length || undefined}
        />
      </nav>
    </div>
  );
}

// ── Times ──────────────────────────────────────────────────────

function TimesView({
  payload,
  config,
  prayers,
  next,
  now,
  error,
}: {
  payload: PublicPayload | null;
  config: AppConfig | null;
  prayers: PrayerConfig[];
  next: PrayerConfig | null;
  now: Date;
  error: string | null;
}) {
  if (error && !payload) return <p style={s.muted}>{error}</p>;
  if (!payload || !config) return <p style={s.muted}>Loading…</p>;

  const use24 = config.features.use24HourFormat;

  return (
    <>
      <h1 style={s.title}>{payload.mosque_name}</h1>
      <p style={s.date}>
        {now.toLocaleDateString(undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      </p>

      {next && (
        <div style={s.nextCard}>
          <span style={s.nextLabel}>Next</span>
          <span style={s.nextName}>{next.name}</span>
          <span style={s.nextTime}>{fmtTime(next.adhanTime, use24)}</span>
          <span style={s.nextIn}>in {countdown(next.adhanTime, now)}</span>
        </div>
      )}

      <table style={s.table}>
        <thead>
          <tr>
            <th style={{ ...s.th, textAlign: 'left' }}>Prayer</th>
            <th style={s.th}>Adhan</th>
            <th style={s.th}>Iqamah</th>
          </tr>
        </thead>
        <tbody>
          {prayers.map((p) => (
            <tr key={p.key} style={next?.key === p.key ? s.rowActive : undefined}>
              <td style={{ ...s.td, textAlign: 'left', fontWeight: 600 }}>{p.name}</td>
              <td style={s.td}>{fmtTime(p.adhanTime, use24)}</td>
              <td style={s.td}>{p.noIqamah ? '—' : fmtTime(p.iqamahTime, use24)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {config.jumuah.enabled && (
        <div style={s.jumuah}>
          <strong>{config.jumuah.displayLabel}</strong>
          <span>
            Khutbah {config.jumuah.khutbahTime} · Iqamah {config.jumuah.iqamahTime}
          </span>
        </div>
      )}

      <p style={s.footer}>
        Times are calculated on your device, so this page works offline.
        {error ? ' Showing the last saved settings.' : ''}
      </p>
    </>
  );
}

// ── Mosques ────────────────────────────────────────────────────

function MosquesView({
  saved,
  activeSlug,
  onOpen,
  onForget,
}: {
  saved: SavedMosque[];
  activeSlug: string;
  onOpen: (slug: string) => void;
  onForget: (slug: string) => void;
}) {
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseSlugInput(input);
    if (!parsed) {
      setInputError('That does not look like a mosque link or code.');
      return;
    }
    setInput('');
    setInputError(null);
    onOpen(parsed);
  };

  return (
    <>
      <h1 style={s.title}>Mosques</h1>
      <p style={s.date}>Scan a mosque's QR code to add it here.</p>

      {saved.length === 0 && (
        <p style={s.muted}>
          No mosques yet. Scan the QR code shown on your mosque's display, or paste its link below.
        </p>
      )}

      {saved.map((m) => (
        <div
          key={m.slug}
          style={{
            ...s.mosqueRow,
            ...(m.slug === activeSlug ? { borderColor: 'rgba(0,212,170,0.45)' } : null),
          }}
        >
          <button type="button" onClick={() => onOpen(m.slug)} style={s.mosqueButton}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{m.name}</span>
            <span style={{ fontSize: 12, color: 'rgba(232,240,254,0.45)' }}>/m/{m.slug}</span>
          </button>
          <button
            type="button"
            aria-label={`Remove ${m.name}`}
            onClick={() => onForget(m.slug)}
            style={s.removeButton}
          >
            ✕
          </button>
        </div>
      ))}

      <form onSubmit={submit} style={{ marginTop: 20 }}>
        <label style={{ fontSize: 12, color: 'rgba(232,240,254,0.5)' }}>Add by link or code</label>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setInputError(null);
            }}
            placeholder="central-mosque"
            style={s.input}
          />
          <button type="submit" style={s.addButton}>
            Add
          </button>
        </div>
        {inputError && <p style={{ color: '#ff6b6b', fontSize: 12, marginTop: 8 }}>{inputError}</p>}
      </form>
    </>
  );
}

// ── Bottom navigation ──────────────────────────────────────────

function NavButton({
  label,
  icon,
  active,
  onClick,
  badge,
}: {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...s.navButton, color: active ? '#00d4aa' : 'rgba(232,240,254,0.55)' }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 11 }}>
        {label}
        {badge ? ` (${badge})` : ''}
      </span>
    </button>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    margin: 0,
    // Room for the fixed bottom bar, plus the home indicator on phones.
    padding: '24px 16px calc(76px + env(safe-area-inset-bottom))',
    background: 'linear-gradient(160deg, #0d1b2a 0%, #1b263b 100%)',
    color: '#e8f0fe',
    fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    boxSizing: 'border-box',
  },
  card: { width: '100%', maxWidth: 480 },
  title: { margin: '0 0 4px', fontSize: 26, fontWeight: 700, textAlign: 'center' },
  date: { margin: '0 0 20px', textAlign: 'center', color: 'rgba(232,240,254,0.55)', fontSize: 14 },
  nextCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    padding: '16px',
    marginBottom: 20,
    borderRadius: 14,
    background: 'rgba(0,212,170,0.10)',
    border: '1px solid rgba(0,212,170,0.35)',
  },
  nextLabel: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: '#00d4aa' },
  nextName: { fontSize: 20, fontWeight: 600 },
  nextTime: { fontSize: 34, fontWeight: 700, lineHeight: 1.1 },
  nextIn: { fontSize: 13, color: 'rgba(232,240,254,0.6)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'right',
    padding: '8px 10px',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(232,240,254,0.45)',
    fontWeight: 500,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  td: {
    textAlign: 'right',
    padding: '13px 10px',
    fontSize: 17,
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    fontVariantNumeric: 'tabular-nums',
  },
  rowActive: { background: 'rgba(0,212,170,0.07)' },
  jumuah: {
    marginTop: 18,
    padding: '12px 14px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.04)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    fontSize: 14,
    flexWrap: 'wrap',
  },
  footer: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 12,
    color: 'rgba(232,240,254,0.35)',
    lineHeight: 1.6,
  },
  muted: { textAlign: 'center', color: 'rgba(232,240,254,0.6)', padding: '30px 0', lineHeight: 1.6 },
  mosqueRow: {
    display: 'flex',
    alignItems: 'stretch',
    gap: 8,
    marginBottom: 10,
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  mosqueButton: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 3,
    padding: '14px 14px',
    background: 'transparent',
    border: 'none',
    color: '#e8f0fe',
    textAlign: 'left',
    cursor: 'pointer',
    font: 'inherit',
  },
  removeButton: {
    width: 46,
    background: 'transparent',
    border: 'none',
    borderLeft: '1px solid rgba(255,255,255,0.08)',
    color: 'rgba(232,240,254,0.4)',
    fontSize: 15,
    cursor: 'pointer',
  },
  input: {
    flex: 1,
    padding: '11px 12px',
    borderRadius: 9,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.05)',
    color: '#e8f0fe',
    fontSize: 14,
    font: 'inherit',
    outline: 'none',
  },
  addButton: {
    padding: '11px 18px',
    borderRadius: 9,
    border: '1px solid rgba(0,212,170,0.4)',
    background: 'rgba(0,212,170,0.12)',
    color: '#00d4aa',
    fontSize: 14,
    cursor: 'pointer',
    font: 'inherit',
  },
  nav: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    justifyContent: 'space-around',
    padding: '8px 0 calc(8px + env(safe-area-inset-bottom))',
    background: 'rgba(13,27,42,0.94)',
    backdropFilter: 'blur(12px)',
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  navButton: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '6px 0',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    font: 'inherit',
  },
};
