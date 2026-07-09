import { processCommand, type ProcessResult } from '../processCommand';
import { createInitialState } from '../../config/gameConfig';
import type { GameState, GameConfig, Command, Visitor } from '../../types';

const testConfig: GameConfig = {
  floorTypes: {
    green: { shirtColor: '#62B23F', accent: '#4E9A2E', businesses: [{ name: 'Coffee Shop', dreamJobs: ['coffee'] }] },
  },
  floors: [
    { id: 2, slots: 3, floorType: 'green', availableTypes: ['coffee'] },
    { id: 3, slots: 3, floorType: 'green', availableTypes: ['coffee'] },
  ],
  productionTypes: {
    coffee: { buyCost: 10, deliveryDuration: 5000, sellDuration: 10000, batchValue: 25 },
  },
  startingBalance: 1000,
  hotelCapacity: 10,
  lobbyConfig: {
    visitorSpawnInterval: 120_000,
    dailyTipsTarget: 10_000,
    dailyTipsReward: 5,
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
  achievements: [],
};

function makeVisitor(overrides?: Partial<Visitor>): Visitor {
  return { id: 'v1', role: 'guest', targetFloor: 3, hairColor: '#5C3A22', female: false, ...overrides };
}

function makeState(overrides?: Partial<GameState>): GameState {
  return { ...createInitialState(testConfig), ...overrides };
}

describe('spawn_visitor', () => {
  it('adds visitor to lobby with role assigned at spawn', () => {
    const state = makeState();
    const cmd: Command = {
      id: 'c1', type: 'spawn_visitor', timestamp: 1000,
      visitorId: 'v1', role: 'guest', targetFloor: 3, hairColor: '#5C3A22', female: false,
    };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.lobbyVisitors).toHaveLength(1);
    expect(result.state.lobbyVisitors[0].id).toBe('v1');
    expect(result.state.lobbyVisitors[0].role).toBe('guest');
    expect(result.state.nextVisitorAt).toBe(1000 + 120_000);
  });

  it('fails when lobby is full', () => {
    const visitors = Array.from({ length: 10 }, (_, i) => makeVisitor({ id: `v${i}` }));
    const state = makeState({ lobbyVisitors: visitors, lobbyCapacity: 10 });
    const cmd: Command = {
      id: 'c1', type: 'spawn_visitor', timestamp: 1000,
      visitorId: 'v99', role: 'guest', targetFloor: 2, hairColor: '#5C3A22', female: false,
    };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(false);
  });
});

describe('lift_visitor', () => {
  it('moves elevator up and assigns role from command', () => {
    const state = makeState({ lobbyVisitors: [makeVisitor({ role: undefined, targetFloor: undefined })], elevatorLevel: 1 });
    const cmd: Command = { id: 'c1', type: 'lift_visitor', timestamp: 1000, role: 'guest', targetFloor: 3 };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.elevatorFloor).toBe(1);
    expect(result.state.lobbyVisitors[0].role).toBe('guest');
    expect(result.state.lobbyVisitors[0].targetFloor).toBe(3);
  });

  it('clamps elevator to target floor', () => {
    const state = makeState({ lobbyVisitors: [makeVisitor({ role: undefined, targetFloor: undefined })], elevatorLevel: 3, elevatorFloor: 1 });
    const cmd: Command = { id: 'c1', type: 'lift_visitor', timestamp: 1000, role: 'guest', targetFloor: 2 };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.elevatorFloor).toBe(2);
  });

  it('fails when no visitors', () => {
    const state = makeState();
    const cmd: Command = { id: 'c1', type: 'lift_visitor', timestamp: 1000, role: 'guest', targetFloor: 2 };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(false);
  });
});

describe('collect_tip', () => {
  it('guest pays tip and is removed from queue', () => {
    const state = makeState({
      lobbyVisitors: [makeVisitor({ role: 'guest', targetFloor: 3 })],
      elevatorFloor: 3,
      elevatorLevel: 1,
    });
    const result = processCommand(state, { id: 'c1', type: 'collect_tip', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.balance).toBe(1000 + 30);
    expect(result.state.dailyTips).toBe(30);
    expect(result.state.lobbyVisitors).toHaveLength(0);
    expect(result.state.elevatorFloor).toBe(0);
  });

  it('guest to floor 1 creates a new worker', () => {
    const state = makeState({
      workers: [],
      lobbyVisitors: [makeVisitor({ role: 'guest', targetFloor: 1 })],
      elevatorFloor: 1,
      elevatorLevel: 1,
    });
    const result = processCommand(state, { id: 'c1', type: 'collect_tip', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.workers).toHaveLength(1);
    expect(result.state.balance).toBe(1000 + 10);
  });

  it('guest to floor 1 does NOT create worker when hotel is full', () => {
    const fullWorkers = Array.from({ length: 10 }, (_, i) => ({
      id: `w${i}`, name: `Worker ${i}`, female: false, floorType: 'green',
      dreamJob: 'coffee', level: 1, hairColor: '#000', assignedFloorId: null, assignedSlotIdx: null,
    }));
    const state = makeState({
      lobbyVisitors: [makeVisitor({ role: 'guest', targetFloor: 1 })],
      elevatorFloor: 1,
      elevatorLevel: 1,
      workers: fullWorkers,
    });
    const result = processCommand(state, { id: 'c1', type: 'collect_tip', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.workers).toHaveLength(10);
  });

  it('businessman gives 1 gem within daily limit', () => {
    const state = makeState({
      lobbyVisitors: [makeVisitor({ role: 'businessman', targetFloor: 2 })],
      elevatorFloor: 2,
      elevatorLevel: 1,
      gems: 20,
      dailyGemsCollected: 0,
    });
    const result = processCommand(state, { id: 'c1', type: 'collect_tip', timestamp: 1000 } as Command, testConfig, 1000, 1);
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(21);
    expect(result.state.dailyGemsCollected).toBe(1);
    expect(result.state.balance).toBe(1000);
  });

  it('businessman gives fallback coins when gem limit reached', () => {
    const state = makeState({
      lobbyVisitors: [makeVisitor({ role: 'businessman', targetFloor: 2 })],
      elevatorFloor: 2,
      elevatorLevel: 1,
      gems: 20,
      dailyGemsCollected: 16,
    });
    const result = processCommand(state, { id: 'c1', type: 'collect_tip', timestamp: 1000 } as Command, testConfig, 1000, 1);
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(20);
    expect(result.state.balance).toBe(1000 + 200);
  });

  it('deliverer reduces delivery time by 5%', () => {
    const state = makeState({
      lobbyVisitors: [makeVisitor({ role: 'deliverer', targetFloor: 2 })],
      elevatorFloor: 2,
      elevatorLevel: 1,
    });
    state.floors[0].productions[0].stage = 'DELIVERING';
    state.floors[0].productions[0].stageStartedAt = 500;
    const result = processCommand(state, { id: 'c1', type: 'collect_tip', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.floors[0].productions[0].stageStartedAt).toBe(500 - 250);
    expect(result.state.balance).toBe(1000 + 20);
  });

  it('seller reduces sell time by 5%', () => {
    const state = makeState({
      lobbyVisitors: [makeVisitor({ role: 'seller', targetFloor: 2 })],
      elevatorFloor: 2,
      elevatorLevel: 1,
    });
    state.floors[0].productions[0].stage = 'SELLING';
    state.floors[0].productions[0].stageStartedAt = 500;
    const result = processCommand(state, { id: 'c1', type: 'collect_tip', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.floors[0].productions[0].stageStartedAt).toBe(500 - 500);
    expect(result.state.balance).toBe(1000 + 20);
  });

  it('fails when elevator not at target', () => {
    const state = makeState({
      lobbyVisitors: [makeVisitor({ targetFloor: 3 })],
      elevatorFloor: 1,
    });
    const result = processCommand(state, { id: 'c1', type: 'collect_tip', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(false);
  });
});

describe('deliver_all', () => {
  it('delivers all visitors for 1 gem', () => {
    const visitors = [
      makeVisitor({ id: 'v1', role: 'guest', targetFloor: 2 }),
      makeVisitor({ id: 'v2', role: 'guest', targetFloor: 3 }),
    ];
    const state = makeState({ lobbyVisitors: visitors, gems: 5, elevatorLevel: 1 });
    const result = processCommand(state, { id: 'c1', type: 'deliver_all', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(true);
    // Roles are freshly generated from current state (random), so exact tips are non-deterministic.
    expect(result.state.lobbyVisitors).toHaveLength(0);
    expect(result.state.elevatorFloor).toBe(0);
    expect(result.state.balance).toBeGreaterThan(1000);
  });

  it('fails with 0 gems', () => {
    const state = makeState({ lobbyVisitors: [makeVisitor()], gems: 0 });
    const result = processCommand(state, { id: 'c1', type: 'deliver_all', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(false);
  });

  it('fails with empty lobby', () => {
    const state = makeState({ gems: 5 });
    const result = processCommand(state, { id: 'c1', type: 'deliver_all', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(false);
  });
});

describe('upgrade_elevator', () => {
  it('increments elevator level and deducts gems equal to target level', () => {
    // testConfig has 2 floors → max = 2; starting at level 1, cost = 1+1 = 2
    const state = makeState({ gems: 10, elevatorLevel: 1 });
    const result = processCommand(state, { id: 'c1', type: 'upgrade_elevator', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.elevatorLevel).toBe(2);
    expect(result.state.gems).toBe(8);
  });

  it('fails at max level (equals floors count)', () => {
    // testConfig has 2 floors → max = 2
    const state = makeState({ gems: 100, elevatorLevel: 2 });
    const result = processCommand(state, { id: 'c1', type: 'upgrade_elevator', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(false);
  });

  it('fails with insufficient gems', () => {
    const state = makeState({ gems: 1, elevatorLevel: 1 });
    const result = processCommand(state, { id: 'c1', type: 'upgrade_elevator', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(false);
  });
});

describe('upgrade_lobby', () => {
  it('adds 1 seat and deducts 5 gems', () => {
    const state = makeState({ gems: 10, lobbyCapacity: 10 });
    const result = processCommand(state, { id: 'c1', type: 'upgrade_lobby', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.lobbyCapacity).toBe(11);
    expect(result.state.gems).toBe(5);
  });

  it('fails at max capacity (50)', () => {
    const state = makeState({ gems: 100, lobbyCapacity: 50 });
    const result = processCommand(state, { id: 'c1', type: 'upgrade_lobby', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(false);
  });
});

describe('claim_daily_reward', () => {
  it('grants gems when target met and not claimed', () => {
    const state = makeState({ dailyTips: 10_000, dailyTipsRewardClaimed: false, gems: 20 });
    const result = processCommand(state, { id: 'c1', type: 'claim_daily_reward', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(25);
    expect(result.state.dailyTipsRewardClaimed).toBe(true);
  });

  it('fails when already claimed', () => {
    const state = makeState({ dailyTips: 10_000, dailyTipsRewardClaimed: true, gems: 20 });
    const result = processCommand(state, { id: 'c1', type: 'claim_daily_reward', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(false);
  });

  it('fails when target not met', () => {
    const state = makeState({ dailyTips: 5_000, dailyTipsRewardClaimed: false });
    const result = processCommand(state, { id: 'c1', type: 'claim_daily_reward', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(false);
  });
});

describe('fill_lobby', () => {
  it('fills lobby to capacity and deducts 1 gem on first use', () => {
    const state = makeState({ gems: 5, lobbyCapacity: 3, lobbyVisitors: [] });
    const cmd: Command = {
      id: 'c1', type: 'fill_lobby', timestamp: 1000,
      visitors: [
        { visitorId: 'v1', role: 'guest', targetFloor: 2, hairColor: '#aaa', female: false },
        { visitorId: 'v2', role: 'businessman', targetFloor: 2, hairColor: '#bbb', female: true },
        { visitorId: 'v3', role: 'guest', targetFloor: 3, hairColor: '#ccc', female: false },
      ],
    };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(4);
    expect(result.state.lobbyVisitors).toHaveLength(3);
    expect(result.state.lobbyVisitors[0].id).toBe('v1');
    expect(result.state.dailyFillLobbyUses).toBe(1);
    expect(result.state.nextVisitorAt).toBe(0);
  });

  it('deducts 2 gems when dailyFillLobbyUses is 5', () => {
    const state = makeState({ gems: 5, lobbyCapacity: 2, lobbyVisitors: [], dailyFillLobbyUses: 5 });
    const cmd: Command = {
      id: 'c1', type: 'fill_lobby', timestamp: 1000,
      visitors: [
        { visitorId: 'v1', role: 'guest', targetFloor: 2, hairColor: '#aaa', female: false },
        { visitorId: 'v2', role: 'guest', targetFloor: 2, hairColor: '#bbb', female: true },
      ],
    };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(3);
  });

  it('fails when not enough gems', () => {
    const state = makeState({ gems: 0, lobbyCapacity: 2, lobbyVisitors: [] });
    const cmd: Command = {
      id: 'c1', type: 'fill_lobby', timestamp: 1000,
      visitors: [
        { visitorId: 'v1', role: 'guest', targetFloor: 2, hairColor: '#aaa', female: false },
      ],
    };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(false);
    expect(result.state.gems).toBe(0);
  });

  it('fails when lobby already has visitors', () => {
    const state = makeState({ gems: 5, lobbyVisitors: [makeVisitor()], lobbyCapacity: 3 });
    const cmd: Command = {
      id: 'c1', type: 'fill_lobby', timestamp: 1000,
      visitors: [
        { visitorId: 'v2', role: 'guest', targetFloor: 2, hairColor: '#aaa', female: false },
      ],
    };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(false);
  });

  it('only adds visitors up to capacity (ignores excess in command)', () => {
    const state = makeState({ gems: 5, lobbyCapacity: 2, lobbyVisitors: [] });
    const cmd: Command = {
      id: 'c1', type: 'fill_lobby', timestamp: 1000,
      visitors: [
        { visitorId: 'v1', role: 'guest', targetFloor: 2, hairColor: '#aaa', female: false },
        { visitorId: 'v2', role: 'guest', targetFloor: 2, hairColor: '#bbb', female: true },
        { visitorId: 'v3', role: 'guest', targetFloor: 2, hairColor: '#ccc', female: false },
      ],
    };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.lobbyVisitors).toHaveLength(2);
  });
});
