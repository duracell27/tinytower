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
  getDailyTipsTargets,
} from './lobbyUtils';
import { generateRandomWorkers } from '../config/workerNames';
import { FLOOR_STAR_MULTIPLIERS } from '../config/floorUpgradeConfig';
import type { VisitorRole } from '../types';

type LobbyCommand = Extract<Command, { type:
  'spawn_visitor' | 'lift_visitor' | 'collect_tip' |
  'deliver_all' | 'upgrade_elevator' | 'upgrade_lobby' | 'claim_daily_reward' | 'expand_hotel' | 'fill_lobby' |
  'evict_low_level_workers'
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
      return handleClaimDailyReward(state, config, command);
    case 'expand_hotel':
      return handleExpandHotel(state);
    case 'fill_lobby':
      return handleFillLobby(state, command, config);
    case 'evict_low_level_workers':
      return handleEvictLowLevelWorkers(state, command.timestamp);
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
    isVip: command.isVip,
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
  // Apply role/appearance from command on the first lift (when not yet assigned).
  // Subsequent lifts pass the same stored values so the visitor never changes mid-trip.
  const active: Visitor = {
    ...base,
    role: base.role ?? command.role,
    targetFloor: base.targetFloor ?? command.targetFloor,
    isVip: base.isVip ?? command.isVip,
    hairColor: base.hairColor ?? command.hairColor,
    female: base.female ?? command.female,
    pendingFloorType: base.pendingFloorType ?? command.pendingFloorType,
  };
  const updatedVisitors = [active, ...state.lobbyVisitors.slice(1)];
  // targetFloor is guaranteed non-null: base.targetFloor ?? command.targetFloor, and LiftVisitorCommandSchema requires targetFloor
  const move = Math.min(state.elevatorLevel, active.targetFloor! - state.elevatorFloor);
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
  now: number,
  preGeneratedWorkerBatch?: { id: string; name: string; female: boolean; floorType: string; dreamJob: string; level: number; hairColor: string }[],
  preGeneratedTools?: string[],
): GameState {
  const role = visitor.role ?? 'guest';
  const isVip = visitor.isVip ?? false;
  const targetFloor = visitor.targetFloor ?? 1;
  const tip = calculateTip(role, targetFloor, state.elevatorLevel, config);
  const vipMultiplier = isVip ? 10 : 1;
  const isToday = now >= state.lastDailyReset;
  let { balance, gems, dailyTips, dailyGemsCollected, workers, floors } = state;
  let tools = state.tools ?? { briks: 0, glass: 0, nails: 0, screw: 0, wood: 0, cement: 0 };
  let underConstruction = state.underConstruction;
  const workersBefore = workers.length;

  if (role === 'businessman') {
    const gemLimit = config.lobbyConfig.dailyGemLimitBase + playerLevel;
    if (dailyGemsCollected < gemLimit) {
      gems += 1;
      dailyGemsCollected += 1; // accumulates for limit correctness; callers restore if not today
    } else {
      balance += tip * vipMultiplier;
      if (isToday) dailyTips += tip * vipMultiplier;
    }
  } else if (role === 'builder') {
    if (isVip) {
      const ucEntry = underConstruction.find((uc) => uc.floorId === targetFloor);
      if (ucEntry) {
        // Complete construction: set startedAt so timer is expired
        underConstruction = underConstruction.map((uc) =>
          uc.floorId === targetFloor ? { ...uc, startedAt: now - uc.durationMs } : uc,
        );
      } else {
        // Give 2 tools
        for (const key of preGeneratedTools ?? []) {
          if (key in tools) {
            tools = { ...tools, [key]: tools[key as keyof typeof tools] + 1 };
          }
        }
      }
    } else {
      const key = preGeneratedTools?.[0];
      if (key && key in tools) {
        tools = { ...tools, [key]: tools[key as keyof typeof tools] + 1 };
      }
    }
  } else {
    balance += tip * vipMultiplier;
    if (isToday) dailyTips += tip * vipMultiplier;
  }

  if (role === 'guest' && targetFloor === 1) {
    const hotelOccupied = workers.filter((w) => w.assignedFloorId === null).length;
    if (isVip) {
      // Fill hotel to capacity
      for (const workerData of preGeneratedWorkerBatch ?? []) {
        if (workers.filter((w) => w.assignedFloorId === null).length < state.hotelCapacity) {
          workers = [...workers, { ...workerData, assignedFloorId: null, assignedSlotIdx: null, isSpecialist: false }];
        }
      }
    } else if (hotelOccupied < state.hotelCapacity) {
      const workerData = preGeneratedWorkerBatch?.[0] ?? generateRandomWorkers(1, config)[0];
      const newWorker: Worker = { ...workerData, assignedFloorId: null, assignedSlotIdx: null, isSpecialist: false };
      workers = [...workers, newWorker];
    }
    // Hotel full → worker leaves, no effect beyond the tip
  }

  const residentsGained = workers.length - workersBefore;

  if (role === 'deliverer') {
    const floorIdx = floors.findIndex((f) => f.id === targetFloor);
    if (floorIdx !== -1) {
      const slotIdx = floors[floorIdx].productions.findIndex((p) => p.stage === 'DELIVERING');
      if (slotIdx !== -1) {
        const typeId = floors[floorIdx].productions[slotIdx].typeId;
        const typeConfig = typeId ? config.productionTypes[typeId] : null;
        if (typeConfig) {
          floors = floors.map((f, fi) => {
            if (fi !== floorIdx) return f;
            return {
              ...f,
              productions: f.productions.map((p, si) => {
                if (si !== slotIdx) return p;
                const updated = isVip
                  ? now - typeConfig.deliveryDuration
                  : p.stageStartedAt - Math.floor(typeConfig.deliveryDuration * config.lobbyConfig.deliverySpeedBonus);
                return { ...p, stageStartedAt: updated };
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
      const floorStarCount = state.floorStars?.[String(targetFloor)] ?? 0;
      const sellerStarMult = FLOOR_STAR_MULTIPLIERS[floorStarCount] ?? FLOOR_STAR_MULTIPLIERS[0];

      let targetSlotIdx: number;
      if (isVip) {
        // Find SELLING slot with longest remaining time (star-scaled)
        let longestRemaining = -1;
        targetSlotIdx = -1;
        floors[floorIdx].productions.forEach((p, si) => {
          if (p.stage !== 'SELLING') return;
          const typeId = p.typeId;
          const typeConfig = typeId ? config.productionTypes[typeId] : null;
          if (!typeConfig) return;
          const remaining = typeConfig.sellDuration * sellerStarMult.time - (now - p.stageStartedAt);
          if (remaining > longestRemaining) {
            longestRemaining = remaining;
            targetSlotIdx = si;
          }
        });
      } else {
        targetSlotIdx = floors[floorIdx].productions.findIndex((p) => p.stage === 'SELLING');
      }

      if (targetSlotIdx !== -1) {
        const typeId = floors[floorIdx].productions[targetSlotIdx].typeId;
        const typeConfig = typeId ? config.productionTypes[typeId] : null;
        if (typeConfig) {
          const effectiveSellDuration = typeConfig.sellDuration * sellerStarMult.time;
          floors = floors.map((f, fi) => {
            if (fi !== floorIdx) return f;
            return {
              ...f,
              productions: f.productions.map((p, si) => {
                if (si !== targetSlotIdx) return p;
                const updated = isVip
                  ? now - effectiveSellDuration
                  : p.stageStartedAt - Math.floor(effectiveSellDuration * config.lobbyConfig.sellSpeedBonus);
                return { ...p, stageStartedAt: updated };
              }),
            };
          });
        }
      }
    }
  }

  return {
    ...state,
    balance, gems, dailyTips, dailyGemsCollected, workers, floors, tools,
    underConstruction,
    dailyTasks: residentsGained > 0 && now >= state.lastDailyReset ? {
      ...state.dailyTasks,
      progress: {
        ...state.dailyTasks.progress,
        residentsAdded: state.dailyTasks.progress.residentsAdded + residentsGained,
      },
    } : state.dailyTasks,
  };
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
  const isVip = active.isVip ?? false;
  const workerBatch = command.newWorkers
    ?? (command.newWorker ? [command.newWorker] : undefined);
  const toolBatch = command.builderTools
    ?? (command.builderTool ? [command.builderTool] : undefined);
  let newState = applyVisitorEffect(state, active, config, playerLevel, now, workerBatch, toolBatch);
  // For yesterday's commands don't let the gem counter bleed into today's tracking
  if (now < state.lastDailyReset) {
    newState = { ...newState, dailyGemsCollected: state.dailyGemsCollected };
  }
  // Restart timer if lobby was full (nextVisitorAt=0) or timer expired while full
  const nextVisitorAt = (state.nextVisitorAt === 0 || state.nextVisitorAt <= now)
    ? now + config.lobbyConfig.visitorSpawnInterval
    : state.nextVisitorAt;
  newState = {
    ...newState,
    lobbyVisitors: newState.lobbyVisitors.slice(1),
    elevatorFloor: 0,
    nextVisitorAt,
    stats: { ...newState.stats, totalPassengersLifted: newState.stats.totalPassengersLifted + 1 },
    dailyTasks: now >= state.lastDailyReset ? {
      ...newState.dailyTasks,
      progress: {
        ...newState.dailyTasks.progress,
        visitorsLifted: newState.dailyTasks.progress.visitorsLifted + 1,
        vipsLifted: newState.dailyTasks.progress.vipsLifted + (isVip ? 1 : 0),
      },
    } : newState.dailyTasks,
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
  const passengersDelivered = state.lobbyVisitors.length;
  const resolvedList = command.resolvedVisitors ?? state.lobbyVisitors.map((v) => ({
    role: v.role ?? 'guest' as VisitorRole,
    isVip: v.isVip ?? false,
    targetFloor: v.targetFloor ?? 1,
    pendingFloorType: v.pendingFloorType,
    female: v.female,
  }));
  const vipsDelivered = resolvedList.filter((v) => v.isVip ?? false).length;
  const builderTools = command.builderTools ?? [];
  const preGeneratedWorkers = command.preGeneratedWorkers ?? [];
  const vipGuestWorkerBatches = command.vipGuestWorkerBatches ?? [];
  let builderIdx = 0;
  let workerIdx = 0;
  let vipGuestIdx = 0;
  let newState = { ...state, gems: state.gems - 1 };
  for (let i = 0; i < state.lobbyVisitors.length; i++) {
    const resolved = resolvedList[i] ?? { role: 'guest' as VisitorRole, targetFloor: 1, isVip: false };
    const role = resolved.role;
    const isBuilder = role === 'builder';
    const isVipBuilder = isBuilder && (resolved.isVip ?? false);
    const toolCount = isVipBuilder ? 2 : isBuilder ? 1 : 0;
    const toolBatch = toolCount > 0 ? builderTools.slice(builderIdx, builderIdx + toolCount) : undefined;
    builderIdx += toolCount;

    const isGuestAtFloor1 = role === 'guest' && resolved.targetFloor === 1;
    let preWorkerBatch: typeof preGeneratedWorkers | undefined;
    if (isGuestAtFloor1 && (resolved.isVip ?? false)) {
      preWorkerBatch = vipGuestWorkerBatches[vipGuestIdx++] ?? [];
    } else if (isGuestAtFloor1) {
      const w = preGeneratedWorkers[workerIdx++];
      preWorkerBatch = w ? [w] : undefined;
    }

    const visitorForEffect: Visitor = {
      ...state.lobbyVisitors[i],
      role: resolved.role,
      isVip: resolved.isVip,
      targetFloor: resolved.targetFloor,
      pendingFloorType: resolved.pendingFloorType,
      female: resolved.female ?? state.lobbyVisitors[i].female,
    };
    newState = applyVisitorEffect(newState, visitorForEffect, config, playerLevel, now, preWorkerBatch, toolBatch);
  }
  // For yesterday's commands don't let the gem counter bleed into today's tracking
  if (now < state.lastDailyReset) {
    newState = { ...newState, dailyGemsCollected: state.dailyGemsCollected };
  }
  // Restart timer if lobby was full (nextVisitorAt=0) or timer expired while full
  const nextVisitorAt = (state.nextVisitorAt === 0 || state.nextVisitorAt <= now)
    ? now + config.lobbyConfig.visitorSpawnInterval
    : state.nextVisitorAt;
  newState = {
    ...newState,
    lobbyVisitors: [],
    elevatorFloor: 0,
    nextVisitorAt,
    stats: { ...newState.stats, totalPassengersLifted: newState.stats.totalPassengersLifted + passengersDelivered },
    dailyTasks: now >= state.lastDailyReset ? {
      ...newState.dailyTasks,
      progress: {
        ...newState.dailyTasks.progress,
        visitorsLifted: newState.dailyTasks.progress.visitorsLifted + passengersDelivered,
        vipsLifted: newState.dailyTasks.progress.vipsLifted + vipsDelivered,
      },
    } : newState.dailyTasks,
  };
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

function handleEvictLowLevelWorkers(state: GameState, commandTimestamp: number): ProcessResult {
  if (state.gems < 1) {
    return { success: false, state, error: 'Not enough gems' };
  }
  const evictedCount = state.workers.filter(
    w => w.level !== 9 && w.assignedFloorId === null,
  ).length;
  return {
    success: true,
    state: {
      ...state,
      gems: state.gems - 1,
      workers: state.workers.filter(w => w.level === 9 || w.assignedFloorId !== null),
      dailyTasks: commandTimestamp >= state.lastDailyReset ? {
        ...state.dailyTasks,
        progress: {
          ...state.dailyTasks.progress,
          residentsEvicted: state.dailyTasks.progress.residentsEvicted + evictedCount,
        },
      } : state.dailyTasks,
    },
  };
}

function handleClaimDailyReward(
  state: GameState,
  config: GameConfig,
  command: Extract<Command, { type: 'claim_daily_reward' }>,
): ProcessResult {
  const { stage1, stage2 } = getDailyTipsTargets(state.elevatorLevel, config);

  if (command.stage === 1) {
    if (state.dailyTips < stage1) {
      return { success: false, state, error: 'Daily tips stage 1 target not met' };
    }
    if (state.dailyTipsStage1Claimed) {
      return { success: false, state, error: 'Stage 1 reward already claimed' };
    }
    return {
      success: true,
      state: {
        ...state,
        gems: state.gems + config.lobbyConfig.dailyTipsStage1Reward,
        dailyTipsStage1Claimed: true,
      },
    };
  }

  // stage 2
  if (state.dailyTips < stage2) {
    return { success: false, state, error: 'Daily tips stage 2 target not met' };
  }
  if (state.dailyTipsStage2Claimed) {
    return { success: false, state, error: 'Stage 2 reward already claimed' };
  }
  return {
    success: true,
    state: {
      ...state,
      gems: state.gems + config.lobbyConfig.dailyTipsStage2Reward,
      dailyTipsStage2Claimed: true,
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
    isVip: v.isVip,
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
