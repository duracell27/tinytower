import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';
import { api } from '../services/api';
import { useGameStore } from './gameStore';

const authStorage = createMMKV({ id: 'auth' });

export interface ReferralEntry {
  id: string;
  referredName: string;
  referredLevel: number;
  milestones: {
    registered: { claimedAt: string | null };
    level10: { reachedAt: string | null; claimedAt: string | null };
    level30: { reachedAt: string | null; claimedAt: string | null };
  };
  gemBonusEarned: number;
}

interface ReferralProfileResponse {
  code: string;
  referrals: ReferralEntry[];
  hasUsedCode: boolean;
}

interface ReferralState {
  code: string | null;
  referrals: ReferralEntry[];
  hasUsedCode: boolean | null;
  isLoading: boolean;
  isApplying: boolean;
  fetchReferral: () => Promise<void>;
  applyReferralCode: (code: string) => Promise<void>;
}

export const useReferralStore = create<ReferralState>((set) => ({
  code: null,
  referrals: [],
  hasUsedCode: null,
  isLoading: false,
  isApplying: false,

  fetchReferral: async () => {
    set({ isLoading: true });
    try {
      const data = await api.get<ReferralProfileResponse>('/player/referral');
      set({ code: data.code, referrals: data.referrals, hasUsedCode: data.hasUsedCode });
    } finally {
      set({ isLoading: false });
    }
  },

  applyReferralCode: async (code) => {
    set({ isApplying: true });
    try {
      const data = await api.post<{ ok: true; coins: number; gems: number }>(
        '/referrals/apply-code',
        { code },
      );
      authStorage.remove('referral.pendingCode');
      useGameStore.getState().pushReferralNotification({
        type: 'referred_bonus',
        coins: data.coins,
        gems: data.gems,
      });
      set({ hasUsedCode: true, isApplying: false });
    } catch (e) {
      set({ isApplying: false });
      throw e;
    }
  },
}));
