import { create } from 'zustand';
import { api, type CityDetail, type CitySummary, type CityRole, type CityRankingsResponse, type CityXpStats, type CityBudget, type CityBudgetContribsData, type DonateBudgetPayload } from '../services/api';
import { useGameStore } from './gameStore';

interface CityState {
  city: CityDetail | null;
  loading: boolean;
  error: string | null;
  budget: CityBudget | null;
  budgetLoading: boolean;
  budgetError: string | null;
  budgetContribsData: CityBudgetContribsData | null;
  budgetContribsLoading: boolean;
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
  browseCities: () => Promise<CitySummary[]>;
  searchCities: (q: string) => Promise<CitySummary[]>;
  getCityById: (id: string) => Promise<CityDetail>;
  getCityRankings: (page: number) => Promise<CityRankingsResponse>;
  getCityXpStats: (cityId: string) => Promise<CityXpStats>;
  resetCityXpPeriod: (cityId: string) => Promise<void>;
  fetchBudget: (cityId: string) => Promise<void>;
  donate: (cityId: string, payload: DonateBudgetPayload) => Promise<void>;
  fetchBudgetContribs: (cityId: string) => Promise<void>;
  resetBudget: (cityId: string) => Promise<void>;
  clearCity: () => void;
}

export const useCityStore = create<CityState & CityActions>((set) => ({
  city: null,
  loading: false,
  error: null,
  budget: null,
  budgetLoading: false,
  budgetError: null,
  budgetContribsData: null,
  budgetContribsLoading: false,

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

  browseCities: async () => {
    return api.browseCities();
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
    set({ budgetLoading: true, budgetError: null });
    try {
      const budget = await api.getCityBudget(cityId);
      set({ budget, budgetLoading: false });
    } catch (e: any) {
      set({ budgetLoading: false, budgetError: e?.message ?? 'Failed to load budget' });
    }
  },

  donate: async (cityId: string, payload: DonateBudgetPayload) => {
    await api.donateToCityBudget(cityId, payload);
    // Deduct donated resources from client state so the next sync doesn't
    // overwrite the server's correctly-decremented values.
    useGameStore.setState((s) => {
      const update: { balance?: number; gems?: number; tools?: typeof s.tools } = {};
      if (payload.coins) update.balance = Math.max(0, s.balance - payload.coins);
      if (payload.gems)  update.gems    = Math.max(0, s.gems    - payload.gems);
      if (payload.tools) {
        const tools = { ...s.tools };
        const t = payload.tools;
        if (t.briks)  tools.briks  = Math.max(0, tools.briks  - t.briks);
        if (t.glass)  tools.glass  = Math.max(0, tools.glass  - t.glass);
        if (t.nails)  tools.nails  = Math.max(0, tools.nails  - t.nails);
        if (t.screw)  tools.screw  = Math.max(0, tools.screw  - t.screw);
        if (t.wood)   tools.wood   = Math.max(0, tools.wood   - t.wood);
        if (t.cement) tools.cement = Math.max(0, tools.cement - t.cement);
        update.tools = tools;
      }
      return update;
    });
    const budget = await api.getCityBudget(cityId);
    set({ budget });
  },

  fetchBudgetContribs: async (cityId: string) => {
    set({ budgetContribsLoading: true });
    try {
      const budgetContribsData = await api.getCityBudgetContribs(cityId);
      set({ budgetContribsData, budgetContribsLoading: false });
    } catch {
      set({ budgetContribsLoading: false });
    }
  },

  resetBudget: async (cityId: string) => {
    await api.resetCityBudget(cityId);
    const budget = await api.getCityBudget(cityId);
    const budgetContribsData = await api.getCityBudgetContribs(cityId);
    set({ budget, budgetContribsData });
  },

  clearCity: () => set({ city: null, error: null }),
}));
