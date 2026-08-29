/**
 * jwt.ts
 * Mints and verifies the tenant-scoped tokens the clients use in place of the
 * anon key. Signed HS256 with the project's JWT secret so PostgREST, Realtime
 * and Storage all accept them as ordinary `authenticated` sessions -- the
 * `tenant_id` claim is what the RLS policies in 02_security_hardening.sql read.
 *
 * Requires the APP_JWT_SECRET function secret to hold the project's JWT secret
 * (Dashboard -> Settings -> API -> JWT Settings -> JWT Secret).
 */
import { create, verify, getNumericDate, type Payload } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

const secret = Deno.env.get('APP_JWT_SECRET');
if (!secret) throw new Error('APP_JWT_SECRET is not set');

// Kiosk displays run unattended for months, so the token has to outlive any
// plausible offline stretch; clients call action=refresh well before expiry.
export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 180; // 180 days

const key = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(secret),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign', 'verify'],
);

export interface TenantClaims extends Payload {
  sub: string;
  tenant_id: string;
  role: 'authenticated';
  aud: 'authenticated';
}

export async function mintToken(userId: string, tenantId: string): Promise<string> {
  return await create(
    { alg: 'HS256', typ: 'JWT' },
    {
      sub: userId,
      tenant_id: tenantId,
      role: 'authenticated',
      aud: 'authenticated',
      iat: getNumericDate(0),
      exp: getNumericDate(TOKEN_TTL_SECONDS),
    },
    key,
  );
}

/** Returns the claims, or null when the token is absent, malformed or expired. */
export async function verifyToken(bearer: string | null): Promise<TenantClaims | null> {
  if (!bearer) return null;
  const raw = bearer.startsWith('Bearer ') ? bearer.slice(7) : bearer;
  try {
    const payload = (await verify(raw, key)) as TenantClaims;
    if (!payload.tenant_id || !payload.sub) return null;
    return payload;
  } catch {
    return null;
  }
}
