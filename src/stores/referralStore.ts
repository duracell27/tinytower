import { create } from 'zustand';
import { api } from '../services/api';

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
}

interface ReferralState {
  code: string | null;
  referrals: ReferralEntry[];
  isLoading: boolean;
  fetchReferral: () => Promise<void>;
}

export const useReferralStore = create<ReferralState>((set) => ({
  code: null,
  referrals: [],
  isLoading: false,

  fetchReferral: async () => {
    set({ isLoading: true });
    try {
      const data = await api.get<ReferralProfileResponse>('/player/referral');
      set({ code: data.code, referrals: data.referrals });
    } finally {
      set({ isLoading: false });
    }
  },
}));
