import * as SecureStore from 'expo-secure-store';

const KEY_ACCESS = 'accessToken';
const KEY_REFRESH = 'refreshToken';

let cache: { access: string | null; refresh: string | null } = { access: null, refresh: null };

export async function initAuthStorage(): Promise<void> {
  cache.access = await SecureStore.getItemAsync(KEY_ACCESS);
  cache.refresh = await SecureStore.getItemAsync(KEY_REFRESH);
}

export function getAccessToken(): string | null {
  return cache.access;
}

export function getRefreshToken(): string | null {
  return cache.refresh;
}

export async function setTokens(access: string, refresh: string): Promise<void> {
  cache.access = access;
  cache.refresh = refresh;
  await Promise.all([
    SecureStore.setItemAsync(KEY_ACCESS, access).catch(() => {}),
    SecureStore.setItemAsync(KEY_REFRESH, refresh).catch(() => {}),
  ]);
}

export function clearTokens(): void {
  cache.access = null;
  cache.refresh = null;
  void SecureStore.deleteItemAsync(KEY_ACCESS);
  void SecureStore.deleteItemAsync(KEY_REFRESH);
}
