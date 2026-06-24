import { processCommand } from '../processCommand';
import { createInitialState } from '../../config/gameConfig';
import type { GameState, GameConfig, Command } from '../../types';

const testConfig: GameConfig = {
  floors: [
    { id: 1, name: 'Floor 1', slots: 2, floorType: 'green', availableTypes: ['coffee_shop', 'bookstore'] },
  ],
  productionTypes: {
    coffee_shop: { buyCost: 10, deliveryDuration: 5000, sellDuration: 10000, batchValue: 25, displayName: 'Coffee' },
    bookstore: { buyCost: 50, deliveryDuration: 15000, sellDuration: 30000, batchValue: 120, displayName: 'Books' },
  },
  floorTypes: {
    green: { category: 'Test', shirtColor: '#62B23F', accent: '#4E9A2E', dreamJobs: ['coffee_shop', 'bookstore'] },
  },
  startingBalance: 100,
  hotelCapacity: 10,
};

function makeState(overrides?: Partial<GameState>): GameState {
  return { ...createInitialState(testConfig), ...overrides };
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

describe('processCommand', () => {
  describe('buy command', () => {
    it('succeeds on IDLE slot with sufficient balance', () => {
      const state = makeState();
      const result = processCommand(state, buyCmd(), testConfig, 1000);
      expect(result.success).toBe(true);
      expect(result.state.balance).toBe(90);
      expect(result.state.floors[0].productions[0].stage).toBe('DELIVERING');
      expect(result.state.floors[0].productions[0].typeId).toBe('coffee_shop');
      expect(result.state.floors[0].productions[0].stageStartedAt).toBe(1000);
    });

    it('fails with insufficient balance', () => {
      const state = makeState({ balance: 5 });
      const result = processCommand(state, buyCmd(), testConfig, 1000);
      expect(result.success).toBe(false);
      expect(result.state.balance).toBe(5);
    });

    it('fails when slot is not IDLE', () => {
      const state = makeState();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 500 };
      const result = processCommand(state, buyCmd(), testConfig, 1000);
      expect(result.success).toBe(false);
    });

    it('fails when typeId is not available on the floor', () => {
      const result = processCommand(
        makeState(),
        buyCmd({ typeId: 'electronics' }),
        testConfig,
        1000,
      );
      expect(result.success).toBe(false);
    });

    it('fails when typeId does not exist in config', () => {
      const result = processCommand(
        makeState(),
        buyCmd({ typeId: 'nonexistent' }),
        testConfig,
        1000,
      );
      expect(result.success).toBe(false);
    });

    it('rejects type change on slot with permanent typeId', () => {
      const state = makeState();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'IDLE', stageStartedAt: 0 };
      const result = processCommand(state, buyCmd({ typeId: 'bookstore' }), testConfig, 1000);
      expect(result.success).toBe(false);
    });

    it('accepts repeat buy with same typeId after collect', () => {
      const state = makeState();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'IDLE', stageStartedAt: 0 };
      const result = processCommand(state, buyCmd({ typeId: 'coffee_shop' }), testConfig, 1000);
      expect(result.success).toBe(true);
    });

    it('does not mutate the original state', () => {
      const state = makeState();
      const originalBalance = state.balance;
      processCommand(state, buyCmd(), testConfig, 1000);
      expect(state.balance).toBe(originalBalance);
    });

    it('fails for nonexistent floor', () => {
      const result = processCommand(makeState(), buyCmd({ floorId: 99 }), testConfig, 1000);
      expect(result.success).toBe(false);
    });

    it('fails for nonexistent slot index', () => {
      const result = processCommand(makeState(), buyCmd({ slotIdx: 99 }), testConfig, 1000);
      expect(result.success).toBe(false);
    });
  });

  describe('list command', () => {
    it('succeeds when delivery timer elapsed', () => {
      const state = makeState();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 1000 };
      const result = processCommand(state, listCmd({ timestamp: 7000 }), testConfig, 7000);
      expect(result.success).toBe(true);
      expect(result.state.floors[0].productions[0].stage).toBe('SELLING');
      expect(result.state.floors[0].productions[0].stageStartedAt).toBe(7000);
    });

    it('succeeds when delivery timer exactly elapsed', () => {
      const state = makeState();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 1000 };
      const result = processCommand(state, listCmd({ timestamp: 6000 }), testConfig, 6000);
      expect(result.success).toBe(true);
    });

    it('fails when delivery timer not elapsed', () => {
      const state = makeState();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 1000 };
      const result = processCommand(state, listCmd({ timestamp: 3000 }), testConfig, 3000);
      expect(result.success).toBe(false);
    });

    it('fails when stage is not DELIVERING', () => {
      const state = makeState();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'IDLE', stageStartedAt: 0 };
      const result = processCommand(state, listCmd(), testConfig, 7000);
      expect(result.success).toBe(false);
    });

    it('does not change balance', () => {
      const state = makeState();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 1000 };
      const result = processCommand(state, listCmd({ timestamp: 7000 }), testConfig, 7000);
      expect(result.state.balance).toBe(state.balance);
    });
  });

  describe('collect command', () => {
    it('succeeds when sell timer elapsed', () => {
      const state = makeState();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 7000 };
      const result = processCommand(state, collectCmd({ timestamp: 18000 }), testConfig, 18000);
      expect(result.success).toBe(true);
      expect(result.state.balance).toBe(125);
      expect(result.state.floors[0].productions[0].stage).toBe('IDLE');
      expect(result.state.floors[0].productions[0].typeId).toBe('coffee_shop');
    });

    it('fails when sell timer not elapsed', () => {
      const state = makeState();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 7000 };
      const result = processCommand(state, collectCmd({ timestamp: 10000 }), testConfig, 10000);
      expect(result.success).toBe(false);
    });

    it('fails when stage is not SELLING', () => {
      const state = makeState();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 1000 };
      const result = processCommand(state, collectCmd(), testConfig, 18000);
      expect(result.success).toBe(false);
    });
  });

  describe('full cycle', () => {
    it('completes IDLE → buy → list → collect → IDLE', () => {
      let state = makeState();

      const r1 = processCommand(state, buyCmd({ timestamp: 1000 }), testConfig, 1000);
      expect(r1.success).toBe(true);
      expect(r1.state.balance).toBe(90);
      expect(r1.state.floors[0].productions[0].stage).toBe('DELIVERING');
      state = r1.state;

      const r2 = processCommand(state, listCmd({ timestamp: 7000 }), testConfig, 7000);
      expect(r2.success).toBe(true);
      expect(r2.state.floors[0].productions[0].stage).toBe('SELLING');
      state = r2.state;

      const r3 = processCommand(state, collectCmd({ timestamp: 18000 }), testConfig, 18000);
      expect(r3.success).toBe(true);
      expect(r3.state.balance).toBe(115);
      expect(r3.state.floors[0].productions[0].stage).toBe('IDLE');
      expect(r3.state.floors[0].productions[0].typeId).toBe('coffee_shop');
    });
  });
});
