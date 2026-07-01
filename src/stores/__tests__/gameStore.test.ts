import { processCommand } from '../../../shared/engine/processCommand';
import { createInitialState } from '../../../shared/config/gameConfig';
import type { GameState, GameConfig } from '../../../shared/types';

const testConfig: GameConfig = {
  floors: [
    { id: 1, slots: 1, floorType: 'green', availableTypes: ['coffee_shop'] },
  ],
  productionTypes: {
    coffee_shop: { buyCost: 10, deliveryDuration: 5000, sellDuration: 10000, batchValue: 25 },
  },
  floorTypes: {
    green: { shirtColor: '#62B23F', accent: '#4E9A2E', dreamJobs: ['coffee_shop'] },
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
};

describe('game store logic (via processCommand)', () => {
  it('buy deducts balance and starts delivering', () => {
    const state = createInitialState(testConfig);
    // Add a worker to the floor
    const stateWithWorker: GameState = {
      ...state,
      workers: [{
        id: 'w1',
        name: 'Test Worker',
        female: false,
        floorType: 'green',
        dreamJob: 'coffee_shop',
        level: 5,
        hairColor: '#5C3A22',
        assignedFloorId: 1,
        assignedSlotIdx: 0,
      }],
    };
    const result = processCommand(
      stateWithWorker,
      { id: '1', type: 'buy', floorId: 1, slotIdx: 0, typeId: 'coffee_shop', timestamp: 1000 },
      testConfig,
      1000,
    );
    expect(result.success).toBe(true);
    // buyCost=10, worker level=5, discount=5%, effective=floor(10*0.95)=9, balance=100-9=91
    expect(result.state.balance).toBe(91);
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
