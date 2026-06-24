import { ProductionStageSchema, ProductionSchema } from '../production';
import { CommandSchema } from '../command';
import { GameConfigSchema } from '../gameConfig';
import { GameStateSchema } from '../gameState';
import { WorkerSchema } from '../worker';

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
  it('accepts valid config', () => {
    const result = GameConfigSchema.parse({
      floors: [{ id: 1, name: 'Floor 1', slots: 2, floorType: 'green', availableTypes: ['coffee_shop'] }],
      productionTypes: {
        coffee_shop: { buyCost: 10, deliveryDuration: 5000, sellDuration: 10000, batchValue: 25, displayName: 'Coffee' },
      },
      floorTypes: {
        green: { category: 'Test', shirtColor: '#62B23F', accent: '#4E9A2E', dreamJobs: ['coffee_shop'] },
      },
      startingBalance: 100,
      hotelCapacity: 10,
    });
    expect(result.floors).toHaveLength(1);
  });

  it('rejects config with zero slots', () => {
    expect(GameConfigSchema.safeParse({
      floors: [{ id: 1, name: 'Floor 1', slots: 0, floorType: 'green', availableTypes: ['x'] }],
      productionTypes: { x: { buyCost: 10, deliveryDuration: 5000, sellDuration: 10000, batchValue: 25, displayName: 'X' } },
      floorTypes: { green: { category: 'Test', shirtColor: '#000', accent: '#000', dreamJobs: ['x'] } },
      startingBalance: 100,
      hotelCapacity: 10,
    }).success).toBe(false);
  });

  it('rejects config with negative buyCost', () => {
    expect(GameConfigSchema.safeParse({
      floors: [{ id: 1, name: 'Floor 1', slots: 1, floorType: 'green', availableTypes: ['x'] }],
      productionTypes: { x: { buyCost: -10, deliveryDuration: 5000, sellDuration: 10000, batchValue: 25, displayName: 'X' } },
      floorTypes: { green: { category: 'Test', shirtColor: '#000', accent: '#000', dreamJobs: ['x'] } },
      startingBalance: 100,
      hotelCapacity: 10,
    }).success).toBe(false);
  });

  it('rejects config without floorTypes', () => {
    expect(GameConfigSchema.safeParse({
      floors: [{ id: 1, name: 'Floor 1', slots: 1, floorType: 'green', availableTypes: ['x'] }],
      productionTypes: { x: { buyCost: 10, deliveryDuration: 5000, sellDuration: 10000, batchValue: 25, displayName: 'X' } },
      startingBalance: 100,
      hotelCapacity: 10,
    }).success).toBe(false);
  });

  it('rejects config without hotelCapacity', () => {
    expect(GameConfigSchema.safeParse({
      floors: [{ id: 1, name: 'Floor 1', slots: 1, floorType: 'green', availableTypes: ['x'] }],
      productionTypes: { x: { buyCost: 10, deliveryDuration: 5000, sellDuration: 10000, batchValue: 25, displayName: 'X' } },
      floorTypes: { green: { category: 'Test', shirtColor: '#000', accent: '#000', dreamJobs: ['x'] } },
      startingBalance: 100,
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
      floorType: 'teal',
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
      floors: [{
        id: 1,
        name: 'Floor 1',
        productions: [{ typeId: null, stage: 'IDLE', stageStartedAt: 0 }],
      }],
      commandQueue: [],
      workers: [],
      hotelCapacity: 10,
    });
    expect(result.balance).toBe(100);
  });

  it('accepts game state with workers', () => {
    const result = GameStateSchema.parse({
      balance: 100,
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
    });
    expect(result.workers).toHaveLength(1);
  });

  it('rejects negative balance', () => {
    expect(GameStateSchema.safeParse({
      balance: -1,
      floors: [{ id: 1, name: 'F', productions: [{ typeId: null, stage: 'IDLE', stageStartedAt: 0 }] }],
      commandQueue: [],
      workers: [],
      hotelCapacity: 10,
    }).success).toBe(false);
  });

  it('rejects game state without workers array', () => {
    expect(GameStateSchema.safeParse({
      balance: 100,
      floors: [{ id: 1, name: 'F', productions: [{ typeId: null, stage: 'IDLE', stageStartedAt: 0 }] }],
      commandQueue: [],
      hotelCapacity: 10,
    }).success).toBe(false);
  });

  it('rejects game state without hotelCapacity', () => {
    expect(GameStateSchema.safeParse({
      balance: 100,
      floors: [{ id: 1, name: 'F', productions: [{ typeId: null, stage: 'IDLE', stageStartedAt: 0 }] }],
      commandQueue: [],
      workers: [],
    }).success).toBe(false);
  });
});
