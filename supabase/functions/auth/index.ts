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

/**
 * Service-role client. Used for the admin API and for every table read, and
 * deliberately never used to sign anybody in: signInWithPassword stores the
 * resulting user session on the client it was called on, and supabase-js then
 * sends that user's access token on subsequent PostgREST requests instead of
 * the service key. The role silently drops from `service_role` to
 * `authenticated`, which is revoked on admin_users -- so the profile read
 * started returning 403 while the tenants read beside it still succeeded under
 * its own RLS policy. Nothing surfaced: the only visible symptom was `mobile`
 * coming back empty, because every other field the row supplies has a fallback.
 */
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Separate client for password verification and refresh, so the session those
 * calls establish cannot contaminate `admin`.
 */
const gotrue = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * Accounts registered without an email address carry a synthetic one so GoTrue
 * has something unique to key on. It is not deliverable and not something the
 * user ever typed, so it must never be shown back to them as their address.
 */
const NO_EMAIL_DOMAIN = '@no-email.masjid.invalid';
const realEmail = (v: string | null | undefined): string =>
  v && !v.toLowerCase().endsWith(NO_EMAIL_DOMAIN) ? v : '';

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

  // A tenant can hold more than one admin_users row, which made maybeSingle()
  // fail outright and blank the profile. The auth user's own username picks the
  // right row; the oldest row is the fallback for tokens minted before the
  // username claim existed.
  const metaUsername = typeof meta.username === 'string' ? meta.username : '';
  let query = admin
    .from('admin_users')
    .select('username, mobile, email, tenant_id')
    .eq('tenant_id', tenantId);
  if (metaUsername) query = query.eq('username', metaUsername);

  let { data: profile, error: profileError } = await query.maybeSingle();
  // Swallowing this is what let a broken admin_users read look like an account
  // with no mobile number on file: every other field the row supplies has a
  // fallback, so nothing else changed when the query stopped returning rows.
  if (profileError) console.error('[auth] admin_users lookup failed', profileError);

  if (!profile && metaUsername) {
    const { data: fallback, error: fbError } = await admin
      .from('admin_users')
      .select('username, mobile, email, tenant_id')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (fbError) console.error('[auth] admin_users fallback lookup failed', fbError);
    profile = fallback;
  }

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
    email: realEmail(profile?.email) || realEmail(user?.user?.email),
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

      const { data, error } = await gotrue.auth.signInWithPassword({
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

      const authEmail = (email ?? `${username}${NO_EMAIL_DOMAIN}`).toLowerCase();
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

      // 05_supabase_auth.sql mirrors admin_users into auth.users keyed on a
      // shared id, and calls itself safe to re-run. GoTrue picks its own id for
      // a new account, so without this the two drift apart and the next run of
      // that script tries to insert a second auth.users row holding the same
      // email. Nothing has a foreign key onto admin_users.id, so realigning it
      // here is free.
      const { error: idError } = await admin
        .from('admin_users')
        .update({ id: created.user.id })
        .eq('tenant_id', row.tenant_id);
      if (idError) console.warn('[auth] could not align admin_users.id', idError.message);

      const { data: signIn, error: signInError } = await gotrue.auth.signInWithPassword({
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

      const { data, error } = await gotrue.auth.refreshSession({ refresh_token: refreshToken });
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
