import { create } from 'zustand';
import { processCommand } from '../../shared/engine/processCommand';
import { gameConfig, createInitialState } from '../../shared/config/gameConfig';
import { generateRandomVisitor } from '../../shared/engine/lobbyUtils';
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
  levelUpQueue: LevelUpEvent[];
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
  spawnVisitor: () => void;
  liftVisitor: () => void;
  collectTip: () => void;
  deliverAll: () => void;
  upgradeElevator: () => void;
  upgradeLobby: () => void;
  claimDailyReward: () => void;
  dismissLevelUp: () => void;
  hydrate: (state: GameState & Partial<SyncState>) => void;
  reconcile: (state: GameState, stateVersion: number, ackCursor: number) => void;
  clearAckedCommands: (ackCursor: number) => void;
}

type GameStore = GameState & PlayerStats & SyncState & GameActions;

function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

function executeCommand(
  get: () => GameStore,
  set: (partial: Partial<GameStore>) => void,
  command: Command,
) {
  const store = get();
  const { balance, gems, floors, commandQueue, workers, hotelCapacity,
    lobbyVisitors, lobbyCapacity, elevatorLevel, elevatorFloor,
    dailyTips, dailyGemsCollected, dailyTipsRewardClaimed, lastDailyReset, nextVisitorAt,
  } = store;
  const gameState: GameState = {
    balance, gems, floors, commandQueue, workers, hotelCapacity,
    lobbyVisitors, lobbyCapacity, elevatorLevel, elevatorFloor,
    dailyTips, dailyGemsCollected, dailyTipsRewardClaimed, lastDailyReset, nextVisitorAt,
  };
  const result = processCommand(gameState, command, gameConfig, command.timestamp, store.playerLevel);
  if (!result.success) return;

  let newQueue = [...result.state.commandQueue, command];
  if (newQueue.length > COMMAND_QUEUE_CAP) {
    newQueue = newQueue.slice(newQueue.length - COMMAND_QUEUE_CAP);
  }

  const coinDelta = Math.abs(result.state.balance - balance);
  const listBonus = command.type === 'list' ? 10 : 0;
  let { playerXp, playerLevel } = store;
  let newBalance = result.state.balance;
  let newGems = result.state.gems;
  const levelUps: LevelUpEvent[] = [];
  playerXp += coinDelta + listBonus;
  while (playerXp >= xpForLevel(playerLevel)) {
    playerXp -= xpForLevel(playerLevel);
    playerLevel++;
    const coinReward = playerLevel * 100;
    const gemReward = playerLevel * 3;
    newBalance += coinReward;
    newGems += gemReward;
    levelUps.push({ newLevel: playerLevel, coinReward, gemReward });
  }

  set({
    balance: newBalance,
    gems: newGems,
    floors: result.state.floors,
    workers: result.state.workers,
    hotelCapacity: result.state.hotelCapacity,
    commandQueue: newQueue,
    lobbyVisitors: result.state.lobbyVisitors,
    lobbyCapacity: result.state.lobbyCapacity,
    elevatorLevel: result.state.elevatorLevel,
    elevatorFloor: result.state.elevatorFloor,
    dailyTips: result.state.dailyTips,
    dailyGemsCollected: result.state.dailyGemsCollected,
    dailyTipsRewardClaimed: result.state.dailyTipsRewardClaimed,
    lastDailyReset: result.state.lastDailyReset,
    nextVisitorAt: result.state.nextVisitorAt,
    playerXp,
    playerLevel,
    levelUpQueue: [...store.levelUpQueue, ...levelUps],
  });
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...createInitialState(gameConfig),
  playerLevel: 1,
  playerXp: 0,
  levelUpQueue: [],
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

  spawnVisitor: () => {
    const state = get();
    const visitor = generateRandomVisitor(
      { ...state },
      gameConfig,
    );
    executeCommand(get, set, {
      id: uuid(),
      type: 'spawn_visitor',
      visitorId: visitor.id,
      role: visitor.role,
      targetFloor: visitor.targetFloor,
      hairColor: visitor.hairColor,
      female: visitor.female,
      timestamp: clock.now(),
    });
  },

  liftVisitor: () => {
    executeCommand(get, set, {
      id: uuid(),
      type: 'lift_visitor',
      timestamp: clock.now(),
    });
  },

  collectTip: () => {
    executeCommand(get, set, {
      id: uuid(),
      type: 'collect_tip',
      timestamp: clock.now(),
    });
  },

  deliverAll: () => {
    executeCommand(get, set, {
      id: uuid(),
      type: 'deliver_all',
      timestamp: clock.now(),
    });
  },

  upgradeElevator: () => {
    executeCommand(get, set, {
      id: uuid(),
      type: 'upgrade_elevator',
      timestamp: clock.now(),
    });
  },

  upgradeLobby: () => {
    executeCommand(get, set, {
      id: uuid(),
      type: 'upgrade_lobby',
      timestamp: clock.now(),
    });
  },

  claimDailyReward: () => {
    executeCommand(get, set, {
      id: uuid(),
      type: 'claim_daily_reward',
      timestamp: clock.now(),
    });
  },

  dismissLevelUp: () => {
    set((state) => ({ levelUpQueue: state.levelUpQueue.slice(1) }));
  },

  hydrate: (state) => set({
    balance: state.balance,
    gems: state.gems ?? 20,
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
  }),

  reconcile: (serverState, newVersion, ackCursor) => set({
    balance: serverState.balance,
    gems: serverState.gems,
    floors: serverState.floors,
    workers: serverState.workers,
    hotelCapacity: serverState.hotelCapacity,
    lobbyVisitors: serverState.lobbyVisitors,
    lobbyCapacity: serverState.lobbyCapacity,
    elevatorLevel: serverState.elevatorLevel,
    elevatorFloor: serverState.elevatorFloor,
    dailyTips: serverState.dailyTips,
    dailyGemsCollected: serverState.dailyGemsCollected,
    dailyTipsRewardClaimed: serverState.dailyTipsRewardClaimed,
    lastDailyReset: serverState.lastDailyReset,
    nextVisitorAt: serverState.nextVisitorAt,
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

export function useVisitors() {
  return useGameStore((state) => state.lobbyVisitors);
}

export function useLobbyState() {
  return useGameStore((state) => ({
    lobbyVisitors: state.lobbyVisitors,
    lobbyCapacity: state.lobbyCapacity,
    elevatorLevel: state.elevatorLevel,
    elevatorFloor: state.elevatorFloor,
    dailyTips: state.dailyTips,
    dailyGemsCollected: state.dailyGemsCollected,
    dailyTipsRewardClaimed: state.dailyTipsRewardClaimed,
    nextVisitorAt: state.nextVisitorAt,
    gems: state.gems,
  }));
}
