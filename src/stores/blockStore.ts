import { create } from 'zustand';
import { api } from '../services/api';

interface BlockState {
  blockedIds: Set<string>;
  isSubmitting: boolean;
}

interface BlockActions {
  fetchBlocked(): Promise<void>;
  blockPlayer(id: string): Promise<void>;
  unblockPlayer(id: string): Promise<void>;
  isBlocked(id: string): boolean;
}

export const useBlockStore = create<BlockState & BlockActions>((set, get) => ({
  blockedIds: new Set(),
  isSubmitting: false,

  isBlocked: (id) => get().blockedIds.has(id),

  fetchBlocked: async () => {
    try {
      const { ids } = await api.getBlockedIds();
      set({ blockedIds: new Set(ids) });
    } catch {
      // silent — keep last known state
    }
  },

  blockPlayer: async (id) => {
    const prev = new Set(get().blockedIds);
    set((s) => ({ blockedIds: new Set([...s.blockedIds, id]), isSubmitting: true }));
    try {
      await api.blockPlayer(id);
    } catch (e) {
      set({ blockedIds: prev });
      throw e;
    } finally {
      set({ isSubmitting: false });
    }
  },

  unblockPlayer: async (id) => {
    const prev = new Set(get().blockedIds);
    set((s) => {
      const next = new Set(s.blockedIds);
      next.delete(id);
      return { blockedIds: next, isSubmitting: true };
    });
    try {
      await api.unblockPlayer(id);
    } catch (e) {
      set({ blockedIds: prev });
      throw e;
    } finally {
      set({ isSubmitting: false });
    }
  },
}));
