/**
 * supabaseClient.js
 * Every request carries the tenant-scoped JWT minted by the `auth` Edge
 * Function rather than the bare anon key, so the RLS policies added in
 * supabase/02_security_hardening.sql can filter on its tenant_id claim.
 */
import { createClient } from '@supabase/supabase-js'
import { AuthSession } from './authSession'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabaseConfig'

export { SUPABASE_URL, SUPABASE_ANON_KEY, FUNCTIONS_URL } from './supabaseConfig'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  accessToken: async () => AuthSession.getToken() ?? SUPABASE_ANON_KEY,
})
