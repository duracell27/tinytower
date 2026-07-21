import { create } from 'zustand';
import { api } from '../services/api';

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
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
  fetchMessages: () => Promise<void>;
  sendMessage: (body: string, playerName: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

let pollingInterval: ReturnType<typeof setInterval> | null = null;

export const useChatStore = create<ChatState & ChatActions>((set, get) => ({
  messages: [],
  isLoading: false,
  isSending: false,
  error: null,

  fetchMessages: async () => {
    set({ isLoading: true });
    try {
      const data = await api.get<{ messages: ChatMessage[] }>('/chat/messages');
      set({ messages: data.messages });
    } catch {
      // silent — keep last known messages, polling continues
    } finally {
      set({ isLoading: false });
    }
  },

  sendMessage: async (body: string, playerName: string) => {
    set({ isSending: true, error: null });
    try {
      await api.post('/chat/messages', { body, playerName });
      await get().fetchMessages();
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

  startPolling: () => {
    if (pollingInterval !== null) clearInterval(pollingInterval);
    void get().fetchMessages();
    pollingInterval = setInterval(() => void get().fetchMessages(), 5000);
  },

  stopPolling: () => {
    if (pollingInterval !== null) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  },
}));
