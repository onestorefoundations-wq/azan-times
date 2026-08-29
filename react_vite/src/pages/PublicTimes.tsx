/**
 * PublicTimes.tsx
 * The read-only prayer-times page behind the QR code on the display, installable
 * as a PWA so the congregation keeps the times on their phone.
 *
 * Deliberately isolated from the rest of the app:
 *  - it is its own Vite entry (masjid.html) and imports neither the store, the
 *    settings bundle, AuthSession nor the router, so there is no code path from
 *    here into anything that can edit and no TV asset in its bundle;
 *  - it talks only to the `public-times` Edge Function, which returns a
 *    whitelist of display fields;
 *  - it caches the payload and recomputes times locally with the same `adhan`
 *    engine the display uses, so it keeps working with no signal — which is the
 *    point of installing it.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppConfig, appConfigFromCloudJson } from '../core/appConfig';
import { PrayerConfig, calculatePrayers, getNextPrayer } from '../core/prayerEngine';
import { FUNCTIONS_URL } from '../core/supabaseConfig';

const CACHE_KEY = 'public_times_cache';
const LAST_SLUG_KEY = 'public_times_last_slug';
/** Re-fetch at most this often; the page renders from cache in the meantime. */
const REFRESH_MS = 6 * 60 * 60 * 1000;

interface PublicPayload {
  mosque_name: string;
  slug: string;
  config_version: number;
  masjid_profile: Record<string, unknown> | null;
  time_adjustments: Record<string, unknown> | null;
  features_format: Record<string, unknown> | null;
  jumuah_settings: Record<string, unknown> | null;
}

interface CacheEntry {
  payload: PublicPayload;
  fetchedAt: number;
}

const readCache = (slug: string): CacheEntry | null => {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY}:${slug}`);
    return raw ? (JSON.parse(raw) as CacheEntry) : null;
  } catch {
    return null;
  }
};

const writeCache = (slug: string, payload: PublicPayload) => {
  try {
    localStorage.setItem(
      `${CACHE_KEY}:${slug}`,
      JSON.stringify({ payload, fetchedAt: Date.now() } satisfies CacheEntry),
    );
    localStorage.setItem(LAST_SLUG_KEY, slug);
  } catch {
    /* private mode, quota — the page still renders from memory */
  }
};

/** The installed PWA opens /m with no slug; send it to the last one viewed. */
export const lastViewedSlug = (): string | null => {
  try {
    return localStorage.getItem(LAST_SLUG_KEY);
  } catch {
    return null;
  }
};

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
  // Installed from the home screen the app opens /m with no slug, so fall back
  // to the last mosque this phone looked at.
  const slug = (slugProp ?? lastViewedSlug() ?? '').toLowerCase();

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

  const load = useCallback(
    async (force = false) => {
      if (!slug) return;
      const cached = readCache(slug);
      if (!force && cached && Date.now() - cached.fetchedAt < REFRESH_MS) return;

      try {
        const res = await fetch(`${FUNCTIONS_URL}/public-times?slug=${encodeURIComponent(slug)}`);
        if (res.status === 404) {
          // Only surface this when there is nothing cached to show; an enabled
          // page that is briefly unreachable should not blank out.
          if (!cached) setError('This mosque page is not available.');
          return;
        }
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = (await res.json()) as PublicPayload;
        writeCache(slug, data);
        setPayload(data);
        setError(null);
      } catch (e) {
        console.warn('[PublicTimes] fetch failed', e);
        if (!cached) setError('Could not load prayer times. Check your connection.');
      }
    },
    [slug],
  );

  useEffect(() => {
    void load();
    // Times are recomputed locally, so a refresh is only about settings changes.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', () => void load(true));
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

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

  if (!slug) {
    return (
      <Shell>
        <p style={s.muted}>Scan the QR code on your mosque's display to open its times here.</p>
      </Shell>
    );
  }

  if (error && !payload) {
    return (
      <Shell>
        <p style={s.muted}>{error}</p>
      </Shell>
    );
  }

  if (!payload || !config) {
    return (
      <Shell>
        <p style={s.muted}>Loading…</p>
      </Shell>
    );
  }

  const use24 = config.features.use24HourFormat;

  return (
    <Shell>
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
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={s.page}>
      <div style={s.card}>{children}</div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    margin: 0,
    padding: '24px 16px',
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
  muted: { textAlign: 'center', color: 'rgba(232,240,254,0.6)', padding: '40px 0' },
};
