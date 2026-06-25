import { GameConfigSchema } from '../schemas/gameConfig';
import type { GameConfig, GameState, Floor } from '../types';

const rawConfig = {
  floorTypes: {
    green:  { category: 'Кондитерська', shirtColor: '#62B23F', accent: '#4E9A2E', dreamJobs: ['bulky', 'cupcake', 'cake'] },
    teal:   { category: 'Пральня',     shirtColor: '#36AE9C', accent: '#1F8979', dreamJobs: ['wash', 'dry', 'bleach'] },
    amber:  { category: "Кав'ярня",    shirtColor: '#E7A21E', accent: '#B07F12', dreamJobs: ['coffee', 'pancake', 'dessert'] },
    purple: { category: 'Парфумерія',  shirtColor: '#9A6FD0', accent: '#7B52BC', dreamJobs: ['aroma', 'soap', 'candle'] },
    blue:   { category: 'Морозиво',    shirtColor: '#4C9BDD', accent: '#2E78B5', dreamJobs: ['icecream', 'shake', 'sorbet'] },
  },
  floors: [
    { id: 2, name: 'Кондитерська', slots: 3, floorType: 'green', availableTypes: ['bulky', 'cupcake', 'cake'] },
    { id: 3, name: 'Пральня',     slots: 3, floorType: 'teal',  availableTypes: ['wash', 'dry', 'bleach'] },
    { id: 4, name: "Кав'ярня",    slots: 3, floorType: 'amber', availableTypes: ['coffee', 'pancake', 'dessert'] },
  ],
  productionTypes: {
    bulky:    { buyCost: 10,  deliveryDuration: 5000,  sellDuration: 10000, batchValue: 25,  displayName: 'Булки' },
    cupcake:  { buyCost: 15,  deliveryDuration: 8000,  sellDuration: 12000, batchValue: 35,  displayName: 'Пирожені' },
    cake:     { buyCost: 25,  deliveryDuration: 12000, sellDuration: 15000, batchValue: 60,  displayName: 'Торти' },
    wash:     { buyCost: 30,  deliveryDuration: 10000, sellDuration: 15000, batchValue: 70,  displayName: 'Прання' },
    dry:      { buyCost: 40,  deliveryDuration: 15000, sellDuration: 20000, batchValue: 90,  displayName: 'Сушка' },
    bleach:   { buyCost: 50,  deliveryDuration: 20000, sellDuration: 25000, batchValue: 120, displayName: 'Відбілювання' },
    coffee:   { buyCost: 20,  deliveryDuration: 8000,  sellDuration: 12000, batchValue: 50,  displayName: 'Кава' },
    pancake:  { buyCost: 35,  deliveryDuration: 12000, sellDuration: 18000, batchValue: 80,  displayName: 'Млинці' },
    dessert:  { buyCost: 45,  deliveryDuration: 18000, sellDuration: 22000, batchValue: 110, displayName: 'Десерти' },
  },
  startingBalance: 1000,
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
} satisfies GameConfig;

export const gameConfig: GameConfig = GameConfigSchema.parse(rawConfig);

export function createInitialState(config: GameConfig): GameState {
  return {
    balance: config.startingBalance,
    gems: 20,
    floors: config.floors.map((floorConfig): Floor => ({
      id: floorConfig.id,
      name: floorConfig.name,
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
  };
}
