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

function makeVisitor(overrides?: Partial<Visitor>): Visitor {
  return { id: 'v1', role: 'guest', targetFloor: 3, ...overrides };
}

function makeState(overrides?: Partial<GameState>): GameState {
  return { ...createInitialState(testConfig), ...overrides };
}

describe('spawn_visitor', () => {
  it('adds blank visitor to lobby (no role, no appearance)', () => {
    const state = makeState({ lobbyVisitors: [] });
    const cmd: Command = {
      id: 'c1', type: 'spawn_visitor', timestamp: 1000,
      visitorId: 'v1',
    };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.lobbyVisitors).toHaveLength(1);
    expect(result.state.lobbyVisitors[0].id).toBe('v1');
    expect(result.state.lobbyVisitors[0].role).toBeUndefined();
    expect(result.state.lobbyVisitors[0].hairColor).toBeUndefined();
    expect(result.state.nextVisitorAt).toBe(1000 + 120_000);
  });

  it('fails when lobby is full', () => {
    const visitors = Array.from({ length: 10 }, (_, i) => makeVisitor({ id: `v${i}` }));
    const state = makeState({ lobbyVisitors: visitors, lobbyCapacity: 10 });
    const cmd: Command = { id: 'c1', type: 'spawn_visitor', timestamp: 1000, visitorId: 'v99' };
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
    const state = makeState({ lobbyVisitors: [] });
    const cmd: Command = { id: 'c1', type: 'lift_visitor', timestamp: 1000, role: 'guest', targetFloor: 2 };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(false);
  });

  it('assigns role + appearance from command to lobbyVisitors[0]', () => {
    const state = makeState({ lobbyVisitors: [{ id: 'v1' }], elevatorLevel: 1 });
    const cmd: Command = {
      id: 'c1', type: 'lift_visitor', timestamp: 1000,
      role: 'guest', targetFloor: 3, isVip: true, hairColor: '#5C3A22', female: true,
    };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.lobbyVisitors[0].role).toBe('guest');
    expect(result.state.lobbyVisitors[0].isVip).toBe(true);
    expect(result.state.lobbyVisitors[0].hairColor).toBe('#5C3A22');
    expect(result.state.lobbyVisitors[0].female).toBe(true);
    expect(result.state.elevatorFloor).toBe(1);
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
      dreamJob: 'coffee', level: 1, hairColor: '#000', assignedFloorId: null, assignedSlotIdx: null, isSpecialist: false,
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
    expect(result.state.lobbyVisitors).toHaveLength(0);
    expect(result.state.elevatorFloor).toBe(0);
    // Stored roles are deterministic: guest@floor2 tip=10*1*2=20, guest@floor3 tip=10*1*3=30 → total 1050
    expect(result.state.balance).toBe(1050);
  });

  it('fails with 0 gems', () => {
    const state = makeState({ lobbyVisitors: [makeVisitor()], gems: 0 });
    const result = processCommand(state, { id: 'c1', type: 'deliver_all', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(false);
  });

  it('fails with empty lobby', () => {
    const state = makeState({ gems: 5, lobbyVisitors: [] });
    const result = processCommand(state, { id: 'c1', type: 'deliver_all', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(false);
  });
});

describe('deliver_all with resolvedVisitors', () => {
  it('uses resolvedVisitors for role/targetFloor when visitors are blank', () => {
    const state = makeState({
      lobbyVisitors: [{ id: 'v1' }, { id: 'v2' }],
      gems: 5,
      elevatorFloor: 0,
      workers: [],
    });
    const cmd: Command = {
      id: 'c1', type: 'deliver_all', timestamp: 1000,
      resolvedVisitors: [
        { role: 'guest', targetFloor: 2, isVip: false },
        { role: 'guest', targetFloor: 3, isVip: false },
      ],
    };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.lobbyVisitors).toHaveLength(0);
    expect(result.state.gems).toBe(4); // 5 - 1 (deliver_all cost)
    expect(result.state.stats.totalPassengersLifted).toBe(2);
    // guest@floor2 tip=10*1*2=20, guest@floor3 tip=10*1*3=30 → total 1050
    expect(result.state.balance).toBe(1050);
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
  it('stage 1: grants stage1Reward when tips >= stage1 target and not yet claimed', () => {
    const state = makeState({ dailyTips: 10_000, dailyTipsStage1Claimed: false, dailyTipsStage2Claimed: false, gems: 20, elevatorLevel: 1 });
    const result = processCommand(state, { id: 'c1', type: 'claim_daily_reward', stage: 1, timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(22); // +2
    expect(result.state.dailyTipsStage1Claimed).toBe(true);
  });

  it('stage 1: fails when already claimed', () => {
    const state = makeState({ dailyTips: 10_000, dailyTipsStage1Claimed: true, gems: 20, elevatorLevel: 1 });
    const result = processCommand(state, { id: 'c1', type: 'claim_daily_reward', stage: 1, timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(false);
  });

  it('stage 1: fails when tips below stage1 target', () => {
    const state = makeState({ dailyTips: 5_000, dailyTipsStage1Claimed: false, gems: 20, elevatorLevel: 1 });
    const result = processCommand(state, { id: 'c1', type: 'claim_daily_reward', stage: 1, timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(false);
  });

  it('stage 2: grants stage2Reward when tips >= stage2 target and not yet claimed', () => {
    const state = makeState({ dailyTips: 20_000, dailyTipsStage1Claimed: false, dailyTipsStage2Claimed: false, gems: 20, elevatorLevel: 1 });
    const result = processCommand(state, { id: 'c1', type: 'claim_daily_reward', stage: 2, timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(23); // +3
    expect(result.state.dailyTipsStage2Claimed).toBe(true);
  });

  it('stage 2: fails when already claimed', () => {
    const state = makeState({ dailyTips: 20_000, dailyTipsStage2Claimed: true, gems: 20, elevatorLevel: 1 });
    const result = processCommand(state, { id: 'c1', type: 'claim_daily_reward', stage: 2, timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(false);
  });

  it('stage 2: fails when tips below stage2 target', () => {
    const state = makeState({ dailyTips: 10_000, dailyTipsStage2Claimed: false, gems: 20, elevatorLevel: 1 });
    const result = processCommand(state, { id: 'c1', type: 'claim_daily_reward', stage: 2, timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(false);
  });

  it('stages are independent: stage 2 can be claimed without stage 1 being claimed', () => {
    const state = makeState({ dailyTips: 20_000, dailyTipsStage1Claimed: false, dailyTipsStage2Claimed: false, gems: 20, elevatorLevel: 1 });
    const result = processCommand(state, { id: 'c1', type: 'claim_daily_reward', stage: 2, timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.dailyTipsStage1Claimed).toBe(false); // unchanged
    expect(result.state.dailyTipsStage2Claimed).toBe(true);
  });

  it('target scales with elevatorLevel', () => {
    // stage1 target at level 4 = round(10000 * sqrt(4)) = 20000
    const state = makeState({ dailyTips: 19_999, dailyTipsStage1Claimed: false, gems: 20, elevatorLevel: 4 });
    const result = processCommand(state, { id: 'c1', type: 'claim_daily_reward', stage: 1, timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(false); // just below stage1 target for level 4
  });
});

describe('passenger tracking', () => {
  const baseState = (): GameState => ({
    ...createInitialState(testConfig),
    stats: { totalBought: 0, totalListed: 0, totalCollected: 0, totalPassengersLifted: 5 },
    lobbyVisitors: [
      { id: 'v1', role: 'guest', targetFloor: 2, hairColor: 'black', female: false },
    ],
    elevatorFloor: 2,
    elevatorLevel: 1,
  });

  it('collect_tip increments totalPassengersLifted by 1', () => {
    const cmd = {
      id: 'ct1', type: 'collect_tip' as const, timestamp: 1000,
      newWorker: undefined, builderTool: undefined,
    };
    const result = processCommand(baseState(), cmd, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.stats.totalPassengersLifted).toBe(6);
  });

  it('deliver_all increments totalPassengersLifted by lobby size', () => {
    const state = {
      ...baseState(),
      gems: 5,
      lobbyVisitors: [
        { id: 'v1', role: 'guest' as const, targetFloor: 2, hairColor: 'black', female: false },
        { id: 'v2', role: 'guest' as const, targetFloor: 3, hairColor: 'brown', female: true },
        { id: 'v3', role: 'businessman' as const, targetFloor: 1, hairColor: 'blonde', female: false },
      ],
    };
    const cmd = {
      id: 'da1', type: 'deliver_all' as const, timestamp: 1000,
      builderTools: [],
    };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.stats.totalPassengersLifted).toBe(8); // 5 + 3 lobby visitors
  });
});

describe('fill_lobby', () => {
  it('creates blank visitors without roles', () => {
    const state = makeState({ lobbyVisitors: [], gems: 10, dailyFillLobbyUses: 0 });
    const cmd: Command = {
      id: 'c1', type: 'fill_lobby', timestamp: 1000,
      visitors: [{ visitorId: 'v1' }, { visitorId: 'v2' }],
    };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.lobbyVisitors).toHaveLength(2);
    expect(result.state.lobbyVisitors[0].id).toBe('v1');
    expect(result.state.lobbyVisitors[0].role).toBeUndefined();
  });

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

describe('VIP visitor effects — collect_tip', () => {
  function makeVipVisitor(role: string, targetFloor: number): Visitor {
    return { id: 'vip1', role: role as any, isVip: true, targetFloor, hairColor: '#000', female: false };
  }

  it('VIP guest at floor 1 fills hotel to capacity', () => {
    const workers = [{ id: 'w1', name: 'A', female: false, floorType: 'green', dreamJob: 'coffee', level: 1, hairColor: '#000', assignedFloorId: null, assignedSlotIdx: null, isSpecialist: false }];
    const state = makeState({ hotelCapacity: 3, workers, lobbyVisitors: [makeVipVisitor('guest', 1)], elevatorFloor: 1 });
    // Pre-generate 2 workers (3 - 1 occupied)
    const w2 = { id: 'w2', name: 'B', female: false, floorType: 'green', dreamJob: 'coffee', level: 1, hairColor: '#000' };
    const w3 = { id: 'w3', name: 'C', female: false, floorType: 'green', dreamJob: 'coffee', level: 1, hairColor: '#000' };
    const cmd: Command = {
      id: 'c1', type: 'collect_tip', timestamp: 1000,
      newWorkers: [w2, w3],
    };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(true);
    // Hotel should have 3 unassigned workers
    const unassigned = result.state.workers.filter(w => w.assignedFloorId === null);
    expect(unassigned).toHaveLength(3);
  });

  it('VIP guest gets tip × 10', () => {
    const state = makeState({ hotelCapacity: 0, lobbyVisitors: [makeVipVisitor('guest', 3)], elevatorFloor: 3 });
    const cmd: Command = { id: 'c1', type: 'collect_tip', timestamp: 1000 };
    const before = state.balance;
    const result = processCommand(state, cmd, testConfig, 1000);
    // Regular tip = guestTipBase(10) * elevatorLevel(1) * floor(3) = 30; VIP = 300
    expect(result.state.balance - before).toBe(300);
  });

  it('VIP businessman fallback tip is × 10', () => {
    const gemLimit = testConfig.lobbyConfig.dailyGemLimitBase + 1;
    const state = makeState({ dailyGemsCollected: gemLimit, lobbyVisitors: [makeVipVisitor('businessman', 3)], elevatorFloor: 3 });
    const cmd: Command = { id: 'c1', type: 'collect_tip', timestamp: 1000 };
    const before = state.balance;
    const result = processCommand(state, cmd, testConfig, 1000);
    // Regular fallback = businessmanFallbackBase(100) * elevatorLevel(1) * floor(3) = 300; VIP = 3000
    expect(result.state.balance - before).toBe(3000);
  });

  it('VIP businessman still gives only 1 gem', () => {
    const state = makeState({ gems: 5, dailyGemsCollected: 0, lobbyVisitors: [makeVipVisitor('businessman', 2)], elevatorFloor: 2 });
    const cmd: Command = { id: 'c1', type: 'collect_tip', timestamp: 1000 };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.state.gems - state.gems).toBe(1);
    expect(result.state.dailyGemsCollected).toBe(1);
  });

  it('VIP builder gives 2 tools when no construction on target floor', () => {
    const state = makeState({
      lobbyVisitors: [makeVipVisitor('builder', 3)],
      underConstruction: [],
      elevatorFloor: 3,
      tools: { briks: 0, glass: 0, nails: 0, screw: 0, wood: 0, cement: 0 },
    });
    const cmd: Command = {
      id: 'c1', type: 'collect_tip', timestamp: 1000,
      builderTools: ['wood', 'cement'],
    };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.state.tools?.wood).toBe(1);
    expect(result.state.tools?.cement).toBe(1);
  });

  it('VIP builder completes construction when target floor is under construction', () => {
    const now = 5000;
    const state = makeState({
      lobbyVisitors: [makeVipVisitor('builder', 2)],
      underConstruction: [{ floorId: 2, startedAt: 0, durationMs: 60_000, requiredTools: [], selectedFloorType: null }],
      elevatorFloor: 2,
    });
    const cmd: Command = { id: 'c1', type: 'collect_tip', timestamp: now, builderTools: [] };
    const result = processCommand(state, cmd, testConfig, now);
    const uc = result.state.underConstruction.find(u => u.floorId === 2)!;
    // startedAt should be set so now - startedAt >= durationMs
    expect(now - uc.startedAt).toBeGreaterThanOrEqual(60_000);
  });

  it('VIP deliverer fully completes DELIVERING slot', () => {
    const now = 1000;
    const state = makeState({
      lobbyVisitors: [makeVipVisitor('deliverer', 2)],
      elevatorFloor: 2,
    });
    state.floors[0].productions[0].stage = 'DELIVERING';
    state.floors[0].productions[0].stageStartedAt = 0;
    const cmd: Command = { id: 'c1', type: 'collect_tip', timestamp: now };
    const result = processCommand(state, cmd, testConfig, now);
    const prod = result.state.floors[0].productions[0];
    // deliveryDuration = 5000; now - stageStartedAt should be >= 5000
    expect(now - prod.stageStartedAt).toBeGreaterThanOrEqual(5000);
  });

  it('VIP seller completes the SELLING slot with longest remaining time', () => {
    const now = 1000;
    // Two selling slots: slot 0 started at 500 (remaining 9500), slot 1 at 0 (remaining 9000)
    // Should complete slot 0 (longest remaining)
    const state = makeState({
      lobbyVisitors: [makeVipVisitor('seller', 2)],
      elevatorFloor: 2,
      floors: [{
        id: 2, productions: [
          { typeId: 'coffee', stage: 'SELLING' as const, stageStartedAt: 500 },
          { typeId: 'coffee', stage: 'SELLING' as const, stageStartedAt: 0 },
        ],
      }],
    });
    const cmd: Command = { id: 'c1', type: 'collect_tip', timestamp: now };
    const result = processCommand(state, cmd, testConfig, now);
    const prods = result.state.floors[0].productions;
    // The slot with stageStartedAt=500 should be completed (now - stageStartedAt >= sellDuration)
    expect(now - prods[0].stageStartedAt).toBeGreaterThanOrEqual(10000);
    // The other slot should be unchanged
    expect(prods[1].stageStartedAt).toBe(0);
  });
});

describe('vipsLifted stat tracking', () => {
  it('increments vipsLifted on collect_tip for VIP visitor', () => {
    const visitor = { id: 'v1', role: 'guest' as const, isVip: true, targetFloor: 3, hairColor: '#000', female: false };
    const state = makeState({ lobbyVisitors: [visitor], elevatorFloor: 3 });
    const cmd: Command = { id: 'c1', type: 'collect_tip', timestamp: 1000 };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.state.dailyTasks.progress.vipsLifted).toBe(1);
    expect(result.state.dailyTasks.progress.visitorsLifted).toBe(1);
  });

  it('does NOT increment vipsLifted for regular visitor', () => {
    const visitor = { id: 'v1', role: 'guest' as const, isVip: false, targetFloor: 3, hairColor: '#000', female: false };
    const state = makeState({ lobbyVisitors: [visitor], elevatorFloor: 3 });
    const cmd: Command = { id: 'c1', type: 'collect_tip', timestamp: 1000 };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.state.dailyTasks.progress.vipsLifted).toBe(0);
    expect(result.state.dailyTasks.progress.visitorsLifted).toBe(1);
  });
});
