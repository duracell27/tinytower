import { create } from 'zustand';
import { api, type CityNotification } from '../services/api';

interface CityNotifState {
  pending: CityNotification | null;
  dismissed: boolean;
  notifications: CityNotification[];
  notifLoading: boolean;
  notifError: string | null;
  sending: boolean;
}

interface CityNotifActions {
  fetchPending: () => Promise<void>;
  dismiss: () => void;
  reopen: () => void;
  acknowledge: (cityId: string, notifId: string) => Promise<void>;
  fetchNotifications: (cityId: string) => Promise<void>;
  sendNotification: (cityId: string, text: string) => Promise<CityNotification>;
}

export const useCityNotifStore = create<CityNotifState & CityNotifActions>((set) => ({
  pending: null,
  dismissed: false,
  notifications: [],
  notifLoading: false,
  notifError: null,
  sending: false,

  fetchPending: async () => {
    try {
      const pending = await api.getPendingCityNotification();
      set({ pending: pending ?? null, dismissed: false });
    } catch {
      // silent — keep last known value
    }
  },

  dismiss: () => set({ dismissed: true }),

  reopen: () => set({ dismissed: false }),

  acknowledge: async (cityId, notifId) => {
    try {
      await api.acknowledgeCityNotification(cityId, notifId);
      set({ pending: null, dismissed: false });
    } catch {
      // silent
    }
  },

  fetchNotifications: async (cityId) => {
    set({ notifLoading: true, notifError: null });
    try {
      const notifications = await api.getCityNotifications(cityId);
      set({ notifications, notifLoading: false });
    } catch (e: any) {
      set({ notifLoading: false, notifError: e?.message ?? 'Error' });
    }
  },

  sendNotification: async (cityId, text) => {
    set({ sending: true });
    try {
      const notif = await api.createCityNotification(cityId, text);
      set((s) => ({
        notifications: [notif, ...s.notifications].slice(0, 5),
        sending: false,
      }));
      return notif;
    } catch (e) {
      set({ sending: false });
      throw e;
    }
  },
}));
