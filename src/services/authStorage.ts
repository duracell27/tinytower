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

export function setTokens(access: string, refresh: string): void {
  cache.access = access;
  cache.refresh = refresh;
  void SecureStore.setItemAsync(KEY_ACCESS, access);
  void SecureStore.setItemAsync(KEY_REFRESH, refresh);
}

export function clearTokens(): void {
  cache.access = null;
  cache.refresh = null;
  void SecureStore.deleteItemAsync(KEY_ACCESS);
  void SecureStore.deleteItemAsync(KEY_REFRESH);
}
