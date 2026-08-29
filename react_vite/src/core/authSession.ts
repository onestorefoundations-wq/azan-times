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
const K_EXPIRES = 'auth_token_expires_at';
const K_USER_ID = 'auth_user_id';

/** Refresh once the token is inside this window of expiring. */
const REFRESH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface AuthSession {
  token: string;
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

  save(session: AuthSession): void {
    cachedToken = session.token;
    localStorage.setItem(K_TOKEN, session.token);
    localStorage.setItem(K_EXPIRES, String(session.expiresAt));
    localStorage.setItem(K_USER_ID, session.userId);
  },

  clear(): void {
    cachedToken = null;
    localStorage.removeItem(K_TOKEN);
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
   * Renews the token when it is close to expiring. Returns false when the
   * session is gone for good and the user has to log in again; callers treat
   * that as "stay linked but sync is dead" rather than wiping local config.
   */
  async refreshIfNeeded(): Promise<boolean> {
    const token = AuthSession.getToken();
    if (!token) return false;
    const expiresAt = AuthSession.getExpiresAt();
    if (expiresAt > 0 && expiresAt - Date.now() > REFRESH_WINDOW_MS) return true;

    try {
      const session = await callAuth({ action: 'refresh' }, token);
      AuthSession.save(session);
      return true;
    } catch (e) {
      console.warn('[Auth] refresh failed', e);
      // A network failure must not log a kiosk out; only a hard rejection does.
      return !AuthSession.isExpired();
    }
  },
};

async function callAuth(body: Record<string, unknown>, bearer?: string): Promise<AuthSession> {
  const res = await fetch(`${FUNCTIONS_URL}/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${bearer ?? SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Auth failed (${res.status})`);
  return data as AuthSession;
}
