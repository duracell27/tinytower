import { create } from 'zustand';
import { processCommand } from '../../shared/engine/processCommand';
import { gameConfig, createInitialState } from '../../shared/config/gameConfig';
import { clock } from '../services/clock';
import type { GameState, Command, Floor, Worker } from '../../shared/types';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const COMMAND_QUEUE_CAP = 10_000;

export interface LevelUpEvent {
  newLevel: number;
  coinReward: number;
  gemReward: number;
}

interface PlayerStats {
  playerLevel: number;
  playerXp: number;
  gems: number;
  levelUpQueue: LevelUpEvent[];
}

interface BuildingState {
  hotelOccupied: number;
  hotelTotal: number;
  visitors: number;
}

interface SyncState {
  lastAckCursor: number;
  stateVersion: number;
}

interface GameActions {
  buy: (floorId: number, slotIdx: number, typeId: string) => void;
  list: (floorId: number, slotIdx: number) => void;
  collect: (floorId: number, slotIdx: number) => void;
  assignWorker: (workerId: string, floorId: number, slotIdx: number) => void;
  fireWorker: (workerId: string) => void;
  evictWorker: (workerId: string) => void;
  liftVisitor: () => void;
  dismissLevelUp: () => void;
  hydrate: (state: GameState & Partial<SyncState>) => void;
  reconcile: (state: GameState, stateVersion: number, ackCursor: number) => void;
  clearAckedCommands: (ackCursor: number) => void;
}

type GameStore = GameState & PlayerStats & BuildingState & SyncState & GameActions;

function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

function executeCommand(
  get: () => GameStore,
  set: (partial: Partial<GameStore>) => void,
  command: Command,
) {
  const store = get();
  const { balance, floors, commandQueue, workers, hotelCapacity } = store;
  const result = processCommand({ balance, floors, commandQueue, workers, hotelCapacity }, command, gameConfig, command.timestamp);
  if (!result.success) return;

  let newQueue = [...result.state.commandQueue, command];
  if (newQueue.length > COMMAND_QUEUE_CAP) {
    newQueue = newQueue.slice(newQueue.length - COMMAND_QUEUE_CAP);
  }

  const coinDelta = Math.abs(result.state.balance - balance);
  const listBonus = command.type === 'list' ? 10 : 0;
  let { playerXp, playerLevel } = store;
  let newBalance = result.state.balance;
  let { gems } = store;
  const levelUps: LevelUpEvent[] = [];
  playerXp += coinDelta + listBonus;
  while (playerXp >= xpForLevel(playerLevel)) {
    playerXp -= xpForLevel(playerLevel);
    playerLevel++;
    const coinReward = playerLevel * 100;
    const gemReward = playerLevel * 3;
    newBalance += coinReward;
    gems += gemReward;
    levelUps.push({ newLevel: playerLevel, coinReward, gemReward });
  }

  set({
    balance: newBalance,
    floors: result.state.floors,
    workers: result.state.workers,
    hotelCapacity: result.state.hotelCapacity,
    commandQueue: newQueue,
    playerXp,
    playerLevel,
    gems,
    levelUpQueue: [...store.levelUpQueue, ...levelUps],
  });
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...createInitialState(gameConfig),
  playerLevel: 1,
  playerXp: 0,
  gems: 20,
  levelUpQueue: [],
  hotelOccupied: 0,
  hotelTotal: 32,
  visitors: 0,
  lastAckCursor: 0,
  stateVersion: 0,

  buy: (floorId, slotIdx, typeId) => {
    executeCommand(get, set, {
      id: uuid(),
      type: 'buy',
      floorId,
      slotIdx,
      typeId,
      timestamp: clock.now(),
    });
  },

  list: (floorId, slotIdx) => {
    executeCommand(get, set, {
      id: uuid(),
      type: 'list',
      floorId,
      slotIdx,
      timestamp: clock.now(),
    });
  },

  collect: (floorId, slotIdx) => {
    executeCommand(get, set, {
      id: uuid(),
      type: 'collect',
      floorId,
      slotIdx,
      timestamp: clock.now(),
    });
  },

  assignWorker: (workerId, floorId, slotIdx) => {
    executeCommand(get, set, {
      id: uuid(),
      type: 'assign_worker',
      workerId,
      floorId,
      slotIdx,
      timestamp: clock.now(),
    });
  },

  fireWorker: (workerId) => {
    executeCommand(get, set, {
      id: uuid(),
      type: 'fire_worker',
      workerId,
      timestamp: clock.now(),
    });
  },

  evictWorker: (workerId) => {
    executeCommand(get, set, {
      id: uuid(),
      type: 'evict_worker',
      workerId,
      timestamp: clock.now(),
    });
  },

  dismissLevelUp: () => {
    set((state) => ({ levelUpQueue: state.levelUpQueue.slice(1) }));
  },

  liftVisitor: () => {
    const { visitors, hotelOccupied, hotelTotal } = get();
    if (visitors <= 0) return;
    set({
      visitors: visitors - 1,
      hotelOccupied: Math.min(hotelOccupied + 1, hotelTotal),
    });
  },

  hydrate: (state) => set({
    balance: state.balance,
    floors: state.floors,
    commandQueue: state.commandQueue,
    workers: state.workers ?? [],
    hotelCapacity: state.hotelCapacity ?? 10,
    lastAckCursor: state.lastAckCursor ?? 0,
    stateVersion: state.stateVersion ?? 0,
  }),

  reconcile: (serverState, newVersion, ackCursor) => set({
    balance: serverState.balance,
    floors: serverState.floors,
    workers: serverState.workers,
    hotelCapacity: serverState.hotelCapacity,
    stateVersion: newVersion,
    lastAckCursor: ackCursor,
    commandQueue: [],
  }),

  clearAckedCommands: (ackCursor) => set((state) => ({
    lastAckCursor: ackCursor,
    commandQueue: state.commandQueue,
  })),
}));

export function useBalance(): number {
  return useGameStore((state) => state.balance);
}

export function useFloor(floorId: number): Floor {
  return useGameStore(
    (state) => state.floors.find(f => f.id === floorId)!,
    (a, b) => a.id === b.id && a.productions === b.productions,
  );
}
