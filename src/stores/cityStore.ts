import { create } from 'zustand';
import { api, type CityDetail, type CitySummary, type CityRole, type CityRankingsResponse, type CityXpStats, type CityBudget, type DonateBudgetPayload } from '../services/api';
import { useGameStore } from './gameStore';

interface CityState {
  city: CityDetail | null;
  loading: boolean;
  error: string | null;
  budget: CityBudget | null;
  budgetLoading: boolean;
}

interface CityActions {
  fetchMyCityInfo: () => Promise<void>;
  createCity: (name: string) => Promise<CityDetail>;
  leaveCity: () => Promise<void>;
  deleteCity: (cityId: string) => Promise<void>;
  invitePlayer: (cityId: string, playerId: string) => Promise<void>;
  kickMember: (cityId: string, playerId: string) => Promise<void>;
  changeMemberRole: (cityId: string, playerId: string, role: CityRole) => Promise<void>;
  updateCity: (cityId: string, updates: { name?: string; description?: string }) => Promise<void>;
  searchCities: (q: string) => Promise<CitySummary[]>;
  getCityById: (id: string) => Promise<CityDetail>;
  getCityRankings: (page: number) => Promise<CityRankingsResponse>;
  getCityXpStats: (cityId: string) => Promise<CityXpStats>;
  resetCityXpPeriod: (cityId: string) => Promise<void>;
  fetchBudget: (cityId: string) => Promise<void>;
  donate: (cityId: string, payload: DonateBudgetPayload) => Promise<void>;
  clearCity: () => void;
}

export const useCityStore = create<CityState & CityActions>((set) => ({
  city: null,
  loading: false,
  error: null,
  budget: null,
  budgetLoading: false,

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
      useGameStore.setState((s) => ({ gems: Math.max(0, s.gems - 1000) }));
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

  deleteCity: async (cityId: string) => {
    set({ loading: true, error: null });
    try {
      await api.deleteCity(cityId);
      set({ city: null, loading: false });
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? 'Failed to delete city' });
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

  getCityRankings: async (page: number) => {
    return api.getCityRankings(page);
  },

  getCityXpStats: async (cityId: string) => {
    return api.getCityXpStats(cityId);
  },

  resetCityXpPeriod: async (cityId: string) => {
    return api.resetCityXpPeriod(cityId);
  },

  fetchBudget: async (cityId: string) => {
    set({ budgetLoading: true });
    try {
      const budget = await api.getCityBudget(cityId);
      set({ budget, budgetLoading: false });
    } catch {
      set({ budgetLoading: false });
    }
  },

  donate: async (cityId: string, payload: DonateBudgetPayload) => {
    await api.donateToCityBudget(cityId, payload);
    const budget = await api.getCityBudget(cityId);
    set({ budget });
  },

  clearCity: () => set({ city: null, error: null }),
}));
