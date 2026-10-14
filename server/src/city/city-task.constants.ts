import { CityTaskType } from '@prisma/client';
import type { DailyTaskProgress } from '../../../shared/types';

export const TICKETS_TO_GEMS_RATE = 2; // 1 ticket = 2 gems

export const PLACEMENT_BONUSES: Record<number, number> = {
  1: 2000, 2: 1900, 3: 1800,
  4: 1600, 5: 1500, 6: 1400,
  7: 1300, 8: 1200, 9: 1100, 10: 1000,
};

// Gems awarded to each participant when a task is collected
export const TASK_GEM_REWARDS: Record<CityTaskType, number> = {
  [CityTaskType.WHOLESALE_PURCHASES]: 2,
  [CityTaskType.GOODS_ON_DISPLAY]:    2,
  [CityTaskType.CASH_COLLECTOR]:      2,
  [CityTaskType.CARRIER]:             2,
  [CityTaskType.VIP_CARRIER]:         2,
  [CityTaskType.EVICT_RESIDENTS]:     2,
  [CityTaskType.NEW_RESIDENTS]:       2,
  [CityTaskType.BUILD_FLOOR]:         5,
  [CityTaskType.EASY_MONEY]:          5,
};

// Coins = cityLevel × multiplier, awarded to each participant on collect
export const TASK_COINS_MULTIPLIER: Record<CityTaskType, number> = {
  [CityTaskType.CASH_COLLECTOR]:      3000,
  [CityTaskType.VIP_CARRIER]:         3000,
  [CityTaskType.GOODS_ON_DISPLAY]:    2500,
  [CityTaskType.WHOLESALE_PURCHASES]: 2000,
  [CityTaskType.NEW_RESIDENTS]:       2000,
  [CityTaskType.EVICT_RESIDENTS]:     2000,
  [CityTaskType.BUILD_FLOOR]:         2000,
  [CityTaskType.EASY_MONEY]:          1500,
  [CityTaskType.CARRIER]:             1500,
};

// Resources (tools) added to city budget based on ranking
export const PLACEMENT_RESOURCE_REWARDS: Record<number, number> = {
  1: 100, 2: 90, 3: 80,
  4: 70,  5: 60, 6: 50,
  7: 40,  8: 30, 9: 20, 10: 10,
};

export const SUPER_RESOURCE_BONUS_250 = 50;
export const SUPER_RESOURCE_BONUS_500 = 100;

const TOOL_KEYS = ['briks', 'glass', 'nails', 'screw', 'wood', 'cement'] as const;
export type ToolKey = typeof TOOL_KEYS[number];

export function generateRandomResources(total: number): Record<ToolKey, number> {
  const result = { briks: 0, glass: 0, nails: 0, screw: 0, wood: 0, cement: 0 };
  if (total <= 0) return result;
  let remaining = total;
  for (let i = 0; i < TOOL_KEYS.length - 1; i++) {
    const maxShare = remaining - (TOOL_KEYS.length - 1 - i);
    const share = Math.floor(Math.random() * (maxShare + 1));
    result[TOOL_KEYS[i]] = share;
    remaining -= share;
  }
  result[TOOL_KEYS[TOOL_KEYS.length - 1]] = remaining;
  return result;
}

export function computeResourceReward(totalTickets: number, rank: number): number {
  const placement = PLACEMENT_RESOURCE_REWARDS[rank] ?? 0;
  const superBonus = totalTickets >= 500 ? SUPER_RESOURCE_BONUS_500 : totalTickets >= 250 ? SUPER_RESOURCE_BONUS_250 : 0;
  return placement + superBonus;
}

export function computeWeeklyReward(totalTickets: number, rank: number): {
  baseReward: number;
  placementBonus: number;
  superBonus: number;
  totalReward: number;
} {
  const baseReward = totalTickets * TICKETS_TO_GEMS_RATE;
  const placementBonus = PLACEMENT_BONUSES[rank] ?? 0;
  const superBonus = totalTickets >= 500 ? 5000 : totalTickets >= 250 ? 500 : 0;
  return { baseReward, placementBonus, superBonus, totalReward: baseReward + placementBonus + superBonus };
}

export const TASK_LABELS: Record<CityTaskType, string> = {
  [CityTaskType.WHOLESALE_PURCHASES]: 'Wholesale Purchases',
  [CityTaskType.GOODS_ON_DISPLAY]:    'Goods on Display',
  [CityTaskType.CASH_COLLECTOR]:      'Cash Collector',
  [CityTaskType.CARRIER]:             'Carrier',
  [CityTaskType.VIP_CARRIER]:         'VIP Carrier',
  [CityTaskType.EVICT_RESIDENTS]:     'Evict Residents',
  [CityTaskType.NEW_RESIDENTS]:       'New Residents',
  [CityTaskType.BUILD_FLOOR]:         'Build a Floor',
  [CityTaskType.EASY_MONEY]:          'Easy Money',
};

export const ALL_TASK_TYPES: CityTaskType[] = [
  CityTaskType.WHOLESALE_PURCHASES,
  CityTaskType.GOODS_ON_DISPLAY,
  CityTaskType.CASH_COLLECTOR,
  CityTaskType.CARRIER,
  CityTaskType.VIP_CARRIER,
  CityTaskType.EVICT_RESIDENTS,
  CityTaskType.NEW_RESIDENTS,
  CityTaskType.BUILD_FLOOR,
  CityTaskType.EASY_MONEY,
];

export function calcRequiredCount(taskType: CityTaskType, cityLevel: number): number {
  const y = Math.max(10, Math.min(50, cityLevel));
  switch (taskType) {
    case CityTaskType.WHOLESALE_PURCHASES: return (y - 10) * 15 + 50;
    case CityTaskType.GOODS_ON_DISPLAY:    return (y - 10) * 30 + 100;
    case CityTaskType.CASH_COLLECTOR:      return (y - 10) * 50 + 150;
    case CityTaskType.CARRIER:             return (y - 10) * 25 + 100;
    case CityTaskType.VIP_CARRIER:         return (y - 10) * 5 + 10;
    case CityTaskType.EVICT_RESIDENTS:     return (y - 10) * 5 + 15;
    case CityTaskType.NEW_RESIDENTS:       return (y - 10) * 5 + 25;
    case CityTaskType.BUILD_FLOOR:         return 1;
    case CityTaskType.EASY_MONEY:          return 30;
  }
}

export function computeTaskDelta(
  before: DailyTaskProgress,
  after: DailyTaskProgress,
  beforeGems: number,
  afterGems: number,
): Record<CityTaskType, number> {
  const d = (a: number, b: number) => Math.max(0, a - b);
  return {
    [CityTaskType.WHOLESALE_PURCHASES]: d(after.goodsBought,      before.goodsBought),
    [CityTaskType.GOODS_ON_DISPLAY]:    d(after.goodsListed,      before.goodsListed),
    [CityTaskType.CASH_COLLECTOR]:      d(after.goodsCollected,   before.goodsCollected),
    [CityTaskType.CARRIER]:             d(after.visitorsLifted,   before.visitorsLifted),
    [CityTaskType.VIP_CARRIER]:         d(after.vipsLifted,       before.vipsLifted),
    [CityTaskType.EVICT_RESIDENTS]:     d(after.residentsEvicted, before.residentsEvicted),
    [CityTaskType.NEW_RESIDENTS]:       d(after.residentsAdded,   before.residentsAdded),
    [CityTaskType.BUILD_FLOOR]:         d(after.floorsStarted ?? 0, before.floorsStarted ?? 0),
    [CityTaskType.EASY_MONEY]:          d(afterGems,              beforeGems),
  } as Record<CityTaskType, number>;
}

export function todayUtcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function isWeekendUTC(): boolean {
  const day = new Date().getUTCDay(); // 0=Sun, 6=Sat
  return day === 0 || day === 6;
}

// Returns Monday 00:00 UTC of current week
export function currentWeekStart(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun ... 6=Sat
  const daysToMonday = day === 0 ? 6 : day - 1;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysToMonday));
}
