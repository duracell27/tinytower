import { GameConfigSchema } from '../schemas/gameConfig';
import type { GameConfig, GameState, Floor } from '../types';

const rawConfig = {
  floorTypes: {
    green:  { shirtColor: '#49AA38', accent: '#20810F', dreamJobs: ['bulky', 'cupcake', 'cake'] },
    blue:   { shirtColor: '#3376E5', accent: '#0A4DBC', dreamJobs: ['wash', 'dry', 'bleach'] },
    yellow: { shirtColor: '#E5A72E', accent: '#BC7E05', dreamJobs: ['coffee', 'pancake', 'dessert'] },
    violet: { shirtColor: '#9A6FD0', accent: '#7B52BC', dreamJobs: ['aroma', 'soap', 'candle'] },
    red:    { shirtColor: '#4C9BDD', accent: '#2E78B5', dreamJobs: ['icecream', 'shake', 'sorbet'] },
  },
  floors: [
    { id: 2, slots: 3, floorType: 'green', availableTypes: ['bulky', 'cupcake', 'cake'] },
    { id: 3, slots: 3, floorType: 'blue',  availableTypes: ['wash', 'dry', 'bleach'] },
    { id: 4, slots: 3, floorType: 'yellow', availableTypes: ['coffee', 'pancake', 'dessert'] },
  ],
  productionTypes: {
    bulky:    { buyCost: 10,  deliveryDuration: 5000,  sellDuration: 10000, batchValue: 20 },
    cupcake:  { buyCost: 15,  deliveryDuration: 8000,  sellDuration: 12000, batchValue: 28 },
    cake:     { buyCost: 25,  deliveryDuration: 12000, sellDuration: 15000, batchValue: 48 },
    wash:     { buyCost: 30,  deliveryDuration: 10000, sellDuration: 15000, batchValue: 55 },
    dry:      { buyCost: 40,  deliveryDuration: 15000, sellDuration: 20000, batchValue: 72 },
    bleach:   { buyCost: 50,  deliveryDuration: 20000, sellDuration: 25000, batchValue: 95 },
    coffee:   { buyCost: 20,  deliveryDuration: 8000,  sellDuration: 12000, batchValue: 40 },
    pancake:  { buyCost: 35,  deliveryDuration: 12000, sellDuration: 18000, batchValue: 64 },
    dessert:  { buyCost: 45,  deliveryDuration: 18000, sellDuration: 22000, batchValue: 88 },
    aroma:    { buyCost: 30,  deliveryDuration: 10000, sellDuration: 14000, batchValue: 58 },
    soap:     { buyCost: 45,  deliveryDuration: 14000, sellDuration: 20000, batchValue: 82 },
    candle:   { buyCost: 60,  deliveryDuration: 20000, sellDuration: 26000, batchValue: 110 },
    icecream: { buyCost: 25,  deliveryDuration: 9000,  sellDuration: 13000, batchValue: 50 },
    shake:    { buyCost: 40,  deliveryDuration: 13000, sellDuration: 19000, batchValue: 74 },
    sorbet:   { buyCost: 55,  deliveryDuration: 18000, sellDuration: 24000, batchValue: 98 },
  },
  startingBalance: 1000,
  hotelCapacity: 10,
  lobbyConfig: {
    visitorSpawnInterval: 120_000,
    dailyTipsTarget: 10_000,
    dailyTipsReward: 5,
    dailyGemLimitBase: 10,
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
    { floorId: 5,  price: 250,  currency: 'gems' as const, constructionDurationMs: 20 * 60 * 1000, requiredToolCount: 1 },
    { floorId: 6,  price: 320,  currency: 'gems' as const, constructionDurationMs: 30 * 60 * 1000, requiredToolCount: 2 },
    { floorId: 7,  price: 420,  currency: 'gems' as const, constructionDurationMs: 45 * 60 * 1000, requiredToolCount: 2 },
    { floorId: 8,  price: 550,  currency: 'gems' as const, constructionDurationMs: 60 * 60 * 1000, requiredToolCount: 3 },
    { floorId: 9,  price: 700,  currency: 'gems' as const, constructionDurationMs: 90 * 60 * 1000, requiredToolCount: 3 },
    { floorId: 10, price: 900,  currency: 'gems' as const, constructionDurationMs: 120 * 60 * 1000, requiredToolCount: 4 },
  ],
} satisfies GameConfig;

export const gameConfig: GameConfig = GameConfigSchema.parse(rawConfig);

export function createInitialState(config: GameConfig): GameState {
  return {
    balance: config.startingBalance,
    gems: 20,
    floors: config.floors.map((floorConfig): Floor => ({
      id: floorConfig.id,
      productions: floorConfig.availableTypes.map((typeId) => ({
        typeId,
        stage: 'IDLE' as const,
        stageStartedAt: 0,
      })),
    })),
    commandQueue: [],
    workers: [],
    hotelCapacity: config.hotelCapacity,
    lobbyVisitors: [],
    lobbyCapacity: config.lobbyConfig.defaultLobbyCapacity,
    elevatorLevel: 1,
    elevatorFloor: 0,
    dailyTips: 0,
    dailyGemsCollected: 0,
    dailyTipsRewardClaimed: false,
    lastDailyReset: 0,
    nextVisitorAt: 0,
    tools: { briks: 1, glass: 1, nails: 1, screw: 1 },
    underConstruction: [],
    openedFloorTypes: {},
  };
}
