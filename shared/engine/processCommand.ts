import type { GameState, Command, GameConfig, Worker } from '../types';
import { getWorkerForSlot, getFloorDiscount, getRevenueMultiplier, getFloorSpecialistBonus, getWorkerMood, SPECIALIST_UPGRADE_COST } from './workerUtils';
import { processLobbyCommand } from './lobbyCommands';
import { DAILY_TASKS, getCoinMultiplier, getMaterialCount, getTaskProgress } from '../config/dailyTasksConfig';
import { BUSINESS_UPGRADE_COSTS } from '../config/businessUpgradeCosts';
import { FLOOR_STAR_MULTIPLIERS, FLOOR_UPGRADE_COSTS } from '../config/floorUpgradeConfig';

export interface ProcessResult {
  success: boolean;
  state: GameState;
  error?: string;
  xpGained?: number;
}

export function processCommand(
  state: GameState,
  command: Command,
  config: GameConfig,
  now: number,
  playerLevel: number = 1,
  bonuses: { coinPercent: number; xpPercent: number } = { coinPercent: 0, xpPercent: 0 },
): ProcessResult {
  switch (command.type) {
    case 'assign_worker':
      return handleAssignWorker(state, command);
    case 'fire_worker':
      return handleFireWorker(state, command, config, now);
    case 'evict_worker':
      return handleEvictWorker(state, command);
    case 'upgrade_to_specialist':
      return handleUpgradeToSpecialist(state, command, config);
    case 'fire_and_evict_worker':
      return handleFireAndEvictWorker(state, command, config, now);
    case 'buy':
    case 'list':
    case 'collect':
      return processProductionCommand(state, command, config, now, bonuses);
    case 'buy_floor':
      return handleBuyFloor(state, command, config);
    case 'open_floor':
      return handleOpenFloor(state, command, config);
    case 'exchange_gems':
      return handleExchangeGems(state, command);
    case 'speed_up_construction':
      return handleSpeedUpConstruction(state, command);
    case 'speed_up_delivery':
      return handleSpeedUpDelivery(state, command, config, now);
    case 'spawn_visitor':
    case 'lift_visitor':
    case 'collect_tip':
    case 'deliver_all':
    case 'upgrade_elevator':
    case 'upgrade_lobby':
    case 'claim_daily_reward':
    case 'expand_hotel':
    case 'fill_lobby':
    case 'evict_low_level_workers':
      return processLobbyCommand(state, command, config, playerLevel);
    case 'dev_add_gems':
      return { success: true, state: { ...state, gems: state.gems + command.amount } };
    case 'shop_purchase': {
      const newDailyTasks = command.gems > 0
        ? {
            ...state.dailyTasks,
            progress: {
              ...state.dailyTasks.progress,
              gemsPurchased: state.dailyTasks.progress.gemsPurchased + command.gems,
            },
          }
        : state.dailyTasks;
      return {
        success: true,
        state: {
          ...state,
          gems:   state.gems + command.gems,
          tools: {
            briks:  (state.tools.briks  ?? 0) + (command.tools.briks  ?? 0),
            glass:  (state.tools.glass  ?? 0) + (command.tools.glass  ?? 0),
            nails:  (state.tools.nails  ?? 0) + (command.tools.nails  ?? 0),
            screw:  (state.tools.screw  ?? 0) + (command.tools.screw  ?? 0),
            wood:   (state.tools.wood   ?? 0) + (command.tools.wood   ?? 0),
            cement: (state.tools.cement ?? 0) + (command.tools.cement ?? 0),
          },
          tokens: {
            green:  (state.tokens.green  ?? 0) + (command.tokens.green  ?? 0),
            blue:   (state.tokens.blue   ?? 0) + (command.tokens.blue   ?? 0),
            yellow: (state.tokens.yellow ?? 0) + (command.tokens.yellow ?? 0),
            purple: (state.tokens.purple ?? 0) + (command.tokens.purple ?? 0),
            red:    (state.tokens.red    ?? 0) + (command.tokens.red    ?? 0),
          },
          dailyTasks: newDailyTasks,
        },
      };
    }
    case 'collect_all':
      return handleCollectAll(state, config, now, bonuses);
    case 'list_all':
      return handleListAll(state, config, now);
    case 'buy_all':
      return handleBuyAll(state, config, now);
    case 'claim_daily_task':
      return handleClaimDailyTask(state, command, playerLevel);
    case 'upgrade_business_category':
      return handleUpgradeBusinessCategory(state, command);
    case 'upgrade_floor':
      return handleUpgradeFloor(state, command, config);
    default:
      const exhaustive: never = command;
      return { success: false, state, error: `Unknown command type: ${(exhaustive as any).type}` };
  }
}

const COINS_PER_GEM = 1000;

function handleExchangeGems(
  state: GameState,
  command: Extract<Command, { type: 'exchange_gems' }>,
): ProcessResult {
  if (state.gems < command.gems) return { success: false, state, error: 'Insufficient gems' };
  return {
    success: true,
    state: {
      ...state,
      gems: state.gems - command.gems,
      balance: state.balance + command.gems * COINS_PER_GEM,
    },
  };
}

const MS_PER_HOUR = 3_600_000;

function handleSpeedUpConstruction(
  state: GameState,
  command: Extract<Command, { type: 'speed_up_construction' }>,
): ProcessResult {
  const uc = state.underConstruction.find((u) => u.floorId === command.floorId);
  if (!uc) return { success: false, state, error: 'Floor not under construction' };

  const timeLeft = uc.startedAt + uc.durationMs - command.timestamp;
  if (timeLeft <= 0) return { success: false, state, error: 'Construction already complete' };

  const cost = Math.max(1, Math.ceil(timeLeft / MS_PER_HOUR));
  if (state.gems < cost) return { success: false, state, error: 'Insufficient gems' };

  const updatedUc = { ...uc, startedAt: command.timestamp - uc.durationMs };
  return {
    success: true,
    state: {
      ...state,
      gems: state.gems - cost,
      underConstruction: state.underConstruction.map((u) =>
        u.floorId === command.floorId ? updatedUc : u,
      ),
    },
  };
}

function handleSpeedUpDelivery(
  state: GameState,
  command: Extract<Command, { type: 'speed_up_delivery' }>,
  config: GameConfig,
  now: number,
): ProcessResult {
  const floorIdx = state.floors.findIndex((f) => f.id === command.floorId);
  if (floorIdx === -1) return { success: false, state, error: 'Floor not found' };

  const production = state.floors[floorIdx].productions[command.slotIdx];
  if (!production) return { success: false, state, error: 'Slot not found' };
  if (production.stage !== 'DELIVERING') return { success: false, state, error: 'Not delivering' };
  if (!production.typeId) return { success: false, state, error: 'No type assigned' };

  const typeConfig = config.productionTypes[production.typeId];
  if (!typeConfig) return { success: false, state, error: 'Unknown production type' };

  const timeLeft = typeConfig.deliveryDuration - (now - production.stageStartedAt);
  if (timeLeft <= 0) return { success: false, state, error: 'Delivery already complete' };

  const cost = Math.max(1, Math.ceil(timeLeft / MS_PER_HOUR));
  if (state.gems < cost) return { success: false, state, error: 'Insufficient gems' };

  return {
    success: true,
    state: {
      ...state,
      gems: state.gems - cost,
      floors: updateProduction(state.floors, floorIdx, command.slotIdx, {
        ...production,
        stageStartedAt: now - typeConfig.deliveryDuration,
      }),
    },
  };
}

function handleBuyFloor(
  state: GameState,
  command: Extract<Command, { type: 'buy_floor' }>,
  config: GameConfig,
): ProcessResult {
  const unlockConfig = config.floorUnlocks?.find((f) => f.floorId === command.floorId);
  if (!unlockConfig) return { success: false, state, error: 'Floor not available for purchase' };
  if (state.underConstruction.some((uc) => uc.floorId === command.floorId)) return { success: false, state, error: 'Floor already under construction' };
  if (state.floors.some((f) => f.id === command.floorId)) return { success: false, state, error: 'Floor already exists' };

  const newUc = {
    floorId: command.floorId,
    startedAt: command.timestamp,
    durationMs: unlockConfig.constructionDurationMs,
    requiredTools: command.requiredTools.map(({ tool }) => ({ tool, count: unlockConfig.requiredToolCount })),
    selectedFloorType: null,
  };

  if (unlockConfig.currency === 'gems') {
    if (state.gems < unlockConfig.price) return { success: false, state, error: 'Insufficient gems' };
    return {
      success: true,
      state: { ...state, gems: state.gems - unlockConfig.price, underConstruction: [...state.underConstruction, newUc] },
    };
  }
  if (state.balance < unlockConfig.price) return { success: false, state, error: 'Insufficient balance' };
  return {
    success: true,
    state: { ...state, balance: state.balance - unlockConfig.price, underConstruction: [...state.underConstruction, newUc] },
  };
}

function handleOpenFloor(
  state: GameState,
  command: Extract<Command, { type: 'open_floor' }>,
  config: GameConfig,
): ProcessResult {
  const uc = state.underConstruction.find((u) => u.floorId === command.floorId);
  if (!uc) return { success: false, state, error: 'Floor not under construction' };
  if (command.timestamp - uc.startedAt < uc.durationMs) return { success: false, state, error: 'Construction not complete' };

  const currentTools = state.tools ?? { briks: 0, glass: 0, nails: 0, screw: 0, wood: 0, cement: 0 };
  const hasAllTools = uc.requiredTools.every(({ tool, count }) => (currentTools[tool] ?? 0) >= count);
  if (!hasAllTools) return { success: false, state, error: 'Insufficient tools' };

  const floorTypeConfig = config.floorTypes[command.floorType];
  if (!floorTypeConfig) return { success: false, state, error: 'Unknown floor type' };

  // Tier = position of this floor among ALL floors of the same type sorted by floorId
  // (static built + dynamic opened + pending with type selected + current floor).
  // Lower floorIds always get lower tiers regardless of open order.
  const allOfTypeSorted = [
    ...config.floors
      .filter((f) => f.floorType === command.floorType && state.floors.some((sf) => sf.id === f.id))
      .map((f) => f.id),
    ...Object.entries(state.openedFloorTypes ?? {})
      .filter(([, t]) => t === command.floorType)
      .map(([id]) => Number(id)),
    ...state.underConstruction
      .filter((u) => u.selectedFloorType === command.floorType && u.floorId !== command.floorId)
      .map((u) => u.floorId),
    command.floorId,
  ].sort((a, b) => a - b);
  const tier = allOfTypeSorted.indexOf(command.floorId);
  const business = floorTypeConfig.businesses[tier];
  if (!business) return { success: false, state, error: 'All businesses of this type already built' };

  const newFloor = {
    id: command.floorId,
    productions: business.dreamJobs.map((typeId) => ({
      typeId,
      stage: 'IDLE' as const,
      stageStartedAt: 0,
    })),
  };

  const updatedTools = { ...currentTools };
  for (const { tool, count } of uc.requiredTools) {
    updatedTools[tool] = updatedTools[tool] - count;
  }

  return {
    success: true,
    state: {
      ...state,
      tools: updatedTools,
      floors: [...state.floors, newFloor],
      lobbyCapacity: Math.min(50, state.lobbyCapacity + 1),
      openedFloorTypes: {
        ...(state.openedFloorTypes ?? {}),
        [String(command.floorId)]: command.floorType,
      },
      underConstruction: state.underConstruction.filter((u) => u.floorId !== command.floorId),
      dailyTasks: {
        ...state.dailyTasks,
        progress: { ...state.dailyTasks.progress, floorsBuilt: state.dailyTasks.progress.floorsBuilt + 1 },
      },
    },
  };
}

function handleAssignWorker(
  state: GameState,
  command: Extract<Command, { type: 'assign_worker' }>,
): ProcessResult {
  const worker = state.workers.find((w) => w.id === command.workerId);
  if (!worker) return { success: false, state, error: 'Worker not found' };
  if (worker.assignedFloorId !== null) return { success: false, state, error: 'Worker already assigned' };

  const floorIdx = state.floors.findIndex((f) => f.id === command.floorId);
  if (floorIdx === -1) return { success: false, state, error: 'Floor not found' };
  if (!state.floors[floorIdx].productions[command.slotIdx]) return { success: false, state, error: 'Slot not found' };

  const existing = getWorkerForSlot(state.workers, command.floorId, command.slotIdx);
  if (existing) return { success: false, state, error: 'Slot already has a worker' };

  return {
    success: true,
    state: {
      ...state,
      workers: state.workers.map((w) =>
        w.id === command.workerId
          ? { ...w, assignedFloorId: command.floorId, assignedSlotIdx: command.slotIdx }
          : w,
      ),
    },
  };
}

function handleFireWorker(
  state: GameState,
  command: Extract<Command, { type: 'fire_worker' }>,
  config: GameConfig,
  now: number,
): ProcessResult {
  const worker = state.workers.find((w) => w.id === command.workerId);
  if (!worker) return { success: false, state, error: 'Worker not found' };
  if (worker.assignedFloorId === null) return { success: false, state, error: 'Worker is not assigned' };

  const floorIdx = state.floors.findIndex((f) => f.id === worker.assignedFloorId);
  if (floorIdx === -1) return { success: false, state, error: 'Floor not found' };

  const production = state.floors[floorIdx].productions[worker.assignedSlotIdx!];
  if (production && (production.stage === 'DELIVERING' || production.stage === 'SELLING')) {
    const typeConfig = production.typeId ? config.productionTypes[production.typeId] : null;
    if (typeConfig) {
      const floorId = state.floors[floorIdx].id;
      const starMult = getFloorStarMultiplier(state, floorId);
      const duration = production.stage === 'DELIVERING'
        ? typeConfig.deliveryDuration
        : typeConfig.sellDuration * starMult.time;
      if (duration - (now - production.stageStartedAt) > 0) {
        return { success: false, state, error: 'Cannot fire during active production' };
      }
    }
  }

  return {
    success: true,
    state: {
      ...state,
      workers: state.workers.map((w) =>
        w.id === command.workerId
          ? { ...w, assignedFloorId: null, assignedSlotIdx: null }
          : w,
      ),
    },
  };
}

function handleEvictWorker(
  state: GameState,
  command: Extract<Command, { type: 'evict_worker' }>,
): ProcessResult {
  const worker = state.workers.find((w) => w.id === command.workerId);
  if (!worker) return { success: false, state, error: 'Worker not found' };
  if (worker.assignedFloorId !== null) return { success: false, state, error: 'Cannot evict assigned worker' };

  return {
    success: true,
    state: {
      ...state,
      workers: state.workers.filter((w) => w.id !== command.workerId),
      dailyTasks: {
        ...state.dailyTasks,
        progress: { ...state.dailyTasks.progress, residentsEvicted: state.dailyTasks.progress.residentsEvicted + 1 },
      },
    },
  };
}

function handleClaimDailyTask(
  state: GameState,
  command: Extract<Command, { type: 'claim_daily_task' }>,
  playerLevel: number,
): ProcessResult {
  const taskConfig = DAILY_TASKS.find((t) => t.key === command.taskKey);
  if (!taskConfig) return { success: false, state, error: 'Unknown task' };
  if (state.dailyTasks.claimed.includes(command.taskKey)) {
    return { success: false, state, error: 'Already claimed' };
  }

  const progress = getTaskProgress(state, taskConfig);
  if (progress < taskConfig.threshold) {
    return { success: false, state, error: 'Task not complete' };
  }

  const multiplier = getCoinMultiplier(playerLevel);
  const doubleMultiplier = state.dailyTasks.doubleRewardActive ? 2 : 1;
  const coins = taskConfig.rewards.baseCoins * multiplier * doubleMultiplier;

  let tools = state.tools;
  if (taskConfig.rewards.hasMaterials && command.materialType) {
    const matCount = getMaterialCount(playerLevel) * doubleMultiplier;
    tools = { ...tools, [command.materialType]: (tools[command.materialType] ?? 0) + matCount };
  }

  const tokens = {
    ...state.tokens,
    [command.tokenColor]: state.tokens[command.tokenColor] + command.tokenCount,
  };

  return {
    success: true,
    state: {
      ...state,
      balance: state.balance + coins,
      gems: state.gems + taskConfig.rewards.gems,
      tools,
      tokens,
      dailyTasks: {
        ...state.dailyTasks,
        claimed: [...state.dailyTasks.claimed, command.taskKey],
      },
    },
  };
}

function processProductionCommand(
  state: GameState,
  command: Extract<Command, { type: 'buy' | 'list' | 'collect' }>,
  config: GameConfig,
  now: number,
  bonuses: { coinPercent: number; xpPercent: number } = { coinPercent: 0, xpPercent: 0 },
): ProcessResult {
  const floorIdx = state.floors.findIndex((f) => f.id === command.floorId);
  if (floorIdx === -1) return { success: false, state, error: 'Floor not found' };

  const floor = state.floors[floorIdx];
  const production = floor.productions[command.slotIdx];
  if (!production) return { success: false, state, error: 'Slot not found' };

  const worker = getWorkerForSlot(state.workers, command.floorId, command.slotIdx);
  if (!worker) return { success: false, state, error: 'No worker assigned to slot' };

  switch (command.type) {
    case 'buy':
      return handleBuy(state, command, config, now, floorIdx, command.slotIdx, production, worker);
    case 'list':
      return handleList(state, config, now, floorIdx, command.slotIdx, production);
    case 'collect':
      return handleCollect(state, config, now, floorIdx, command.slotIdx, production, worker, bonuses);
  }
}

function resolveFloorType(state: GameState, config: GameConfig, floorId: number): string {
  const staticConfig = config.floors.find((f) => f.id === floorId);
  if (staticConfig) return staticConfig.floorType;
  return state.openedFloorTypes?.[String(floorId)] ?? '';
}

function resolveAvailableTypes(state: GameState, config: GameConfig, floorId: number): string[] {
  const staticConfig = config.floors.find((f) => f.id === floorId);
  if (staticConfig) return staticConfig.availableTypes;
  const floor = state.floors.find((f) => f.id === floorId);
  return floor?.productions.map((p) => p.typeId).filter((id): id is string => id !== null) ?? [];
}

function getFloorStarMultiplier(state: GameState, floorId: number) {
  const stars = state.floorStars?.[String(floorId)] ?? 0;
  return FLOOR_STAR_MULTIPLIERS[stars] ?? FLOOR_STAR_MULTIPLIERS[0];
}

function handleBuy(
  state: GameState,
  command: Extract<Command, { type: 'buy' }>,
  config: GameConfig,
  now: number,
  floorIdx: number,
  slotIdx: number,
  production: GameState['floors'][0]['productions'][0],
  worker: Worker,
): ProcessResult {
  if (production.stage !== 'IDLE') {
    return { success: false, state, error: 'Production not idle' };
  }

  // Block buy if another slot on this floor has an active delivery
  const hasActiveDelivery = state.floors[floorIdx].productions.some((p, i) => {
    if (i === slotIdx) return false;
    if (p.stage !== 'DELIVERING' || !p.typeId) return false;
    const tc = config.productionTypes[p.typeId];
    return tc ? (now - p.stageStartedAt) < tc.deliveryDuration : false;
  });
  if (hasActiveDelivery) {
    return { success: false, state, error: 'Another delivery in progress on this floor' };
  }

  if (production.typeId !== null && production.typeId !== command.typeId) {
    return { success: false, state, error: 'Cannot change production type' };
  }

  const typeConfig = config.productionTypes[command.typeId];
  if (!typeConfig) return { success: false, state, error: 'Unknown production type' };

  const availableTypes = resolveAvailableTypes(state, config, state.floors[floorIdx].id);
  if (!availableTypes.includes(command.typeId)) {
    return { success: false, state, error: 'Type not available on this floor' };
  }

  const discount = getFloorDiscount(state.workers, command.floorId);
  const starMult = getFloorStarMultiplier(state, command.floorId);
  const effectiveCost = Math.floor(typeConfig.buyCost * starMult.cost * (1 - discount));

  if (state.balance < effectiveCost) {
    return { success: false, state, error: 'Insufficient balance' };
  }

  return {
    success: true,
    state: {
      ...state,
      balance: state.balance - effectiveCost,
      floors: updateProduction(state.floors, floorIdx, slotIdx, {
        typeId: command.typeId,
        stage: 'DELIVERING',
        stageStartedAt: now,
      }),
      stats: { ...state.stats, totalBought: state.stats.totalBought + 1 },
      dailyTasks: {
        ...state.dailyTasks,
        progress: { ...state.dailyTasks.progress, goodsBought: state.dailyTasks.progress.goodsBought + 1 },
      },
    },
  };
}

function handleList(
  state: GameState,
  config: GameConfig,
  now: number,
  floorIdx: number,
  slotIdx: number,
  production: GameState['floors'][0]['productions'][0],
): ProcessResult {
  if (production.stage !== 'DELIVERING') {
    return { success: false, state, error: 'Production not delivering' };
  }

  if (!production.typeId) return { success: false, state, error: 'No type assigned' };

  const typeConfig = config.productionTypes[production.typeId];
  if (!typeConfig) return { success: false, state, error: 'Unknown production type' };

  if (now - production.stageStartedAt < typeConfig.deliveryDuration) {
    return { success: false, state, error: 'Delivery not complete' };
  }

  return {
    success: true,
    state: {
      ...state,
      floors: updateProduction(state.floors, floorIdx, slotIdx, {
        ...production,
        stage: 'SELLING',
        stageStartedAt: now,
      }),
      stats: { ...state.stats, totalListed: state.stats.totalListed + 1 },
      dailyTasks: {
        ...state.dailyTasks,
        progress: { ...state.dailyTasks.progress, goodsListed: state.dailyTasks.progress.goodsListed + 1 },
      },
    },
  };
}

function handleCollect(
  state: GameState,
  config: GameConfig,
  now: number,
  floorIdx: number,
  slotIdx: number,
  production: GameState['floors'][0]['productions'][0],
  worker: Worker,
  bonuses: { coinPercent: number; xpPercent: number } = { coinPercent: 0, xpPercent: 0 },
): ProcessResult {
  if (production.stage !== 'SELLING') {
    return { success: false, state, error: 'Production not selling' };
  }

  if (!production.typeId) return { success: false, state, error: 'No type assigned' };

  const typeConfig = config.productionTypes[production.typeId];
  if (!typeConfig) return { success: false, state, error: 'Unknown production type' };

  const floorId = state.floors[floorIdx].id;
  const starMult = getFloorStarMultiplier(state, floorId);
  const effectiveSellDuration = typeConfig.sellDuration * starMult.time;
  if (now - production.stageStartedAt < effectiveSellDuration) {
    return { success: false, state, error: 'Sale not complete' };
  }

  const floorType = resolveFloorType(state, config, floorId);
  const workerMultiplier = getRevenueMultiplier(worker, floorType, production.typeId);
  const specialistBonusPercent = Math.round(getFloorSpecialistBonus(state.workers, floorId) * 100);
  const categoryBonus = (state.businessUpgrades?.[floorType as keyof typeof state.businessUpgrades] ?? 0) * 5;

  const coinMultiplier = 1 + (bonuses.coinPercent + specialistBonusPercent + categoryBonus) / 100;
  const revenue = Math.floor(typeConfig.batchValue * starMult.value * coinMultiplier * workerMultiplier);

  const xpMultiplier = 1 + bonuses.xpPercent / 100;
  const xpGained = Math.floor(typeConfig.batchValue * starMult.value * xpMultiplier * workerMultiplier);

  return {
    success: true,
    xpGained,
    state: {
      ...state,
      balance: state.balance + revenue,
      floors: updateProduction(state.floors, floorIdx, slotIdx, {
        typeId: production.typeId,
        stage: 'IDLE',
        stageStartedAt: 0,
      }),
      stats: { ...state.stats, totalCollected: state.stats.totalCollected + 1 },
      dailyTasks: {
        ...state.dailyTasks,
        progress: { ...state.dailyTasks.progress, goodsCollected: state.dailyTasks.progress.goodsCollected + 1 },
      },
    },
  };
}

function handleCollectAll(
  state: GameState,
  config: GameConfig,
  now: number,
  bonuses: { coinPercent: number; xpPercent: number },
): ProcessResult {
  if (state.gems < 1) return { success: false, state, error: 'Insufficient gems' };
  let current: GameState = { ...state, gems: state.gems - 1 };
  let totalXp = 0;
  for (let fi = 0; fi < current.floors.length; fi++) {
    for (let si = 0; si < current.floors[fi].productions.length; si++) {
      const prod = current.floors[fi].productions[si];
      const worker = getWorkerForSlot(current.workers, current.floors[fi].id, si);
      if (!worker) continue;
      const result = handleCollect(current, config, now, fi, si, prod, worker, bonuses);
      if (result.success) {
        totalXp += result.xpGained ?? 0;
        current = result.state;
      }
    }
  }
  return { success: true, state: current, xpGained: totalXp };
}

function handleListAll(
  state: GameState,
  config: GameConfig,
  now: number,
): ProcessResult {
  if (state.gems < 1) return { success: false, state, error: 'Insufficient gems' };
  let current: GameState = { ...state, gems: state.gems - 1 };
  for (let fi = 0; fi < current.floors.length; fi++) {
    for (let si = 0; si < current.floors[fi].productions.length; si++) {
      const prod = current.floors[fi].productions[si];
      const result = handleList(current, config, now, fi, si, prod);
      if (result.success) {
        current = result.state;
      }
    }
  }
  return { success: true, state: current };
}

function handleBuyAll(
  state: GameState,
  config: GameConfig,
  now: number,
): ProcessResult {
  if (state.gems < 1) return { success: false, state, error: 'Insufficient gems' };
  let current: GameState = { ...state, gems: state.gems - 1 };
  for (let fi = 0; fi < current.floors.length; fi++) {
    for (let si = 0; si < current.floors[fi].productions.length; si++) {
      const floor = current.floors[fi];
      const prod = floor.productions[si];
      if (prod.stage !== 'IDLE' || !prod.typeId) continue;
      const worker = getWorkerForSlot(current.workers, floor.id, si);
      if (!worker) continue;
      const fakeCmd: Extract<Command, { type: 'buy' }> = {
        id: '', type: 'buy', floorId: floor.id, slotIdx: si, typeId: prod.typeId, timestamp: now,
      };
      const result = handleBuy(current, fakeCmd, config, now, fi, si, prod, worker);
      if (result.success) {
        current = result.state;
      }
    }
  }
  return { success: true, state: current };
}

function handleUpgradeToSpecialist(
  state: GameState,
  command: Extract<Command, { type: 'upgrade_to_specialist' }>,
  config: GameConfig,
): ProcessResult {
  const worker = state.workers.find((w) => w.id === command.workerId);
  if (!worker) return { success: false, state, error: 'Worker not found' };
  if (worker.assignedFloorId === null) return { success: false, state, error: 'Worker not assigned' };
  if (worker.level !== 9) return { success: false, state, error: 'Worker must be level 9' };
  if (worker.isSpecialist) return { success: false, state, error: 'Already a specialist' };
  if (state.gems < SPECIALIST_UPGRADE_COST) return { success: false, state, error: 'Insufficient gems' };

  const floorConfig = config.floors.find((f) => f.id === worker.assignedFloorId);
  const floorType = floorConfig?.floorType ?? state.openedFloorTypes?.[String(worker.assignedFloorId)] ?? '';
  const floor = state.floors.find((f) => f.id === worker.assignedFloorId);
  const production = floor?.productions[worker.assignedSlotIdx!];
  const mood = getWorkerMood(worker, floorType, production?.typeId ?? null);
  if (mood !== 'good') return { success: false, state, error: 'Worker not at dream job' };

  return {
    success: true,
    state: {
      ...state,
      gems: state.gems - SPECIALIST_UPGRADE_COST,
      workers: state.workers.map((w) =>
        w.id === command.workerId ? { ...w, isSpecialist: true } : w,
      ),
    },
  };
}

function handleFireAndEvictWorker(
  state: GameState,
  command: Extract<Command, { type: 'fire_and_evict_worker' }>,
  config: GameConfig,
  now: number,
): ProcessResult {
  const worker = state.workers.find((w) => w.id === command.workerId);
  if (!worker) return { success: false, state, error: 'Worker not found' };
  if (worker.assignedFloorId === null) return { success: false, state, error: 'Worker not assigned' };
  if (worker.assignedSlotIdx === null) return { success: false, state, error: 'Worker slot not assigned' };

  const floorIdx = state.floors.findIndex((f) => f.id === worker.assignedFloorId);
  if (floorIdx === -1) return { success: false, state, error: 'Floor not found' };

  const production = state.floors[floorIdx].productions[worker.assignedSlotIdx!];
  if (production && (production.stage === 'DELIVERING' || production.stage === 'SELLING')) {
    const typeConfig = production.typeId ? config.productionTypes[production.typeId] : null;
    if (typeConfig) {
      const floorId = state.floors[floorIdx].id;
      const starMult = getFloorStarMultiplier(state, floorId);
      const duration = production.stage === 'DELIVERING'
        ? typeConfig.deliveryDuration
        : typeConfig.sellDuration * starMult.time;
      if (duration - (now - production.stageStartedAt) > 0) {
        return { success: false, state, error: 'Cannot fire during active production' };
      }
    }
  }

  return {
    success: true,
    state: {
      ...state,
      workers: state.workers.filter((w) => w.id !== command.workerId),
    },
  };
}

function handleUpgradeBusinessCategory(
  state: GameState,
  command: Extract<Command, { type: 'upgrade_business_category' }>,
): ProcessResult {
  const { floorType } = command;
  const currentLevel = state.businessUpgrades?.[floorType] ?? 0;
  if (currentLevel >= 40) {
    return { success: false, state, error: 'Max level reached' };
  }
  const cost = BUSINESS_UPGRADE_COSTS[currentLevel];
  const upgradedBusinessUpgrades = {
    ...(state.businessUpgrades ?? { green: 0, blue: 0, yellow: 0, purple: 0, red: 0 }),
    [floorType]: currentLevel + 1,
  };
  if (cost.kind === 'gems') {
    if (state.gems < cost.gems) {
      return { success: false, state, error: 'Insufficient gems' };
    }
    return {
      success: true,
      xpGained: 0,
      state: { ...state, gems: state.gems - cost.gems, businessUpgrades: upgradedBusinessUpgrades },
    };
  }
  if (state.balance < cost.coins) {
    return { success: false, state, error: 'Insufficient balance' };
  }
  const tokenBalance = state.tokens?.[floorType] ?? 0;
  if (tokenBalance < cost.tokens) {
    return { success: false, state, error: 'Insufficient tokens' };
  }
  return {
    success: true,
    xpGained: 0,
    state: {
      ...state,
      balance: state.balance - cost.coins,
      tokens: { ...state.tokens, [floorType]: tokenBalance - cost.tokens },
      businessUpgrades: upgradedBusinessUpgrades,
    },
  };
}

function handleUpgradeFloor(
  state: GameState,
  command: Extract<Command, { type: 'upgrade_floor' }>,
  config: GameConfig,
): ProcessResult {
  const { floorId } = command;
  const floorExists = state.floors.some((f) => f.id === floorId);
  if (!floorExists) return { success: false, state, error: 'Floor not found' };

  const floorType = resolveFloorType(state, config, floorId);
  if (!floorType) return { success: false, state, error: 'Floor not open' };

  const currentStars = state.floorStars?.[String(floorId)] ?? 0;
  if (currentStars >= 5) return { success: false, state, error: 'Floor already at max stars' };

  const cost = FLOOR_UPGRADE_COSTS[currentStars];

  if (state.gems < cost.gems) return { success: false, state, error: 'Insufficient gems' };

  const tokenKey = floorType as keyof typeof state.tokens;
  const tokenBalance = state.tokens?.[tokenKey] ?? 0;
  if (tokenBalance < cost.tokens) return { success: false, state, error: 'Insufficient tokens' };

  return {
    success: true,
    state: {
      ...state,
      gems: state.gems - cost.gems,
      tokens: { ...state.tokens, [tokenKey]: tokenBalance - cost.tokens },
      floorStars: { ...state.floorStars, [String(floorId)]: currentStars + 1 },
    },
  };
}

function updateProduction(
  floors: GameState['floors'],
  floorIdx: number,
  slotIdx: number,
  newProduction: GameState['floors'][0]['productions'][0],
): GameState['floors'] {
  return floors.map((floor, fi) => {
    if (fi !== floorIdx) return floor;
    return {
      ...floor,
      productions: floor.productions.map((prod, si) => {
        if (si !== slotIdx) return prod;
        return newProduction;
      }),
    };
  });
}
