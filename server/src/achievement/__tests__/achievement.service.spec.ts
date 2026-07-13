import { AchievementService } from '../achievement.service';
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_GEM_REWARDS,
  ACHIEVEMENT_INCOME_BONUS,
  ACHIEVEMENT_XP_BONUS,
} from '@shared/config/achievementCategories';

function makeTx(overrides: Partial<{
  findUnique: jest.Mock;
  upsert: jest.Mock;
  update: jest.Mock;
}> = {}) {
  return {
    playerCategoryProgress: {
      findUnique: overrides.findUnique ?? jest.fn(),
      upsert: overrides.upsert ?? jest.fn(),
      update: overrides.update ?? jest.fn(),
    },
  } as any;
}

describe('AchievementService.incrementProgress', () => {
  let service: AchievementService;

  beforeEach(() => {
    service = new AchievementService();
  });

  it('returns no grants when threshold not yet reached', async () => {
    const tx = makeTx({
      upsert: jest.fn().mockResolvedValue({
        progress: 50,
        currentLevel: 0,
        claimedLevels: [],
      }),
      update: jest.fn().mockResolvedValue({}),
    });

    const result = await service.incrementProgress(tx, 'player1', 'buy', 50);
    expect(result.newGrants).toHaveLength(0);
    expect(result.gemsToAdd).toBe(0);
    expect(result.coinBonusDelta).toBe(0);
    expect(result.xpBonusDelta).toBe(0);
  });

  it('awards level 1 when progress crosses 100 threshold', async () => {
    const tx = makeTx({
      upsert: jest.fn().mockResolvedValue({
        progress: 100,
        currentLevel: 0,
        claimedLevels: [],
      }),
      update: jest.fn().mockResolvedValue({}),
    });

    const result = await service.incrementProgress(tx, 'player1', 'buy', 100);
    expect(result.newGrants).toHaveLength(1);
    expect(result.newGrants[0].level).toBe(1);
    expect(result.newGrants[0].gems).toBe(ACHIEVEMENT_GEM_REWARDS[1]); // 5
    expect(result.newGrants[0].incomeBonus).toBe(ACHIEVEMENT_INCOME_BONUS[1]); // 0
    expect(result.gemsToAdd).toBe(5);
    expect(result.coinBonusDelta).toBe(0);
  });

  it('awards multiple levels when progress jumps across several thresholds', async () => {
    // progress was 90, now becomes 3000 → should unlock levels 1, 2, 3
    const tx = makeTx({
      upsert: jest.fn().mockResolvedValue({
        progress: 3000,
        currentLevel: 0,
        claimedLevels: [],
      }),
      update: jest.fn().mockResolvedValue({}),
    });

    const result = await service.incrementProgress(tx, 'player1', 'buy', 2910);
    expect(result.newGrants).toHaveLength(3);
    expect(result.newGrants.map(g => g.level)).toEqual([1, 2, 3]);
    expect(result.gemsToAdd).toBe(5 + 10 + 20); // 35
    expect(result.coinBonusDelta).toBe(0); // levels 1-3 give no income bonus
  });

  it('awards income and xp bonus for level 4', async () => {
    const tx = makeTx({
      upsert: jest.fn().mockResolvedValue({
        progress: 10_000,
        currentLevel: 3,
        claimedLevels: [1, 2, 3],
      }),
      update: jest.fn().mockResolvedValue({}),
    });

    const result = await service.incrementProgress(tx, 'player1', 'buy', 0);
    expect(result.newGrants).toHaveLength(1);
    expect(result.newGrants[0].level).toBe(4);
    expect(result.newGrants[0].incomeBonus).toBe(1);
    expect(result.newGrants[0].xpBonus).toBe(1);
    expect(result.gemsToAdd).toBe(ACHIEVEMENT_GEM_REWARDS[4]); // 35
    expect(result.coinBonusDelta).toBe(1);
    expect(result.xpBonusDelta).toBe(1);
  });

  it('does not re-award already claimed levels', async () => {
    const tx = makeTx({
      upsert: jest.fn().mockResolvedValue({
        progress: 3000,
        currentLevel: 2,
        claimedLevels: [1, 2],
      }),
      update: jest.fn().mockResolvedValue({}),
    });

    const result = await service.incrementProgress(tx, 'player1', 'buy', 500);
    // progress=3000 >= threshold[3]=2500, levels 1 and 2 already claimed
    expect(result.newGrants).toHaveLength(1);
    expect(result.newGrants[0].level).toBe(3);
  });

  it('calls tx.playerCategoryProgress.update with new claimedLevels and currentLevel', async () => {
    const mockUpdate = jest.fn().mockResolvedValue({});
    const tx = makeTx({
      upsert: jest.fn().mockResolvedValue({
        progress: 100,
        currentLevel: 0,
        claimedLevels: [],
      }),
      update: mockUpdate,
    });

    await service.incrementProgress(tx, 'player1', 'buy', 100);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { playerId_categoryKey: { playerId: 'player1', categoryKey: 'buy' } },
      data: {
        currentLevel: 1,
        claimedLevels: [1],
      },
    });
  });
});
