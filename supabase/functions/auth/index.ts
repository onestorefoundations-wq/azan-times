/**
 * functions/auth
 * Replaces the old client-side login, which compared the submitted password to
 * admin_users.password_hash with a plain PostgREST filter -- that required anon
 * SELECT on admin_users, so the anon key baked into every bundle could read
 * every tenant's credentials.
 *
 * Here the password never leaves the server: bcrypt comparison happens inside
 * app_login(), and the client gets back a tenant-scoped JWT that the RLS
 * policies in 02_security_hardening.sql key off.
 *
 *   POST { action: "login",    identifier, password }
 *   POST { action: "register", mosqueName, username, password, mobile?, email? }
 *   POST { action: "refresh" }  + Authorization: Bearer <current token>
 *
 * Response: { token, expiresAt, userId, tenantId, username, mobile, email, mosqueName }
 *
 * Deploy with --no-verify-jwt: login is by definition called without a token.
 *   supabase functions deploy auth --no-verify-jwt
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { json, preflight } from '../_shared/cors.ts';
import { TOKEN_TTL_SECONDS, mintToken, verifyToken } from '../_shared/jwt.ts';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

interface AccountRow {
  user_id: string;
  tenant_id: string;
  username: string | null;
  mobile: string | null;
  email: string | null;
  mosque_name: string | null;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

async function respondWithToken(req: Request, row: AccountRow): Promise<Response> {
  const token = await mintToken(row.user_id, row.tenant_id);
  return json(req, {
    token,
    expiresAt: Date.now() + TOKEN_TTL_SECONDS * 1000,
    userId: row.user_id,
    tenantId: row.tenant_id,
    username: row.username ?? '',
    mobile: row.mobile ?? '',
    email: row.email ?? '',
    mosqueName: row.mosque_name ?? 'Linked Mosque',
  });
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(req, { error: 'Invalid JSON body' }, 400);
  }

  const action = str(body.action);

  try {
    if (action === 'login') {
      const identifier = str(body.identifier);
      const password = str(body.password);
      if (!identifier || !password) return json(req, { error: 'Missing credentials' }, 400);

      const { data, error } = await admin.rpc('app_login', {
        p_identifier: identifier,
        p_password: password,
      });
      if (error) throw error;

      const row = (data as AccountRow[] | null)?.[0];
      if (!row) {
        // Constant-ish delay so a wrong username and a wrong password are not
        // trivially distinguishable by timing.
        await new Promise((r) => setTimeout(r, 300));
        return json(req, { error: 'Invalid username/mobile/email or password' }, 401);
      }
      return await respondWithToken(req, row);
    }

    if (action === 'register') {
      const mosqueName = str(body.mosqueName);
      const username = str(body.username);
      const password = str(body.password);
      if (!mosqueName || !username || !password)
        return json(req, { error: 'Mosque name, username and password are required' }, 400);
      if (password.length < 6)
        return json(req, { error: 'Password must be at least 6 characters' }, 400);

      const { data, error } = await admin.rpc('app_register', {
        p_mosque_name: mosqueName,
        p_username: username,
        p_password: password,
        p_mobile: str(body.mobile) || null,
        p_email: str(body.email) || null,
      });
      if (error) return json(req, { error: error.message }, 400);

      const row = (data as AccountRow[] | null)?.[0];
      if (!row) return json(req, { error: 'Registration failed' }, 400);
      return await respondWithToken(req, row);
    }

    if (action === 'refresh') {
      const claims = await verifyToken(req.headers.get('Authorization'));
      if (!claims) return json(req, { error: 'Token missing, invalid or expired' }, 401);

      const { data, error } = await admin.rpc('app_refresh', { p_user_id: claims.sub });
      if (error) throw error;

      const row = (data as AccountRow[] | null)?.[0];
      if (!row) return json(req, { error: 'Account no longer exists' }, 401);
      return await respondWithToken(req, row);
    }

    return json(req, { error: `Unknown action "${action}"` }, 400);
  } catch (e) {
    console.error('[auth]', action, e);
    return json(req, { error: 'Internal error' }, 500);
  }
});
