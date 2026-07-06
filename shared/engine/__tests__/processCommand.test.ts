import { processCommand } from '../processCommand';
import { createInitialState } from '../../config/gameConfig';
import type { GameState, GameConfig, Command, Worker } from '../../types';

const testConfig: GameConfig = {
  floorTypes: {
    green: { shirtColor: '#62B23F', accent: '#4E9A2E', dreamJobs: ['coffee_shop', 'bookstore'] },
  },
  floors: [
    { id: 1, slots: 2, floorType: 'green', availableTypes: ['coffee_shop', 'bookstore'] },
  ],
  productionTypes: {
    coffee_shop: { buyCost: 10, deliveryDuration: 5000, sellDuration: 10000, batchValue: 25 },
    bookstore: { buyCost: 50, deliveryDuration: 15000, sellDuration: 30000, batchValue: 120 },
  },
  startingBalance: 100,
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
  floorUnlocks: [
    {
      floorId: 5,
      price: 10,
      currency: 'gems' as const,
      constructionDurationMs: 60000,
      requiredToolCount: 1,
    },
    {
      floorId: 6,
      price: 50,
      currency: 'coins' as const,
      constructionDurationMs: 60000,
      requiredToolCount: 2,
    },
  ],
  achievements: [],
};

function makeWorker(overrides?: Partial<Worker>): Worker {
  return {
    id: 'w1', name: 'Test', female: false, floorType: 'green',
    dreamJob: 'coffee_shop', level: 5, hairColor: '#5C3A22',
    assignedFloorId: null, assignedSlotIdx: null,
    ...overrides,
  };
}

function makeState(overrides?: Partial<GameState>): GameState {
  return { ...createInitialState(testConfig), ...overrides };
}

function stateWithWorker(slotIdx = 0): GameState {
  return makeState({
    workers: [makeWorker({ assignedFloorId: 1, assignedSlotIdx: slotIdx })],
  });
}

function buyCmd(overrides?: Partial<Extract<Command, { type: 'buy' }>>): Command {
  return { id: 'cmd-1', type: 'buy', floorId: 1, slotIdx: 0, typeId: 'coffee_shop', timestamp: 1000, ...overrides };
}

function listCmd(overrides?: Partial<Extract<Command, { type: 'list' }>>): Command {
  return { id: 'cmd-2', type: 'list', floorId: 1, slotIdx: 0, timestamp: 7000, ...overrides };
}

function collectCmd(overrides?: Partial<Extract<Command, { type: 'collect' }>>): Command {
  return { id: 'cmd-3', type: 'collect', floorId: 1, slotIdx: 0, timestamp: 18000, ...overrides };
}

function assignCmd(overrides?: Record<string, unknown>): Command {
  return { id: 'cmd-a', type: 'assign_worker', workerId: 'w1', floorId: 1, slotIdx: 0, timestamp: 1000, ...overrides } as Command;
}

function fireCmd(overrides?: Record<string, unknown>): Command {
  return { id: 'cmd-f', type: 'fire_worker', workerId: 'w1', timestamp: 1000, ...overrides } as Command;
}

function evictCmd(overrides?: Record<string, unknown>): Command {
  return { id: 'cmd-e', type: 'evict_worker', workerId: 'w1', timestamp: 1000, ...overrides } as Command;
}

describe('processCommand', () => {
  describe('buy command', () => {
    it('succeeds on IDLE slot with sufficient balance', () => {
      const state = stateWithWorker();
      const result = processCommand(state, buyCmd(), testConfig, 1000);
      expect(result.success).toBe(true);
      // buyCost=10, worker level=5, discount=5%, effective=floor(10*0.95)=9
      expect(result.state.balance).toBe(91);
      expect(result.state.floors[0].productions[0].stage).toBe('DELIVERING');
      expect(result.state.floors[0].productions[0].typeId).toBe('coffee_shop');
      expect(result.state.floors[0].productions[0].stageStartedAt).toBe(1000);
    });

    it('fails with insufficient balance', () => {
      const state = stateWithWorker();
      state.balance = 5;
      const result = processCommand(state, buyCmd(), testConfig, 1000);
      expect(result.success).toBe(false);
      expect(result.state.balance).toBe(5);
    });

    it('fails when slot is not IDLE', () => {
      const state = stateWithWorker();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 500 };
      const result = processCommand(state, buyCmd(), testConfig, 1000);
      expect(result.success).toBe(false);
    });

    it('fails when typeId is not available on the floor', () => {
      const result = processCommand(
        stateWithWorker(),
        buyCmd({ typeId: 'electronics' }),
        testConfig,
        1000,
      );
      expect(result.success).toBe(false);
    });

    it('fails when typeId does not exist in config', () => {
      const result = processCommand(
        stateWithWorker(),
        buyCmd({ typeId: 'nonexistent' }),
        testConfig,
        1000,
      );
      expect(result.success).toBe(false);
    });

    it('rejects type change on slot with permanent typeId', () => {
      const state = stateWithWorker();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'IDLE', stageStartedAt: 0 };
      const result = processCommand(state, buyCmd({ typeId: 'bookstore' }), testConfig, 1000);
      expect(result.success).toBe(false);
    });

    it('accepts repeat buy with same typeId after collect', () => {
      const state = stateWithWorker();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'IDLE', stageStartedAt: 0 };
      const result = processCommand(state, buyCmd({ typeId: 'coffee_shop' }), testConfig, 1000);
      expect(result.success).toBe(true);
    });

    it('does not mutate the original state', () => {
      const state = stateWithWorker();
      const originalBalance = state.balance;
      processCommand(state, buyCmd(), testConfig, 1000);
      expect(state.balance).toBe(originalBalance);
    });

    it('fails for nonexistent floor', () => {
      const result = processCommand(stateWithWorker(), buyCmd({ floorId: 99 }), testConfig, 1000);
      expect(result.success).toBe(false);
    });

    it('fails for nonexistent slot index', () => {
      const result = processCommand(stateWithWorker(), buyCmd({ slotIdx: 99 }), testConfig, 1000);
      expect(result.success).toBe(false);
    });
  });

  describe('list command', () => {
    it('succeeds when delivery timer elapsed', () => {
      const state = stateWithWorker();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 1000 };
      const result = processCommand(state, listCmd({ timestamp: 7000 }), testConfig, 7000);
      expect(result.success).toBe(true);
      expect(result.state.floors[0].productions[0].stage).toBe('SELLING');
      expect(result.state.floors[0].productions[0].stageStartedAt).toBe(7000);
    });

    it('succeeds when delivery timer exactly elapsed', () => {
      const state = stateWithWorker();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 1000 };
      const result = processCommand(state, listCmd({ timestamp: 6000 }), testConfig, 6000);
      expect(result.success).toBe(true);
    });

    it('fails when delivery timer not elapsed', () => {
      const state = stateWithWorker();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 1000 };
      const result = processCommand(state, listCmd({ timestamp: 3000 }), testConfig, 3000);
      expect(result.success).toBe(false);
    });

    it('fails when stage is not DELIVERING', () => {
      const state = stateWithWorker();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'IDLE', stageStartedAt: 0 };
      const result = processCommand(state, listCmd(), testConfig, 7000);
      expect(result.success).toBe(false);
    });

    it('does not change balance', () => {
      const state = stateWithWorker();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 1000 };
      const result = processCommand(state, listCmd({ timestamp: 7000 }), testConfig, 7000);
      expect(result.state.balance).toBe(state.balance);
    });
  });

  describe('collect command', () => {
    it('succeeds when sell timer elapsed', () => {
      const state = stateWithWorker();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 7000 };
      const result = processCommand(state, collectCmd({ timestamp: 18000 }), testConfig, 18000);
      expect(result.success).toBe(true);
      expect(result.state.balance).toBe(150);
      expect(result.state.floors[0].productions[0].stage).toBe('IDLE');
      expect(result.state.floors[0].productions[0].typeId).toBe('coffee_shop');
    });

    it('fails when sell timer not elapsed', () => {
      const state = stateWithWorker();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 7000 };
      const result = processCommand(state, collectCmd({ timestamp: 10000 }), testConfig, 10000);
      expect(result.success).toBe(false);
    });

    it('fails when stage is not SELLING', () => {
      const state = stateWithWorker();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 1000 };
      const result = processCommand(state, collectCmd(), testConfig, 18000);
      expect(result.success).toBe(false);
    });
  });

  describe('full cycle', () => {
    it('completes IDLE -> buy -> list -> collect -> IDLE', () => {
      let state = stateWithWorker();

      // Buy: buyCost=10, level=5, discount=5%, effective=floor(10*0.95)=9, balance=100-9=91
      const r1 = processCommand(state, buyCmd({ timestamp: 1000 }), testConfig, 1000);
      expect(r1.success).toBe(true);
      expect(r1.state.balance).toBe(91);
      expect(r1.state.floors[0].productions[0].stage).toBe('DELIVERING');
      state = r1.state;

      const r2 = processCommand(state, listCmd({ timestamp: 7000 }), testConfig, 7000);
      expect(r2.success).toBe(true);
      expect(r2.state.floors[0].productions[0].stage).toBe('SELLING');
      state = r2.state;

      // Collect: dream job match (green+coffee_shop), 2x multiplier, revenue=25*2=50, balance=91+50=141
      const r3 = processCommand(state, collectCmd({ timestamp: 18000 }), testConfig, 18000);
      expect(r3.success).toBe(true);
      expect(r3.state.balance).toBe(141);
      expect(r3.state.floors[0].productions[0].stage).toBe('IDLE');
      expect(r3.state.floors[0].productions[0].typeId).toBe('coffee_shop');
    });
  });

  describe('assign_worker command', () => {
    it('assigns unemployed worker to empty slot', () => {
      const state = makeState({ workers: [makeWorker()] });
      const result = processCommand(state, assignCmd(), testConfig, 1000);
      expect(result.success).toBe(true);
      expect(result.state.workers[0].assignedFloorId).toBe(1);
      expect(result.state.workers[0].assignedSlotIdx).toBe(0);
    });

    it('fails if worker is already assigned', () => {
      const state = makeState({
        workers: [makeWorker({ assignedFloorId: 1, assignedSlotIdx: 1 })],
      });
      const result = processCommand(state, assignCmd(), testConfig, 1000);
      expect(result.success).toBe(false);
    });

    it('fails if slot already has a worker', () => {
      const state = makeState({
        workers: [
          makeWorker({ id: 'w1' }),
          makeWorker({ id: 'w2', assignedFloorId: 1, assignedSlotIdx: 0 }),
        ],
      });
      const result = processCommand(state, assignCmd(), testConfig, 1000);
      expect(result.success).toBe(false);
    });

    it('fails if worker does not exist', () => {
      const state = makeState({ workers: [] });
      const result = processCommand(state, assignCmd(), testConfig, 1000);
      expect(result.success).toBe(false);
    });
  });

  describe('fire_worker command', () => {
    it('returns assigned worker to hotel when slot is IDLE', () => {
      const state = makeState({
        workers: [makeWorker({ assignedFloorId: 1, assignedSlotIdx: 0 })],
      });
      const result = processCommand(state, fireCmd(), testConfig, 1000);
      expect(result.success).toBe(true);
      expect(result.state.workers[0].assignedFloorId).toBeNull();
      expect(result.state.workers[0].assignedSlotIdx).toBeNull();
    });

    it('fails if slot is DELIVERING', () => {
      const state = makeState({
        workers: [makeWorker({ assignedFloorId: 1, assignedSlotIdx: 0 })],
      });
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 500 };
      const result = processCommand(state, fireCmd(), testConfig, 1000);
      expect(result.success).toBe(false);
    });

    it('fails if slot is SELLING', () => {
      const state = makeState({
        workers: [makeWorker({ assignedFloorId: 1, assignedSlotIdx: 0 })],
      });
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 500 };
      const result = processCommand(state, fireCmd(), testConfig, 1000);
      expect(result.success).toBe(false);
    });

    it('fails if worker is not assigned', () => {
      const state = makeState({ workers: [makeWorker()] });
      const result = processCommand(state, fireCmd(), testConfig, 1000);
      expect(result.success).toBe(false);
    });
  });

  describe('evict_worker command', () => {
    it('removes unemployed worker from state', () => {
      const state = makeState({ workers: [makeWorker()] });
      const result = processCommand(state, evictCmd(), testConfig, 1000);
      expect(result.success).toBe(true);
      expect(result.state.workers).toHaveLength(0);
    });

    it('fails if worker is assigned', () => {
      const state = makeState({
        workers: [makeWorker({ assignedFloorId: 1, assignedSlotIdx: 0 })],
      });
      const result = processCommand(state, evictCmd(), testConfig, 1000);
      expect(result.success).toBe(false);
    });
  });

  describe('buy with worker checks', () => {
    it('fails if no worker on slot', () => {
      const state = makeState({ workers: [] });
      const result = processCommand(state, buyCmd(), testConfig, 1000);
      expect(result.success).toBe(false);
      expect(result.error).toBe('No worker assigned to slot');
    });

    it('applies floor discount from worker levels', () => {
      const state = makeState({
        workers: [
          makeWorker({ id: 'w1', level: 5, assignedFloorId: 1, assignedSlotIdx: 0 }),
          makeWorker({ id: 'w2', level: 5, assignedFloorId: 1, assignedSlotIdx: 1 }),
        ],
      });
      // buyCost=10, discount=(5+5)*1%=10%, effective=9
      const result = processCommand(state, buyCmd(), testConfig, 1000);
      expect(result.success).toBe(true);
      expect(result.state.balance).toBe(91); // 100 - 9
    });
  });

  describe('collect with worker multiplier', () => {
    it('applies 2x multiplier for dream job match', () => {
      const state = makeState({
        workers: [makeWorker({ floorType: 'green', dreamJob: 'coffee_shop', assignedFloorId: 1, assignedSlotIdx: 0 })],
      });
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 1000 };
      const result = processCommand(state, collectCmd({ timestamp: 12000 }), testConfig, 12000);
      expect(result.success).toBe(true);
      expect(result.state.balance).toBe(150); // 100 + 25*2
    });

    it('applies 1.3x multiplier for matching floor type', () => {
      const state = makeState({
        workers: [makeWorker({ floorType: 'green', dreamJob: 'bookstore', assignedFloorId: 1, assignedSlotIdx: 0 })],
      });
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 1000 };
      const result = processCommand(state, collectCmd({ timestamp: 12000 }), testConfig, 12000);
      expect(result.success).toBe(true);
      expect(result.state.balance).toBe(132); // 100 + floor(25*1.3) = 100 + 32
    });

    it('applies 1x multiplier for wrong floor type', () => {
      const state = makeState({
        workers: [makeWorker({ floorType: 'blue', assignedFloorId: 1, assignedSlotIdx: 0 })],
      });
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 1000 };
      const result = processCommand(state, collectCmd({ timestamp: 12000 }), testConfig, 12000);
      expect(result.success).toBe(true);
      expect(result.state.balance).toBe(125); // 100 + 25*1
    });

    it('fails if no worker on slot', () => {
      const state = makeState({ workers: [] });
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 1000 };
      const result = processCommand(state, collectCmd({ timestamp: 12000 }), testConfig, 12000);
      expect(result.success).toBe(false);
    });
  });

  describe('list with worker checks', () => {
    it('fails if no worker on slot', () => {
      const state = makeState({ workers: [] });
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 1000 };
      const result = processCommand(state, listCmd({ timestamp: 7000 }), testConfig, 7000);
      expect(result.success).toBe(false);
    });
  });
});

describe('buy_floor command', () => {
  function buyFloorCmd(overrides?: Partial<Extract<Command, { type: 'buy_floor' }>>): Command {
    return {
      id: 'bf-1', type: 'buy_floor', timestamp: 1000,
      floorId: 5, requiredTool: 'briks',
      ...overrides,
    } as Command;
  }

  it('deducts gems and sets underConstruction', () => {
    const state = makeState({ gems: 20 });
    const result = processCommand(state, buyFloorCmd(), testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(10);
    expect(result.state.underConstruction).toMatchObject([{
      floorId: 5, requiredTool: 'briks', requiredCount: 1, durationMs: 60000,
    }]);
  });

  it('fails when gems are insufficient', () => {
    const state = makeState({ gems: 5 });
    const result = processCommand(state, buyFloorCmd(), testConfig, 1000);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient gems');
  });

  it('fails when already under construction', () => {
    const state = makeState({
      gems: 20,
      underConstruction: [{
        floorId: 5, startedAt: 0, durationMs: 60000,
        requiredTool: 'briks', requiredCount: 1, selectedFloorType: null,
      }],
    });
    const result = processCommand(state, buyFloorCmd(), testConfig, 1000);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Floor already under construction');
  });

  it('fails for unknown floor id', () => {
    const state = makeState({ gems: 20 });
    const result = processCommand(state, buyFloorCmd({ floorId: 99 }), testConfig, 1000);
    expect(result.success).toBe(false);
  });

  it('deducts balance and sets underConstruction for coins currency', () => {
    const state = makeState({ balance: 100 });
    const result = processCommand(state, {
      id: 'bf-2', type: 'buy_floor', timestamp: 1000,
      floorId: 6, requiredTool: 'glass',
    } as Command, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.balance).toBe(50);
    expect(result.state.underConstruction).toMatchObject([{ floorId: 6, requiredTool: 'glass' }]);
  });

  it('fails with insufficient balance for coins currency', () => {
    const state = makeState({ balance: 10 });
    const result = processCommand(state, {
      id: 'bf-3', type: 'buy_floor', timestamp: 1000,
      floorId: 6, requiredTool: 'glass',
    } as Command, testConfig, 1000);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient balance');
  });
});

describe('stats tracking', () => {
  const worker = makeWorker({ assignedFloorId: 1, assignedSlotIdx: 0 });

  it('increments totalBought on successful buy', () => {
    const state = makeState({
      balance: 1000,
      workers: [worker],
      stats: { totalBought: 5, totalListed: 0, totalSold: 0 },
    });
    const cmd: Command = { id: 'b1', type: 'buy', floorId: 1, slotIdx: 0, typeId: 'coffee_shop', timestamp: 1000 };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.stats.totalBought).toBe(6);
    expect(result.state.stats.totalListed).toBe(0);
    expect(result.state.stats.totalSold).toBe(0);
  });

  it('increments totalListed on successful list', () => {
    const state = makeState({
      balance: 1000,
      workers: [worker],
      floors: [{
        id: 1,
        productions: [{ typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 0 }, { typeId: 'bookstore', stage: 'IDLE', stageStartedAt: 0 }],
      }],
      stats: { totalBought: 0, totalListed: 3, totalSold: 0 },
    });
    const cmd: Command = { id: 'l1', type: 'list', floorId: 1, slotIdx: 0, timestamp: 10000 };
    const result = processCommand(state, cmd, testConfig, 10000);
    expect(result.success).toBe(true);
    expect(result.state.stats.totalListed).toBe(4);
    expect(result.state.stats.totalBought).toBe(0);
    expect(result.state.stats.totalSold).toBe(0);
  });

  it('increments totalSold on successful collect', () => {
    const state = makeState({
      balance: 0,
      workers: [worker],
      floors: [{
        id: 1,
        productions: [{ typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 0 }, { typeId: 'bookstore', stage: 'IDLE', stageStartedAt: 0 }],
      }],
      stats: { totalBought: 0, totalListed: 0, totalSold: 7 },
    });
    const cmd: Command = { id: 'c1', type: 'collect', floorId: 1, slotIdx: 0, timestamp: 15000 };
    const result = processCommand(state, cmd, testConfig, 15000);
    expect(result.success).toBe(true);
    expect(result.state.stats.totalSold).toBe(8);
    expect(result.state.stats.totalBought).toBe(0);
    expect(result.state.stats.totalListed).toBe(0);
  });

  it('does not increment stats on failed command', () => {
    const state = makeState({
      balance: 0,  // insufficient balance
      workers: [worker],
      stats: { totalBought: 5, totalListed: 0, totalSold: 0 },
    });
    const cmd: Command = { id: 'b2', type: 'buy', floorId: 1, slotIdx: 0, typeId: 'coffee_shop', timestamp: 1000 };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(false);
    expect(result.state.stats.totalBought).toBe(5);
  });
});

describe('open_floor command', () => {
  function openFloorCmd(overrides?: Partial<Extract<Command, { type: 'open_floor' }>>): Command {
    return {
      id: 'of-1', type: 'open_floor', timestamp: 62000,
      floorId: 5, floorType: 'green',
      ...overrides,
    } as Command;
  }

  const stateUnderConstruction: Partial<GameState> = {
    gems: 10,
    tools: { briks: 2, glass: 0, nails: 0, screw: 0 },
    underConstruction: [{
      floorId: 5, startedAt: 1000, durationMs: 60000,
      requiredTool: 'briks', requiredCount: 1, selectedFloorType: null,
    }],
  };

  it('adds new floor, deducts tool, clears underConstruction', () => {
    const state = makeState(stateUnderConstruction);
    const result = processCommand(state, openFloorCmd(), testConfig, 62000);
    expect(result.success).toBe(true);
    expect(result.state.floors).toHaveLength(2);
    expect(result.state.floors[1].id).toBe(5);
    expect(result.state.tools.briks).toBe(1);
    expect(result.state.underConstruction).toHaveLength(0);
    expect(result.state.openedFloorTypes['5']).toBe('green');
  });

  it('new floor has 2 productions matching dreamJobs', () => {
    const state = makeState(stateUnderConstruction);
    const result = processCommand(state, openFloorCmd(), testConfig, 62000);
    const newFloor = result.state.floors.find((f) => f.id === 5)!;
    expect(newFloor.productions.map((p) => p.typeId)).toEqual(['coffee_shop', 'bookstore']);
  });

  it('fails when timer not complete', () => {
    const state = makeState(stateUnderConstruction);
    const result = processCommand(state, openFloorCmd({ timestamp: 30000 }), testConfig, 30000);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Construction not complete');
  });

  it('fails when tools insufficient', () => {
    const state = makeState({
      ...stateUnderConstruction,
      tools: { briks: 0, glass: 0, nails: 0, screw: 0 },
    });
    const result = processCommand(state, openFloorCmd(), testConfig, 62000);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient tools');
  });

  it('fails when no floor under construction', () => {
    const state = makeState({ underConstruction: [] });
    const result = processCommand(state, openFloorCmd(), testConfig, 62000);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Floor not under construction');
  });
});
