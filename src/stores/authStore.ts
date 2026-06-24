import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';
import { api } from '../services/api';

interface PlayerInfo {
  id: string;
  email: string;
  playerName: string;
}

interface AuthState {
  player: PlayerInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthActions {
  register: (email: string, password: string, playerName: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loadTokens: () => void;
}

type AuthStore = AuthState & AuthActions;

let storage: ReturnType<typeof createMMKV> | null = null;
function getStorage() {
  if (!storage) storage = createMMKV({ id: 'auth' });
  return storage;
}

export const useAuthStore = create<AuthStore>((set) => ({
  player: null,
  isAuthenticated: false,
  isLoading: false,

  register: async (email, password, playerName) => {
    set({ isLoading: true });
    try {
      const data = await api.post<{
        accessToken: string;
        refreshToken: string;
        player: PlayerInfo;
      }>('/auth/register', { email, password, playerName });

      api.setTokens(data.accessToken, data.refreshToken);
      getStorage().set('player', JSON.stringify(data.player));
      set({ player: data.player, isAuthenticated: true, isLoading: false });
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const data = await api.post<{
        accessToken: string;
        refreshToken: string;
        player: PlayerInfo;
      }>('/auth/login', { email, password });

      api.setTokens(data.accessToken, data.refreshToken);
      getStorage().set('player', JSON.stringify(data.player));
      set({ player: data.player, isAuthenticated: true, isLoading: false });
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  logout: () => {
    api.post('/auth/logout').catch(() => {});
    api.clearTokens();
    getStorage().delete('player');
    set({ player: null, isAuthenticated: false });
  },

  loadTokens: () => {
    const token = api.getAccessToken();
    const playerStr = getStorage().getString('player');
    if (token && playerStr) {
      try {
        const player = JSON.parse(playerStr) as PlayerInfo;
        set({ player, isAuthenticated: true });
      } catch {
        set({ player: null, isAuthenticated: false });
      }
    }
  },
}));
