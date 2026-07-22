import { create } from 'zustand';
import { api } from '../services/api';

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  playerLevel: number;
  country?: string | null;
  body: string;
  createdAt: string;
}

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  activeCountry: string | undefined;
}

interface ChatActions {
  fetchMessages: (country?: string) => Promise<void>;
  sendMessage: (body: string, playerName: string, playerLevel: number, country?: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  startPolling: (country?: string) => void;
  stopPolling: () => void;
}

let pollingInterval: ReturnType<typeof setInterval> | null = null;

export const useChatStore = create<ChatState & ChatActions>((set, get) => ({
  messages: [],
  isLoading: false,
  isSending: false,
  error: null,
  activeCountry: undefined,

  fetchMessages: async (country?: string) => {
    set({ isLoading: true });
    try {
      const params = country ? `?country=${encodeURIComponent(country)}` : '';
      const data = await api.get<{ messages: ChatMessage[] }>(`/chat/messages${params}`);
      // Discard stale response if channel changed while request was in flight
      if (get().activeCountry === country) {
        set({ messages: data.messages });
      }
    } catch {
      // silent — keep last known messages, polling continues
    } finally {
      set({ isLoading: false });
    }
  },

  sendMessage: async (body: string, playerName: string, playerLevel: number, country?: string) => {
    set({ isSending: true, error: null });
    try {
      await api.post('/chat/messages', { body, playerLevel, ...(country ? { country } : {}) });
      await get().fetchMessages(country);
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    } finally {
      set({ isSending: false });
    }
  },

  deleteMessage: async (id: string) => {
    set((s) => ({ messages: s.messages.filter((m) => m.id !== id) }));
    try {
      await api.delete<{ success: true }>(`/chat/messages/${id}`);
    } catch (e) {
      await get().fetchMessages(); // revert optimistic removal
      throw e;
    }
  },

  startPolling: (country?: string) => {
    if (pollingInterval !== null) clearInterval(pollingInterval);
    // Set channel + clear stale messages before fetching
    set({ activeCountry: country, messages: [] });
    void get().fetchMessages(country);
    pollingInterval = setInterval(() => void get().fetchMessages(country), 5000);
  },

  stopPolling: () => {
    if (pollingInterval !== null) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  },
}));
