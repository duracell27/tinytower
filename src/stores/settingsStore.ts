import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';

const MMKV_KEY = 'liftSimplifiedRewards';

let storage: ReturnType<typeof createMMKV> | null = null;
function getStorage() {
  if (!storage) storage = createMMKV({ id: 'user-settings' });
  return storage;
}

interface SettingsState {
  liftSimplifiedRewards: boolean;
  setLiftSimplifiedRewards: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  liftSimplifiedRewards: getStorage().getBoolean(MMKV_KEY) ?? false,
  setLiftSimplifiedRewards: (v) => {
    getStorage().set(MMKV_KEY, v);
    set({ liftSimplifiedRewards: v });
  },
}));
