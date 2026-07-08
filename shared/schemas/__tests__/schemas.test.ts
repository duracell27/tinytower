import { ProductionStageSchema, ProductionSchema } from '../production';
import { CommandSchema, SpawnVisitorCommandSchema, LiftVisitorCommandSchema, CollectTipCommandSchema, DeliverAllCommandSchema, UpgradeElevatorCommandSchema, UpgradeLobbyCommandSchema, ClaimDailyRewardCommandSchema } from '../command';
import { GameConfigSchema } from '../gameConfig';
import { GameStateSchema } from '../gameState';
import { WorkerSchema } from '../worker';
import { VisitorSchema, VisitorRoleSchema } from '../visitor';

describe('ProductionStageSchema', () => {
  it('accepts valid stages', () => {
    expect(ProductionStageSchema.parse('IDLE')).toBe('IDLE');
    expect(ProductionStageSchema.parse('DELIVERING')).toBe('DELIVERING');
    expect(ProductionStageSchema.parse('READY_TO_LIST')).toBe('READY_TO_LIST');
    expect(ProductionStageSchema.parse('SELLING')).toBe('SELLING');
    expect(ProductionStageSchema.parse('READY_TO_COLLECT')).toBe('READY_TO_COLLECT');
  });

  it('rejects invalid stages', () => {
    expect(ProductionStageSchema.safeParse('INVALID').success).toBe(false);
    expect(ProductionStageSchema.safeParse(123).success).toBe(false);
  });
});

describe('ProductionSchema', () => {
  it('accepts valid production with assigned type', () => {
    const result = ProductionSchema.parse({
      typeId: 'coffee_shop',
      stage: 'IDLE',
      stageStartedAt: 0,
    });
    expect(result.typeId).toBe('coffee_shop');
  });

  it('accepts production with null typeId (empty slot)', () => {
    const result = ProductionSchema.parse({
      typeId: null,
      stage: 'IDLE',
      stageStartedAt: 0,
    });
    expect(result.typeId).toBeNull();
  });

  it('rejects production with missing fields', () => {
    expect(ProductionSchema.safeParse({ typeId: 'x' }).success).toBe(false);
  });
});

describe('CommandSchema', () => {
  it('accepts a valid buy command', () => {
    const result = CommandSchema.parse({
      id: 'abc-123',
      type: 'buy',
      floorId: 1,
      slotIdx: 0,
      typeId: 'coffee_shop',
      timestamp: 1000,
    });
    expect(result.type).toBe('buy');
  });

  it('accepts a valid list command', () => {
    const result = CommandSchema.parse({
      id: 'abc-124',
      type: 'list',
      floorId: 1,
      slotIdx: 0,
      timestamp: 2000,
    });
    expect(result.type).toBe('list');
  });

  it('accepts a valid collect command', () => {
    const result = CommandSchema.parse({
      id: 'abc-125',
      type: 'collect',
      floorId: 1,
      slotIdx: 0,
      timestamp: 3000,
    });
    expect(result.type).toBe('collect');
  });

  it('accepts a valid assign_worker command', () => {
    const result = CommandSchema.parse({
      id: 'abc-128',
      type: 'assign_worker',
      workerId: 'worker-1',
      floorId: 1,
      slotIdx: 0,
      timestamp: 4000,
    });
    expect(result.type).toBe('assign_worker');
  });

  it('accepts a valid fire_worker command', () => {
    const result = CommandSchema.parse({
      id: 'abc-129',
      type: 'fire_worker',
      workerId: 'worker-1',
      timestamp: 5000,
    });
    expect(result.type).toBe('fire_worker');
  });

  it('accepts a valid evict_worker command', () => {
    const result = CommandSchema.parse({
      id: 'abc-130',
      type: 'evict_worker',
      workerId: 'worker-1',
      timestamp: 6000,
    });
    expect(result.type).toBe('evict_worker');
  });

  it('rejects buy command without typeId', () => {
    expect(CommandSchema.safeParse({
      id: 'abc-126',
      type: 'buy',
      floorId: 1,
      slotIdx: 0,
      timestamp: 1000,
    }).success).toBe(false);
  });

  it('rejects unknown command type', () => {
    expect(CommandSchema.safeParse({
      id: 'abc-127',
      type: 'upgrade',
      floorId: 1,
      slotIdx: 0,
      timestamp: 1000,
    }).success).toBe(false);
  });

  it('rejects fire_worker without workerId', () => {
    expect(CommandSchema.safeParse({
      id: 'abc-131',
      type: 'fire_worker',
      timestamp: 5000,
    }).success).toBe(false);
  });
});

describe('GameConfigSchema', () => {
  const baseLobbyConfig = {
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
  };

  it('accepts valid config', () => {
    const result = GameConfigSchema.parse({
      floors: [{ id: 1, slots: 2, floorType: 'green', availableTypes: ['coffee_shop'] }],
      productionTypes: {
        coffee_shop: { buyCost: 10, deliveryDuration: 5000, sellDuration: 10000, batchValue: 25 },
      },
      floorTypes: {
        green: { shirtColor: '#62B23F', accent: '#4E9A2E', businesses: [{ name: 'Test', dreamJobs: ['coffee_shop'] }] },
      },
      startingBalance: 100,
      hotelCapacity: 10,
      lobbyConfig: baseLobbyConfig,
    });
    expect(result.floors).toHaveLength(1);
  });

  it('rejects config with zero slots', () => {
    expect(GameConfigSchema.safeParse({
      floors: [{ id: 1, slots: 0, floorType: 'green', availableTypes: ['x'] }],
      productionTypes: { x: { buyCost: 10, deliveryDuration: 5000, sellDuration: 10000, batchValue: 25 } },
      floorTypes: { green: { shirtColor: '#000', accent: '#000', businesses: [{ name: 'T', dreamJobs: ['x'] }] } },
      startingBalance: 100,
      hotelCapacity: 10,
      lobbyConfig: baseLobbyConfig,
    }).success).toBe(false);
  });

  it('rejects config with negative buyCost', () => {
    expect(GameConfigSchema.safeParse({
      floors: [{ id: 1, slots: 1, floorType: 'green', availableTypes: ['x'] }],
      productionTypes: { x: { buyCost: -10, deliveryDuration: 5000, sellDuration: 10000, batchValue: 25 } },
      floorTypes: { green: { shirtColor: '#000', accent: '#000', businesses: [{ name: 'T', dreamJobs: ['x'] }] } },
      startingBalance: 100,
      hotelCapacity: 10,
      lobbyConfig: baseLobbyConfig,
    }).success).toBe(false);
  });

  it('rejects config without floorTypes', () => {
    expect(GameConfigSchema.safeParse({
      floors: [{ id: 1, slots: 1, floorType: 'green', availableTypes: ['x'] }],
      productionTypes: { x: { buyCost: 10, deliveryDuration: 5000, sellDuration: 10000, batchValue: 25 } },
      startingBalance: 100,
      hotelCapacity: 10,
      lobbyConfig: baseLobbyConfig,
    }).success).toBe(false);
  });

  it('rejects config without hotelCapacity', () => {
    expect(GameConfigSchema.safeParse({
      floors: [{ id: 1, slots: 1, floorType: 'green', availableTypes: ['x'] }],
      productionTypes: { x: { buyCost: 10, deliveryDuration: 5000, sellDuration: 10000, batchValue: 25 } },
      floorTypes: { green: { shirtColor: '#000', accent: '#000', businesses: [{ name: 'T', dreamJobs: ['x'] }] } },
      startingBalance: 100,
      lobbyConfig: baseLobbyConfig,
    }).success).toBe(false);
  });
});

describe('WorkerSchema', () => {
  it('accepts a valid worker', () => {
    const result = WorkerSchema.parse({
      id: 'worker-1',
      name: 'Test Worker',
      female: false,
      floorType: 'green',
      dreamJob: 'bulky',
      level: 5,
      hairColor: '#5C3A22',
      assignedFloorId: null,
      assignedSlotIdx: null,
    });
    expect(result.id).toBe('worker-1');
    expect(result.level).toBe(5);
  });

  it('accepts worker assigned to a floor', () => {
    const result = WorkerSchema.parse({
      id: 'worker-2',
      name: 'Assigned Worker',
      female: true,
      floorType: 'blue',
      dreamJob: 'wash',
      level: 3,
      hairColor: '#E0A93C',
      assignedFloorId: 2,
      assignedSlotIdx: 0,
    });
    expect(result.assignedFloorId).toBe(2);
    expect(result.assignedSlotIdx).toBe(0);
  });

  it('rejects worker with level below 1', () => {
    expect(WorkerSchema.safeParse({
      id: 'worker-3',
      name: 'Bad Worker',
      female: false,
      floorType: 'green',
      dreamJob: 'bulky',
      level: 0,
      hairColor: '#5C3A22',
      assignedFloorId: null,
      assignedSlotIdx: null,
    }).success).toBe(false);
  });

  it('rejects worker with level above 9', () => {
    expect(WorkerSchema.safeParse({
      id: 'worker-4',
      name: 'Bad Worker',
      female: false,
      floorType: 'green',
      dreamJob: 'bulky',
      level: 10,
      hairColor: '#5C3A22',
      assignedFloorId: null,
      assignedSlotIdx: null,
    }).success).toBe(false);
  });
});

describe('GameStateSchema', () => {
  it('accepts a valid game state', () => {
    const result = GameStateSchema.parse({
      balance: 100,
      gems: 20,
      floors: [{
        id: 1,
        name: 'Floor 1',
        productions: [{ typeId: null, stage: 'IDLE', stageStartedAt: 0 }],
      }],
      commandQueue: [],
      workers: [],
      hotelCapacity: 10,
      lobbyVisitors: [],
      lobbyCapacity: 10,
      elevatorLevel: 1,
      elevatorFloor: 0,
      dailyTips: 0,
      dailyGemsCollected: 0,
      dailyTipsRewardClaimed: false,
      lastDailyReset: 0,
      nextVisitorAt: 0,
    });
    expect(result.balance).toBe(100);
  });

  it('accepts game state with workers', () => {
    const result = GameStateSchema.parse({
      balance: 100,
      gems: 20,
      floors: [{
        id: 1,
        name: 'Floor 1',
        productions: [{ typeId: 'bulky', stage: 'IDLE', stageStartedAt: 0 }],
      }],
      commandQueue: [],
      workers: [{
        id: 'worker-1',
        name: 'Test Worker',
        female: false,
        floorType: 'green',
        dreamJob: 'bulky',
        level: 5,
        hairColor: '#5C3A22',
        assignedFloorId: null,
        assignedSlotIdx: null,
      }],
      hotelCapacity: 10,
      lobbyVisitors: [],
      lobbyCapacity: 10,
      elevatorLevel: 1,
      elevatorFloor: 0,
      dailyTips: 0,
      dailyGemsCollected: 0,
      dailyTipsRewardClaimed: false,
      lastDailyReset: 0,
      nextVisitorAt: 0,
    });
    expect(result.workers).toHaveLength(1);
  });

  it('rejects negative balance', () => {
    expect(GameStateSchema.safeParse({
      balance: -1,
      gems: 20,
      floors: [{ id: 1, name: 'F', productions: [{ typeId: null, stage: 'IDLE', stageStartedAt: 0 }] }],
      commandQueue: [],
      workers: [],
      hotelCapacity: 10,
      lobbyVisitors: [],
      lobbyCapacity: 10,
      elevatorLevel: 1,
      elevatorFloor: 0,
      dailyTips: 0,
      dailyGemsCollected: 0,
      dailyTipsRewardClaimed: false,
      lastDailyReset: 0,
      nextVisitorAt: 0,
    }).success).toBe(false);
  });

  it('rejects game state without workers array', () => {
    expect(GameStateSchema.safeParse({
      balance: 100,
      gems: 20,
      floors: [{ id: 1, name: 'F', productions: [{ typeId: null, stage: 'IDLE', stageStartedAt: 0 }] }],
      commandQueue: [],
      hotelCapacity: 10,
      lobbyVisitors: [],
      lobbyCapacity: 10,
      elevatorLevel: 1,
      elevatorFloor: 0,
      dailyTips: 0,
      dailyGemsCollected: 0,
      dailyTipsRewardClaimed: false,
      lastDailyReset: 0,
      nextVisitorAt: 0,
    }).success).toBe(false);
  });

  it('rejects game state without hotelCapacity', () => {
    expect(GameStateSchema.safeParse({
      balance: 100,
      gems: 20,
      floors: [{ id: 1, name: 'F', productions: [{ typeId: null, stage: 'IDLE', stageStartedAt: 0 }] }],
      commandQueue: [],
      workers: [],
      lobbyVisitors: [],
      lobbyCapacity: 10,
      elevatorLevel: 1,
      elevatorFloor: 0,
      dailyTips: 0,
      dailyGemsCollected: 0,
      dailyTipsRewardClaimed: false,
      lastDailyReset: 0,
      nextVisitorAt: 0,
    }).success).toBe(false);
  });
});

describe('VisitorSchema', () => {
  it('validates a valid visitor', () => {
    const visitor = { id: 'v1', role: 'guest', targetFloor: 3, hairColor: '#5C3A22', female: false };
    expect(VisitorSchema.parse(visitor)).toEqual(visitor);
  });

  it('rejects invalid role', () => {
    expect(() => VisitorSchema.parse({ id: 'v1', role: 'vip', targetFloor: 3, hairColor: '#000', female: true })).toThrow();
  });
});

describe('New command schemas', () => {
  it('validates buy_floor command', () => {
    const cmd = CommandSchema.parse({
      id: 'c1', type: 'buy_floor', timestamp: 1000,
      floorId: 5, requiredTools: [{ tool: 'briks' }],
    });
    expect(cmd.type).toBe('buy_floor');
    expect((cmd as import('../../types').BuyFloorCommand).floorId).toBe(5);
    expect((cmd as import('../../types').BuyFloorCommand).requiredTools[0].tool).toBe('briks');
  });

  it('validates open_floor command', () => {
    const cmd = CommandSchema.parse({
      id: 'c2', type: 'open_floor', timestamp: 2000,
      floorId: 5, floorType: 'purple',
    });
    expect(cmd.type).toBe('open_floor');
    expect((cmd as import('../../types').OpenFloorCommand).floorId).toBe(5);
    expect((cmd as import('../../types').OpenFloorCommand).floorType).toBe('purple');
  });

  it('rejects buy_floor with unknown tool', () => {
    expect(CommandSchema.safeParse({
      id: 'c3', type: 'buy_floor', timestamp: 1000,
      floorId: 5, requiredTools: [{ tool: 'hammer' }],
    }).success).toBe(false);
  });
});

describe('GameStateSchema with new fields', () => {
  const minimalState = {
    balance: 100, gems: 20,
    floors: [{ id: 1, productions: [{ typeId: null, stage: 'IDLE', stageStartedAt: 0 }] }],
    commandQueue: [], workers: [], hotelCapacity: 10,
    lobbyVisitors: [], lobbyCapacity: 10, elevatorLevel: 1, elevatorFloor: 0,
    dailyTips: 0, dailyGemsCollected: 0, dailyTipsRewardClaimed: false,
    lastDailyReset: 0, nextVisitorAt: 0,
  };

  it('defaults tools to zero when not provided', () => {
    const result = GameStateSchema.parse(minimalState);
    expect(result.tools).toEqual({ briks: 0, glass: 0, nails: 0, screw: 0 });
  });

  it('defaults underConstruction to null when not provided', () => {
    const result = GameStateSchema.parse(minimalState);
    expect(result.underConstruction).toEqual([]);
  });

  it('defaults openedFloorTypes to empty object when not provided', () => {
    const result = GameStateSchema.parse(minimalState);
    expect(result.openedFloorTypes).toEqual({});
  });

  it('accepts underConstruction when provided', () => {
    const result = GameStateSchema.parse({
      ...minimalState,
      underConstruction: [{
        floorId: 5, startedAt: 1000, durationMs: 1200000,
        requiredTools: [{ tool: 'glass', count: 1 }],
      }],
    });
    expect(result.underConstruction[0]?.floorId).toBe(5);
    expect(result.underConstruction[0]?.requiredTools[0].tool).toBe('glass');
  });
});

describe('Lobby command schemas', () => {
  it('validates spawn_visitor command', () => {
    const cmd = { id: 'c1', type: 'spawn_visitor', timestamp: 1000, visitorId: 'v1', role: 'guest', targetFloor: 3, hairColor: '#5C3A22', female: false };
    expect(CommandSchema.parse(cmd).type).toBe('spawn_visitor');
  });

  it('validates lift_visitor command', () => {
    const cmd = { id: 'c1', type: 'lift_visitor', timestamp: 1000, role: 'guest', targetFloor: 3 };
    expect(CommandSchema.parse(cmd).type).toBe('lift_visitor');
  });

  it('validates collect_tip command', () => {
    const cmd = { id: 'c1', type: 'collect_tip', timestamp: 1000 };
    expect(CommandSchema.parse(cmd).type).toBe('collect_tip');
  });

  it('validates deliver_all command', () => {
    const cmd = { id: 'c1', type: 'deliver_all', timestamp: 1000 };
    expect(CommandSchema.parse(cmd).type).toBe('deliver_all');
  });

  it('validates upgrade_elevator command', () => {
    const cmd = { id: 'c1', type: 'upgrade_elevator', timestamp: 1000 };
    expect(CommandSchema.parse(cmd).type).toBe('upgrade_elevator');
  });

  it('validates upgrade_lobby command', () => {
    const cmd = { id: 'c1', type: 'upgrade_lobby', timestamp: 1000 };
    expect(CommandSchema.parse(cmd).type).toBe('upgrade_lobby');
  });

  it('validates claim_daily_reward command', () => {
    const cmd = { id: 'c1', type: 'claim_daily_reward', timestamp: 1000 };
    expect(CommandSchema.parse(cmd).type).toBe('claim_daily_reward');
  });
});
