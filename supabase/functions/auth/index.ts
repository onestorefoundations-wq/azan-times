/**
 * functions/auth
 * Login, registration and token refresh, on top of Supabase Auth.
 *
 * Two problems this solves at once.
 *
 * The original scheme compared the submitted password to
 * admin_users.password_hash from the client, which required anon SELECT on the
 * credential table -- and the anon key ships in every bundle. Passwords are now
 * checked by GoTrue and admin_users is unreachable by any client role.
 *
 * The replacement scheme minted its own HS256 tokens using the project's JWT
 * secret. That key is "previously_used" here (ES256 signs now), so it would
 * have failed the moment legacy JWT support was disabled. Supabase issues the
 * tokens instead, so key rotation is no longer our problem and the deployment
 * holds no signing secret.
 *
 * The endpoint keeps its original shape so clients did not need reworking:
 *
 *   POST { action: "login",    identifier, password }
 *   POST { action: "register", mosqueName, username, password, mobile?, email? }
 *   POST { action: "refresh",  refreshToken }
 *
 * Response: { token, refreshToken, expiresAt, userId, tenantId, username,
 *             mobile, email, mosqueName }
 *
 *   supabase functions deploy auth --no-verify-jwt
 * (login is by definition called without a token)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { json, preflight } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

interface Session {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}

/**
 * Builds the client-facing payload from a GoTrue session, filling in the
 * profile fields the displays show from admin_users.
 */
async function sessionResponse(req: Request, session: Session, userId: string) {
  const { data: user } = await admin.auth.admin.getUserById(userId);
  const meta = (user?.user?.app_metadata ?? {}) as Record<string, unknown>;
  const tenantId = typeof meta.tenant_id === 'string' ? meta.tenant_id : null;

  if (!tenantId) return json(req, { error: 'Account is not linked to a mosque' }, 403);

  const { data: profile } = await admin
    .from('admin_users')
    .select('username, mobile, email, tenant_id')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const { data: tenant } = await admin
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .maybeSingle();

  return json(req, {
    token: session.access_token,
    refreshToken: session.refresh_token,
    // GoTrue access tokens are short-lived; the client refreshes with the
    // refresh token rather than holding one long-lived token as before.
    expiresAt: (session.expires_at ?? 0) * 1000,
    userId,
    tenantId,
    username: profile?.username ?? (typeof meta.username === 'string' ? meta.username : ''),
    mobile: profile?.mobile ?? '',
    email: profile?.email ?? user?.user?.email ?? '',
    mosqueName: tenant?.name ?? 'Linked Mosque',
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

      // People sign in with a username or mobile number; GoTrue only knows
      // email addresses, and accounts without one carry a synthetic address.
      const { data: email } = await admin.rpc('app_email_for_identifier', {
        p_identifier: identifier,
      });

      if (!email) {
        // Same delay and message as a wrong password, so this cannot be used
        // to discover which usernames exist.
        await new Promise((r) => setTimeout(r, 300));
        return json(req, { error: 'Invalid username/mobile/email or password' }, 401);
      }

      const { data, error } = await admin.auth.signInWithPassword({
        email: email as string,
        password,
      });
      if (error || !data?.session) {
        await new Promise((r) => setTimeout(r, 300));
        return json(req, { error: 'Invalid username/mobile/email or password' }, 401);
      }

      return await sessionResponse(req, data.session as Session, data.user!.id);
    }

    if (action === 'register') {
      const mosqueName = str(body.mosqueName);
      const username = str(body.username);
      const password = str(body.password);
      if (!mosqueName || !username || !password)
        return json(req, { error: 'Mosque name, username and password are required' }, 400);
      if (password.length < 6)
        return json(req, { error: 'Password must be at least 6 characters' }, 400);

      const mobile = str(body.mobile) || null;
      const email = str(body.email) || null;

      // Creates the tenant and the admin_users row in one transaction, and
      // rejects a duplicate username.
      const { data: reg, error: regError } = await admin.rpc('app_register', {
        p_mosque_name: mosqueName,
        p_username: username,
        p_password: password,
        p_mobile: mobile,
        p_email: email,
      });
      if (regError) return json(req, { error: regError.message }, 400);

      const row = (reg as { tenant_id: string }[] | null)?.[0];
      if (!row) return json(req, { error: 'Registration failed' }, 400);

      const authEmail = (email ?? `${username}@no-email.masjid.invalid`).toLowerCase();
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: authEmail,
        password,
        email_confirm: true,
        app_metadata: { tenant_id: row.tenant_id, username },
        user_metadata: { username },
      });

      if (createError || !created?.user) {
        // Don't strand a tenant with no way to sign in.
        await admin.from('admin_users').delete().eq('tenant_id', row.tenant_id);
        await admin.from('tenants').delete().eq('id', row.tenant_id);
        return json(req, { error: createError?.message ?? 'Could not create account' }, 400);
      }

      const { data: signIn, error: signInError } = await admin.auth.signInWithPassword({
        email: authEmail,
        password,
      });
      if (signInError || !signIn?.session)
        return json(req, { error: 'Account created, but sign-in failed. Try logging in.' }, 500);

      return await sessionResponse(req, signIn.session as Session, signIn.user!.id);
    }

    if (action === 'refresh') {
      const refreshToken = str(body.refreshToken);
      if (!refreshToken) return json(req, { error: 'Missing refresh token' }, 400);

      const { data, error } = await admin.auth.refreshSession({ refresh_token: refreshToken });
      if (error || !data?.session || !data.user)
        return json(req, { error: 'Session expired, please sign in again' }, 401);

      return await sessionResponse(req, data.session as Session, data.user.id);
    }

    return json(req, { error: `Unknown action "${action}"` }, 400);
  } catch (e) {
    console.error('[auth]', action, e);
    return json(req, { error: 'Internal error' }, 500);
  }
});
