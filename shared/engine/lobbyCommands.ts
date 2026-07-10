import type { GameState, GameConfig, Command, Visitor, Worker } from '../types';
import type { ProcessResult } from './processCommand';
import {
  calculateTip,
  calculateElevatorUpgradeCost,
  calculateLobbyUpgradeCost,
  getMaxElevatorLevel,
  getMaxLobbyCapacity,
  checkDailyReset,
  generateRandomVisitorRole,
  getFillLobbyCost,
} from './lobbyUtils';
import { generateRandomWorkers } from '../config/workerNames';
import type { VisitorRole } from '../types';

type LobbyCommand = Extract<Command, { type:
  'spawn_visitor' | 'lift_visitor' | 'collect_tip' |
  'deliver_all' | 'upgrade_elevator' | 'upgrade_lobby' | 'claim_daily_reward' | 'expand_hotel' | 'fill_lobby'
}>;

export function processLobbyCommand(
  state: GameState,
  command: LobbyCommand,
  config: GameConfig,
  playerLevel: number,
): ProcessResult {
  state = checkDailyReset(state, command.timestamp);

  switch (command.type) {
    case 'spawn_visitor':
      return handleSpawnVisitor(state, command, config);
    case 'lift_visitor':
      return handleLiftVisitor(state, command);
    case 'collect_tip':
      return handleCollectTip(state, config, playerLevel, command.timestamp, command);
    case 'deliver_all':
      return handleDeliverAll(state, config, playerLevel, command.timestamp, command);
    case 'upgrade_elevator':
      return handleUpgradeElevator(state, config);
    case 'upgrade_lobby':
      return handleUpgradeLobby(state, config);
    case 'claim_daily_reward':
      return handleClaimDailyReward(state, config);
    case 'expand_hotel':
      return handleExpandHotel(state);
    case 'fill_lobby':
      return handleFillLobby(state, command, config);
  }
}

function handleSpawnVisitor(
  state: GameState,
  command: Extract<Command, { type: 'spawn_visitor' }>,
  config: GameConfig,
): ProcessResult {
  if (state.lobbyVisitors.length >= state.lobbyCapacity) {
    return { success: false, state, error: 'Lobby is full' };
  }
  const visitor: Visitor = {
    id: command.visitorId,
    role: command.role,
    targetFloor: command.targetFloor,
    hairColor: command.hairColor,
    female: command.female,
    pendingFloorType: command.pendingFloorType,
  };
  const newVisitors = [...state.lobbyVisitors, visitor];
  const willBeFull = newVisitors.length >= state.lobbyCapacity;
  return {
    success: true,
    state: {
      ...state,
      lobbyVisitors: newVisitors,
      nextVisitorAt: willBeFull ? 0 : command.timestamp + config.lobbyConfig.visitorSpawnInterval,
    },
  };
}

function handleLiftVisitor(
  state: GameState,
  command: Extract<Command, { type: 'lift_visitor' }>,
): ProcessResult {
  if (state.lobbyVisitors.length === 0) {
    return { success: false, state, error: 'No visitors in lobby' };
  }
  const base = state.lobbyVisitors[0];
  // Apply role/targetFloor from command only on the first lift (when not yet assigned).
  // Subsequent lifts pass the same stored values so the visitor never changes mid-trip.
  const active = {
    ...base,
    role: base.role ?? command.role,
    targetFloor: base.targetFloor ?? command.targetFloor,
  } satisfies Visitor;
  const updatedVisitors = [active, ...state.lobbyVisitors.slice(1)];
  const move = Math.min(state.elevatorLevel, active.targetFloor - state.elevatorFloor);
  if (move <= 0) {
    return { success: false, state, error: 'Already at target floor' };
  }
  return {
    success: true,
    state: { ...state, elevatorFloor: state.elevatorFloor + move, lobbyVisitors: updatedVisitors },
  };
}

function applyVisitorEffect(
  state: GameState,
  visitor: Visitor,
  config: GameConfig,
  playerLevel: number,
  preGeneratedWorker?: { id: string; name: string; female: boolean; floorType: string; dreamJob: string; level: number; hairColor: string },
  preGeneratedTool?: string,
): GameState {
  const role = visitor.role ?? 'guest';
  const targetFloor = visitor.targetFloor ?? 1;
  const tip = calculateTip(role, targetFloor, state.elevatorLevel, config);
  let { balance, gems, dailyTips, dailyGemsCollected, workers, floors } = state;
  let tools = state.tools ?? { briks: 0, glass: 0, nails: 0, screw: 0 };

  if (role === 'businessman') {
    const gemLimit = config.lobbyConfig.dailyGemLimitBase + playerLevel;
    if (dailyGemsCollected < gemLimit) {
      gems += 1;
      dailyGemsCollected += 1;
    } else {
      balance += tip;
      dailyTips += tip;
    }
  } else if (role === 'builder') {
    if (preGeneratedTool && preGeneratedTool in tools) {
      const key = preGeneratedTool as keyof typeof tools;
      tools = { ...tools, [key]: tools[key] + 1 };
    }
  } else {
    balance += tip;
    dailyTips += tip;
  }

  if (role === 'guest' && targetFloor === 1) {
    const hotelOccupied = workers.filter((w) => w.assignedFloorId === null).length;
    if (hotelOccupied < state.hotelCapacity) {
      const workerData = preGeneratedWorker ?? generateRandomWorkers(1, config)[0];
      const newWorker: Worker = { ...workerData, assignedFloorId: null, assignedSlotIdx: null, isSpecialist: false };
      workers = [...workers, newWorker];
    }
    // Hotel full → worker leaves, no effect beyond the tip
  }

  if (role === 'deliverer') {
    const floorIdx = floors.findIndex((f) => f.id === targetFloor);
    if (floorIdx !== -1) {
      const slotIdx = floors[floorIdx].productions.findIndex((p) => p.stage === 'DELIVERING');
      if (slotIdx !== -1) {
        const typeId = floors[floorIdx].productions[slotIdx].typeId;
        const typeConfig = typeId ? config.productionTypes[typeId] : null;
        if (typeConfig) {
          const reduction = Math.floor(typeConfig.deliveryDuration * config.lobbyConfig.deliverySpeedBonus);
          floors = floors.map((f, fi) => {
            if (fi !== floorIdx) return f;
            return {
              ...f,
              productions: f.productions.map((p, si) => {
                if (si !== slotIdx) return p;
                return { ...p, stageStartedAt: p.stageStartedAt - reduction };
              }),
            };
          });
        }
      }
    }
  }

  if (role === 'seller') {
    const floorIdx = floors.findIndex((f) => f.id === targetFloor);
    if (floorIdx !== -1) {
      const slotIdx = floors[floorIdx].productions.findIndex((p) => p.stage === 'SELLING');
      if (slotIdx !== -1) {
        const typeId = floors[floorIdx].productions[slotIdx].typeId;
        const typeConfig = typeId ? config.productionTypes[typeId] : null;
        if (typeConfig) {
          const reduction = Math.floor(typeConfig.sellDuration * config.lobbyConfig.sellSpeedBonus);
          floors = floors.map((f, fi) => {
            if (fi !== floorIdx) return f;
            return {
              ...f,
              productions: f.productions.map((p, si) => {
                if (si !== slotIdx) return p;
                return { ...p, stageStartedAt: p.stageStartedAt - reduction };
              }),
            };
          });
        }
      }
    }
  }

  return { ...state, balance, gems, dailyTips, dailyGemsCollected, workers, floors, tools };
}

function handleCollectTip(
  state: GameState,
  config: GameConfig,
  playerLevel: number,
  now: number,
  command: Extract<Command, { type: 'collect_tip' }>,
): ProcessResult {
  if (state.lobbyVisitors.length === 0) {
    return { success: false, state, error: 'No visitors' };
  }
  const active = state.lobbyVisitors[0];
  if (state.elevatorFloor !== active.targetFloor) {
    return { success: false, state, error: 'Elevator not at target floor' };
  }
  let newState = applyVisitorEffect(state, active, config, playerLevel, command.newWorker, command.builderTool);
  // Restart timer if lobby was full (nextVisitorAt=0) or timer expired while full
  const nextVisitorAt = (state.nextVisitorAt === 0 || state.nextVisitorAt <= now)
    ? now + config.lobbyConfig.visitorSpawnInterval
    : state.nextVisitorAt;
  newState = {
    ...newState,
    lobbyVisitors: newState.lobbyVisitors.slice(1),
    elevatorFloor: 0,
    nextVisitorAt,
  };
  return { success: true, state: newState };
}

function handleDeliverAll(
  state: GameState,
  config: GameConfig,
  playerLevel: number,
  now: number,
  command: Extract<Command, { type: 'deliver_all' }>,
): ProcessResult {
  if (state.gems < 1) {
    return { success: false, state, error: 'Not enough gems' };
  }
  if (state.lobbyVisitors.length === 0) {
    return { success: false, state, error: 'No visitors to deliver' };
  }
  const builderTools = command.builderTools ?? [];
  let builderIdx = 0;
  let newState = { ...state, gems: state.gems - 1 };
  for (const visitor of state.lobbyVisitors) {
    const isBuilder = (visitor.role ?? 'guest') === 'builder';
    const tool = isBuilder ? builderTools[builderIdx++] : undefined;
    newState = applyVisitorEffect(newState, visitor, config, playerLevel, undefined, tool);
  }
  // Restart timer if lobby was full (nextVisitorAt=0) or timer expired while full
  const nextVisitorAt = (state.nextVisitorAt === 0 || state.nextVisitorAt <= now)
    ? now + config.lobbyConfig.visitorSpawnInterval
    : state.nextVisitorAt;
  newState = { ...newState, lobbyVisitors: [], elevatorFloor: 0, nextVisitorAt };
  return { success: true, state: newState };
}

function handleUpgradeElevator(state: GameState, config: GameConfig): ProcessResult {
  const maxLevel = getMaxElevatorLevel(state.floors.length);
  if (state.elevatorLevel >= maxLevel) {
    return { success: false, state, error: 'Elevator at max level' };
  }
  const cost = calculateElevatorUpgradeCost(state.elevatorLevel);
  if (state.gems < cost) {
    return { success: false, state, error: 'Not enough gems' };
  }
  return {
    success: true,
    state: { ...state, gems: state.gems - cost, elevatorLevel: state.elevatorLevel + 1 },
  };
}

function handleUpgradeLobby(state: GameState, config: GameConfig): ProcessResult {
  const maxCapacity = getMaxLobbyCapacity();
  if (state.lobbyCapacity >= maxCapacity) {
    return { success: false, state, error: 'Lobby at max capacity' };
  }
  const cost = calculateLobbyUpgradeCost();
  if (state.gems < cost) {
    return { success: false, state, error: 'Not enough gems' };
  }
  return {
    success: true,
    state: {
      ...state,
      gems: state.gems - cost,
      lobbyCapacity: state.lobbyCapacity + 1,
    },
  };
}

export const MAX_HOTEL_CAPACITY = 50;

export function getHotelExpansionCost(currentCapacity: number): number | null {
  if (currentCapacity >= MAX_HOTEL_CAPACITY) return null;
  if (currentCapacity >= 40) return 50;
  if (currentCapacity >= 30) return 30;
  if (currentCapacity >= 20) return 20;
  return 10;
}

function handleExpandHotel(state: GameState): ProcessResult {
  const cost = getHotelExpansionCost(state.hotelCapacity);
  if (cost === null) {
    return { success: false, state, error: 'Hotel at max capacity' };
  }
  if (state.gems < cost) {
    return { success: false, state, error: 'Not enough gems' };
  }
  return {
    success: true,
    state: {
      ...state,
      gems: state.gems - cost,
      hotelCapacity: state.hotelCapacity + 1,
    },
  };
}

function handleClaimDailyReward(state: GameState, config: GameConfig): ProcessResult {
  if (state.dailyTips < config.lobbyConfig.dailyTipsTarget) {
    return { success: false, state, error: 'Daily tips target not met' };
  }
  if (state.dailyTipsRewardClaimed) {
    return { success: false, state, error: 'Reward already claimed' };
  }
  return {
    success: true,
    state: {
      ...state,
      gems: state.gems + config.lobbyConfig.dailyTipsReward,
      dailyTipsRewardClaimed: true,
    },
  };
}

function handleFillLobby(
  state: GameState,
  command: Extract<Command, { type: 'fill_lobby' }>,
  config: GameConfig,
): ProcessResult {
  if (state.lobbyVisitors.length > 0) {
    return { success: false, state, error: 'Lobby is not empty' };
  }
  const cost = getFillLobbyCost(state.dailyFillLobbyUses);
  if (state.gems < cost) {
    return { success: false, state, error: 'Not enough gems' };
  }
  const slots = state.lobbyCapacity - state.lobbyVisitors.length;
  const newVisitors: Visitor[] = command.visitors.slice(0, slots).map((v) => ({
    id: v.visitorId,
    role: v.role,
    targetFloor: v.targetFloor,
    hairColor: v.hairColor,
    female: v.female,
    pendingFloorType: v.pendingFloorType,
  }));
  return {
    success: true,
    state: {
      ...state,
      gems: state.gems - cost,
      lobbyVisitors: newVisitors,
      dailyFillLobbyUses: state.dailyFillLobbyUses + 1,
      nextVisitorAt: 0,
    },
  };
}
