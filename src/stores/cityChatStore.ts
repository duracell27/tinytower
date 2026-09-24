import { create } from 'zustand';
import { api, type CityChatMessage } from '../services/api';

interface CityChatState {
  messages: CityChatMessage[];
  page: number;
  totalPages: number;
  isLoading: boolean;
  isSending: boolean;
  hasPendingMention: boolean;
  unreadCount: number;
  error: string | null;
}

interface CityChatActions {
  fetchPage: (cityId: string, page: number) => Promise<void>;
  sendMessage: (cityId: string, body: string, mentionedPlayerId?: string, mentionedName?: string) => Promise<void>;
  refresh: (cityId: string) => Promise<void>;
  checkMention: (cityId: string) => Promise<void>;
  clearMention: (cityId: string) => Promise<void>;
  checkUnreadCount: (cityId: string) => Promise<void>;
}

export const useCityChatStore = create<CityChatState & CityChatActions>((set, get) => ({
  messages: [],
  page: 1,
  totalPages: 1,
  isLoading: false,
  isSending: false,
  hasPendingMention: false,
  unreadCount: 0,
  error: null,

  fetchPage: async (cityId, page) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.getCityChatMessages(cityId, page);
      set({ messages: data.messages, page: data.page, totalPages: data.totalPages, isLoading: false });
    } catch (e: any) {
      set({ isLoading: false, error: e?.message ?? 'Error' });
    }
  },

  sendMessage: async (cityId, body, mentionedPlayerId, mentionedName) => {
    set({ isSending: true, error: null });
    try {
      await api.sendCityChatMessage(cityId, body, mentionedPlayerId, mentionedName);
      await get().refresh(cityId);
    } catch (e: any) {
      set({ error: e?.message ?? 'Error' });
      throw e;
    } finally {
      set({ isSending: false });
    }
  },

  refresh: async (cityId) => {
    await get().fetchPage(cityId, get().page);
  },

  checkMention: async (cityId) => {
    try {
      const { hasMention } = await api.getCityChatPendingMention(cityId);
      set({ hasPendingMention: hasMention });
    } catch {
      // silent
    }
  },

  clearMention: async (cityId) => {
    set({ hasPendingMention: false, unreadCount: 0 });
    try {
      await api.readCityChatMentions(cityId);
    } catch {
      // silent — local state already cleared
    }
  },

  checkUnreadCount: async (cityId) => {
    try {
      const { count } = await api.getCityChatUnreadCount(cityId);
      set({ unreadCount: count });
    } catch {
      // silent
    }
  },
}));
