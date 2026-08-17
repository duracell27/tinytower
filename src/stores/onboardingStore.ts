import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';

export type OnboardingStep =
  | 'collect_slot_1' | 'collect_slot_2'
  | 'buy_goods_1'    | 'buy_goods_2'
  | 'open_elevator_1'
  | 'deliver_visitor'
  | 'open_elevator_2'
  | 'deliver_worker'
  | 'assign_worker'
  | 'choose_floor_type'
  | 'speed_up_construction'
  | 'construction_tip'
  | 'open_business'
  | 'final_message'
  | 'done';

const SEQUENCE: OnboardingStep[] = [
  'collect_slot_1', 'collect_slot_2',
  'buy_goods_1',    'buy_goods_2',
  'open_elevator_1',
  'deliver_visitor',
  'open_elevator_2',
  'deliver_worker',
  'assign_worker',
  'choose_floor_type',
  'speed_up_construction',
  'construction_tip',
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

interface OnboardingState {
  step: OnboardingStep | null;
  isActive: boolean;
  start: () => void;
  advance: () => void;
  complete: () => void;
  notifyElevatorOpened: () => void;
}

const saved = loadStep();

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  step: saved,
  isActive: saved !== null && saved !== 'done',

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
      // final_message → done
      get().complete();
      return;
    }
    const next = SEQUENCE[idx + 1];
    saveStep(next);
    set({ step: next });
  },

  complete: () => {
    saveStep('done');
    set({ step: 'done', isActive: false });
  },

  notifyElevatorOpened: () => {
    const { step } = get();
    if (step === 'open_elevator_1' || step === 'open_elevator_2') {
      get().advance();
    }
  },
}));
