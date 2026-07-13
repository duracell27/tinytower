import { detectOptimisticGrants } from '../detectOptimisticGrants';
import type { Stats } from '../../../shared/types';
import type { CategoryProgressState } from '../../../shared/types/achievements';

const base: Stats = { totalBought: 0, totalListed: 0, totalCollected: 0, totalPassengersLifted: 0 };

describe('detectOptimisticGrants', () => {
  it('returns [] when no threshold is crossed', () => {
    const result = detectOptimisticGrants(
      { ...base, totalBought: 5 },
      { ...base, totalBought: 6 },
      {},
      new Set(),
    );
    expect(result).toEqual([]);
  });

  it('fires buy level 1 when totalBought crosses 100', () => {
    const grants = detectOptimisticGrants(
      { ...base, totalBought: 99 },
      { ...base, totalBought: 100 },
      {},
      new Set(),
    );
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({ categoryKey: 'buy', level: 1, gems: 5 });
  });

  it('excludes levels already in categoryProgress.claimedLevels', () => {
    const progress: Record<string, CategoryProgressState> = {
      buy: { progress: 200, currentLevel: 1, claimedLevels: [1] },
    };
    const grants = detectOptimisticGrants(
      { ...base, totalBought: 99 },
      { ...base, totalBought: 100 },
      progress,
      new Set(),
    );
    expect(grants).toHaveLength(0);
  });

  it('excludes levels already in alreadyGranted', () => {
    const grants = detectOptimisticGrants(
      { ...base, totalBought: 99 },
      { ...base, totalBought: 100 },
      {},
      new Set(['buy-1']),
    );
    expect(grants).toHaveLength(0);
  });

  it('fires multiple levels when multiple thresholds crossed in one step', () => {
    // level 1 threshold = 100, level 2 threshold = 500
    const grants = detectOptimisticGrants(
      { ...base, totalBought: 99 },
      { ...base, totalBought: 500 },
      {},
      new Set(),
    );
    expect(grants.map((g) => g.level).sort()).toEqual([1, 2]);
  });

  it('does not re-fire a threshold oldStats already met', () => {
    const grants = detectOptimisticGrants(
      { ...base, totalBought: 100 },
      { ...base, totalBought: 101 },
      {},
      new Set(),
    );
    expect(grants).toHaveLength(0);
  });

  it('fires collect category independently', () => {
    const grants = detectOptimisticGrants(
      { ...base, totalCollected: 99 },
      { ...base, totalCollected: 100 },
      {},
      new Set(),
    );
    expect(grants).toHaveLength(1);
    expect(grants[0].categoryKey).toBe('collect');
  });
});
