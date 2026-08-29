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
  accessToken: async () => AuthSession.getToken() ?? SUPABASE_ANON_KEY,
});
