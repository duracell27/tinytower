import { CityTaskType } from '@prisma/client';
import type { DailyTaskProgress } from '../../../shared/types';

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
