import { createMMKV } from 'react-native-mmkv';
import { AppState } from 'react-native';
import { GameStateSchema } from '../../shared/schemas/gameState';
import { useGameStore } from '../stores/gameStore';
import type { GameState, AchievementGrant } from '../../shared/types';

let storage: ReturnType<typeof createMMKV> | null = null;

function getStorage() {
  if (!storage) {
    storage = createMMKV({ id: 'game-state' });
  }
  return storage;
}
const GAME_STATE_KEY = 'gameState';
const SAVE_DEBOUNCE_MS = 3000;

interface PersistedGameState extends GameState {
  lastAckCursor?: number;
  stateVersion?: number;
  playerLevel?: number;
  playerXp?: number;
  achievementQueue?: AchievementGrant[];
}

export function loadGameState(): PersistedGameState | null {
  const raw = getStorage().getString(GAME_STATE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    // Backward compat: old saves may lack workers/hotelCapacity/lobby fields
    const withDefaults = {
      ...parsed,
      workers: parsed.workers ?? [],
      hotelCapacity: parsed.hotelCapacity ?? 10,
      lobbyVisitors: parsed.lobbyVisitors ?? [],
      lobbyCapacity: parsed.lobbyCapacity ?? 10,
      elevatorLevel: parsed.elevatorLevel ?? 1,
      elevatorFloor: parsed.elevatorFloor ?? 0,
      dailyTips: parsed.dailyTips ?? 0,
      dailyGemsCollected: parsed.dailyGemsCollected ?? 0,
      dailyTipsRewardClaimed: parsed.dailyTipsRewardClaimed ?? false,
      lastDailyReset: parsed.lastDailyReset ?? 0,
      nextVisitorAt: parsed.nextVisitorAt ?? 0,
      gems: parsed.gems ?? 20,
      tools: parsed.tools ?? { briks: 0, glass: 0, nails: 0, screw: 0 },
      underConstruction: Array.isArray(parsed.underConstruction)
        ? parsed.underConstruction
        : parsed.underConstruction != null
          ? [parsed.underConstruction]
          : [],
      openedFloorTypes: parsed.openedFloorTypes ?? {},
      stats: parsed.stats ?? { totalBought: 0, totalListed: 0, totalSold: 0 },
    };
    const result = GameStateSchema.safeParse(withDefaults);
    if (result.success) {
      return {
        ...result.data,
        lastAckCursor: typeof parsed.lastAckCursor === 'number' ? parsed.lastAckCursor : 0,
        stateVersion: typeof parsed.stateVersion === 'number' ? parsed.stateVersion : 0,
        playerLevel: typeof parsed.playerLevel === 'number' ? parsed.playerLevel : 1,
        playerXp: typeof parsed.playerXp === 'number' ? parsed.playerXp : 0,
        achievementQueue: Array.isArray(parsed.achievementQueue) ? parsed.achievementQueue : [],
      };
    }
    console.warn('Invalid game state in MMKV, starting fresh');
    return null;
  } catch {
    console.warn('Failed to parse game state from MMKV, starting fresh');
    return null;
  }
}

export function saveGameState(state: PersistedGameState): void {
  getStorage().set(GAME_STATE_KEY, JSON.stringify({
    balance: state.balance,
    gems: state.gems,
    floors: state.floors,
    commandQueue: state.commandQueue,
    workers: state.workers ?? [],
    hotelCapacity: state.hotelCapacity ?? 10,
    lobbyVisitors: state.lobbyVisitors ?? [],
    lobbyCapacity: state.lobbyCapacity ?? 10,
    elevatorLevel: state.elevatorLevel ?? 1,
    elevatorFloor: state.elevatorFloor ?? 0,
    dailyTips: state.dailyTips ?? 0,
    dailyGemsCollected: state.dailyGemsCollected ?? 0,
    dailyTipsRewardClaimed: state.dailyTipsRewardClaimed ?? false,
    lastDailyReset: state.lastDailyReset ?? 0,
    nextVisitorAt: state.nextVisitorAt ?? 0,
    lastAckCursor: state.lastAckCursor ?? 0,
    stateVersion: state.stateVersion ?? 0,
    playerLevel: state.playerLevel ?? 1,
    playerXp: state.playerXp ?? 0,
    tools: state.tools ?? { briks: 0, glass: 0, nails: 0, screw: 0 },
    underConstruction: state.underConstruction ?? [],
    openedFloorTypes: state.openedFloorTypes ?? {},
    stats: state.stats ?? { totalBought: 0, totalListed: 0, totalSold: 0 },
    achievementQueue: (state as any).achievementQueue ?? [],
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
