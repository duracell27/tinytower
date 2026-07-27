import { DAILY_TASKS, getCoinMultiplier, getMaterialCount, getTaskProgress } from '../dailyTasksConfig';
import type { GameState } from '../../types';

const baseState = {
  dailyGemsCollected: 0,
  dailyTasks: {
    progress: {
      visitorsLifted: 0, vipsLifted: 0, goodsBought: 0, residentsAdded: 0,
      gemsPurchased: 0, goodsCollected: 0, floorsBuilt: 0, residentsEvicted: 0, goodsListed: 0,
    },
    claimed: [],
    doubleRewardActive: false,
  },
} as unknown as GameState;

describe('DAILY_TASKS', () => {
  it('has 11 tasks', () => {
    expect(DAILY_TASKS).toHaveLength(11);
  });

  it('major_investor threshold is 1000', () => {
    expect(DAILY_TASKS.find(t => t.key === 'major_investor')?.threshold).toBe(1000);
  });

  it('investor gems reward is 100', () => {
    expect(DAILY_TASKS.find(t => t.key === 'investor')?.rewards.gems).toBe(100);
  });

  it('only build_floor has hasMaterials true', () => {
    const withMaterials = DAILY_TASKS.filter(t => t.rewards.hasMaterials);
    expect(withMaterials).toHaveLength(1);
    expect(withMaterials[0].key).toBe('build_floor');
  });
});

describe('getCoinMultiplier', () => {
  it('returns 1 for level 1', () => expect(getCoinMultiplier(1)).toBe(1));
  it('returns 1 for level 10', () => expect(getCoinMultiplier(10)).toBe(1));
  it('returns 3 for level 11', () => expect(getCoinMultiplier(11)).toBe(3));
  it('returns 3 for level 20', () => expect(getCoinMultiplier(20)).toBe(3));
  it('returns 6 for level 25', () => expect(getCoinMultiplier(25)).toBe(6));
  it('returns 6 for level 30', () => expect(getCoinMultiplier(30)).toBe(6));
  it('returns 12 for level 40', () => expect(getCoinMultiplier(40)).toBe(12));
  it('returns 20 for level 50', () => expect(getCoinMultiplier(50)).toBe(20));
  it('returns 35 for level 51', () => expect(getCoinMultiplier(51)).toBe(35));
});

describe('getMaterialCount', () => {
  it('returns 2 for level 5', () => expect(getMaterialCount(5)).toBe(2));
  it('returns 4 for level 25', () => expect(getMaterialCount(25)).toBe(4));
  it('returns 6 for level 50', () => expect(getMaterialCount(50)).toBe(6));
  it('returns 8 for level 70', () => expect(getMaterialCount(70)).toBe(8));
});

describe('getTaskProgress', () => {
  it('reads dailyGemsCollected for easy_money', () => {
    const s = { ...baseState, dailyGemsCollected: 7 };
    const task = DAILY_TASKS.find(t => t.key === 'easy_money')!;
    expect(getTaskProgress(s, task)).toBe(7);
  });

  it('reads progress field for transporter', () => {
    const s = { ...baseState, dailyTasks: { ...baseState.dailyTasks, progress: { ...baseState.dailyTasks.progress, visitorsLifted: 55 } } };
    const task = DAILY_TASKS.find(t => t.key === 'transporter')!;
    expect(getTaskProgress(s, task)).toBe(55);
  });
});
