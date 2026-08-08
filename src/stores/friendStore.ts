import { create } from 'zustand';
import { api, type FriendEntry, type IncomingRequest, type FriendStatusResponse } from '../services/api';

interface FriendState {
  statusCache: Record<string, FriendStatusResponse>;
  friends: FriendEntry[];
  incomingRequests: IncomingRequest[];
  pendingCount: number;
}

interface FriendActions {
  fetchStatus: (playerId: string) => Promise<void>;
  fetchFriends: () => Promise<void>;
  fetchIncoming: () => Promise<void>;
  sendRequest: (toId: string) => Promise<void>;
  cancelRequest: (requestId: string, toId: string) => Promise<void>;
  acceptRequest: (requestId: string, fromId: string) => Promise<void>;
  rejectRequest: (requestId: string, fromId: string) => Promise<void>;
  removeFriend: (requestId: string, friendId: string) => Promise<void>;
}

export const useFriendStore = create<FriendState & FriendActions>((set, get) => ({
  statusCache: {},
  friends: [],
  incomingRequests: [],
  pendingCount: 0,

  fetchStatus: async (playerId: string) => {
    try {
      const status = await api.getFriendStatus(playerId);
      set(s => ({ statusCache: { ...s.statusCache, [playerId]: status } }));
    } catch {
      // silent — keep last known state
    }
  },

  fetchFriends: async () => {
    try {
      const friends = await api.getFriends();
      set({ friends });
    } catch {
      // silent
    }
  },

  fetchIncoming: async () => {
    try {
      const incomingRequests = await api.getIncomingFriendRequests();
      set({ incomingRequests, pendingCount: incomingRequests.length });
    } catch {
      // silent
    }
  },

  sendRequest: async (toId: string) => {
    set(s => ({ statusCache: { ...s.statusCache, [toId]: { status: 'pending_sent' } } }));
    try {
      const { requestId } = await api.sendFriendRequest(toId);
      set(s => ({ statusCache: { ...s.statusCache, [toId]: { status: 'pending_sent', requestId } } }));
    } catch (e) {
      set(s => ({ statusCache: { ...s.statusCache, [toId]: { status: 'none' } } }));
      throw e;
    }
  },

  cancelRequest: async (requestId: string, toId: string) => {
    const prev = get().statusCache[toId];
    set(s => ({ statusCache: { ...s.statusCache, [toId]: { status: 'none' } } }));
    try {
      await api.cancelFriendRequest(requestId);
    } catch (e) {
      if (prev) set(s => ({ statusCache: { ...s.statusCache, [toId]: prev } }));
      throw e;
    }
  },

  acceptRequest: async (requestId: string, fromId: string) => {
    set(s => ({
      incomingRequests: s.incomingRequests.filter(r => r.requestId !== requestId),
      pendingCount: Math.max(0, s.pendingCount - 1),
      statusCache: { ...s.statusCache, [fromId]: { status: 'friends', requestId } },
    }));
    try {
      await api.acceptFriendRequest(requestId);
      await get().fetchFriends();
    } catch (e) {
      await get().fetchIncoming();
      throw e;
    }
  },

  rejectRequest: async (requestId: string, fromId: string) => {
    set(s => ({
      incomingRequests: s.incomingRequests.filter(r => r.requestId !== requestId),
      pendingCount: Math.max(0, s.pendingCount - 1),
      statusCache: { ...s.statusCache, [fromId]: { status: 'none' } },
    }));
    try {
      await api.rejectFriendRequest(requestId);
    } catch (e) {
      await get().fetchIncoming();
      throw e;
    }
  },

  removeFriend: async (requestId: string, friendId: string) => {
    const prev = get().statusCache[friendId];
    set(s => ({
      friends: s.friends.filter(f => f.requestId !== requestId),
      statusCache: { ...s.statusCache, [friendId]: { status: 'none' } },
    }));
    try {
      await api.removeFriend(requestId);
    } catch (e) {
      if (prev) set(s => ({ statusCache: { ...s.statusCache, [friendId]: prev } }));
      await get().fetchFriends();
      throw e;
    }
  },
}));
