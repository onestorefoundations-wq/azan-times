/**
 * supabaseClient.ts
 * Shared Supabase client.
 *
 * Every request (PostgREST, Realtime, Functions) carries the tenant-scoped JWT
 * from AuthSession rather than the bare anon key, so the RLS policies in
 * 02_security_hardening.sql can filter on its tenant_id claim. When no session
 * exists the anon key is sent and the server correctly rejects everything.
 */
import { createClient } from '@supabase/supabase-js';
import { AuthSession } from './authSession';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabaseConfig';

export { APP_VERSION, FUNCTIONS_URL, SUPABASE_ANON_KEY, SUPABASE_URL } from './supabaseConfig';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  // Third-party auth hook: supabase-js calls this before each request and uses
  // the result as the Authorization bearer, including for realtime socket
  // re-auth. Supplying it disables the built-in Supabase Auth client, which we
  // do not use.
  // Supabase access tokens last about an hour, so refresh here rather than
  // relying on callers to do it first -- otherwise a display that has been
  // idle sends an expired token and the request fails for no visible reason.
  // refreshIfNeeded returns immediately when the token is still fresh, and
  // uses plain fetch, so this cannot recurse back into the client.
  accessToken: async () => {
    if (AuthSession.getToken()) await AuthSession.refreshIfNeeded();
    return AuthSession.getToken() ?? SUPABASE_ANON_KEY;
  },
});
