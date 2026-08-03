import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { processCommand } from '../../shared/engine/processCommand';
import { gameConfig, createInitialState } from '../../shared/config/gameConfig';
import { generateRandomVisitorRole, generateVisitorAppearance, getFillLobbyCost, checkDailyReset, calculateTip } from '../../shared/engine/lobbyUtils';
import { generateRandomWorkers, WORKER_LOOKAHEAD } from '../../shared/config/workerNames';
import { getBuiltFloorCountForType } from '../../shared/engine/workerUtils';
import { applyXpGain, xpForCommand, type LevelUpEvent } from '../../shared/engine/xp';
import { clock } from '../services/clock';
import type { GameState, Command, Floor, Worker, ToolsState, Visitor } from '../../shared/types';
import type { NewAchievementGrant, CategoryProgressState } from '../../shared/types/achievements';
import { detectOptimisticGrants } from '../utils/detectOptimisticGrants';
import { ACHIEVEMENT_CATEGORIES } from '../../shared/config/achievementCategories';
import { DAILY_TASKS, getCoinMultiplier, getMaterialCount } from '../../shared/config/dailyTasksConfig';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function computeDeliverAllSummary(
  visitors: Visitor[],
  elevatorLevel: number,
  dailyGemsCollected: number,
  playerLevel: number,
  hotelOccupied: number = 0,
  hotelCapacity: number = 999,
): DeliverAllSummary {
  let guestCount = 0, businessmanCount = 0, delivererCount = 0, sellerCount = 0, builderCount = 0;
  let totalCoins = 0, totalGems = 0, newWorkers = 0;
  let gemsCollected = dailyGemsCollected;
  const gemLimit = gameConfig.lobbyConfig.dailyGemLimitBase + playerLevel;
  let occupied = hotelOccupied;

  for (const v of visitors) {
    const role = v.role ?? 'guest';
    const targetFloor = v.targetFloor ?? 1;
    const isVip = v.isVip ?? false;
    const tipMultiplier = isVip ? 10 : 1;
    switch (role) {
      case 'guest':
        guestCount++;
        totalCoins += calculateTip('guest', targetFloor, elevatorLevel, gameConfig) * tipMultiplier;
        if (targetFloor === 1) {
          if (isVip) {
            const added = Math.max(0, hotelCapacity - occupied);
            newWorkers += added;
            occupied += added;
          } else if (occupied < hotelCapacity) {
            newWorkers++;
            occupied++;
          }
        }
        break;
      case 'businessman':
        businessmanCount++;
        if (gemsCollected < gemLimit) {
          totalGems++;
          gemsCollected++;
        } else {
          totalCoins += calculateTip('businessman', targetFloor, elevatorLevel, gameConfig) * tipMultiplier;
        }
        break;
      case 'deliverer':
        delivererCount++;
        totalCoins += calculateTip('deliverer', targetFloor, elevatorLevel, gameConfig) * tipMultiplier;
        break;
      case 'seller':
        sellerCount++;
        totalCoins += calculateTip('seller', targetFloor, elevatorLevel, gameConfig) * tipMultiplier;
        break;
      case 'builder':
        builderCount++;
        break;
    }
  }

  return { guestCount, businessmanCount, delivererCount, sellerCount, builderCount, totalCoins, totalGems, newWorkers };
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
    key: 'briks' | 'glass' | 'nails' | 'screw' | 'wood' | 'cement';
    need: number;
    have: number;
  }[];
}

type ToolKey = 'briks' | 'glass' | 'nails' | 'screw' | 'wood' | 'cement';

export interface FailedCommandEntry {
  id: string;
  type: string;
  error: string;
  timestamp: number;
}

export type DeliverAllSummary = {
  guestCount: number;
  businessmanCount: number;
  delivererCount: number;
  sellerCount: number;
  builderCount: number;
  totalCoins: number;
  totalGems: number;
  newWorkers: number;
};

export type PendingTaskReward = {
  taskTitle: string;
  coins: number;
  gems: number;
  tokenCount: number;
  tokenColor: string;
  matCount?: number;
  materialType?: string;
};

export type PurchaseSuccessPayload = {
  packName: string;
  price: string;
  rewards: import('../data/shopPacks').ShopRewards;
};

export type ReferralNotification =
  | { type: 'claim'; referralId: string; referredName: string; milestone: 'registered'; coins: number }
  | { type: 'claim'; referralId: string; referredName: string; milestone: 'level10' | 'level30'; gems: number }
  | { type: 'purchase_bonus'; names: string[]; totalBonus: number }
  | { type: 'referred_bonus'; coins: number; gems: number };

interface UIState {
  insufficientResources: InsufficientResourcesPayload | null;
  builderToolDrop: ToolKey | null;
  achievementQueue: NewAchievementGrant[];
  coinBonusPercent: number;
  xpBonusPercent: number;
  categoryProgress: Record<string, CategoryProgressState>;
  locallyGrantedAchievements: Set<string>;
  failedCommandLog: FailedCommandEntry[];
  pendingReferralNotifications: ReferralNotification[];
  pendingWorkerFocus: string | null;
  pendingDailyLoginReward: { coins: number; gems: number } | null;
  tokenInsufficient: { floorType: 'green' | 'blue' | 'yellow' | 'purple' | 'red'; have: number; need: number } | null;
  pendingTaskReward: PendingTaskReward | null;
  pendingDeliverAll: DeliverAllSummary | null;
  hotelFullNotice: boolean;
  pendingOpenHotel: boolean;
  pendingPurchaseSuccess: PurchaseSuccessPayload | null;
  isHydrated: boolean;
  activeSheetCount: number;
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
  collectAll: () => void;
  listAll: () => void;
  buyAll: () => void;
  fillLobby: () => void;
  upgradeElevator: () => void;
  upgradeLobby: () => void;
  expandHotel: () => void;
  evictLowLevelWorkers: () => void;
  claimDailyReward: (stage: 1 | 2) => void;
  claimDailyTask: (taskKey: string, taskTitle: string) => void;
  dismissLevelUp: () => void;
  setToolInventory: (tools: ToolsState) => void;
  buyFloor: (floorId: number) => void;
  selectFloorType: (floorId: number, floorType: string) => void;
  openFloor: (floorId: number, floorType: string) => void;
  setLastSyncAt: (ts: number) => void;
  upgradeBusinessCategory: (floorType: 'green' | 'blue' | 'yellow' | 'purple' | 'red') => void;
  hydrate: (state: GameState & Partial<SyncState> & {
    playerLevel?: number;
    playerXp?: number;
    achievementQueue?: NewAchievementGrant[];
    coinBonusPercent?: number;
    xpBonusPercent?: number;
    categoryProgress?: Record<string, CategoryProgressState>;
    dailyTipsRewardClaimed?: boolean;
  }) => void;
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
  enqueueReferralNotifications: (
    claims: Array<{ id: string; referredName: string; milestone: 'registered' | 'level10' | 'level30'; gems?: number; coins?: number }>,
    bonuses: Array<{ referredName: string; bonus: number; purchaseAmount: number }>
  ) => void;
  pushReferralNotification: (notification: ReferralNotification) => void;
  dismissReferralNotification: () => void;
  setPendingWorkerFocus: (workerId: string) => void;
  clearPendingWorkerFocus: () => void;
  setDailyLoginReward: (reward: { coins: number; gems: number }) => void;
  dismissDailyLoginReward: () => void;
  clearFailedCommandLog: () => void;
  showTokenInsufficient: (payload: { floorType: 'green' | 'blue' | 'yellow' | 'purple' | 'red'; have: number; need: number }) => void;
  clearTokenInsufficient: () => void;
  setTaskReward: (payload: PendingTaskReward) => void;
  clearTaskReward: () => void;
  shopPurchase: (pack: import('../data/shopPacks').ShopPack) => void;
  clearPurchaseSuccess: () => void;
  setPendingDeliverAll: (summary: DeliverAllSummary) => void;
  clearPendingDeliverAll: () => void;
  showHotelFullNotice: () => void;
  dismissHotelFullNotice: () => void;
  clearPendingOpenHotel: () => void;
  openSheet: () => void;
  closeSheet: () => void;
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
    dailyTips, dailyGemsCollected, dailyTipsStage1Claimed, dailyTipsStage2Claimed, lastDailyReset, nextVisitorAt,
    tools, underConstruction, openedFloorTypes, stats, dailyFillLobbyUses,
    coinBonusPercent, xpBonusPercent, tokens, businessUpgrades, dailyTasks,
  } = store;
  let gameState: GameState = {
    balance, gems, floors, commandQueue, workers, hotelCapacity,
    lobbyVisitors, lobbyCapacity, elevatorLevel, elevatorFloor,
    dailyTips, dailyGemsCollected, dailyTipsStage1Claimed, dailyTipsStage2Claimed, lastDailyReset, nextVisitorAt,
    tools, underConstruction, openedFloorTypes, stats, dailyFillLobbyUses,
    coinBonusPercent, xpBonusPercent, tokens, businessUpgrades, dailyTasks,
  };
  // Use real wall-clock time so daily reset fires even when spawn_visitor
  // timestamps are from yesterday (catch-up cadence).
  gameState = checkDailyReset(gameState, clock.now());
  // If a daily reset just fired, re-apply any claim_daily_task commands that were
  // dispatched today (timestamp >= new lastDailyReset) so they survive the reset.
  if (gameState.lastDailyReset !== lastDailyReset) {
    const todaysClaims = commandQueue
      .filter((cmd) => cmd.type === 'claim_daily_task' && cmd.timestamp >= gameState.lastDailyReset)
      .map((cmd) => (cmd as Extract<typeof cmd, { type: 'claim_daily_task' }>).taskKey);
    if (todaysClaims.length > 0) {
      gameState = {
        ...gameState,
        dailyTasks: {
          ...gameState.dailyTasks,
          claimed: [...new Set([...gameState.dailyTasks.claimed, ...todaysClaims])],
        },
      };
    }
  }
  const result = processCommand(
    gameState, command, gameConfig, command.timestamp, store.playerLevel,
    { coinPercent: store.coinBonusPercent, xpPercent: store.xpBonusPercent },
  );
  if (!result.success) {
    const curLog = get().failedCommandLog;
    set({
      failedCommandLog: [
        ...curLog.slice(-19),
        { id: uuid(), type: command.type, error: result.error ?? 'Unknown error', timestamp: Date.now() },
      ],
    });
    return;
  }

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

  // Keep categoryProgress in sync with optimistic stats so the achievements
  // screen reflects the current local state instead of the last server sync.
  // Use delta-based progress (same logic as the server) so the counter stays
  // consistent with playerCategoryProgress.progress even if it diverges from
  // stats[stat] (e.g. stats column was added before the progress table).
  const newCategoryProgress = { ...store.categoryProgress };
  let hasCategoryChanges = false;
  for (const category of ACHIEVEMENT_CATEGORIES) {
    const delta = result.state.stats[category.stat] - stats[category.stat];
    if (delta <= 0) continue;
    hasCategoryChanges = true;
    const existing = store.categoryProgress[category.key] ?? { progress: 0, currentLevel: 0, claimedLevels: [] };
    const grants = optimisticGrants.filter((g) => g.categoryKey === category.key);
    const newLevel = grants.reduce((max, g) => Math.max(max, g.level), existing.currentLevel);
    const newClaimed = grants.length > 0
      ? [...new Set([...existing.claimedLevels, ...grants.map((g) => g.level)])].sort((a, b) => a - b)
      : existing.claimedLevels;
    newCategoryProgress[category.key] = {
      progress: existing.progress + delta,
      currentLevel: newLevel,
      claimedLevels: newClaimed,
    };
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
    dailyTipsStage1Claimed: result.state.dailyTipsStage1Claimed,
    dailyTipsStage2Claimed: result.state.dailyTipsStage2Claimed,
    lastDailyReset: result.state.lastDailyReset,
    nextVisitorAt: result.state.nextVisitorAt,
    dailyFillLobbyUses: result.state.dailyFillLobbyUses,
    tools: result.state.tools,
    underConstruction: result.state.underConstruction,
    openedFloorTypes: result.state.openedFloorTypes,
    stats: result.state.stats,
    tokens: result.state.tokens,
    businessUpgrades: result.state.businessUpgrades,
    dailyTasks: result.state.dailyTasks,
    playerXp: xpResult.playerXp,
    playerLevel: xpResult.playerLevel,
    levelUpQueue: [...store.levelUpQueue, ...levelUps],
    ...(hasCategoryChanges ? { categoryProgress: newCategoryProgress } : {}),
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
  failedCommandLog: [],
  pendingReferralNotifications: [],
  pendingWorkerFocus: null,
  pendingDailyLoginReward: null,
  tokenInsufficient: null,
  pendingTaskReward: null,
  pendingDeliverAll: null,
  hotelFullNotice: false,
  pendingOpenHotel: false,
  pendingPurchaseSuccess: null,
  isHydrated: false,
  activeSheetCount: 0,

  exchangeGemsForCoins: (gems) => {
    executeCommand(get, set, { id: uuid(), type: 'exchange_gems', gems, timestamp: clock.now() });
  },
  devAddGems: (amount) => {
    executeCommand(get, set, { id: uuid(), type: 'dev_add_gems', amount, timestamp: clock.now() });
  },
  upgradeBusinessCategory: (floorType) => {
    executeCommand(get, set, {
      id: uuid(),
      type: 'upgrade_business_category',
      floorType,
      timestamp: clock.now(),
    });
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
  showTokenInsufficient: (payload) => set({ tokenInsufficient: payload }),
  clearTokenInsufficient: () => set({ tokenInsufficient: null }),
  setTaskReward: (payload) => set({ pendingTaskReward: payload }),
  clearTaskReward: () => set({ pendingTaskReward: null }),
  clearPurchaseSuccess: () => set({ pendingPurchaseSuccess: null }),
  shopPurchase: (pack) => {
    executeCommand(get, set, {
      id: uuid(),
      type: 'shop_purchase',
      gems:   pack.rewards.gems ?? 0,
      tools:  {
        briks:  pack.rewards.tools?.briks  ?? 0,
        glass:  pack.rewards.tools?.glass  ?? 0,
        nails:  pack.rewards.tools?.nails  ?? 0,
        screw:  pack.rewards.tools?.screw  ?? 0,
        wood:   pack.rewards.tools?.wood   ?? 0,
        cement: pack.rewards.tools?.cement ?? 0,
      },
      tokens: {
        green:  pack.rewards.tokens?.green  ?? 0,
        blue:   pack.rewards.tokens?.blue   ?? 0,
        yellow: pack.rewards.tokens?.yellow ?? 0,
        purple: pack.rewards.tokens?.purple ?? 0,
        red:    pack.rewards.tokens?.red    ?? 0,
      },
      timestamp: clock.now(),
    });
    set({
      pendingPurchaseSuccess: {
        packName: pack.name,
        price:    pack.price,
        rewards:  pack.rewards,
      },
    });
  },
  setPendingDeliverAll: (summary) => set({ pendingDeliverAll: summary }),
  clearPendingDeliverAll: () => set({ pendingDeliverAll: null }),
  showHotelFullNotice: () => set({ hotelFullNotice: true }),
  dismissHotelFullNotice: () => set({ hotelFullNotice: false }),
  clearPendingOpenHotel: () => set({ pendingOpenHotel: false }),
  openSheet: () => set((s) => ({ activeSheetCount: s.activeSheetCount + 1 })),
  closeSheet: () => set((s) => ({ activeSheetCount: Math.max(0, s.activeSheetCount - 1) })),
  setPendingWorkerFocus: (workerId) => set({ pendingWorkerFocus: workerId }),
  clearPendingWorkerFocus: () => set({ pendingWorkerFocus: null }),
  setDailyLoginReward: (reward) => set({ pendingDailyLoginReward: reward }),
  dismissDailyLoginReward: () => set({ pendingDailyLoginReward: null }),
  clearBuilderToolDrop: () => set({ builderToolDrop: null }),

  addAchievements: (grants) => set((cur) => ({
    achievementQueue: [...cur.achievementQueue, ...grants],
  })),

  dismissAchievement: () => set((cur) => ({
    achievementQueue: cur.achievementQueue.slice(1),
  })),

  enqueueReferralNotifications: (claims, bonuses) => set((cur) => {
    const newNotifs: ReferralNotification[] = [
      ...claims.map((c): ReferralNotification => {
        if (c.milestone === 'registered') {
          return {
            type: 'claim',
            referralId: c.id,
            referredName: c.referredName,
            milestone: 'registered',
            coins: c.coins ?? 0,
          };
        }
        return {
          type: 'claim',
          referralId: c.id,
          referredName: c.referredName,
          milestone: c.milestone as 'level10' | 'level30',
          gems: c.gems ?? 0,
        };
      }),
    ];
    if (bonuses.length > 0) {
      const names = bonuses.map((b) => b.referredName);
      const totalBonus = bonuses.reduce((sum, b) => sum + b.bonus, 0);
      newNotifs.push({ type: 'purchase_bonus', names, totalBonus });
    }
    return { pendingReferralNotifications: [...cur.pendingReferralNotifications, ...newNotifs] };
  }),

  pushReferralNotification: (notification) => set((cur) => ({
    pendingReferralNotifications: [...cur.pendingReferralNotifications, notification],
  })),

  dismissReferralNotification: () => set((cur) => ({
    pendingReferralNotifications: cur.pendingReferralNotifications.slice(1),
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
    pendingReferralNotifications: [],
    pendingWorkerFocus: null,
    pendingDailyLoginReward: null,
    hotelFullNotice: false,
    pendingOpenHotel: false,
    tokens: { green: 0, blue: 0, yellow: 0, purple: 0, red: 0 },
    dailyTasks: { progress: { visitorsLifted: 0, vipsLifted: 0, goodsBought: 0, residentsAdded: 0, gemsPurchased: 0, goodsCollected: 0, floorsBuilt: 0, residentsEvicted: 0, goodsListed: 0 }, claimed: [], doubleRewardActive: false },
    isHydrated: false,
    activeSheetCount: 0,
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
    const { role, targetFloor, isVip } = generateRandomVisitorRole({ ...state }, gameConfig, timestamp, state.playerLevel);
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
      isVip,
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
    const isVip = active?.isVip ?? false;
    const prevVisitorCount = state.lobbyVisitors.length;

    const TOOLS: ToolKey[] = ['briks', 'glass', 'nails', 'screw', 'wood', 'cement'];

    // Worker pre-generation
    let newWorker: ReturnType<typeof generateRandomWorkers>[0] | undefined;
    let newWorkers: ReturnType<typeof generateRandomWorkers>[0][] | undefined;

    if (role === 'guest' && targetFloor === 1) {
      const hotelOccupied = state.workers.filter((w) => w.assignedFloorId === null).length;
      if (isVip) {
        const spotsLeft = state.hotelCapacity - hotelOccupied;
        if (spotsLeft > 0) {
          const pendingFloorType = active?.pendingFloorType;
          newWorkers = Array.from({ length: spotsLeft }, () => {
            let maxBizIdx: number | undefined;
            if (pendingFloorType && gameConfig.floorTypes[pendingFloorType]) {
              const builtCount = getBuiltFloorCountForType(pendingFloorType, state.floors, state.openedFloorTypes ?? {}, gameConfig);
              maxBizIdx = Math.min(builtCount + WORKER_LOOKAHEAD - 1, gameConfig.floorTypes[pendingFloorType].businesses.length - 1);
            }
            return generateRandomWorkers(1, gameConfig, undefined, pendingFloorType, maxBizIdx)[0];
          });
        }
      } else if (hotelOccupied < state.hotelCapacity) {
        const pendingFloorType = active?.pendingFloorType;
        let maxBizIdx: number | undefined;
        if (pendingFloorType && gameConfig.floorTypes[pendingFloorType]) {
          const builtCount = getBuiltFloorCountForType(pendingFloorType, state.floors, state.openedFloorTypes ?? {}, gameConfig);
          maxBizIdx = Math.min(builtCount + WORKER_LOOKAHEAD - 1, gameConfig.floorTypes[pendingFloorType].businesses.length - 1);
        }
        newWorker = generateRandomWorkers(1, gameConfig, undefined, pendingFloorType, maxBizIdx)[0];
      }
    }

    // Builder tool pre-generation
    let builderTool: ToolKey | undefined;
    let builderTools: ToolKey[] | undefined;

    if (role === 'builder') {
      if (isVip) {
        const isUnderConstruction = state.underConstruction.some((uc) => uc.floorId === targetFloor);
        builderTools = isUnderConstruction
          ? []   // completing construction — no tools
          : [TOOLS[Math.floor(Math.random() * TOOLS.length)], TOOLS[Math.floor(Math.random() * TOOLS.length)]];
      } else {
        builderTool = TOOLS[Math.floor(Math.random() * TOOLS.length)];
      }
    }

    executeCommand(get, set, {
      id: uuid(),
      type: 'collect_tip',
      timestamp: clock.now(),
      newWorker,
      newWorkers,
      builderTool,
      builderTools,
    });

    // Builder tool drop popup (show first tool for VIP non-construction builders)
    const droppedTool = builderTools?.[0] ?? (builderTool && get().lobbyVisitors.length < prevVisitorCount ? builderTool : undefined);
    if (droppedTool && get().lobbyVisitors.length < prevVisitorCount) {
      set({ builderToolDrop: droppedTool });
    }
  },

  deliverAll: () => {
    const state = get();
    const now = clock.now();
    const TOOLS: ToolKey[] = ['briks', 'glass', 'nails', 'screw', 'wood', 'cement'];

    // Builder tools: 1 per regular builder, 2 per VIP builder (engine ignores if completing construction)
    const builderTools: ToolKey[] = [];
    for (const visitor of state.lobbyVisitors) {
      const isBuilder = (visitor.role ?? 'guest') === 'builder';
      if (isBuilder) {
        const count = (visitor.isVip ?? false) ? 2 : 1;
        for (let i = 0; i < count; i++) {
          builderTools.push(TOOLS[Math.floor(Math.random() * TOOLS.length)]);
        }
      }
    }

    // Pre-generate workers for each guest heading to floor 1 so the server uses
    // the same worker IDs instead of generating its own (which would cause mismatch
    // on reconcile, resulting in "Worker not found" and incorrect over-capacity display).
    let hotelOccupied = state.workers.filter((w) => w.assignedFloorId === null).length;
    const preGeneratedWorkers: ReturnType<typeof generateRandomWorkers>[0][] = [];
    const vipGuestWorkerBatches: ReturnType<typeof generateRandomWorkers>[0][][] = [];

    for (const visitor of state.lobbyVisitors) {
      const isGuestAtFloor1 = (visitor.role ?? 'guest') === 'guest' && visitor.targetFloor === 1;
      if (!isGuestAtFloor1) continue;

      const pendingFloorType = visitor.pendingFloorType;
      let maxBizIdx: number | undefined;
      if (pendingFloorType && gameConfig.floorTypes[pendingFloorType]) {
        const builtCount = getBuiltFloorCountForType(pendingFloorType, state.floors, state.openedFloorTypes ?? {}, gameConfig);
        maxBizIdx = Math.min(builtCount + WORKER_LOOKAHEAD - 1, gameConfig.floorTypes[pendingFloorType].businesses.length - 1);
      }

      if (visitor.isVip ?? false) {
        const spotsLeft = state.hotelCapacity - hotelOccupied;
        const batch: ReturnType<typeof generateRandomWorkers>[0][] = [];
        for (let i = 0; i < spotsLeft; i++) {
          batch.push(generateRandomWorkers(1, gameConfig, undefined, pendingFloorType, maxBizIdx)[0]);
          hotelOccupied++;
        }
        vipGuestWorkerBatches.push(batch);
      } else if (hotelOccupied < state.hotelCapacity) {
        preGeneratedWorkers.push(generateRandomWorkers(1, gameConfig, undefined, pendingFloorType, maxBizIdx)[0]);
        hotelOccupied++;
      }
    }

    executeCommand(get, set, {
      id: uuid(),
      type: 'deliver_all',
      timestamp: now,
      builderTools,
      ...(preGeneratedWorkers.length > 0 && { preGeneratedWorkers }),
      ...(vipGuestWorkerBatches.length > 0 && { vipGuestWorkerBatches }),
    });

    const summary = computeDeliverAllSummary(
      state.lobbyVisitors,
      state.elevatorLevel,
      state.dailyGemsCollected,
      state.playerLevel,
      state.workers.filter((w) => w.assignedFloorId === null).length,
      state.hotelCapacity,
    );
    set({ pendingDeliverAll: summary });
  },

  collectAll: () => {
    const state = get();
    if (state.gems < 1) {
      state.showInsufficientResources({ currency: 'gems', need: 1, have: state.gems });
      return;
    }
    executeCommand(get, set, { id: uuid(), type: 'collect_all', timestamp: clock.now() });
  },

  listAll: () => {
    const state = get();
    if (state.gems < 1) {
      state.showInsufficientResources({ currency: 'gems', need: 1, have: state.gems });
      return;
    }
    executeCommand(get, set, { id: uuid(), type: 'list_all', timestamp: clock.now() });
  },

  buyAll: () => {
    const state = get();
    if (state.gems < 1) {
      state.showInsufficientResources({ currency: 'gems', need: 1, have: state.gems });
      return;
    }
    executeCommand(get, set, { id: uuid(), type: 'buy_all', timestamp: clock.now() });
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
      const { role, targetFloor, isVip } = generateRandomVisitorRole({ ...state }, gameConfig, now, state.playerLevel);
      const { id, hairColor, female } = generateVisitorAppearance();
      const pendingFloorType = (role === 'guest' && targetFloor === 1)
        ? Object.keys(gameConfig.floorTypes)[Math.floor(Math.random() * Object.keys(gameConfig.floorTypes).length)]
        : undefined;
      return { visitorId: id, role, isVip, targetFloor, hairColor, female, pendingFloorType };
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

  claimDailyReward: (stage: 1 | 2) => {
    executeCommand(get, set, {
      id: uuid(),
      type: 'claim_daily_reward',
      stage,
      timestamp: clock.now(),
    });
  },

  claimDailyTask: (taskKey, taskTitle) => {
    const COLORS = ['green', 'blue', 'yellow', 'purple', 'red'] as const;
    const MATERIAL_TYPES = ['briks', 'glass', 'nails', 'screw', 'wood', 'cement'] as const;
    const taskConfig = DAILY_TASKS.find((t) => t.key === taskKey);
    if (!taskConfig) return;
    const state = get();
    const tokenCount = Math.floor(Math.random() * 5) + 1;
    const tokenColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    const materialType = taskConfig.rewards.hasMaterials
      ? (state.dailyTasks.dailyMaterialType ?? MATERIAL_TYPES[Math.floor(Math.random() * MATERIAL_TYPES.length)])
      : undefined;
    const multiplier = getCoinMultiplier(state.playerLevel);
    const doubleMultiplier = state.dailyTasks.doubleRewardActive ? 2 : 1;
    const coins = taskConfig.rewards.baseCoins * multiplier * doubleMultiplier;
    const matCount = taskConfig.rewards.hasMaterials
      ? getMaterialCount(state.playerLevel) * doubleMultiplier
      : undefined;
    executeCommand(get, set, {
      id: uuid(),
      type: 'claim_daily_task',
      taskKey,
      tokenCount,
      tokenColor,
      materialType,
      timestamp: clock.now(),
    });
    set({ pendingTaskReward: { taskTitle, coins, gems: taskConfig.rewards.gems, tokenCount, tokenColor, matCount, materialType } });
  },

  dismissLevelUp: () => {
    set((state) => ({ levelUpQueue: state.levelUpQueue.slice(1) }));
  },

  setToolInventory: (tools) => set((cur) => ({ tools: { ...cur.tools, ...tools } })),

  setLastSyncAt: (ts) => set({ lastSyncAt: ts }),

  hydrate: (state) => set({
    isHydrated: true,
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
    dailyTipsStage1Claimed: state.dailyTipsStage1Claimed ?? state.dailyTipsRewardClaimed ?? false,
    dailyTipsStage2Claimed: state.dailyTipsStage2Claimed ?? false,
    lastDailyReset: state.lastDailyReset ?? 0,
    nextVisitorAt: state.nextVisitorAt ?? 0,
    dailyFillLobbyUses: state.dailyFillLobbyUses ?? 0,
    lastAckCursor: state.lastAckCursor ?? 0,
    stateVersion: state.stateVersion ?? 0,
    playerLevel: state.playerLevel ?? 1,
    playerXp: state.playerXp ?? 0,
    tools: state.tools ?? { briks: 1, glass: 1, nails: 1, screw: 1, wood: 1, cement: 1 },
    underConstruction: state.underConstruction ?? [],
    openedFloorTypes: state.openedFloorTypes ?? {},
    stats: state.stats ?? { totalBought: 0, totalListed: 0, totalCollected: 0, totalPassengersLifted: 0 },
    achievementQueue: state.achievementQueue ?? [],
    coinBonusPercent: state.coinBonusPercent ?? 0,
    xpBonusPercent: state.xpBonusPercent ?? 0,
    categoryProgress: state.categoryProgress ?? {},
    tokens: state.tokens ?? { green: 0, blue: 0, yellow: 0, purple: 0, red: 0 },
    businessUpgrades: state.businessUpgrades ?? { green: 0, blue: 0, yellow: 0, purple: 0, red: 0 },
    dailyTasks: state.dailyTasks ?? { progress: { visitorsLifted: 0, vipsLifted: 0, goodsBought: 0, residentsAdded: 0, gemsPurchased: 0, goodsCollected: 0, floorsBuilt: 0, residentsEvicted: 0, goodsListed: 0 }, claimed: [], doubleRewardActive: false },
  }),

  reconcile: (serverState, newVersion, ackCursor, sentIds, playerLevel, playerXp) => set((cur) => ({
    balance: serverState.balance,
    gems: serverState.gems,
    workers: (() => {
      // Re-apply pending worker commands over server state to preserve optimistic effects.
      // Without this, a stale sync response (stateVersion bumped by lobby visitors while
      // a hire was in-flight) triggers a reconcile that rolls back the optimistic hire,
      // causing the "better candidate" badge to flicker incorrectly.
      const pendingWorkerCmds = cur.commandQueue.filter(
        (cmd) => !sentIds.has(cmd.id) &&
          (cmd.type === 'assign_worker' || cmd.type === 'fire_worker' ||
           cmd.type === 'evict_worker' || cmd.type === 'fire_and_evict_worker' ||
           cmd.type === 'evict_low_level_workers' || cmd.type === 'upgrade_to_specialist' ||
           cmd.type === 'deliver_all'),
      );
      if (pendingWorkerCmds.length === 0) return serverState.workers;
      let workers = serverState.workers;
      let floors = serverState.floors;
      for (const cmd of pendingWorkerCmds) {
        const result = processCommand(
          { ...serverState, workers, floors, commandQueue: [] },
          cmd, gameConfig, cmd.timestamp,
        );
        if (result.success) {
          workers = result.state.workers;
          floors = result.state.floors;
        }
      }
      // Guard against over-capacity: server may have generated workers to fill hotel
      // slots it thought were free (visitor lifts run before the fire_worker commands
      // reach the server). Re-applying those fires above can push unemployed count
      // above hotelCapacity. Trim excess server-generated workers (those absent from
      // the pre-reconcile local state) so the occupancy display stays within bounds.
      const cap = serverState.hotelCapacity;
      const unemployed = workers.filter((w) => w.assignedFloorId === null);
      if (unemployed.length > cap) {
        const localIds = new Set(cur.workers.map((w) => w.id));
        const assigned = workers.filter((w) => w.assignedFloorId !== null);
        const localUnemployed = unemployed.filter((w) => localIds.has(w.id));
        const serverNew = unemployed.filter((w) => !localIds.has(w.id));
        const keepCount = Math.max(0, cap - localUnemployed.length);
        workers = [...localUnemployed, ...serverNew.slice(0, keepCount), ...assigned];
      }
      return workers;
    })(),
    hotelCapacity: serverState.hotelCapacity + cur.commandQueue.filter(
      (cmd) => !sentIds.has(cmd.id) && cmd.type === 'expand_hotel',
    ).length,
    lobbyVisitors: serverState.lobbyVisitors,
    lobbyCapacity: serverState.lobbyCapacity,
    elevatorLevel: serverState.elevatorLevel,
    elevatorFloor: serverState.elevatorFloor,
    dailyTips: serverState.dailyTips,
    dailyGemsCollected: serverState.dailyGemsCollected,
    dailyTipsStage1Claimed: serverState.dailyTipsStage1Claimed ?? (serverState as any).dailyTipsRewardClaimed ?? false,
    dailyTipsStage2Claimed: serverState.dailyTipsStage2Claimed ?? false,
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
    tools: serverState.tools ?? cur.tools ?? { briks: 0, glass: 0, nails: 0, screw: 0, wood: 0, cement: 0 },
    underConstruction: (() => {
      const pendingOpenFloorIds = new Set<number>();
      for (const cmd of cur.commandQueue) {
        if (!sentIds.has(cmd.id) && cmd.type === 'open_floor') {
          pendingOpenFloorIds.add(cmd.floorId);
        }
      }
      return (serverState.underConstruction ?? [])
        .filter((uc) => !pendingOpenFloorIds.has(uc.floorId))
        .map((uc) => {
          const local = cur.underConstruction.find((u) => u.floorId === uc.floorId);
          return local?.selectedFloorType ? { ...uc, selectedFloorType: local.selectedFloorType } : uc;
        });
    })(),
    openedFloorTypes: (() => {
      const base = serverState.openedFloorTypes ?? {};
      // Pending open_floor commands (not in this sync batch) must survive reconcile so
      // subsequent open_floor commands for other floors compute the correct tier.
      const extra: Record<string, string> = {};
      for (const cmd of cur.commandQueue) {
        if (!sentIds.has(cmd.id) && cmd.type === 'open_floor') {
          extra[String(cmd.floorId)] = cmd.floorType;
        }
      }
      return { ...base, ...extra };
    })(),
    floors: (() => {
      const base = serverState.floors;
      const extra: typeof base = [];
      for (const cmd of cur.commandQueue) {
        if (!sentIds.has(cmd.id) && cmd.type === 'open_floor') {
          const f = cur.floors.find((fl) => fl.id === cmd.floorId);
          if (f && !base.some((b) => b.id === cmd.floorId)) extra.push(f);
        }
      }
      return extra.length > 0 ? [...base, ...extra] : base;
    })(),
    stats: serverState.stats ?? { totalBought: 0, totalListed: 0, totalCollected: 0, totalPassengersLifted: 0 },
    tokens:     serverState.tokens     ?? cur.tokens,
    businessUpgrades: serverState.businessUpgrades ?? cur.businessUpgrades ?? { green: 0, blue: 0, yellow: 0, purple: 0, red: 0 },
    dailyTasks: (() => {
      const base = serverState.dailyTasks ?? cur.dailyTasks;
      const pendingClaims = cur.commandQueue
        .filter((cmd) => !sentIds.has(cmd.id) && cmd.type === 'claim_daily_task')
        .map((cmd) => (cmd as Extract<typeof cmd, { type: 'claim_daily_task' }>).taskKey);
      if (pendingClaims.length === 0) return base;
      return { ...base, claimed: [...new Set([...base.claimed, ...pendingClaims])] };
    })(),
    locallyGrantedAchievements: new Set<string>(),
  })),

  clearAckedCommands: (ackCursor, sentIds, playerLevel, playerXp) => set((cur) => ({
    lastAckCursor: ackCursor,
    playerLevel: playerLevel ?? cur.playerLevel,
    playerXp: playerXp ?? cur.playerXp,
    commandQueue: cur.commandQueue.filter((cmd) => !sentIds.has(cmd.id)),
  })),

  buyFloor: (floorId) => {
    const TOOLS: ToolKey[] = ['briks', 'glass', 'nails', 'screw', 'wood', 'cement'];
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

  clearFailedCommandLog: () => set({ failedCommandLog: [] }),
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
    dailyTipsStage1Claimed: state.dailyTipsStage1Claimed,
    dailyTipsStage2Claimed: state.dailyTipsStage2Claimed,
    nextVisitorAt: state.nextVisitorAt,
    gems: state.gems,
    dailyFillLobbyUses: state.dailyFillLobbyUses,
    floorsCount: state.floors.length,
  })));
}
