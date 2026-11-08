import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';

const MMKV_KEY = 'liftSimplifiedRewards';
const SOUND_KEY = 'soundEffectsEnabled';
const MUSIC_KEY = 'musicEnabled';

let storage: ReturnType<typeof createMMKV> | null = null;
function getStorage() {
  if (!storage) storage = createMMKV({ id: 'user-settings' });
  return storage;
}

interface SettingsState {
  liftSimplifiedRewards: boolean;
  setLiftSimplifiedRewards: (v: boolean) => void;
  soundEffectsEnabled: boolean;
  setSoundEffectsEnabled: (v: boolean) => void;
  musicEnabled: boolean;
  setMusicEnabled: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  liftSimplifiedRewards: getStorage().getBoolean(MMKV_KEY) ?? false,
  setLiftSimplifiedRewards: (v) => {
    getStorage().set(MMKV_KEY, v);
    set({ liftSimplifiedRewards: v });
  },
  soundEffectsEnabled: getStorage().getBoolean(SOUND_KEY) ?? true,
  setSoundEffectsEnabled: (v) => {
    getStorage().set(SOUND_KEY, v);
    set({ soundEffectsEnabled: v });
  },
  musicEnabled: getStorage().getBoolean(MUSIC_KEY) ?? true,
  setMusicEnabled: (v) => {
    getStorage().set(MUSIC_KEY, v);
    set({ musicEnabled: v });
  },
}));
