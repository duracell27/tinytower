import { create } from 'zustand';
import { api, type CityTaskSummary } from '../services/api';

interface CityTaskState {
  tasks: CityTaskSummary[];
  myActiveTaskId: string | null;
  cityStyleStars: number;
  loading: boolean;
  error: string | null;
}

interface CityTaskActions {
  reset: () => void;
  setFromSync: (payload: { tasks: CityTaskSummary[]; myActiveTaskId: string | null; cityStyleStars: number }) => void;
  fetchTasks: () => Promise<void>;
  joinTask: (taskId: string) => Promise<void>;
  collectTask: (taskId: string) => Promise<{ finalStars: number }>;
  cancelTask: (taskId: string) => Promise<void>;
}

export const useCityTaskStore = create<CityTaskState & CityTaskActions>((set, get) => ({
  tasks: [],
  myActiveTaskId: null,
  cityStyleStars: 0,
  loading: false,
  error: null,

  reset: () => set({ tasks: [], myActiveTaskId: null, cityStyleStars: 0, loading: false, error: null }),

  setFromSync: ({ tasks, myActiveTaskId, cityStyleStars }) => {
    set({ tasks, myActiveTaskId, cityStyleStars });
  },

  fetchTasks: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api.fetchCityTasks();
      set({ tasks: res.tasks, myActiveTaskId: res.myActiveTaskId, cityStyleStars: res.cityStyleStars });
    } catch (e: any) {
      set({ error: e?.message ?? 'Failed to fetch tasks' });
    } finally {
      set({ loading: false });
    }
  },

  joinTask: async (taskId) => {
    const updated = await api.joinCityTask(taskId);
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? updated : t)),
      myActiveTaskId: taskId,
    }));
  },

  collectTask: async (taskId) => {
    const result = await api.collectCityTask(taskId);
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId ? { ...t, status: 'COLLECTED' as const, finalStars: result.finalStars } : t
      ),
      myActiveTaskId: s.myActiveTaskId === taskId ? null : s.myActiveTaskId,
    }));
    get().fetchTasks();
    return result;
  },

  cancelTask: async (taskId) => {
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? { ...t, status: 'AVAILABLE' as const, participants: [], currentProgress: 0, takenAt: null, canDoubleUntil: null }
          : t
      ),
      myActiveTaskId: s.myActiveTaskId === taskId ? null : s.myActiveTaskId,
    }));
    await api.cancelCityTask(taskId);
    get().fetchTasks();
  },
}));
