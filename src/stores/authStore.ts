import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';
import i18n from '../i18n';
import { api } from '../services/api';
import { setupUserPersistence, teardownPersistence } from '../services/persistence';

type GuestNameLocale = 'en';

const GUEST_NAME_POOLS: Record<GuestNameLocale, { adjectives: string[]; nouns: string[] }> = {
  en: {
    adjectives: ['Bold', 'Cheerful', 'Swift', 'Wise', 'Lucky'],
    nouns: ['Builder', 'Architect', 'Owner', 'Foreman', 'Creator'],
  },
};

function currentGuestNameLocale(): GuestNameLocale {
  return 'en';
  // Widen this once a second language is supported: return the app's
  // current i18n language if it's a supported GuestNameLocale, else 'en'.
}

void i18n; // referenced above for the future per-language lookup

interface PlayerInfo {
  id: string;
  email: string;
  playerName: string;
}

interface AuthState {
  player: PlayerInfo | null;
  lastPlayer: PlayerInfo | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
}

interface AuthActions {
  register: (email: string, password: string, playerName: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  quickLogin: (password: string) => Promise<void>;
  logout: () => void;
  loadTokens: () => void;
  enterAsGuest: () => void;
}

type AuthStore = AuthState & AuthActions;

let storage: ReturnType<typeof createMMKV> | null = null;
function getStorage() {
  if (!storage) storage = createMMKV({ id: 'auth' });
  return storage;
}

function saveLastPlayer(player: PlayerInfo) {
  getStorage().set('lastPlayer', JSON.stringify(player));
}

function loadLastPlayer(): PlayerInfo | null {
  const str = getStorage().getString('lastPlayer');
  if (!str) return null;
  try { return JSON.parse(str) as PlayerInfo; } catch { return null; }
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  player: null,
  lastPlayer: null,
  isAuthenticated: false,
  isGuest: false,
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
      saveLastPlayer(data.player);
      set({ player: data.player, lastPlayer: data.player, isAuthenticated: true, isLoading: false });
      setupUserPersistence(data.player.id);
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
      saveLastPlayer(data.player);
      set({ player: data.player, lastPlayer: data.player, isAuthenticated: true, isLoading: false });
      setupUserPersistence(data.player.id);
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  quickLogin: async (password) => {
    const last = get().lastPlayer;
    if (!last) throw new Error('No saved account');
    try {
      await get().login(last.email, password);
    } catch (e: unknown) {
      const status = (e as { status?: number })?.status;
      if (status === 404 || status === 401) {
        getStorage().remove('lastPlayer');
        set({ lastPlayer: null });
      }
      throw e;
    }
  },

  logout: () => {
    teardownPersistence();
    api.post('/auth/logout').catch(() => {});
    api.clearTokens();
    getStorage().remove('player');
    set({ player: null, isAuthenticated: false, isGuest: false });
  },

  enterAsGuest: () => {
    const pool = GUEST_NAME_POOLS[currentGuestNameLocale()];
    const adj = pool.adjectives[Math.floor(Math.random() * pool.adjectives.length)];
    const noun = pool.nouns[Math.floor(Math.random() * pool.nouns.length)];
    const guestPlayer: PlayerInfo = {
      id: `guest_${Date.now()}`,
      email: '',
      playerName: `${adj} ${noun}`,
    };
    set({ player: guestPlayer, isAuthenticated: false, isGuest: true });
  },

  loadTokens: () => {
    const lastPlayer = loadLastPlayer();
    const token = api.getAccessToken();
    const playerStr = getStorage().getString('player');
    if (token && playerStr) {
      try {
        const player = JSON.parse(playerStr) as PlayerInfo;
        set({ player, lastPlayer: lastPlayer ?? player, isAuthenticated: true });
        setupUserPersistence(player.id);
      } catch {
        set({ player: null, lastPlayer, isAuthenticated: false });
      }
    } else {
      set({ lastPlayer });
    }
  },
}));
