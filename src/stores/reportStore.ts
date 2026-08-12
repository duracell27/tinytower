import { create } from 'zustand';
import { api } from '../services/api';

export type ReportTargetType = 'CHAT_MESSAGE' | 'FORUM_POST' | 'FORUM_COMMENT';
export type ReportCategory = 'SPAM' | 'INSULT' | 'ADVERTISEMENT' | 'PROFANITY' | 'THREAT' | 'OTHER';

interface ReportState {
  reportedKeys: Set<string>;
  isSubmitting: boolean;
}

interface ReportActions {
  submitReport(targetType: ReportTargetType, targetId: string, category: ReportCategory): Promise<void>;
  hasReported(targetType: ReportTargetType, targetId: string): boolean;
}

export const useReportStore = create<ReportState & ReportActions>((set, get) => ({
  reportedKeys: new Set(),
  isSubmitting: false,

  hasReported: (targetType, targetId) =>
    get().reportedKeys.has(`${targetType}:${targetId}`),

  submitReport: async (targetType, targetId, category) => {
    set({ isSubmitting: true });
    try {
      await api.post('/report', { targetType, targetId, category });
      const key = `${targetType}:${targetId}`;
      set(state => ({ reportedKeys: new Set([...state.reportedKeys, key]) }));
    } finally {
      set({ isSubmitting: false });
    }
  },
}));
