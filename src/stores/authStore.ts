import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';
import i18n from '../i18n';
import { api } from '../services/api';
import { setupUserPersistence, teardownPersistence, migrateToNewUser } from '../services/persistence';
import { useOnboardingStore } from './onboardingStore';
import { useGameStore } from './gameStore';

void i18n;

interface PlayerInfo {
  id: string;
  email: string;
  playerName: string;
  isAdmin?: boolean;
  isTemporary?: boolean;
}

interface AuthState {
  player: PlayerInfo | null;
  lastPlayer: PlayerInfo | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  pendingConvertModal: boolean;
  pendingRegistration: boolean;
}

interface AuthActions {
  register: (email: string, password: string, playerName: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  quickLogin: (password: string) => Promise<void>;
  clearLastPlayer: () => void;
  logout: () => void;
  deleteAccount: () => Promise<void>;
  loadTokens: () => void;
  enterAsGuest: () => Promise<void>;
  retryRegistration: () => Promise<void>;
  convertAccount: (email: string, password: string, playerName: string) => Promise<number>;
  requestConvertModal: () => void;
  clearConvertModal: () => void;
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

const OFFLINE_GUEST_ID = 'offline-guest';


export const useAuthStore = create<AuthStore>((set, get) => ({
  player: null,
  lastPlayer: null,
  isAuthenticated: false,
  isGuest: false,
  isLoading: false,
  pendingConvertModal: false,
  pendingRegistration: false,
  requestConvertModal: () => set({ pendingConvertModal: true }),
  clearConvertModal: () => set({ pendingConvertModal: false }),

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
      useOnboardingStore.getState().reset();
      useOnboardingStore.getState().start();
      useGameStore.getState().initOnboardingProductions();
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
      useOnboardingStore.getState().reset();
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  clearLastPlayer: () => {
    getStorage().remove('lastPlayer');
    set({ lastPlayer: null });
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
    getStorage().remove('pendingRegistration');
    set({ player: null, isAuthenticated: false, isGuest: false, pendingRegistration: false });
  },

  deleteAccount: async () => {
    await api.deleteAccount();
    teardownPersistence();
    api.clearTokens();
    getStorage().remove('player');
    getStorage().remove('pendingRegistration');
    getStorage().remove('lastPlayer');
    set({ player: null, lastPlayer: null, isAuthenticated: false, isGuest: false, pendingRegistration: false });
  },

  enterAsGuest: async () => {
    set({ isLoading: true });
    try {
      const data = await api.registerAsGuest();
      api.setTokens(data.accessToken, data.refreshToken);
      getStorage().set('player', JSON.stringify(data.player));
      saveLastPlayer(data.player);
      set({ player: data.player, lastPlayer: data.player, isAuthenticated: true, isGuest: false, isLoading: false });
      setupUserPersistence(data.player.id);
      useOnboardingStore.getState().reset();
      useOnboardingStore.getState().start();
      useGameStore.getState().initOnboardingProductions();
    } catch {
      const offlinePlayer: PlayerInfo = { id: OFFLINE_GUEST_ID, email: '', playerName: 'Guest', isTemporary: true };
      getStorage().set('player', JSON.stringify(offlinePlayer));
      getStorage().set('pendingRegistration', 'true');
      saveLastPlayer(offlinePlayer);
      setupUserPersistence(OFFLINE_GUEST_ID);
      useGameStore.setState({ isHydrated: true });
      set({ player: offlinePlayer, isAuthenticated: true, isGuest: true, pendingRegistration: true, isLoading: false });
      useOnboardingStore.getState().reset();
      useOnboardingStore.getState().start();
      useGameStore.getState().initOnboardingProductions();
    }
  },

  retryRegistration: async () => {
    if (!get().pendingRegistration) return;
    try {
      const data = await api.registerAsGuest();
      migrateToNewUser(data.player.id);
      api.setTokens(data.accessToken, data.refreshToken);
      getStorage().set('player', JSON.stringify(data.player));
      getStorage().remove('pendingRegistration');
      saveLastPlayer(data.player);
      set({ player: data.player, lastPlayer: data.player, isAuthenticated: true, isGuest: false, pendingRegistration: false });
      setupUserPersistence(data.player.id);
    } catch {
      // Still offline, retry next sync cycle
    }
  },

  convertAccount: async (email, password, playerName) => {
    set({ isLoading: true });
    try {
      const data = await api.convertAccount(email, password, playerName);
      const player = data.player;
      getStorage().set('player', JSON.stringify(player));
      saveLastPlayer(player);
      set({ player, lastPlayer: player, isAuthenticated: true, isLoading: false });
      setupUserPersistence(player.id);
      return data.registrationGems ?? 5;
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  loadTokens: () => {
    const lastPlayer = loadLastPlayer();
    const token = api.getAccessToken();
    const playerStr = getStorage().getString('player');
    const isPendingReg = getStorage().getString('pendingRegistration') === 'true';

    if (token && playerStr) {
      try {
        const player = JSON.parse(playerStr) as PlayerInfo;
        set({ player, lastPlayer: lastPlayer ?? player, isAuthenticated: true });
        setupUserPersistence(player.id);
      } catch {
        set({ player: null, lastPlayer, isAuthenticated: false });
      }
    } else if (isPendingReg && playerStr) {
      try {
        const player = JSON.parse(playerStr) as PlayerInfo;
        setupUserPersistence(player.id);
        useGameStore.setState({ isHydrated: true });
        set({ player, lastPlayer: lastPlayer ?? player, isAuthenticated: true, isGuest: true, pendingRegistration: true });
      } catch {
        getStorage().remove('pendingRegistration');
        set({ player: null, lastPlayer, isAuthenticated: false });
      }
    } else {
      set({ lastPlayer });
    }
  },
}));
