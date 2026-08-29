/**
 * functions/public-times
 * Read-only prayer times for one mosque, for the page behind the QR code shown
 * on the display.
 *
 *   GET /public-times?slug=central-mosque
 *
 * Unauthenticated by design, so it is the one endpoint that must never hand
 * back anything but display data. It calls public_prayer_times(), which selects
 * a hard-coded whitelist of keys -- crucially not display_settings, the block
 * where a stale client could leave a PIN hash (unsalted SHA-256 of a 4-digit
 * code, i.e. instantly reversible).
 *
 * Only mosques with public_page_enabled are visible; the function cannot see
 * the others at all, so a wrong or guessed slug is a flat 404.
 *
 *   supabase functions deploy public-times --no-verify-jwt
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

// Deliberately open: this is public data meant to be embedded anywhere.
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
  // The page recomputes times locally from this payload, so it only needs to
  // change when a mosque edits its settings.
  'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
};

const SLUG_RE = /^[a-z0-9-]{1,80}$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  const slug = new URL(req.url).searchParams.get('slug')?.trim().toLowerCase() ?? '';
  if (!SLUG_RE.test(slug)) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
  }

  try {
    const { data, error } = await admin.rpc('public_prayer_times', { p_slug: slug });
    if (error) throw error;

    // Same response for "no such mosque" and "page not enabled", so the
    // endpoint cannot be used to enumerate which mosques exist.
    if (!data) {
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
    }

    return new Response(JSON.stringify(data), { status: 200, headers });
  } catch (e) {
    console.error('[public-times]', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers });
  }
});
