import { CityBuildingType } from '@prisma/client';

export interface LevelConfig {
  standardCostCoins: number | null;
  standardCostGems: number | null;
  vipCostGems: number;
  buildDurationMs: number;
  boostCoinsCost: number;
  boostGemsCost: number;
  standardTools: { count: number; types: (1 | 2 | 3 | 4 | 5 | 6)[] };
  vipTools: { count: number; types: (1 | 2 | 3 | 4 | 5 | 6)[] };
}

const H = 60 * 60 * 1000;

export const BUILDING_LEVELS: LevelConfig[] = [
  // Level 1
  { standardCostGems: 1_000, standardCostCoins: null, vipCostGems: 10_000, buildDurationMs: 15 * H, boostCoinsCost: 100_000, boostGemsCost: 100, standardTools: { count: 10, types: [1, 3, 5] }, vipTools: { count: 100, types: [2, 4, 6] } },
  // Level 2
  { standardCostCoins: 10_000_000, standardCostGems: null, vipCostGems: 10_000, buildDurationMs: 30 * H, boostCoinsCost: 200_000, boostGemsCost: 200, standardTools: { count: 30, types: [2, 4, 6] }, vipTools: { count: 200, types: [1, 3, 5] } },
  // Level 3
  { standardCostGems: 5_000, standardCostCoins: null, vipCostGems: 10_000, buildDurationMs: 45 * H, boostCoinsCost: 300_000, boostGemsCost: 300, standardTools: { count: 50, types: [1, 3, 5] }, vipTools: { count: 300, types: [2, 4, 6] } },
  // Level 4
  { standardCostCoins: 100_000_000, standardCostGems: null, vipCostGems: 10_000, buildDurationMs: 60 * H, boostCoinsCost: 400_000, boostGemsCost: 400, standardTools: { count: 100, types: [2, 4, 6] }, vipTools: { count: 400, types: [1, 3, 5] } },
  // Level 5
  { standardCostGems: 15_000, standardCostCoins: null, vipCostGems: 10_000, buildDurationMs: 74 * H, boostCoinsCost: 500_000, boostGemsCost: 500, standardTools: { count: 150, types: [1, 3, 5] }, vipTools: { count: 500, types: [2, 4, 6] } },
  // Level 6
  { standardCostCoins: 500_000_000, standardCostGems: null, vipCostGems: 10_000, buildDurationMs: 89 * H, boostCoinsCost: 600_000, boostGemsCost: 600, standardTools: { count: 200, types: [2, 4, 6] }, vipTools: { count: 600, types: [1, 3, 5] } },
  // Level 7
  { standardCostGems: 25_000, standardCostCoins: null, vipCostGems: 10_000, buildDurationMs: 104 * H, boostCoinsCost: 700_000, boostGemsCost: 700, standardTools: { count: 250, types: [1, 3, 5] }, vipTools: { count: 700, types: [2, 4, 6] } },
  // Level 8
  { standardCostCoins: 2_500_000_000, standardCostGems: null, vipCostGems: 10_000, buildDurationMs: 119 * H, boostCoinsCost: 800_000, boostGemsCost: 800, standardTools: { count: 375, types: [2, 4, 6] }, vipTools: { count: 800, types: [1, 3, 5] } },
  // Level 9
  { standardCostGems: 50_000, standardCostCoins: null, vipCostGems: 10_000, buildDurationMs: 134 * H, boostCoinsCost: 900_000, boostGemsCost: 900, standardTools: { count: 500, types: [1, 3, 5] }, vipTools: { count: 900, types: [2, 4, 6] } },
  // Level 10
  { standardCostCoins: 10_000_000_000, standardCostGems: null, vipCostGems: 10_000, buildDurationMs: 149 * H, boostCoinsCost: 1_000_000, boostGemsCost: 1000, standardTools: { count: 625, types: [2, 4, 6] }, vipTools: { count: 1000, types: [1, 3, 5] } },
  // Level 11
  { standardCostGems: 75_000, standardCostCoins: null, vipCostGems: 10_000, buildDurationMs: 164 * H, boostCoinsCost: 1_100_000, boostGemsCost: 1100, standardTools: { count: 750, types: [1, 3, 5] }, vipTools: { count: 1100, types: [2, 4, 6] } },
  // Level 12
  { standardCostCoins: 25_000_000_000, standardCostGems: null, vipCostGems: 10_000, buildDurationMs: 179 * H, boostCoinsCost: 1_200_000, boostGemsCost: 1200, standardTools: { count: 875, types: [2, 4, 6] }, vipTools: { count: 1200, types: [1, 3, 5] } },
  // Level 13
  { standardCostGems: 100_000, standardCostCoins: null, vipCostGems: 10_000, buildDurationMs: 194 * H, boostCoinsCost: 1_300_000, boostGemsCost: 1300, standardTools: { count: 1000, types: [1, 3, 5] }, vipTools: { count: 1300, types: [2, 4, 6] } },
  // Level 14
  { standardCostCoins: 50_000_000_000, standardCostGems: null, vipCostGems: 10_000, buildDurationMs: 209 * H, boostCoinsCost: 1_400_000, boostGemsCost: 1400, standardTools: { count: 1250, types: [2, 4, 6] }, vipTools: { count: 1400, types: [1, 3, 5] } },
  // Level 15
  { standardCostGems: 150_000, standardCostCoins: null, vipCostGems: 10_000, buildDurationMs: 224 * H, boostCoinsCost: 1_500_000, boostGemsCost: 1500, standardTools: { count: 1500, types: [1, 3, 5] }, vipTools: { count: 1500, types: [2, 4, 6] } },
];

export const BONUS_PER_LEVEL: Record<CityBuildingType, number> = {
  MOTOR_POOL: 2,
  AD_AGENCY: 2,
  CITY_BANK: 2,
  BUSINESS_SCHOOL: 5,
  STATE_ACADEMY: 5,
  VIP_CLUB: 1,
  VIP_HOTEL: 3,
};

export const IS_VIP_BUILDING = new Set<CityBuildingType>([
  CityBuildingType.VIP_CLUB,
  CityBuildingType.VIP_HOTEL,
]);

export const BOOST_DURATION_MS = 20 * H;

export const INSTANT_SKIP_GEMS_PER_HOUR = 10;

export function getLevelConfig(nextLevel: number): LevelConfig {
  if (nextLevel < 1 || nextLevel > 15) throw new Error(`Invalid level ${nextLevel}`);
  return BUILDING_LEVELS[nextLevel - 1];
}
