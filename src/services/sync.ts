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
  playerLevel: number;
  playerXp: number;
}

async function fetchTools(): Promise<void> {
  if (!useAuthStore.getState().isAuthenticated) return;
  try {
    const tools = await api.get<{ briks: number; glass: number; nails: number; screw: number }>('/tools');
    useGameStore.getState().setToolInventory(tools);
  } catch {
    // Network error — keep defaults
  }
}

const SYNC_INTERVAL_MS = 5000;

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

    const store = useGameStore.getState();
    const needsReconcile =
      (response.stateVersion !== store.stateVersion && response.stateVersion > 0) ||
      (store.workers.length === 0 && response.state.workers.length > 0);

    if (needsReconcile) {
      store.reconcile(response.state, response.stateVersion, response.ackCursor, response.playerLevel, response.playerXp);
    } else {
      store.clearAckedCommands(response.ackCursor, sentIds, response.playerLevel, response.playerXp);
    }
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
    fetchTools();
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
