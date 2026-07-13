import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { processCommand } from '../../shared/engine/processCommand';
import { gameConfig, createInitialState } from '../../shared/config/gameConfig';
import { generateRandomVisitorRole, generateVisitorAppearance, getFillLobbyCost } from '../../shared/engine/lobbyUtils';
import { generateRandomWorkers } from '../../shared/config/workerNames';
import { applyXpGain, xpForCommand, type LevelUpEvent } from '../../shared/engine/xp';
import { clock } from '../services/clock';
import type { GameState, Command, Floor, Worker, ToolsState } from '../../shared/types';
import type { NewAchievementGrant, CategoryProgressState } from '../../shared/types/achievements';
import { detectOptimisticGrants } from '../utils/detectOptimisticGrants';

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
  lastSyncAt: number;
}

export interface InsufficientResourcesPayload {
  currency?: 'coins' | 'gems';
  need: number;
  have: number;
  missingTools?: {
    key: 'briks' | 'glass' | 'nails' | 'screw';
    need: number;
    have: number;
  }[];
}

type ToolKey = 'briks' | 'glass' | 'nails' | 'screw';

interface UIState {
  insufficientResources: InsufficientResourcesPayload | null;
  builderToolDrop: ToolKey | null;
  achievementQueue: NewAchievementGrant[];
  coinBonusPercent: number;
  xpBonusPercent: number;
  categoryProgress: Record<string, CategoryProgressState>;
  locallyGrantedAchievements: Set<string>;
}

interface GameActions {
  buy: (floorId: number, slotIdx: number, typeId: string) => void;
  list: (floorId: number, slotIdx: number) => void;
  collect: (floorId: number, slotIdx: number) => void;
  assignWorker: (workerId: string, floorId: number, slotIdx: number) => void;
  fireWorker: (workerId: string) => void;
  evictWorker: (workerId: string) => void;
  upgradeToSpecialist: (workerId: string) => void;
  fireAndEvictWorker: (workerId: string) => void;
  spawnVisitor: () => void;
  liftVisitor: () => void;
  collectTip: () => void;
  deliverAll: () => void;
  fillLobby: () => void;
  upgradeElevator: () => void;
  upgradeLobby: () => void;
  expandHotel: () => void;
  evictLowLevelWorkers: () => void;
  claimDailyReward: () => void;
  dismissLevelUp: () => void;
  setToolInventory: (tools: ToolsState) => void;
  buyFloor: (floorId: number) => void;
  selectFloorType: (floorId: number, floorType: string) => void;
  openFloor: (floorId: number, floorType: string) => void;
  setLastSyncAt: (ts: number) => void;
  hydrate: (state: GameState & Partial<SyncState> & { playerLevel?: number; playerXp?: number }) => void;
  reconcile: (state: GameState, stateVersion: number, ackCursor: number, sentIds: Set<string>, playerLevel?: number, playerXp?: number) => void;
  clearAckedCommands: (ackCursor: number, sentIds: Set<string>, playerLevel?: number, playerXp?: number) => void;
  exchangeGemsForCoins: (gems: number) => void;
  devAddGems: (amount: number) => void;
  speedUpConstruction: (floorId: number) => void;
  speedUpDelivery: (floorId: number, slotIdx: number) => void;
  showInsufficientResources: (payload: InsufficientResourcesPayload) => void;
  clearInsufficientResources: () => void;
  clearBuilderToolDrop: () => void;
  addAchievements: (grants: NewAchievementGrant[]) => void;
  dismissAchievement: () => void;
  reset: () => void;
}

type GameStore = GameState & PlayerStats & SyncState & UIState & GameActions;

function executeCommand(
  get: () => GameStore,
  set: (partial: Partial<GameStore>) => void,
  command: Command,
) {
  const store = get();
  const { balance, gems, floors, commandQueue, workers, hotelCapacity,
    lobbyVisitors, lobbyCapacity, elevatorLevel, elevatorFloor,
    dailyTips, dailyGemsCollected, dailyTipsRewardClaimed, lastDailyReset, nextVisitorAt,
    tools, underConstruction, openedFloorTypes, stats, dailyFillLobbyUses,
    coinBonusPercent, xpBonusPercent,
  } = store;
  const gameState: GameState = {
    balance, gems, floors, commandQueue, workers, hotelCapacity,
    lobbyVisitors, lobbyCapacity, elevatorLevel, elevatorFloor,
    dailyTips, dailyGemsCollected, dailyTipsRewardClaimed, lastDailyReset, nextVisitorAt,
    tools, underConstruction, openedFloorTypes, stats, dailyFillLobbyUses,
    coinBonusPercent, xpBonusPercent,
  };
  const result = processCommand(
    gameState, command, gameConfig, command.timestamp, store.playerLevel,
    { coinPercent: store.coinBonusPercent, xpPercent: store.xpBonusPercent },
  );
  if (!result.success) return;

  let newQueue = [...result.state.commandQueue, command];
  if (newQueue.length > COMMAND_QUEUE_CAP) {
    newQueue = newQueue.slice(newQueue.length - COMMAND_QUEUE_CAP);
  }

  const xpGained = result.xpGained !== undefined
    ? result.xpGained
    : xpForCommand(command.type, balance, result.state.balance, gems, result.state.gems);
  const xpResult = applyXpGain(store.playerLevel, store.playerXp, xpGained);
  let newBalance = result.state.balance + xpResult.bonusCoins;
  let newGems = result.state.gems + xpResult.bonusGems;
  const levelUps: LevelUpEvent[] = xpResult.levelUpEvents;

  const optimisticGrants = detectOptimisticGrants(
    stats,
    result.state.stats,
    store.categoryProgress,
    store.locallyGrantedAchievements,
  );
  if (optimisticGrants.length > 0) {
    newGems += optimisticGrants.reduce((sum, g) => sum + g.gems, 0);
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
    dailyFillLobbyUses: result.state.dailyFillLobbyUses,
    tools: result.state.tools,
    underConstruction: result.state.underConstruction,
    openedFloorTypes: result.state.openedFloorTypes,
    stats: result.state.stats,
    playerXp: xpResult.playerXp,
    playerLevel: xpResult.playerLevel,
    levelUpQueue: [...store.levelUpQueue, ...levelUps],
    ...(optimisticGrants.length > 0 ? {
      achievementQueue: [...store.achievementQueue, ...optimisticGrants],
      locallyGrantedAchievements: new Set([
        ...store.locallyGrantedAchievements,
        ...optimisticGrants.map((g) => `${g.categoryKey}-${g.level}`),
      ]),
    } : {}),
  });
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...createInitialState(gameConfig),
  playerLevel: 1,
  playerXp: 0,
  levelUpQueue: [],
  lastAckCursor: 0,
  stateVersion: 0,
  lastSyncAt: 0,
  insufficientResources: null,
  builderToolDrop: null,
  achievementQueue: [],
  locallyGrantedAchievements: new Set<string>(),
  coinBonusPercent: 0,
  xpBonusPercent: 0,
  categoryProgress: {},

  exchangeGemsForCoins: (gems) => {
    executeCommand(get, set, { id: uuid(), type: 'exchange_gems', gems, timestamp: clock.now() });
  },
  devAddGems: (amount) => {
    executeCommand(get, set, { id: uuid(), type: 'dev_add_gems', amount, timestamp: clock.now() });
  },
  speedUpConstruction: (floorId) => {
    const state = get();
    const now = clock.now();
    const uc = state.underConstruction.find((u) => u.floorId === floorId);
    if (!uc) return;
    const timeLeft = uc.startedAt + uc.durationMs - now;
    if (timeLeft <= 0) return;
    const cost = Math.max(1, Math.ceil(timeLeft / 3_600_000));
    if (state.gems < cost) {
      state.showInsufficientResources({ currency: 'gems', need: cost, have: state.gems });
      return;
    }
    executeCommand(get, set, {
      id: uuid(),
      type: 'speed_up_construction',
      timestamp: now,
      floorId,
    });
  },
  speedUpDelivery: (floorId, slotIdx) => {
    executeCommand(get, set, {
      id: uuid(),
      type: 'speed_up_delivery',
      floorId,
      slotIdx,
      timestamp: clock.now(),
    });
  },
  showInsufficientResources: (payload) => set({ insufficientResources: payload }),
  clearInsufficientResources: () => set({ insufficientResources: null }),
  clearBuilderToolDrop: () => set({ builderToolDrop: null }),

  addAchievements: (grants) => set((cur) => ({
    achievementQueue: [...cur.achievementQueue, ...grants],
  })),

  dismissAchievement: () => set((cur) => ({
    achievementQueue: cur.achievementQueue.slice(1),
  })),

  reset: () => set({
    ...createInitialState(gameConfig),
    playerLevel: 1,
    playerXp: 0,
    levelUpQueue: [],
    lastAckCursor: 0,
    stateVersion: 0,
    lastSyncAt: 0,
    insufficientResources: null,
    builderToolDrop: null,
    achievementQueue: [],
    coinBonusPercent: 0,
    xpBonusPercent: 0,
    categoryProgress: {},
    locallyGrantedAchievements: new Set<string>(),
  }),

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

  evictLowLevelWorkers: () => {
    const state = get();
    if (state.gems < 1) {
      state.showInsufficientResources({ currency: 'gems', need: 1, have: state.gems });
      return;
    }
    executeCommand(get, set, { id: uuid(), type: 'evict_low_level_workers', timestamp: clock.now() });
  },

  upgradeToSpecialist: (workerId) => {
    executeCommand(get, set, {
      id: uuid(),
      type: 'upgrade_to_specialist',
      workerId,
      timestamp: clock.now(),
    });
  },

  fireAndEvictWorker: (workerId) => {
    executeCommand(get, set, {
      id: uuid(),
      type: 'fire_and_evict_worker',
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
    const { role, targetFloor } = generateRandomVisitorRole({ ...state }, gameConfig, timestamp, state.playerLevel);
    const { id, hairColor, female } = generateVisitorAppearance();
    const floorTypeKeys = Object.keys(gameConfig.floorTypes);
    const pendingFloorType = (role === 'guest' && targetFloor === 1)
      ? floorTypeKeys[Math.floor(Math.random() * floorTypeKeys.length)]
      : undefined;
    executeCommand(get, set, {
      id: uuid(),
      type: 'spawn_visitor',
      visitorId: id,
      role,
      targetFloor,
      hairColor,
      female,
      pendingFloorType,
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
      ({ role, targetFloor } = generateRandomVisitorRole({ ...state }, gameConfig, now, state.playerLevel));
    } else if (role === 'seller' && !isStillSelling(targetFloor)) {
      ({ role, targetFloor } = generateRandomVisitorRole({ ...state }, gameConfig, now, state.playerLevel));
    } else if (role === 'deliverer' && !isStillDelivering(targetFloor)) {
      ({ role, targetFloor } = generateRandomVisitorRole({ ...state }, gameConfig, now, state.playerLevel));
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
    const state = get();
    const active = state.lobbyVisitors[0];
    const role = active?.role ?? 'guest';
    const targetFloor = active?.targetFloor ?? 1;
    const prevVisitorCount = state.lobbyVisitors.length;

    let newWorker: ReturnType<typeof generateRandomWorkers>[0] | undefined;
    if (role === 'guest' && targetFloor === 1) {
      const hotelOccupied = state.workers.filter((w) => w.assignedFloorId === null).length;
      if (hotelOccupied < state.hotelCapacity) {
        newWorker = generateRandomWorkers(1, gameConfig, undefined, active?.pendingFloorType)[0];
      }
    }

    const builderTool = role === 'builder'
      ? (['briks', 'glass', 'nails', 'screw'] as ToolKey[])[Math.floor(Math.random() * 4)]
      : undefined;

    executeCommand(get, set, {
      id: uuid(),
      type: 'collect_tip',
      timestamp: clock.now(),
      newWorker,
      builderTool,
    });

    if (builderTool && get().lobbyVisitors.length < prevVisitorCount) {
      set({ builderToolDrop: builderTool });
    }
  },

  deliverAll: () => {
    const state = get();
    const builders = state.lobbyVisitors.filter((v) => v.role === 'builder');
    const TOOLS: ToolKey[] = ['briks', 'glass', 'nails', 'screw'];
    const builderTools = builders.map(() => TOOLS[Math.floor(Math.random() * TOOLS.length)]);
    executeCommand(get, set, {
      id: uuid(),
      type: 'deliver_all',
      timestamp: clock.now(),
      builderTools,
    });
  },

  fillLobby: () => {
    const state = get();
    const slotsToFill = state.lobbyCapacity - state.lobbyVisitors.length;
    const now = clock.now();
    const cost = getFillLobbyCost(state.dailyFillLobbyUses);
    if (state.gems < cost) {
      state.showInsufficientResources({ currency: 'gems', need: cost, have: state.gems });
      return;
    }
    const visitors = Array.from({ length: slotsToFill }, () => {
      const { role, targetFloor } = generateRandomVisitorRole({ ...state }, gameConfig, now, state.playerLevel);
      const { id, hairColor, female } = generateVisitorAppearance();
      const pendingFloorType = (role === 'guest' && targetFloor === 1)
        ? Object.keys(gameConfig.floorTypes)[Math.floor(Math.random() * Object.keys(gameConfig.floorTypes).length)]
        : undefined;
      return { visitorId: id, role, targetFloor, hairColor, female, pendingFloorType };
    });
    executeCommand(get, set, {
      id: uuid(),
      type: 'fill_lobby',
      timestamp: now,
      visitors,
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

  expandHotel: () => {
    executeCommand(get, set, {
      id: uuid(),
      type: 'expand_hotel',
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

  setToolInventory: (tools) => set((cur) => ({ tools: { ...cur.tools, ...tools } })),

  setLastSyncAt: (ts) => set({ lastSyncAt: ts }),

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
    dailyFillLobbyUses: state.dailyFillLobbyUses ?? 0,
    lastAckCursor: state.lastAckCursor ?? 0,
    stateVersion: state.stateVersion ?? 0,
    playerLevel: state.playerLevel ?? 1,
    playerXp: state.playerXp ?? 0,
    tools: state.tools ?? { briks: 1, glass: 1, nails: 1, screw: 1 },
    underConstruction: state.underConstruction ?? [],
    openedFloorTypes: state.openedFloorTypes ?? {},
    stats: state.stats ?? { totalBought: 0, totalListed: 0, totalCollected: 0, totalPassengersLifted: 0 },
    achievementQueue: (state as any).achievementQueue ?? [],
    coinBonusPercent: (state as any).coinBonusPercent ?? 0,
    xpBonusPercent: (state as any).xpBonusPercent ?? 0,
    categoryProgress: (state as any).categoryProgress ?? {},
  }),

  reconcile: (serverState, newVersion, ackCursor, sentIds, playerLevel, playerXp) => set((cur) => ({
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
    dailyFillLobbyUses: serverState.dailyFillLobbyUses ?? 0,
    stateVersion: newVersion,
    lastAckCursor: ackCursor,
    commandQueue: cur.commandQueue.filter((cmd) => !sentIds.has(cmd.id)),
    playerLevel: playerLevel != null ? Math.max(playerLevel, cur.playerLevel) : cur.playerLevel,
    playerXp: (() => {
      if (playerLevel == null) return cur.playerXp;
      if (playerLevel > cur.playerLevel) return playerXp ?? 0;
      if (playerLevel < cur.playerLevel) return cur.playerXp;
      return Math.max(playerXp ?? 0, cur.playerXp);
    })(),
    tools: serverState.tools ?? cur.tools ?? { briks: 0, glass: 0, nails: 0, screw: 0 },
    underConstruction: (serverState.underConstruction ?? []).map((uc) => {
      const local = cur.underConstruction.find((u) => u.floorId === uc.floorId);
      return local?.selectedFloorType ? { ...uc, selectedFloorType: local.selectedFloorType } : uc;
    }),
    openedFloorTypes: serverState.openedFloorTypes ?? {},
    stats: serverState.stats ?? { totalBought: 0, totalListed: 0, totalCollected: 0, totalPassengersLifted: 0 },
    locallyGrantedAchievements: new Set<string>(),
  })),

  clearAckedCommands: (ackCursor, sentIds, playerLevel, playerXp) => set((cur) => ({
    lastAckCursor: ackCursor,
    playerLevel: playerLevel ?? cur.playerLevel,
    playerXp: playerXp ?? cur.playerXp,
    commandQueue: cur.commandQueue.filter((cmd) => !sentIds.has(cmd.id)),
  })),

  buyFloor: (floorId) => {
    const TOOLS: ToolKey[] = ['briks', 'glass', 'nails', 'screw'];
    const unlock = gameConfig.floorUnlocks.find((f) => f.floorId === floorId);
    const slots = unlock?.requiredToolSlots ?? 1;
    const shuffled = [...TOOLS].sort(() => Math.random() - 0.5);
    const requiredTools = shuffled.slice(0, slots).map((tool) => ({ tool }));
    executeCommand(get, set, {
      id: uuid(),
      type: 'buy_floor',
      floorId,
      requiredTools,
      timestamp: clock.now(),
    });
  },

  selectFloorType: (floorId, floorType) => {
    set((cur) => ({
      underConstruction: cur.underConstruction.map((uc) =>
        uc.floorId === floorId ? { ...uc, selectedFloorType: floorType } : uc,
      ),
    }));
  },

  openFloor: (floorId, floorType) => {
    executeCommand(get, set, {
      id: uuid(),
      type: 'open_floor',
      floorId,
      floorType,
      timestamp: clock.now(),
    });
  },
}));

export function useBalance(): number {
  return useGameStore((state) => state.balance);
}

export function useFloor(floorId: number): Floor {
  return useGameStore((state) => state.floors.find(f => f.id === floorId)!);
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
    dailyFillLobbyUses: state.dailyFillLobbyUses,
    floorsCount: state.floors.length,
  })));
}
