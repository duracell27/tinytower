import { GameConfigSchema } from '../schemas/gameConfig';
import type { GameConfig, GameState, Floor } from '../types';
import { generateRandomWorkers } from './workerNames';
import { generateVisitorAppearance } from '../engine/lobbyUtils';

const rawConfig = {
  floorTypes: {
    green: {
      shirtColor: '#49AA38', accent: '#20810F',
      businesses: [
        { name: 'Confectionery', dreamJobs: ['buns', 'pastries', 'cakes'] },
        { name: 'Burger Joint',  dreamJobs: ['burgers', 'fries', 'drinks'] },
        { name: 'Cheese Dairy',  dreamJobs: ['milk', 'cheese', 'yogurt'] },
      ],
    },
    blue: {
      shirtColor: '#3376E5', accent: '#0A4DBC',
      businesses: [
        { name: 'Banking',      dreamJobs: ['cards', 'loans', 'accounts'] },
        { name: 'Rental',       dreamJobs: ['scooters', 'consoles', 'tools'] },
        { name: 'Dental Clinic', dreamJobs: ['fillings', 'cleaning', 'braces'] },
      ],
    },
    yellow: {
      shirtColor: '#E5A72E', accent: '#BC7E05',
      businesses: [
        { name: 'Exhibition', dreamJobs: ['paintings', 'sculptures', 'gallery'] },
        { name: 'Karting',    dreamJobs: ['karts', 'helmets', 'track'] },
        { name: 'Lounge',     dreamJobs: ['cocktails', 'hookahs', 'pizza'] },
      ],
    },
    purple: {
      shirtColor: '#9A6FD0', accent: '#7B52BC',
      businesses: [
        { name: 'Sneaker Store',  dreamJobs: ['canvas_shoes', 'sneakers', 'custom_sneakers'] },
        { name: 'Clothing Store', dreamJobs: ['tshirts', 'pants', 'jackets'] },
        { name: 'Merch Shop',     dreamJobs: ['hoodies', 'sweatshirts', 'caps'] },
      ],
    },
    red: {
      shirtColor: '#E05A4A', accent: '#C0372A',
      businesses: [
        { name: 'Smartphones', dreamJobs: ['phones', 'cases', 'screen_protectors'] },
        { name: 'Computers',   dreamJobs: ['pcs', 'laptops', 'monitors'] },
        { name: 'Robotics',    dreamJobs: ['robots', 'drones', 'spare_parts'] },
      ],
    },
  },
  floors: [
    { id: 2, slots: 3, floorType: 'green', availableTypes: ['buns', 'pastries', 'cakes'] },
    { id: 3, slots: 3, floorType: 'blue',  availableTypes: ['cards', 'loans', 'accounts'] },
  ],
  productionTypes: {
    // Green / Products — Confectionery (tier 1)
    buns:     { buyCost: 10,   deliveryDuration:   105_000, sellDuration:   300_000, batchValue: 16 },
    pastries: { buyCost: 15,   deliveryDuration:   180_000, sellDuration:   720_000, batchValue: 63 },
    cakes:    { buyCost: 20,   deliveryDuration:   600_000, sellDuration: 1_440_000, batchValue: 318 },
    // Green / Products — Burger Joint (tier 2)
    burgers:  { buyCost: 30,   deliveryDuration:   180_000, sellDuration:   360_000, batchValue: 48 },
    fries:    { buyCost: 100,  deliveryDuration:   600_000, sellDuration: 1_200_000, batchValue: 211 },
    drinks:   { buyCost: 400,  deliveryDuration: 1_800_000, sellDuration: 3_600_000, batchValue: 957 },
    // Green / Products — Cheese Dairy (tier 3)
    milk:     { buyCost: 50,   deliveryDuration:   300_000, sellDuration:   600_000, batchValue: 80 },
    cheese:   { buyCost: 255,  deliveryDuration:   960_000, sellDuration: 1_920_000, batchValue: 338 },
    yogurt:   { buyCost: 1450, deliveryDuration: 3_000_000, sellDuration: 6_000_000, batchValue: 1595 },
    // Blue / Service — Banking (tier 1)
    cards:    { buyCost: 20,   deliveryDuration:   120_000, sellDuration:   480_000, batchValue: 32 },
    loans:    { buyCost: 25,   deliveryDuration:   300_000, sellDuration: 1_200_000, batchValue: 106 },
    accounts: { buyCost: 30,   deliveryDuration:   900_000, sellDuration: 1_800_000, batchValue: 479 },
    // Blue / Service — Rental (tier 2)
    scooters: { buyCost: 40,   deliveryDuration:   300_000, sellDuration: 1_200_000, batchValue: 80 },
    consoles: { buyCost: 150,  deliveryDuration:   900_000, sellDuration: 3_600_000, batchValue: 317 },
    tools:    { buyCost: 800,  deliveryDuration: 3_000_000, sellDuration: 6_000_000, batchValue: 1595 },
    // Blue / Service — Dental Clinic (tier 3)
    fillings: { buyCost: 80,   deliveryDuration:   480_000, sellDuration: 1_920_000, batchValue: 128 },
    cleaning: { buyCost: 400,  deliveryDuration: 1_500_000, sellDuration: 3_600_000, batchValue: 527 },
    braces:   { buyCost: 1740, deliveryDuration: 3_600_000, sellDuration: 7_200_000, batchValue: 1914 },
    // Yellow / Rest — Exhibition (tier 1)
    paintings:   { buyCost: 30,   deliveryDuration:   180_000, sellDuration:   720_000, batchValue: 48 },
    sculptures:  { buyCost: 40,   deliveryDuration:   420_000, sellDuration:   840_000, batchValue: 148 },
    gallery:     { buyCost: 50,   deliveryDuration: 1_200_000, sellDuration: 2_400_000, batchValue: 638 },
    // Yellow / Rest — Karting (tier 2)
    karts:    { buyCost: 60,   deliveryDuration:   360_000, sellDuration:   864_000, batchValue: 95 },
    helmets:  { buyCost: 120,  deliveryDuration: 1_080_000, sellDuration: 2_160_000, batchValue: 380 },
    track:    { buyCost: 900,  deliveryDuration: 3_000_000, sellDuration: 6_000_000, batchValue: 1595 },
    // Yellow / Rest — Lounge (tier 3)
    cocktails: { buyCost: 100,  deliveryDuration:   600_000, sellDuration: 2_400_000, batchValue: 160 },
    hookahs:   { buyCost: 480,  deliveryDuration: 1_800_000, sellDuration: 3_600_000, batchValue: 634 },
    pizza:     { buyCost: 2320, deliveryDuration: 4_800_000, sellDuration: 9_600_000, batchValue: 2552 },
    // Purple / Fashion — Sneaker Store (tier 1)
    canvas_shoes:    { buyCost: 40,   deliveryDuration:   300_000, sellDuration:  1_200_000, batchValue: 80 },
    sneakers:        { buyCost: 50,   deliveryDuration:   600_000, sellDuration:  1_200_000, batchValue: 211 },
    custom_sneakers: { buyCost: 60,   deliveryDuration: 1_800_000, sellDuration:  3_600_000, batchValue: 957 },
    // Purple / Fashion — Clothing Store (tier 2)
    tshirts:  { buyCost: 70,   deliveryDuration:   420_000, sellDuration:  1_008_000, batchValue: 111 },
    pants:    { buyCost: 300,  deliveryDuration: 1_200_000, sellDuration:  2_400_000, batchValue: 422 },
    jackets:  { buyCost: 1000, deliveryDuration: 3_600_000, sellDuration:  7_200_000, batchValue: 1914 },
    // Purple / Fashion — Merch Shop (tier 3)
    hoodies:     { buyCost: 120,  deliveryDuration:   720_000, sellDuration:  2_880_000, batchValue: 192 },
    sweatshirts: { buyCost: 640,  deliveryDuration: 2_400_000, sellDuration:  5_760_000, batchValue: 845 },
    caps:        { buyCost: 3190, deliveryDuration: 6_600_000, sellDuration: 13_200_000, batchValue: 3509 },
    // Red / Electronics — Smartphones (tier 1)
    phones:           { buyCost: 60,   deliveryDuration:   420_000, sellDuration:  1_680_000, batchValue: 112 },
    cases:            { buyCost: 70,   deliveryDuration: 1_200_000, sellDuration:  2_400_000, batchValue: 422 },
    screen_protectors:{ buyCost: 80,   deliveryDuration: 3_600_000, sellDuration:  7_200_000, batchValue: 1914 },
    // Red / Electronics — Computers (tier 2)
    pcs:      { buyCost: 100,  deliveryDuration:   900_000, sellDuration:  2_160_000, batchValue: 240 },
    laptops:  { buyCost: 400,  deliveryDuration: 2_700_000, sellDuration:  6_480_000, batchValue: 950 },
    monitors: { buyCost: 1500, deliveryDuration: 7_200_000, sellDuration: 17_280_000, batchValue: 3827 },
    // Red / Electronics — Robotics (tier 3)
    robots:      { buyCost: 200,  deliveryDuration:  1_200_000, sellDuration:  4_800_000, batchValue: 320 },
    drones:      { buyCost: 960,  deliveryDuration:  3_600_000, sellDuration:  8_640_000, batchValue: 1266 },
    spare_parts: { buyCost: 5220, deliveryDuration: 10_800_000, sellDuration: 25_920_000, batchValue: 5741 },
  },
  startingBalance: 500,
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
    { floorId: 4,  price: 300,   currency: 'coins' as const, constructionDurationMs: 15  * 60 * 1000, requiredToolSlots: 1, requiredToolCount: 1 },
    { floorId: 5,  price: 3,     currency: 'gems'  as const, constructionDurationMs: 20  * 60 * 1000, requiredToolSlots: 1, requiredToolCount: 1 },
    { floorId: 6,  price: 500,   currency: 'coins' as const, constructionDurationMs: 30  * 60 * 1000, requiredToolSlots: 1, requiredToolCount: 2 },
    { floorId: 7,  price: 750,   currency: 'coins' as const, constructionDurationMs: 45  * 60 * 1000, requiredToolSlots: 1, requiredToolCount: 2 },
    { floorId: 8,  price: 1200,  currency: 'coins' as const, constructionDurationMs: 60  * 60 * 1000, requiredToolSlots: 1, requiredToolCount: 2 },
    { floorId: 9,  price: 1700,  currency: 'coins' as const, constructionDurationMs: 90  * 60 * 1000, requiredToolSlots: 1, requiredToolCount: 2 },
    { floorId: 10, price: 15,    currency: 'gems'  as const, constructionDurationMs: 120 * 60 * 1000, requiredToolSlots: 1, requiredToolCount: 2 },
    { floorId: 11, price: 4000,  currency: 'coins' as const, constructionDurationMs: 240 * 60 * 1000, requiredToolSlots: 2, requiredToolCount: 2 },
    { floorId: 12, price: 7000,  currency: 'coins' as const, constructionDurationMs: 360 * 60 * 1000, requiredToolSlots: 2, requiredToolCount: 2 },
    { floorId: 13, price: 11500, currency: 'coins' as const, constructionDurationMs: 480 * 60 * 1000, requiredToolSlots: 2, requiredToolCount: 2 },
    { floorId: 14, price: 18000, currency: 'coins' as const, constructionDurationMs: 600 * 60 * 1000, requiredToolSlots: 2, requiredToolCount: 2 },
    { floorId: 15, price: 50,    currency: 'gems'  as const, constructionDurationMs: 720 * 60 * 1000, requiredToolSlots: 2, requiredToolCount: 2 },
  ],
} satisfies GameConfig;

export const gameConfig: GameConfig = GameConfigSchema.parse(rawConfig);

export function createInitialState(config: GameConfig): GameState {
  return {
    balance: config.startingBalance,
    gems: 10,
    floors: config.floors.map((floorConfig): Floor => ({
      id: floorConfig.id,
      productions: floorConfig.availableTypes.map((typeId) => ({
        typeId,
        stage: 'IDLE' as const,
        stageStartedAt: 0,
      })),
    })),
    commandQueue: [],
    workers: generateRandomWorkers(5, config),
    hotelCapacity: config.hotelCapacity,
    lobbyVisitors: Array.from({ length: config.lobbyConfig.defaultLobbyCapacity }, () => generateVisitorAppearance()),
    lobbyCapacity: config.lobbyConfig.defaultLobbyCapacity,
    elevatorLevel: 1,
    elevatorFloor: 0,
    dailyTips: 0,
    dailyGemsCollected: 0,
    dailyTipsRewardClaimed: false,
    lastDailyReset: 0,
    dailyFillLobbyUses: 0,
    nextVisitorAt: 0,
    tools: { briks: 1, glass: 1, nails: 1, screw: 1 },
    underConstruction: [],
    openedFloorTypes: {},
    stats: {
      totalBought: 0,
      totalListed: 0,
      totalCollected: 0,
      totalPassengersLifted: 0,
    },
    coinBonusPercent: 0,
    xpBonusPercent: 0,
  };
}
