import type { GameState, Command, GameConfig, Worker } from '../types';
import { getWorkerForSlot, getFloorDiscount, getRevenueMultiplier } from './workerUtils';
import { processLobbyCommand } from './lobbyCommands';

export interface ProcessResult {
  success: boolean;
  state: GameState;
  error?: string;
}

export function processCommand(
  state: GameState,
  command: Command,
  config: GameConfig,
  now: number,
  playerLevel: number = 1,
): ProcessResult {
  switch (command.type) {
    case 'assign_worker':
      return handleAssignWorker(state, command);
    case 'fire_worker':
      return handleFireWorker(state, command);
    case 'evict_worker':
      return handleEvictWorker(state, command);
    case 'buy':
    case 'list':
    case 'collect':
      return processProductionCommand(state, command, config, now);
    case 'buy_floor':
      return handleBuyFloor(state, command, config);
    case 'open_floor':
      return handleOpenFloor(state, command, config);
    case 'exchange_gems':
      return handleExchangeGems(state, command);
    case 'spawn_visitor':
    case 'lift_visitor':
    case 'collect_tip':
    case 'deliver_all':
    case 'upgrade_elevator':
    case 'upgrade_lobby':
    case 'claim_daily_reward':
    case 'expand_hotel':
    case 'fill_lobby':
      return processLobbyCommand(state, command, config, playerLevel);
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

  const currentTools = state.tools ?? { briks: 0, glass: 0, nails: 0, screw: 0 };
  const hasAllTools = uc.requiredTools.every(({ tool, count }) => (currentTools[tool] ?? 0) >= count);
  if (!hasAllTools) return { success: false, state, error: 'Insufficient tools' };

  const floorTypeConfig = config.floorTypes[command.floorType];
  if (!floorTypeConfig) return { success: false, state, error: 'Unknown floor type' };

  const staticBuiltOfType = config.floors.filter(
    (f) => f.floorType === command.floorType && state.floors.some((sf) => sf.id === f.id),
  ).length;
  const dynamicBuiltOfType = Object.values(state.openedFloorTypes ?? {})
    .filter((t) => t === command.floorType).length;
  const tier = staticBuiltOfType + dynamicBuiltOfType;
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
      openedFloorTypes: {
        ...(state.openedFloorTypes ?? {}),
        [String(command.floorId)]: command.floorType,
      },
      underConstruction: state.underConstruction.filter((u) => u.floorId !== command.floorId),
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
): ProcessResult {
  const worker = state.workers.find((w) => w.id === command.workerId);
  if (!worker) return { success: false, state, error: 'Worker not found' };
  if (worker.assignedFloorId === null) return { success: false, state, error: 'Worker is not assigned' };

  const floorIdx = state.floors.findIndex((f) => f.id === worker.assignedFloorId);
  if (floorIdx === -1) return { success: false, state, error: 'Floor not found' };

  const production = state.floors[floorIdx].productions[worker.assignedSlotIdx!];
  if (production && (production.stage === 'DELIVERING' || production.stage === 'SELLING')) {
    return { success: false, state, error: 'Cannot fire during active production' };
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
    },
  };
}

function processProductionCommand(
  state: GameState,
  command: Extract<Command, { type: 'buy' | 'list' | 'collect' }>,
  config: GameConfig,
  now: number,
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
      return handleCollect(state, config, now, floorIdx, command.slotIdx, production, worker);
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
  const effectiveCost = Math.floor(typeConfig.buyCost * (1 - discount));

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
): ProcessResult {
  if (production.stage !== 'SELLING') {
    return { success: false, state, error: 'Production not selling' };
  }

  if (!production.typeId) return { success: false, state, error: 'No type assigned' };

  const typeConfig = config.productionTypes[production.typeId];
  if (!typeConfig) return { success: false, state, error: 'Unknown production type' };

  if (now - production.stageStartedAt < typeConfig.sellDuration) {
    return { success: false, state, error: 'Sale not complete' };
  }

  const floorId = state.floors[floorIdx].id;
  const floorType = resolveFloorType(state, config, floorId);
  const multiplier = getRevenueMultiplier(worker, floorType, production.typeId);
  const revenue = Math.floor(typeConfig.batchValue * multiplier);

  return {
    success: true,
    state: {
      ...state,
      balance: state.balance + revenue,
      floors: updateProduction(state.floors, floorIdx, slotIdx, {
        typeId: production.typeId,
        stage: 'IDLE',
        stageStartedAt: 0,
      }),
      stats: { ...state.stats, totalSold: state.stats.totalSold + 1 },
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
