import { create } from 'zustand';
import { api, type CityDetail, type CitySummary, type CityRole } from '../services/api';

interface CityState {
  city: CityDetail | null;
  loading: boolean;
  error: string | null;
}

interface CityActions {
  fetchMyCityInfo: () => Promise<void>;
  createCity: (name: string) => Promise<CityDetail>;
  leaveCity: () => Promise<void>;
  invitePlayer: (cityId: string, playerId: string) => Promise<void>;
  kickMember: (cityId: string, playerId: string) => Promise<void>;
  changeMemberRole: (cityId: string, playerId: string, role: CityRole) => Promise<void>;
  updateCity: (cityId: string, updates: { name?: string; description?: string }) => Promise<void>;
  searchCities: (q: string) => Promise<CitySummary[]>;
  getCityById: (id: string) => Promise<CityDetail>;
  clearCity: () => void;
}

export const useCityStore = create<CityState & CityActions>((set) => ({
  city: null,
  loading: false,
  error: null,

  fetchMyCityInfo: async () => {
    set({ loading: true, error: null });
    try {
      const city = await api.getMyCityInfo();
      set({ city, loading: false });
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? 'Failed to load city' });
    }
  },

  createCity: async (name: string) => {
    set({ loading: true, error: null });
    try {
      const city = await api.createCity(name);
      set({ city, loading: false });
      return city;
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? 'Failed to create city' });
      throw e;
    }
  },

  leaveCity: async () => {
    set({ loading: true, error: null });
    try {
      await api.leaveCity();
      set({ city: null, loading: false });
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? 'Failed to leave city' });
      throw e;
    }
  },

  invitePlayer: async (cityId: string, playerId: string) => {
    try {
      await api.inviteToCity(cityId, playerId);
      // Refresh city info after invite
      const city = await api.getMyCityInfo();
      set({ city });
    } catch (e: any) {
      throw e;
    }
  },

  kickMember: async (cityId: string, playerId: string) => {
    try {
      await api.kickFromCity(cityId, playerId);
      const city = await api.getMyCityInfo();
      set({ city });
    } catch (e: any) {
      throw e;
    }
  },

  changeMemberRole: async (cityId: string, playerId: string, role: CityRole) => {
    try {
      await api.changeCityMemberRole(cityId, playerId, role);
      const city = await api.getMyCityInfo();
      set({ city });
    } catch (e: any) {
      throw e;
    }
  },

  updateCity: async (cityId: string, updates: { name?: string; description?: string }) => {
    try {
      const city = await api.updateCity(cityId, updates);
      set({ city });
    } catch (e: any) {
      throw e;
    }
  },

  searchCities: async (q: string) => {
    return api.searchCities(q);
  },

  getCityById: async (id: string) => {
    return api.getCityById(id);
  },

  clearCity: () => set({ city: null, error: null }),
}));
