import type { GameState, Command, GameConfig, Worker } from '../types';
import { getWorkerForSlot, getFloorDiscount, getRevenueMultiplier } from './workerUtils';

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
    case 'spawn_visitor':
    case 'lift_visitor':
    case 'collect_tip':
    case 'deliver_all':
    case 'upgrade_elevator':
    case 'upgrade_lobby':
    case 'claim_daily_reward':
      // Lobby feature commands - not yet implemented
      return { success: true, state };
  }
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

  const floorConfig = config.floors.find((f) => f.id === state.floors[floorIdx].id);
  if (!floorConfig || !floorConfig.availableTypes.includes(command.typeId)) {
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

  const floorConfig = config.floors.find((f) => f.id === state.floors[floorIdx].id);
  const floorType = floorConfig?.floorType ?? '';
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
