import { AppState } from 'react-native';
import { api } from './api';
import { clock } from './clock';
import { useGameStore } from '../stores/gameStore';
import { useAuthStore } from '../stores/authStore';
import type { GameState } from '../../shared/types';

interface SyncResponse {
  state: GameState;
  stateVersion: number;
  ackCursor: number;
  serverTime: number;
}

const SYNC_INTERVAL_MS = 5000;

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let isSyncing = false;

async function doSync(): Promise<void> {
  if (isSyncing) return;
  if (!useAuthStore.getState().isAuthenticated) return;

  const { commandQueue, lastAckCursor } = useGameStore.getState();

  isSyncing = true;
  try {
    const response = await api.post<SyncResponse>('/sync', {
      commands: commandQueue,
      lastAckCursor,
    });

    clock.updateOffset(response.serverTime);

    const store = useGameStore.getState();
    const needsReconcile =
      (response.stateVersion !== store.stateVersion && response.stateVersion > 0) ||
      (store.workers.length === 0 && response.state.workers.length > 0);
    if (needsReconcile) {
      store.reconcile(response.state, response.stateVersion, response.ackCursor);
    } else {
      store.clearAckedCommands(response.ackCursor);
    }
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
