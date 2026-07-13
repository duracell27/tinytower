import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_GEM_REWARDS,
  ACHIEVEMENT_INCOME_BONUS,
  ACHIEVEMENT_XP_BONUS,
} from '@shared/config/achievementCategories';
import type { NewAchievementGrant } from '@shared/types/achievements';

@Injectable()
export class AchievementService {
  async incrementProgress(
    tx: Prisma.TransactionClient,
    playerId: string,
    categoryKey: string,
    amount: number,
  ): Promise<{
    newGrants: NewAchievementGrant[];
    gemsToAdd: number;
    coinBonusDelta: number;
    xpBonusDelta: number;
  }> {
    const category = ACHIEVEMENT_CATEGORIES.find(c => c.key === categoryKey);
    if (!category) {
      return { newGrants: [], gemsToAdd: 0, coinBonusDelta: 0, xpBonusDelta: 0 };
    }

    // Upsert: increment progress and read the resulting row
    const current = await tx.playerCategoryProgress.upsert({
      where: { playerId_categoryKey: { playerId, categoryKey } },
      create: { playerId, categoryKey, progress: amount, currentLevel: 0, claimedLevels: [] },
      update: { progress: { increment: amount } },
    });

    const { progress, claimedLevels } = current;
    const claimedSet = new Set<number>(claimedLevels as number[]);

    const newGrants: NewAchievementGrant[] = [];
    let gemsToAdd = 0;
    let coinBonusDelta = 0;
    let xpBonusDelta = 0;
    let maxNewLevel = current.currentLevel as number;

    for (const levelConfig of category.levels) {
      const { level, title, threshold } = levelConfig;
      if (progress >= threshold && !claimedSet.has(level)) {
        const gems = ACHIEVEMENT_GEM_REWARDS[level] ?? 0;
        const incomeBonus = ACHIEVEMENT_INCOME_BONUS[level] ?? 0;
        const xpBonus = ACHIEVEMENT_XP_BONUS[level] ?? 0;

        newGrants.push({
          categoryKey,
          level,
          title,
          categoryTitle: category.title,
          gems,
          incomeBonus,
          xpBonus,
        });

        gemsToAdd += gems;
        coinBonusDelta += incomeBonus;
        xpBonusDelta += xpBonus;
        claimedSet.add(level);
        if (level > maxNewLevel) maxNewLevel = level;
      }
    }

    if (newGrants.length > 0) {
      await tx.playerCategoryProgress.update({
        where: { playerId_categoryKey: { playerId, categoryKey } },
        data: {
          currentLevel: maxNewLevel,
          claimedLevels: Array.from(claimedSet).sort((a, b) => a - b),
        },
      });
    }

    return { newGrants, gemsToAdd, coinBonusDelta, xpBonusDelta };
  }
}
