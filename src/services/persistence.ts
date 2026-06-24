import { createMMKV } from 'react-native-mmkv';
import { AppState } from 'react-native';
import { GameStateSchema } from '../../shared/schemas/gameState';
import { useGameStore } from '../stores/gameStore';
import type { GameState } from '../../shared/types';

let storage: ReturnType<typeof createMMKV> | null = null;

function getStorage() {
  if (!storage) {
    storage = createMMKV({ id: 'game-state' });
  }
  return storage;
}
const GAME_STATE_KEY = 'gameState';
const SAVE_DEBOUNCE_MS = 3000;

export function loadGameState(): GameState | null {
  const raw = getStorage().getString(GAME_STATE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const result = GameStateSchema.safeParse(parsed);
    if (result.success) return result.data;
    console.warn('Invalid game state in MMKV, starting fresh');
    return null;
  } catch {
    console.warn('Failed to parse game state from MMKV, starting fresh');
    return null;
  }
}

export function saveGameState(state: GameState): void {
  getStorage().set(GAME_STATE_KEY, JSON.stringify({
    balance: state.balance,
    floors: state.floors,
    commandQueue: state.commandQueue,
  }));
}

export function setupPersistence(): void {
  const savedState = loadGameState();
  if (savedState) {
    useGameStore.getState().hydrate(savedState);
  }

  let saveTimeout: ReturnType<typeof setTimeout> | null = null;

  useGameStore.subscribe((state) => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveGameState(state);
      saveTimeout = null;
    }, SAVE_DEBOUNCE_MS);
  });

  const handleAppState = (nextAppState: string) => {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
      }
      saveGameState(useGameStore.getState());
    }
  };

  AppState.addEventListener('change', handleAppState);
}
