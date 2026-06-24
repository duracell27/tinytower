import { GameConfigSchema } from '../schemas/gameConfig';
import type { GameConfig, GameState, Floor } from '../types';

const rawConfig = {
  floors: [
    { id: 2, name: 'Floor 2', slots: 3, availableTypes: ['coffee_shop'] },
    { id: 3, name: 'Floor 3', slots: 3, availableTypes: ['coffee_shop', 'bookstore'] },
    { id: 4, name: 'Floor 4', slots: 3, availableTypes: ['bookstore'] },
  ],
  productionTypes: {
    coffee_shop: { buyCost: 10, deliveryDuration: 5000, sellDuration: 10000, batchValue: 25 },
    bookstore: { buyCost: 50, deliveryDuration: 15000, sellDuration: 30000, batchValue: 120 },
    electronics: { buyCost: 200, deliveryDuration: 60000, sellDuration: 90000, batchValue: 500 },
  },
  startingBalance: 1000,
} satisfies GameConfig;

export const gameConfig: GameConfig = GameConfigSchema.parse(rawConfig);

export function createInitialState(config: GameConfig): GameState {
  return {
    balance: config.startingBalance,
    floors: config.floors.map((floorConfig): Floor => ({
      id: floorConfig.id,
      name: floorConfig.name,
      productions: Array.from({ length: floorConfig.slots }, () => ({
        typeId: null,
        stage: 'IDLE' as const,
        stageStartedAt: 0,
      })),
    })),
    commandQueue: [],
  };
}
