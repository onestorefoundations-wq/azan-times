/**
 * authSession.js
 * Tenant-scoped JWT handling for the superadmin dashboard.
 *
 * The dashboard used to log in by SELECTing admin_users and comparing the typed
 * password to password_hash, which required anon read access to the credential
 * table. Login now goes through the `auth` Edge Function and every Supabase
 * request carries the returned token, which the RLS policies filter on.
 */
import { FUNCTIONS_URL, SUPABASE_ANON_KEY } from './supabaseConfig';

const K_TOKEN = 'auth_token';
const K_REFRESH = 'auth_refresh_token';
const K_EXPIRES = 'auth_token_expires_at';

/**
 * Supabase access tokens last about an hour; the refresh token is what keeps
 * the session alive. This is a margin before expiry, not a renewal interval.
 */
const REFRESH_WINDOW_MS = 5 * 60 * 1000;

export const AuthSession = {
  getToken: () => localStorage.getItem(K_TOKEN),

  isAuthenticated() {
    const token = localStorage.getItem(K_TOKEN);
    const expiresAt = Number(localStorage.getItem(K_EXPIRES) ?? 0);
    return Boolean(token) && (expiresAt === 0 || Date.now() < expiresAt);
  },

  getRefreshToken: () => localStorage.getItem(K_REFRESH),

  save(session) {
    localStorage.setItem(K_TOKEN, session.token);
    if (session.refreshToken) localStorage.setItem(K_REFRESH, session.refreshToken);
    localStorage.setItem(K_EXPIRES, String(session.expiresAt));
    localStorage.setItem('tenant_id', session.tenantId);
    localStorage.setItem('username', session.username);
  },

  clear() {
    localStorage.removeItem(K_TOKEN);
    localStorage.removeItem(K_REFRESH);
    localStorage.removeItem(K_EXPIRES);
    localStorage.removeItem('tenant_id');
    localStorage.removeItem('username');
  },

  async login(identifier, password) {
    const session = await callAuth({ action: 'login', identifier, password });
    AuthSession.save(session);
    return session;
  },

  async register(params) {
    const session = await callAuth({ action: 'register', ...params });
    AuthSession.save(session);
    return session;
  },

  async refreshIfNeeded() {
    const token = AuthSession.getToken();
    const refreshToken = AuthSession.getRefreshToken();
    if (!token && !refreshToken) return false;

    const expiresAt = Number(localStorage.getItem(K_EXPIRES) ?? 0);
    if (token && expiresAt > 0 && expiresAt - Date.now() > REFRESH_WINDOW_MS) return true;
    if (!refreshToken) return false;

    try {
      AuthSession.save(await callAuth({ action: 'refresh', refreshToken }));
      return true;
    } catch (e) {
      console.warn('[Auth] refresh failed', e);
      return false;
    }
  },
};

async function callAuth(body) {
  const res = await fetch(`${FUNCTIONS_URL}/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Auth failed (${res.status})`);
  return data;
}
