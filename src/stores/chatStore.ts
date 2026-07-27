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
}

interface ChatActions {
  fetchMessages: (country?: string) => Promise<void>;
  sendMessage: (body: string, playerName: string, playerLevel: number, country?: string) => Promise<void>;
  editMessage: (id: string, newBody: string, country?: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  startPolling: (country?: string) => void;
  stopPolling: () => void;
}

let pollingInterval: ReturnType<typeof setInterval> | null = null;
// Monotonic counter to discard responses from superseded requests
let currentRequestId = 0;

export const useChatStore = create<ChatState & ChatActions>((set, get) => ({
  messages: [],
  isLoading: false,
  isSending: false,
  error: null,

  fetchMessages: async (country?: string) => {
    const myId = ++currentRequestId;
    set({ isLoading: true });
    try {
      const params = country ? `?country=${encodeURIComponent(country)}` : '';
      const data = await api.get<{ messages: ChatMessage[] }>(`/chat/messages${params}`);
      if (currentRequestId === myId) {
        set({ messages: data.messages });
      }
    } catch {
      // silent — keep last known messages, polling continues
    } finally {
      if (currentRequestId === myId) {
        set({ isLoading: false });
      }
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

  editMessage: async (id: string, newBody: string, country?: string) => {
    set({ isSending: true, error: null });
    // Optimistic update
    set((s) => ({ messages: s.messages.map((m) => m.id === id ? { ...m, body: newBody } : m) }));
    try {
      await api.patch(`/chat/messages/${id}`, { body: newBody });
    } catch (e) {
      await get().fetchMessages(country); // revert on error
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
    currentRequestId++; // invalidate any in-flight request from the previous channel
    set({ messages: [] });
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
