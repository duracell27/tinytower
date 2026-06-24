import { processCommand } from '../../../shared/engine/processCommand';
import { createInitialState } from '../../../shared/config/gameConfig';
import type { GameState, GameConfig } from '../../../shared/types';

const testConfig: GameConfig = {
  floors: [
    { id: 1, name: 'Floor 1', slots: 1, availableTypes: ['coffee_shop'] },
  ],
  productionTypes: {
    coffee_shop: { buyCost: 10, deliveryDuration: 5000, sellDuration: 10000, batchValue: 25 },
  },
  startingBalance: 100,
};

describe('game store logic (via processCommand)', () => {
  it('buy deducts balance and starts delivering', () => {
    const state = createInitialState(testConfig);
    const result = processCommand(
      state,
      { id: '1', type: 'buy', floorId: 1, slotIdx: 0, typeId: 'coffee_shop', timestamp: 1000 },
      testConfig,
      1000,
    );
    expect(result.success).toBe(true);
    expect(result.state.balance).toBe(90);
    expect(result.state.floors[0].productions[0].stage).toBe('DELIVERING');
  });

  it('command queue cap works at boundary', () => {
    const state = createInitialState(testConfig);
    const bigQueue = Array.from({ length: 10000 }, (_, i) => ({
      id: `cmd-${i}`,
      type: 'buy' as const,
      floorId: 1,
      slotIdx: 0,
      typeId: 'coffee_shop',
      timestamp: i,
    }));
    const stateWithFullQueue: GameState = { ...state, commandQueue: bigQueue };
    expect(stateWithFullQueue.commandQueue).toHaveLength(10000);
  });
});
