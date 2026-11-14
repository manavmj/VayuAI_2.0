import type { AuthUser } from '../types/vayu.ts';

const SESSION_TOKEN_KEY = 'vayu_ai_session_token_v1';
const LEGACY_STORAGE_KEYS = ['vayu_ai_accounts_v1', 'vayu_ai_active_session_v1'];

export function scrubLegacyInsecureStorage(): void {
  try {
    for (const key of LEGACY_STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {
    // Storage unavailable
  }
}

export function getSessionToken(): string | null {
  try {
    return sessionStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token: string | null): void {
  try {
    if (token) {
      sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // Storage unavailable
  }
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('X-Requested-With', 'VayuAI');

  const token = getSessionToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: 'same-origin',
  });
}

export async function fetchCurrentSessionUser(): Promise<AuthUser | null> {
  try {
    const res = await apiFetch('/api/auth/me', { method: 'GET' });
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: AuthUser | null };
    if (!data.user) {
      setSessionToken(null);
      return null;
    }
    return data.user;
  } catch {
    return null;
  }
}
