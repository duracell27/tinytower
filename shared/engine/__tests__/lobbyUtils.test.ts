import {
  calculateTip,
  calculateElevatorUpgradeCost,
  calculateLobbyUpgradeCost,
  getMaxElevatorLevel,
  getMaxLobbyCapacity,
  checkDailyReset,
  generateRandomVisitor,
  getFillLobbyCost,
} from '../lobbyUtils';
import { createInitialState } from '../../config/gameConfig';
import type { GameConfig, GameState } from '../../types';

const testConfig: GameConfig = {
  floorTypes: {
    green: { shirtColor: '#62B23F', accent: '#4E9A2E', businesses: [{ name: 'Coffee Shop', dreamJobs: ['coffee'] }] },
  },
  floors: [
    { id: 2, slots: 3, floorType: 'green', availableTypes: ['coffee'] },
    { id: 3, slots: 3, floorType: 'green', availableTypes: ['coffee'] },
    { id: 4, slots: 3, floorType: 'green', availableTypes: ['coffee'] },
  ],
  productionTypes: {
    coffee: { buyCost: 10, deliveryDuration: 5000, sellDuration: 10000, batchValue: 25 },
  },
  startingBalance: 1000,
  hotelCapacity: 10,
  lobbyConfig: {
    visitorSpawnInterval: 120_000,
    dailyTipsBaseTarget: 10_000,
    dailyTipsStage1Reward: 2,
    dailyTipsStage2Reward: 3,
    dailyGemLimitBase: 15,
    guestTipBase: 10,
    businessmanFallbackBase: 100,
    deliverySpeedBonus: 0.05,
    sellSpeedBonus: 0.05,
    elevatorUpgradeBaseCost: 3,
    lobbyUpgradeBaseCost: 5,
    lobbyUpgradeSeats: 3,
    defaultLobbyCapacity: 10,
  },
  floorUnlocks: [],
};

function makeState(overrides?: Partial<GameState>): GameState {
  return { ...createInitialState(testConfig), ...overrides };
}

describe('calculateTip', () => {
  it('guest tip = base * level * floor', () => {
    expect(calculateTip('guest', 4, 1, testConfig)).toBe(40);
    expect(calculateTip('guest', 4, 3, testConfig)).toBe(120);
    expect(calculateTip('guest', 1, 1, testConfig)).toBe(10);
  });

  it('deliverer tip same as guest', () => {
    expect(calculateTip('deliverer', 3, 2, testConfig)).toBe(60);
  });

  it('seller tip same as guest', () => {
    expect(calculateTip('seller', 3, 2, testConfig)).toBe(60);
  });

  it('businessman fallback tip = fallbackBase * level * floor', () => {
    expect(calculateTip('businessman', 4, 1, testConfig)).toBe(400);
    expect(calculateTip('businessman', 2, 3, testConfig)).toBe(600);
  });
});

describe('calculateElevatorUpgradeCost', () => {
  it('cost equals target level (upgrading from 1 costs 2)', () => {
    expect(calculateElevatorUpgradeCost(1)).toBe(2);
  });
  it('upgrading from level 4 costs 5', () => {
    expect(calculateElevatorUpgradeCost(4)).toBe(5);
  });
  it('upgrading from level 9 costs 10', () => {
    expect(calculateElevatorUpgradeCost(9)).toBe(10);
  });
});

describe('calculateLobbyUpgradeCost', () => {
  it('always costs 5 gems regardless of capacity', () => {
    expect(calculateLobbyUpgradeCost()).toBe(5);
  });
});

describe('getMaxElevatorLevel', () => {
  it('equals the number of open floors', () => {
    expect(getMaxElevatorLevel(3)).toBe(3);
    expect(getMaxElevatorLevel(5)).toBe(5);
  });
});

describe('getMaxLobbyCapacity', () => {
  it('always returns 50', () => {
    expect(getMaxLobbyCapacity()).toBe(50);
  });
});

describe('checkDailyReset', () => {
  it('resets counters when timestamp crosses midnight', () => {
    const midnight = new Date('2026-06-25T00:00:00').getTime();
    const state = makeState({
      dailyTips: 5000,
      dailyGemsCollected: 10,
      dailyTipsRewardClaimed: true,
      lastDailyReset: midnight,
    });
    const nextDay = midnight + 25 * 60 * 60 * 1000;
    const result = checkDailyReset(state, nextDay);
    expect(result.dailyTips).toBe(0);
    expect(result.dailyGemsCollected).toBe(0);
    expect(result.dailyTipsRewardClaimed).toBe(false);
    expect(result.lastDailyReset).toBeGreaterThan(midnight);
  });

  it('does not reset when same day', () => {
    const midnight = new Date('2026-06-25T00:00:00').getTime();
    const state = makeState({
      dailyTips: 5000,
      dailyGemsCollected: 10,
      lastDailyReset: midnight,
    });
    const sameDay = midnight + 10 * 60 * 60 * 1000;
    const result = checkDailyReset(state, sameDay);
    expect(result.dailyTips).toBe(5000);
    expect(result.dailyGemsCollected).toBe(10);
  });

  it('initializes lastDailyReset on first command when 0', () => {
    const state = makeState({ lastDailyReset: 0 });
    const now = new Date('2026-06-25T14:30:00').getTime();
    const result = checkDailyReset(state, now);
    expect(result.lastDailyReset).toBeGreaterThan(0);
  });
});

describe('generateRandomVisitor', () => {
  const NOW = 100_000;

  it('generates a visitor with valid fields', () => {
    const state = makeState();
    const visitor = generateRandomVisitor(state, testConfig, NOW);
    expect(visitor.id).toBeDefined();
    expect(['guest', 'businessman', 'deliverer', 'seller']).toContain(visitor.role);
    expect(visitor.targetFloor).toBeGreaterThanOrEqual(1);
    expect(visitor.targetFloor).toBeLessThanOrEqual(4);
    expect(visitor.hairColor).toBeDefined();
    expect(typeof visitor.female).toBe('boolean');
  });

  it('only produces guest or businessman when no deliveries/sales active', () => {
    const state = makeState();
    const roles = new Set<string>();
    for (let i = 0; i < 200; i++) {
      roles.add(generateRandomVisitor(state, testConfig, NOW).role ?? '');
    }
    expect(roles.has('deliverer')).toBe(false);
    expect(roles.has('seller')).toBe(false);
  });

  it('can produce deliverer when a slot is DELIVERING with time remaining', () => {
    const state = makeState();
    // deliveryDuration = 5000ms; started 1000ms ago → 4000ms remaining
    state.floors[0].productions[0].stage = 'DELIVERING';
    state.floors[0].productions[0].typeId = 'coffee';
    state.floors[0].productions[0].stageStartedAt = NOW - 1000;
    const roles = new Set<string>();
    for (let i = 0; i < 500; i++) {
      roles.add(generateRandomVisitor(state, testConfig, NOW).role ?? '');
    }
    expect(roles.has('deliverer')).toBe(true);
    expect(roles.has('seller')).toBe(false);
  });

  it('does NOT produce deliverer when delivery time has expired', () => {
    const state = makeState();
    // deliveryDuration = 5000ms; started 10000ms ago → expired
    state.floors[0].productions[0].stage = 'DELIVERING';
    state.floors[0].productions[0].typeId = 'coffee';
    state.floors[0].productions[0].stageStartedAt = NOW - 10_000;
    const roles = new Set<string>();
    for (let i = 0; i < 200; i++) {
      roles.add(generateRandomVisitor(state, testConfig, NOW).role ?? '');
    }
    expect(roles.has('deliverer')).toBe(false);
  });

  it('businessman never targets floor 1', () => {
    const state = makeState();
    for (let i = 0; i < 500; i++) {
      const v = generateRandomVisitor(state, testConfig, NOW);
      if (v.role === 'businessman') {
        expect(v.targetFloor).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe('getFillLobbyCost', () => {
  it('returns 1 for uses 0–4', () => {
    expect(getFillLobbyCost(0)).toBe(1);
    expect(getFillLobbyCost(4)).toBe(1);
  });
  it('returns 2 for uses 5–9', () => {
    expect(getFillLobbyCost(5)).toBe(2);
    expect(getFillLobbyCost(9)).toBe(2);
  });
  it('returns 3 for uses 10–14', () => {
    expect(getFillLobbyCost(10)).toBe(3);
    expect(getFillLobbyCost(14)).toBe(3);
  });
  it('returns 5 for uses 15+', () => {
    expect(getFillLobbyCost(15)).toBe(5);
    expect(getFillLobbyCost(100)).toBe(5);
  });
});

describe('checkDailyReset resets dailyFillLobbyUses', () => {
  it('resets dailyFillLobbyUses to 0 on new day', () => {
    const midnight = new Date('2026-01-01T00:00:00').getTime();
    const state = makeState({ dailyFillLobbyUses: 7, lastDailyReset: midnight });
    const nextDay = midnight + 25 * 60 * 60 * 1000;
    const result = checkDailyReset(state, nextDay);
    expect(result.dailyFillLobbyUses).toBe(0);
  });

  it('does not reset dailyFillLobbyUses within same day', () => {
    const midnight = new Date('2026-01-01T00:00:00').getTime();
    const state = makeState({ dailyFillLobbyUses: 7, lastDailyReset: midnight });
    const sameDay = midnight + 10 * 60 * 60 * 1000;
    const result = checkDailyReset(state, sameDay);
    expect(result.dailyFillLobbyUses).toBe(7);
  });
});
