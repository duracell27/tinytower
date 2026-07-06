import type { GameState, GameConfig, Visitor, VisitorRole } from '../types';
import { HAIR_COLORS } from '../config/workerNames';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function calculateTip(
  role: VisitorRole,
  targetFloor: number,
  elevatorLevel: number,
  config: GameConfig,
): number {
  if (role === 'businessman') {
    return config.lobbyConfig.businessmanFallbackBase * elevatorLevel * targetFloor;
  }
  return config.lobbyConfig.guestTipBase * elevatorLevel * targetFloor;
}

export function calculateElevatorUpgradeCost(currentLevel: number, config: GameConfig): number {
  return config.lobbyConfig.elevatorUpgradeBaseCost + (currentLevel - 1) * 2;
}

export function calculateLobbyUpgradeCost(currentCapacity: number, config: GameConfig): number {
  const tiers = (currentCapacity - config.lobbyConfig.defaultLobbyCapacity) / config.lobbyConfig.lobbyUpgradeSeats;
  return config.lobbyConfig.lobbyUpgradeBaseCost + tiers * 2;
}

export function getMaxElevatorLevel(config: GameConfig): number {
  return config.floors.length + 1;
}

export function getMaxLobbyCapacity(playerLevel: number, config: GameConfig): number {
  return config.lobbyConfig.defaultLobbyCapacity + playerLevel * config.lobbyConfig.lobbyUpgradeSeats;
}

function getMidnightBefore(timestamp: number): number {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function checkDailyReset(state: GameState, commandTimestamp: number): GameState {
  if (state.lastDailyReset === 0) {
    return { ...state, lastDailyReset: getMidnightBefore(commandTimestamp) };
  }

  const nextMidnight = state.lastDailyReset + 24 * 60 * 60 * 1000;
  if (commandTimestamp >= nextMidnight) {
    return {
      ...state,
      dailyTips: 0,
      dailyGemsCollected: 0,
      dailyTipsRewardClaimed: false,
      lastDailyReset: getMidnightBefore(commandTimestamp),
    };
  }

  return state;
}

export function generateRandomVisitorRole(
  state: GameState,
  config: GameConfig,
  now: number,
): { role: VisitorRole; targetFloor: number } {
  const totalFloors = config.floors.length + 1;

  // Check if stage is still actively running (not yet expired by wall clock)
  const isActiveDelivering = (p: { stage: string; typeId: string | null; stageStartedAt: number }) =>
    p.stage === 'DELIVERING' &&
    p.typeId != null &&
    now - p.stageStartedAt < (config.productionTypes[p.typeId]?.deliveryDuration ?? 0);

  const isActiveSelling = (p: { stage: string; typeId: string | null; stageStartedAt: number }) =>
    p.stage === 'SELLING' &&
    p.typeId != null &&
    now - p.stageStartedAt < (config.productionTypes[p.typeId]?.sellDuration ?? 0);

  const hasDelivering = state.floors.some((f) => f.productions.some(isActiveDelivering));
  const hasSelling = state.floors.some((f) => f.productions.some(isActiveSelling));

  // higher builder chance when a floor is actively under construction
  const builderChance = state.underConstruction.length > 0 ? 0.10 : 0.02;
  if (Math.random() < builderChance) {
    const targetFloor = 1 + Math.floor(Math.random() * totalFloors);
    return { role: 'builder', targetFloor };
  }

  let role: VisitorRole;
  const businessmanRoll = Math.random();

  if (businessmanRoll < 0.03) {
    role = 'businessman';
  } else {
    if (hasDelivering && hasSelling) {
      const r = Math.random();
      if (r < 0.50) role = 'guest';
      else if (r < 0.75) role = 'deliverer';
      else role = 'seller';
    } else if (hasDelivering) {
      role = Math.random() < 0.75 ? 'guest' : 'deliverer';
    } else if (hasSelling) {
      role = Math.random() < 0.75 ? 'guest' : 'seller';
    } else {
      role = 'guest';
    }
  }

  let targetFloor: number;
  if (role === 'businessman') {
    targetFloor = 2 + Math.floor(Math.random() * (totalFloors - 1));
  } else if (role === 'deliverer') {
    const deliveringFloors = config.floors.filter((fc) => {
      const floor = state.floors.find((f) => f.id === fc.id);
      return floor?.productions.some(isActiveDelivering);
    });
    const picked = deliveringFloors[Math.floor(Math.random() * deliveringFloors.length)];
    targetFloor = picked.id;
  } else if (role === 'seller') {
    const sellingFloors = config.floors.filter((fc) => {
      const floor = state.floors.find((f) => f.id === fc.id);
      return floor?.productions.some(isActiveSelling);
    });
    const picked = sellingFloors[Math.floor(Math.random() * sellingFloors.length)];
    targetFloor = picked.id;
  } else {
    targetFloor = 1 + Math.floor(Math.random() * totalFloors);
  }

  return { role, targetFloor };
}

export function generateVisitorAppearance(): { id: string; hairColor: string; female: boolean } {
  return {
    id: uuid(),
    hairColor: HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)],
    female: Math.random() < 0.5,
  };
}

/** @deprecated use generateRandomVisitorRole + generateVisitorAppearance separately */
export function generateRandomVisitor(state: GameState, config: GameConfig, now = Date.now()): Visitor {
  const { role, targetFloor } = generateRandomVisitorRole(state, config, now);
  return {
    ...generateVisitorAppearance(),
    role,
    targetFloor,
  };
}
