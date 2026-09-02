/**
 * supabaseConfig.ts
 * Project coordinates, split out from supabaseClient so authSession can import
 * them without a cycle (the client's accessToken hook reads from authSession).
 *
 * The anon key is public by design -- it ships inside every bundle. After
 * 02_security_hardening.sql it grants nothing on its own: every table is
 * REVOKEd from anon, and reads require the tenant-scoped JWT from the `auth`
 * Edge Function.
 */

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://veyrcvvvsomyrahjfvhh.supabase.co';

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleXJjdnZ2c29teXJhaGpmdmhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NjI5MzUsImV4cCI6MjA5NzMzODkzNX0.-N470V130EwnrJabX1CMId8hLiaQal0g_al_eMJzQ-Q';

export const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

export const APP_VERSION = '1.1.0-react';

/**
 * Where the congregation's page is publicly reachable. Needed because the app
 * cannot always derive it from itself: inside the Android WebView the origin is
 * `https://localhost` (androidScheme: https), so a link built from
 * window.location.origin came out as https://localhost/m/<slug> -- a QR code
 * and a "Copy link" that resolve to the phone showing them and to nobody else.
 */
export const PUBLIC_SITE_URL =
  import.meta.env.VITE_PUBLIC_SITE_URL ?? 'https://azan-times.vercel.app';

/**
 * The public URL for a mosque's read-only page.
 *
 * A real web deployment links to itself, so a preview build or a self-hosted
 * copy shares its own address rather than this repo's. Anything that is not a
 * public web origin -- the APK, `vite dev`, a file:// load -- falls back to the
 * canonical host, since a link to localhost is worse than useless when the
 * whole point is to hand it to someone else.
 */
export function publicPageUrl(slug: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const isShareable =
    /^https?:\/\//i.test(origin) && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|$)/i.test(origin);
  return `${isShareable ? origin : PUBLIC_SITE_URL}/m/${slug}`;
}
