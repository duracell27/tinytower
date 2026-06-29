import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { processCommand } from '../../shared/engine/processCommand';
import { gameConfig, createInitialState } from '../../shared/config/gameConfig';
import { generateRandomVisitorRole, generateVisitorAppearance } from '../../shared/engine/lobbyUtils';
import { applyXpGain, type LevelUpEvent } from '../../shared/engine/xp';
import { clock } from '../services/clock';
import type { GameState, Command, Floor, Worker } from '../../shared/types';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const COMMAND_QUEUE_CAP = 10_000;

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
  hydrate: (state: GameState & Partial<SyncState> & { playerLevel?: number; playerXp?: number }) => void;
  reconcile: (state: GameState, stateVersion: number, ackCursor: number, playerLevel?: number, playerXp?: number) => void;
  clearAckedCommands: (ackCursor: number, playerLevel?: number, playerXp?: number) => void;
}

type GameStore = GameState & PlayerStats & SyncState & GameActions;

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

  const xpGained = Math.abs(result.state.balance - balance) + (command.type === 'list' ? 10 : 0);
  const xpResult = applyXpGain(store.playerLevel, store.playerXp, xpGained);
  let newBalance = result.state.balance + xpResult.bonusCoins;
  let newGems = result.state.gems + xpResult.bonusGems;
  const levelUps: LevelUpEvent[] = xpResult.levelUpEvents;

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
    playerXp: xpResult.playerXp,
    playerLevel: xpResult.playerLevel,
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
    const now = clock.now();
    // When catching up after offline time, use the scheduled spawn time as the
    // command timestamp so nextVisitorAt advances by interval from the *scheduled*
    // time, not from now — otherwise the catch-up loop exits after one spawn.
    const timestamp = (state.nextVisitorAt > 0 && state.nextVisitorAt < now)
      ? state.nextVisitorAt
      : now;
    const { role, targetFloor } = generateRandomVisitorRole({ ...state }, gameConfig, timestamp);
    const { id, hairColor, female } = generateVisitorAppearance();
    executeCommand(get, set, {
      id: uuid(),
      type: 'spawn_visitor',
      visitorId: id,
      role,
      targetFloor,
      hairColor,
      female,
      timestamp,
    });
  },

  liftVisitor: () => {
    const state = get();
    const active = state.lobbyVisitors[0];
    if (!active) return;

    const now = clock.now();
    let role = active.role;
    let targetFloor = active.targetFloor;

    const isStillSelling = (floorId: number) => {
      const floor = state.floors.find((f) => f.id === floorId);
      return floor?.productions.some(
        (p) => p.stage === 'SELLING' && p.typeId != null &&
          now - p.stageStartedAt < (gameConfig.productionTypes[p.typeId]?.sellDuration ?? 0),
      );
    };
    const isStillDelivering = (floorId: number) => {
      const floor = state.floors.find((f) => f.id === floorId);
      return floor?.productions.some(
        (p) => p.stage === 'DELIVERING' && p.typeId != null &&
          now - p.stageStartedAt < (gameConfig.productionTypes[p.typeId]?.deliveryDuration ?? 0),
      );
    };

    if (role == null || targetFloor == null) {
      ({ role, targetFloor } = generateRandomVisitorRole({ ...state }, gameConfig, now));
    } else if (role === 'seller' && !isStillSelling(targetFloor)) {
      ({ role, targetFloor } = generateRandomVisitorRole({ ...state }, gameConfig, now));
    } else if (role === 'deliverer' && !isStillDelivering(targetFloor)) {
      ({ role, targetFloor } = generateRandomVisitorRole({ ...state }, gameConfig, now));
    }

    executeCommand(get, set, {
      id: uuid(),
      type: 'lift_visitor',
      role,
      targetFloor,
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
    playerLevel: state.playerLevel ?? 1,
    playerXp: state.playerXp ?? 0,
  }),

  reconcile: (serverState, newVersion, ackCursor, playerLevel, playerXp) => set((cur) => ({
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
    playerLevel: playerLevel ?? cur.playerLevel,
    playerXp: playerXp ?? cur.playerXp,
  })),

  clearAckedCommands: (ackCursor, playerLevel, playerXp) => set((cur) => ({
    lastAckCursor: ackCursor,
    playerLevel: playerLevel ?? cur.playerLevel,
    playerXp: playerXp ?? cur.playerXp,
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
  return useGameStore(useShallow((state) => ({
    lobbyVisitors: state.lobbyVisitors,
    lobbyCapacity: state.lobbyCapacity,
    elevatorLevel: state.elevatorLevel,
    elevatorFloor: state.elevatorFloor,
    dailyTips: state.dailyTips,
    dailyGemsCollected: state.dailyGemsCollected,
    dailyTipsRewardClaimed: state.dailyTipsRewardClaimed,
    nextVisitorAt: state.nextVisitorAt,
    gems: state.gems,
  })));
}
