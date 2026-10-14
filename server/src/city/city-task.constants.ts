import { CityTaskType } from '@prisma/client';
import type { DailyTaskProgress } from '../../../shared/types';

export const TICKETS_TO_GEMS_RATE = 2; // 1 ticket = 2 gems

export const PLACEMENT_BONUSES: Record<number, number> = {
  1: 2000, 2: 1900, 3: 1800,
  4: 1600, 5: 1500, 6: 1400,
  7: 1300, 8: 1200, 9: 1100, 10: 1000,
};

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
