/**
 * savedMosques.ts
 * The congregation app's local list of mosques this phone has opened, plus the
 * cached payload for each.
 *
 * Most people follow one mosque, so the app opens straight into the last one
 * used. But scanning a second QR should add to the list rather than replace it —
 * travelling, a second jama'ah, a relative's masjid — so switching is a tap
 * instead of hunting for the old link.
 *
 * Everything here is per-device and read-only in nature: this app can view any
 * mosque that has published a page and can edit none of them.
 */

const CACHE_PREFIX = 'public_times_cache';
const LIST_KEY = 'public_saved_mosques';
const LAST_SLUG_KEY = 'public_times_last_slug';

/** Payload shape returned by the `public-times` Edge Function. */
export interface PublicPayload {
  mosque_name: string;
  slug: string;
  config_version: number;
  masjid_profile: Record<string, unknown> | null;
  time_adjustments: Record<string, unknown> | null;
  features_format: Record<string, unknown> | null;
  jumuah_settings: Record<string, unknown> | null;
}

export interface CacheEntry {
  payload: PublicPayload;
  fetchedAt: number;
}

export interface SavedMosque {
  slug: string;
  name: string;
  lastViewedAt: number;
}

// localStorage throws outright in some privacy modes, so every access is
// guarded — the app must still render, just without remembering anything.
const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode or quota — nothing to do but carry on */
  }
};

export const readCache = (slug: string): CacheEntry | null => {
  const raw = read(`${CACHE_PREFIX}:${slug}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
};

export const listSaved = (): SavedMosque[] => {
  const raw = read(LIST_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as SavedMosque[])
      .filter((m) => m && typeof m.slug === 'string')
      .sort((a, b) => (b.lastViewedAt ?? 0) - (a.lastViewedAt ?? 0));
  } catch {
    return [];
  }
};

/** The app opens with no slug; send it to the mosque last looked at. */
export const lastViewedSlug = (): string | null =>
  read(LAST_SLUG_KEY) ?? listSaved()[0]?.slug ?? null;

export const setLastViewed = (slug: string): void => write(LAST_SLUG_KEY, slug);

/**
 * Records a successful visit: caches the payload and moves the mosque to the
 * top of the list. Only called on a real response, so a typo'd slug never ends
 * up saved.
 */
export const remember = (slug: string, payload: PublicPayload): void => {
  write(`${CACHE_PREFIX}:${slug}`, JSON.stringify({ payload, fetchedAt: Date.now() }));
  setLastViewed(slug);

  const others = listSaved().filter((m) => m.slug !== slug);
  const entry: SavedMosque = {
    slug,
    name: payload.mosque_name || slug,
    lastViewedAt: Date.now(),
  };
  write(LIST_KEY, JSON.stringify([entry, ...others]));
};

export const forget = (slug: string): void => {
  write(LIST_KEY, JSON.stringify(listSaved().filter((m) => m.slug !== slug)));
  try {
    localStorage.removeItem(`${CACHE_PREFIX}:${slug}`);
  } catch {
    /* nothing to clean up */
  }
};

/**
 * Accepts what someone is likely to paste: a full link, a `/m/...` path, or the
 * bare code. Returns null when there is no plausible slug in it.
 */
export const parseSlugInput = (input: string): string | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const fromPath = /\/m\/([^/?#\s]+)/.exec(trimmed);
  const candidate = (fromPath ? fromPath[1] : trimmed).toLowerCase();

  return /^[a-z0-9-]{1,80}$/.test(candidate) ? candidate : null;
};
