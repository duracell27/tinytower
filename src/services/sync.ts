import { AppState } from 'react-native';
import { api } from './api';
import { clock } from './clock';
import { useGameStore } from '../stores/gameStore';
import { useAuthStore } from '../stores/authStore';
import type { GameState } from '../../shared/types';
import type { NewAchievementGrant, CategoryProgressState } from '../../shared/types/achievements';

interface SyncResponse {
  state: GameState;
  stateVersion: number;
  ackCursor: number;
  serverTime: number;
  playerLevel: number;
  playerXp: number;
  newAchievements: NewAchievementGrant[];
  coinBonusPercent: number;
  xpBonusPercent: number;
  categoryProgress: Record<string, CategoryProgressState>;
}

const SYNC_INTERVAL_MS = 30_000;

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let isSyncing = false;

async function doSync(): Promise<void> {
  if (isSyncing) return;
  if (!useAuthStore.getState().isAuthenticated) return;

  const { commandQueue, lastAckCursor } = useGameStore.getState();
  const sentIds = new Set(commandQueue.map((c) => c.id));

  isSyncing = true;
  try {
    const response = await api.post<SyncResponse>('/sync', {
      commands: commandQueue,
      lastAckCursor,
    });

    clock.updateOffset(response.serverTime);

    // Capture before reconcile so store.locallyGrantedAchievements has the pre-reconcile optimistic keys.
    const store = useGameStore.getState();
    const needsReconcile =
      (response.stateVersion !== store.stateVersion && response.stateVersion > 0) ||
      (store.workers.length === 0 && response.state.workers.length > 0);

    if (needsReconcile) {
      store.reconcile(response.state, response.stateVersion, response.ackCursor, sentIds, response.playerLevel, response.playerXp);
    } else {
      store.clearAckedCommands(response.ackCursor, sentIds, response.playerLevel, response.playerXp);
    }
    if (response.newAchievements && response.newAchievements.length > 0) {
      const unshown = response.newAchievements.filter(
        (g) => !store.locallyGrantedAchievements.has(`${g.categoryKey}-${g.level}`),
      );
      if (unshown.length > 0) useGameStore.getState().addAchievements(unshown);
    }
    // Merge server categoryProgress with local optimistic state: take MAX for
    // each field so a stale sync response (from before pending commands were
    // processed) never rolls back progress the user can already see.
    const serverCP = response.categoryProgress ?? {};
    const localCP = useGameStore.getState().categoryProgress;
    const mergedCP: typeof serverCP = { ...serverCP };
    for (const key of Object.keys(localCP)) {
      const local = localCP[key];
      const server = serverCP[key];
      if (!server || local.progress > server.progress) {
        mergedCP[key] = server ? {
          progress: Math.max(server.progress, local.progress),
          currentLevel: Math.max(server.currentLevel, local.currentLevel),
          claimedLevels: [...new Set([...server.claimedLevels, ...local.claimedLevels])].sort((a, b) => a - b),
        } : local;
      }
    }
    useGameStore.setState({
      coinBonusPercent: response.coinBonusPercent ?? 0,
      xpBonusPercent: response.xpBonusPercent ?? 0,
      categoryProgress: mergedCP,
    });
    useGameStore.getState().setLastSyncAt(Date.now());
  } catch {
    // Network error — retry next cycle
  } finally {
    isSyncing = false;
  }
}

function scheduleSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    await doSync();
    scheduleSync();
  }, SYNC_INTERVAL_MS);
}

function handleAppState(state: string) {
  if (state === 'background' || state === 'inactive') {
    doSync();
  } else if (state === 'active') {
    doSync();
    scheduleSync();
  }
}

let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

export const syncService = {
  start: () => {
    scheduleSync();
    appStateSubscription = AppState.addEventListener('change', handleAppState);
    doSync();
  },
  stop: () => {
    if (syncTimer) {
      clearTimeout(syncTimer);
      syncTimer = null;
    }
    appStateSubscription?.remove();
    appStateSubscription = null;
  },
  syncNow: doSync,
};
