import { createMMKV } from 'react-native-mmkv';

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  city?: string;
  value: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  total: number;
  currentPlayer: { rank: number; value: number };
}

export interface UserEntry {
  id: string;
  playerName: string;
  playerLevel: number;
  city: string | null;
  lastSeenAt: string;
}

export interface UsersResponse {
  entries: UserEntry[];
  total: number;
}

export interface PlayerProfile {
  id: string;
  playerName: string;
  playerLevel: number;
  playerXp: number;
  openedFloorsCount: number;
  city: string | null;
  lastSeenAt: string;
  createdAt: string;
  avgStars: number;
  revenuePerMin: number;
  maxRevenuePerMin: number;
  coinBonusPercent: number;
  xpBonusPercent: number;
  happyWorkers: number;
  specialistWorkers: number;
  totalWorkers: number;
  businessUpgrades: Record<string, number>;
  categoryProgress: Record<string, number>;
}

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
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
  retry = true,
): Promise<T> {
  const isAuthEndpoint = path === '/auth/login' || path === '/auth/register' || path === '/auth/guest';
  const token = getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token && !isAuthEndpoint) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry && !isAuthEndpoint) {
    if (!token) throw new Error('Unauthorized');
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

export interface GlobalStats {
  players: number;
  floors: number;
  cities: number;
}

export async function fetchGlobalStats(): Promise<GlobalStats> {
  const res = await fetch(`${API_BASE_URL}/stats`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
  leaderboard: (tab: 'level' | 'floors' | 'revenue', page: number) =>
    request<LeaderboardResponse>('GET', `/leaderboard?tab=${tab}&page=${page}`),
  getOnlinePlayers: (page: number) =>
    request<UsersResponse>('GET', `/players/online?page=${page}`),
  getNoCityPlayers: (page: number) =>
    request<UsersResponse>('GET', `/players/no-city?page=${page}`),
  searchPlayers: (q: string, page: number) =>
    request<UsersResponse>('GET', `/players/search?q=${encodeURIComponent(q)}&page=${page}`),
  getPlayerProfile: (id: string) =>
    request<PlayerProfile>('GET', `/players/${id}`),
  registerAsGuest: () =>
    request<{ accessToken: string; refreshToken: string; player: { id: string; email: string; playerName: string; isAdmin: boolean; isTemporary: true } }>(
      'POST', '/auth/guest',
    ),
  convertAccount: (email: string, password: string, playerName: string) =>
    request<{ player: { id: string; email: string; playerName: string; isAdmin: boolean; isTemporary: false } }>(
      'POST', '/auth/convert', { email, password, playerName },
    ),
  setTokens,
  clearTokens,
  getAccessToken,
};
