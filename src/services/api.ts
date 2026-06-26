import { createMMKV } from 'react-native-mmkv';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? (
  __DEV__ ? 'http://localhost:3000' : 'https://api.tinytower.com'
);

let storage: ReturnType<typeof createMMKV> | null = null;
function getStorage() {
  if (!storage) storage = createMMKV({ id: 'auth' });
  return storage;
}

function getAccessToken(): string | null {
  return getStorage().getString('accessToken') ?? null;
}

function getRefreshToken(): string | null {
  return getStorage().getString('refreshToken') ?? null;
}

function setTokens(access: string, refresh: string): void {
  getStorage().set('accessToken', access);
  getStorage().set('refreshToken', refresh);
}

function clearTokens(): void {
  getStorage().remove('accessToken');
  getStorage().remove('refreshToken');
  getStorage().remove('player');
}

let onAuthFailure: (() => void) | null = null;
export function setAuthFailureCallback(cb: () => void) {
  onAuthFailure = cb;
}

async function refreshTokens(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  retry = true,
): Promise<T> {
  const isAuthEndpoint = path === '/auth/login' || path === '/auth/register';
  const token = getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token && !isAuthEndpoint) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry && !isAuthEndpoint) {
    const refreshed = await refreshTokens();
    if (refreshed) return request<T>(method, path, body, false);
    clearTokens();
    onAuthFailure?.();
    throw new Error('Authentication failed');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  setTokens,
  clearTokens,
  getAccessToken,
};
