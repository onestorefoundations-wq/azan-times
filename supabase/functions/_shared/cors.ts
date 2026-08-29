/**
 * cors.ts
 * Shared CORS headers + preflight handling for the Edge Functions.
 *
 * ALLOWED_ORIGINS is a comma-separated secret (e.g. the kiosk PWA origin and
 * the superadmin dashboard origin). Unset means "*", which is only appropriate
 * while developing -- these endpoints mint auth tokens.
 */

const allowList = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowed =
    allowList.length === 0 ? '*' : allowList.includes(origin) ? origin : allowList[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

export const preflight = (req: Request): Response | null =>
  req.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders(req) }) : null;

export const json = (req: Request, body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
