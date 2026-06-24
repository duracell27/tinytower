import { ProductionStageSchema, ProductionSchema } from '../production';
import { CommandSchema } from '../command';
import { GameConfigSchema } from '../gameConfig';
import { GameStateSchema } from '../gameState';

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
});

describe('GameConfigSchema', () => {
  it('accepts valid config', () => {
    const result = GameConfigSchema.parse({
      floors: [{ id: 1, name: 'Floor 1', slots: 2, availableTypes: ['coffee_shop'] }],
      productionTypes: {
        coffee_shop: { buyCost: 10, deliveryDuration: 5000, sellDuration: 10000, batchValue: 25 },
      },
      startingBalance: 100,
    });
    expect(result.floors).toHaveLength(1);
  });

  it('rejects config with zero slots', () => {
    expect(GameConfigSchema.safeParse({
      floors: [{ id: 1, name: 'Floor 1', slots: 0, availableTypes: ['x'] }],
      productionTypes: { x: { buyCost: 10, deliveryDuration: 5000, sellDuration: 10000, batchValue: 25 } },
      startingBalance: 100,
    }).success).toBe(false);
  });

  it('rejects config with negative buyCost', () => {
    expect(GameConfigSchema.safeParse({
      floors: [{ id: 1, name: 'Floor 1', slots: 1, availableTypes: ['x'] }],
      productionTypes: { x: { buyCost: -10, deliveryDuration: 5000, sellDuration: 10000, batchValue: 25 } },
      startingBalance: 100,
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
    });
    expect(result.balance).toBe(100);
  });

  it('rejects negative balance', () => {
    expect(GameStateSchema.safeParse({
      balance: -1,
      floors: [{ id: 1, name: 'F', productions: [{ typeId: null, stage: 'IDLE', stageStartedAt: 0 }] }],
      commandQueue: [],
    }).success).toBe(false);
  });
});
