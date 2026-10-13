import { CityTaskType } from '@prisma/client';
import { calcRequiredCount, computeTaskDelta, ALL_TASK_TYPES } from '../city-task.constants';

describe('calcRequiredCount', () => {
  it('returns BASE at city level 10', () => {
    expect(calcRequiredCount(CityTaskType.WHOLESALE_PURCHASES, 10)).toBe(50);
    expect(calcRequiredCount(CityTaskType.GOODS_ON_DISPLAY, 10)).toBe(100);
    expect(calcRequiredCount(CityTaskType.CASH_COLLECTOR, 10)).toBe(150);
    expect(calcRequiredCount(CityTaskType.CARRIER, 10)).toBe(100);
    expect(calcRequiredCount(CityTaskType.VIP_CARRIER, 10)).toBe(10);
    expect(calcRequiredCount(CityTaskType.EVICT_RESIDENTS, 10)).toBe(15);
    expect(calcRequiredCount(CityTaskType.NEW_RESIDENTS, 10)).toBe(25);
    expect(calcRequiredCount(CityTaskType.BUILD_FLOOR, 10)).toBe(1);
    expect(calcRequiredCount(CityTaskType.EASY_MONEY, 10)).toBe(30);
  });

  it('clamps below level 10 to level 10 BASE', () => {
    expect(calcRequiredCount(CityTaskType.WHOLESALE_PURCHASES, 5)).toBe(50);
  });

  it('caps at level 50 for variable tasks', () => {
    expect(calcRequiredCount(CityTaskType.WHOLESALE_PURCHASES, 50)).toBe(650);
    expect(calcRequiredCount(CityTaskType.WHOLESALE_PURCHASES, 99)).toBe(650);
  });

  it('stable tasks ignore city level', () => {
    expect(calcRequiredCount(CityTaskType.BUILD_FLOOR, 99)).toBe(1);
    expect(calcRequiredCount(CityTaskType.EASY_MONEY, 99)).toBe(30);
  });
});

describe('computeTaskDelta', () => {
  const zero = {
    visitorsLifted: 0, vipsLifted: 0, goodsBought: 0, residentsAdded: 0,
    gemsPurchased: 0, goodsCollected: 0, floorsBuilt: 0, residentsEvicted: 0, goodsListed: 0,
  };

  it('computes correct increments', () => {
    const before = { ...zero, goodsBought: 3, visitorsLifted: 2, vipsLifted: 1 };
    const after  = { ...zero, goodsBought: 4, visitorsLifted: 5, vipsLifted: 2 };
    const delta = computeTaskDelta(before, after, 0, 2);
    expect(delta[CityTaskType.WHOLESALE_PURCHASES]).toBe(1);
    expect(delta[CityTaskType.CARRIER]).toBe(3);
    expect(delta[CityTaskType.VIP_CARRIER]).toBe(1);
    expect(delta[CityTaskType.EASY_MONEY]).toBe(2);
  });

  it('clamps negative deltas to 0 (daily reset edge case)', () => {
    const before = { ...zero, goodsBought: 5 };
    const after  = { ...zero, goodsBought: 0 };
    const delta = computeTaskDelta(before, after, 0, 0);
    expect(delta[CityTaskType.WHOLESALE_PURCHASES]).toBe(0);
  });

  it('ALL_TASK_TYPES contains exactly 9 entries', () => {
    expect(ALL_TASK_TYPES.length).toBe(9);
  });
});
