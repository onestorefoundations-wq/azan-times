/**
 * authSession.ts
 * Holds the tenant-scoped JWT minted by the `auth` Edge Function and drives the
 * login / register / refresh calls.
 *
 * This replaces the old scheme where the client queried admin_users directly
 * and compared the password to password_hash. Nothing here ever sees a stored
 * password, and every Supabase request now travels as an `authenticated` role
 * carrying a tenant_id claim, which is what the RLS policies filter on.
 */
import { FUNCTIONS_URL, SUPABASE_ANON_KEY } from './supabaseConfig';

const K_TOKEN = 'auth_token';
const K_REFRESH = 'auth_refresh_token';
const K_EXPIRES = 'auth_token_expires_at';
const K_USER_ID = 'auth_user_id';

/**
 * Supabase access tokens last about an hour, so this is a small margin before
 * expiry rather than the long window a self-minted token allowed. The refresh
 * token is what actually persists the session across months of uptime.
 */
const REFRESH_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export interface AuthSession {
  token: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
  tenantId: string;
  username: string;
  mobile: string;
  email: string;
  mosqueName: string;
}

let cachedToken: string | null = null;

export const AuthSession = {
  getToken(): string | null {
    if (cachedToken) return cachedToken;
    cachedToken = localStorage.getItem(K_TOKEN);
    return cachedToken;
  },

  getExpiresAt(): number {
    return Number(localStorage.getItem(K_EXPIRES) ?? 0);
  },

  isExpired(): boolean {
    const exp = AuthSession.getExpiresAt();
    return exp > 0 && Date.now() >= exp;
  },

  getRefreshToken(): string | null {
    return localStorage.getItem(K_REFRESH);
  },

  save(session: AuthSession): void {
    cachedToken = session.token;
    localStorage.setItem(K_TOKEN, session.token);
    if (session.refreshToken) localStorage.setItem(K_REFRESH, session.refreshToken);
    localStorage.setItem(K_EXPIRES, String(session.expiresAt));
    localStorage.setItem(K_USER_ID, session.userId);
  },

  clear(): void {
    cachedToken = null;
    localStorage.removeItem(K_TOKEN);
    localStorage.removeItem(K_REFRESH);
    localStorage.removeItem(K_EXPIRES);
    localStorage.removeItem(K_USER_ID);
  },

  async login(identifier: string, password: string): Promise<AuthSession> {
    const session = await callAuth({ action: 'login', identifier, password });
    AuthSession.save(session);
    return session;
  },

  async register(params: {
    mosqueName: string;
    username: string;
    password: string;
    mobile?: string;
    email?: string;
  }): Promise<AuthSession> {
    const session = await callAuth({ action: 'register', ...params });
    AuthSession.save(session);
    return session;
  },

  /**
   * Renews the access token when it is close to expiring. Returns false only
   * when the session is genuinely gone and the user has to sign in again; a
   * network failure leaves the existing token in place so a display that is
   * merely offline does not log itself out.
   */
  async refreshIfNeeded(): Promise<boolean> {
    const token = AuthSession.getToken();
    const refreshToken = AuthSession.getRefreshToken();
    if (!token && !refreshToken) return false;

    const expiresAt = AuthSession.getExpiresAt();
    if (token && expiresAt > 0 && expiresAt - Date.now() > REFRESH_WINDOW_MS) return true;

    // Nothing to renew with: the token is stale and cannot be replaced.
    if (!refreshToken) return false;

    try {
      const session = await callAuth({ action: 'refresh', refreshToken });
      AuthSession.save(session);
      return true;
    } catch (e) {
      console.warn('[Auth] refresh failed', e);
      return !AuthSession.isExpired();
    }
  },
};

async function callAuth(body: Record<string, unknown>): Promise<AuthSession> {
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
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Auth failed (${res.status})`);
  return data as AuthSession;
}
