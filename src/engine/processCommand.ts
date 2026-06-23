import type { GameState, Command, GameConfig } from '../types';

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
  const floorIdx = state.floors.findIndex(f => f.id === command.floorId);
  if (floorIdx === -1) {
    return { success: false, state, error: 'Floor not found' };
  }

  const floor = state.floors[floorIdx];
  const production = floor.productions[command.slotIdx];
  if (!production) {
    return { success: false, state, error: 'Slot not found' };
  }

  switch (command.type) {
    case 'buy':
      return handleBuy(state, command, config, now, floorIdx, command.slotIdx, production);
    case 'list':
      return handleList(state, config, now, floorIdx, command.slotIdx, production);
    case 'collect':
      return handleCollect(state, config, now, floorIdx, command.slotIdx, production);
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
): ProcessResult {
  if (production.stage !== 'IDLE') {
    return { success: false, state, error: 'Production not idle' };
  }

  if (production.typeId !== null && production.typeId !== command.typeId) {
    return { success: false, state, error: 'Cannot change production type' };
  }

  const typeConfig = config.productionTypes[command.typeId];
  if (!typeConfig) {
    return { success: false, state, error: 'Unknown production type' };
  }

  const floorConfig = config.floors.find(f => f.id === state.floors[floorIdx].id);
  if (!floorConfig || !floorConfig.availableTypes.includes(command.typeId)) {
    return { success: false, state, error: 'Type not available on this floor' };
  }

  if (state.balance < typeConfig.buyCost) {
    return { success: false, state, error: 'Insufficient balance' };
  }

  return {
    success: true,
    state: {
      ...state,
      balance: state.balance - typeConfig.buyCost,
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

  if (!production.typeId) {
    return { success: false, state, error: 'No type assigned' };
  }

  const typeConfig = config.productionTypes[production.typeId];
  if (!typeConfig) {
    return { success: false, state, error: 'Unknown production type' };
  }

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
): ProcessResult {
  if (production.stage !== 'SELLING') {
    return { success: false, state, error: 'Production not selling' };
  }

  if (!production.typeId) {
    return { success: false, state, error: 'No type assigned' };
  }

  const typeConfig = config.productionTypes[production.typeId];
  if (!typeConfig) {
    return { success: false, state, error: 'Unknown production type' };
  }

  if (now - production.stageStartedAt < typeConfig.sellDuration) {
    return { success: false, state, error: 'Sale not complete' };
  }

  return {
    success: true,
    state: {
      ...state,
      balance: state.balance + typeConfig.batchValue,
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
