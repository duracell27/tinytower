import { create } from 'zustand';

const DEFER_MS = 450;

interface ModalQueueState {
  active: string | null;
  queue: string[];
  transitioning: boolean;
  request: (name: string) => void;
  release: (name: string) => void;
}

export const useModalQueueStore = create<ModalQueueState>((set, get) => ({
  active: null,
  queue: [],
  transitioning: false,

  request: (name) => {
    const { active, queue, transitioning } = get();
    if (active === name || queue.includes(name)) return;
    if (!active && !transitioning) {
      set({ active: name });
    } else {
      set({ queue: [...queue, name] });
    }
  },

  release: (name) => {
    const { active, queue } = get();
    if (active !== name) {
      set({ queue: queue.filter((n) => n !== name) });
      return;
    }
    const [next, ...rest] = queue;
    set({ active: null, queue: rest, transitioning: true });
    setTimeout(() => {
      set({ active: next ?? null, transitioning: false });
    }, DEFER_MS);
  },
}));
