/**
 * jwt.ts
 * Verifies the caller's Supabase Auth token and pulls the tenant out of it.
 *
 * This used to mint HS256 tokens with the project's JWT secret. That secret is
 * the "previously_used" key on this project -- ES256 is what signs now -- so
 * anything built on it would have stopped working the day legacy JWT support
 * was switched off, logging out every display at once. Supabase Auth issues
 * the tokens instead, signed with whatever the current key is, and no secret
 * needs to exist in the deployment at all.
 *
 * tenant_id lives in app_metadata, which a user's own session cannot modify --
 * unlike user_metadata, which it can.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export interface TenantClaims {
  sub: string;
  tenant_id: string;
  email: string | null;
  username: string | null;
}

/**
 * Returns the caller's claims, or null when the token is absent, malformed,
 * expired, or carries no tenant. Verification is delegated to Supabase, so
 * this stays correct across key rotations.
 */
export async function verifyToken(bearer: string | null): Promise<TenantClaims | null> {
  if (!bearer) return null;
  const token = bearer.startsWith('Bearer ') ? bearer.slice(7) : bearer;

  // A short-lived client per call: getUser validates the token against the
  // project's current signing keys rather than trusting anything we decode.
  const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return null;

    const meta = (data.user.app_metadata ?? {}) as Record<string, unknown>;
    const tenantId = typeof meta.tenant_id === 'string' ? meta.tenant_id : null;
    // An authenticated user with no tenant must not be treated as belonging to
    // some default one; refuse rather than guess.
    if (!tenantId) return null;

    return {
      sub: data.user.id,
      tenant_id: tenantId,
      email: data.user.email ?? null,
      username: typeof meta.username === 'string' ? meta.username : null,
    };
  } catch {
    return null;
  }
}
