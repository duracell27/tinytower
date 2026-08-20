import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';

export type OnboardingStep =
  | 'collect_slot_1' | 'collect_slot_2'
  | 'buy_goods_1'    | 'buy_goods_2'
  | 'open_elevator_1'
  | 'deliver_visitor'
  | 'assign_worker'
  | 'buy_floor'
  | 'choose_floor_type'
  | 'speed_up_construction'
  | 'expand_floor_card'
  | 'open_business'
  | 'final_message'
  | 'done';

export const SEQUENCE: OnboardingStep[] = [
  'collect_slot_1', 'collect_slot_2',
  'buy_goods_1',    'buy_goods_2',
  'open_elevator_1',
  'deliver_visitor',
  'assign_worker',
  'buy_floor',
  'choose_floor_type',
  'speed_up_construction',
  'expand_floor_card',
  'open_business',
  'final_message',
];

const MMKV_KEY = 'step';

let storage: ReturnType<typeof createMMKV> | null = null;
function getStorage() {
  if (!storage) storage = createMMKV({ id: 'onboarding' });
  return storage;
}

function loadStep(): OnboardingStep | null {
  const saved = getStorage().getString(MMKV_KEY);
  return (saved as OnboardingStep) ?? null;
}

function saveStep(step: OnboardingStep) {
  getStorage().set(MMKV_KEY, step);
}

export interface TargetRect { x: number; y: number; width: number; height: number }

interface OnboardingState {
  step: OnboardingStep | null;
  isActive: boolean;
  targetRect: TargetRect | null;
  /** Optional separate rect used to position the arrow, independent of the spotlight rect. */
  arrowRect: TargetRect | null;
  reset: () => void;
  start: () => void;
  advance: () => void;
  complete: () => void;
  notifyElevatorOpened: () => void;
  setTargetRect: (rect: TargetRect | null) => void;
  setArrowRect: (rect: TargetRect | null) => void;
  goToStep: (step: OnboardingStep) => void;
}

const saved = loadStep();

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  step: saved,
  isActive: saved !== null && saved !== 'done',
  targetRect: null,
  arrowRect: null,

  reset: () => {
    getStorage().remove(MMKV_KEY);
    set({ step: null, isActive: false, targetRect: null, arrowRect: null });
  },

  start: () => {
    const { step } = get();
    if (step !== null) return; // already started or completed
    saveStep('collect_slot_1');
    set({ step: 'collect_slot_1', isActive: true });
  },

  advance: () => {
    const { step } = get();
    if (step === null || step === 'done') return;
    const idx = SEQUENCE.indexOf(step);
    if (idx === SEQUENCE.length - 1) {
      get().complete();
      return;
    }
    const next = SEQUENCE[idx + 1];
    saveStep(next);
    set({ step: next, targetRect: null, arrowRect: null });
  },

  complete: () => {
    saveStep('done');
    set({ step: 'done', isActive: false, targetRect: null, arrowRect: null });
  },

  setTargetRect: (rect) => set({ targetRect: rect }),
  setArrowRect: (rect) => set({ arrowRect: rect }),

  goToStep: (step) => {
    saveStep(step);
    set({ step, isActive: step !== 'done', targetRect: null, arrowRect: null });
  },

  notifyElevatorOpened: () => {
    const { step } = get();
    if (step === 'open_elevator_1') {
      get().advance();
    }
  },
}));
