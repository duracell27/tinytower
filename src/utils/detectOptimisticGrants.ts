import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_GEM_REWARDS,
  ACHIEVEMENT_INCOME_BONUS,
  ACHIEVEMENT_XP_BONUS,
} from '../../shared/config/achievementCategories';
import type { Stats } from '../../shared/types';
import type { CategoryProgressState, NewAchievementGrant } from '../../shared/types/achievements';

export function detectOptimisticGrants(
  oldStats: Stats,
  newStats: Stats,
  categoryProgress: Record<string, CategoryProgressState>,
  alreadyGranted: Set<string>,
): NewAchievementGrant[] {
  const grants: NewAchievementGrant[] = [];

  for (const category of ACHIEVEMENT_CATEGORIES) {
    const oldProgress = oldStats[category.stat];
    const newProgress = newStats[category.stat];
    if (newProgress <= oldProgress) continue;

    const claimed = new Set<number>(categoryProgress[category.key]?.claimedLevels ?? []);

    for (const { level, threshold, title } of category.levels) {
      const key = `${category.key}-${level}`;
      if (newProgress >= threshold && oldProgress < threshold && !claimed.has(level) && !alreadyGranted.has(key)) {
        grants.push({
          categoryKey: category.key,
          level,
          title,
          categoryTitle: category.title,
          gems: ACHIEVEMENT_GEM_REWARDS[level] ?? 0,
          incomeBonus: ACHIEVEMENT_INCOME_BONUS[level] ?? 0,
          xpBonus: ACHIEVEMENT_XP_BONUS[level] ?? 0,
        });
      }
    }
  }

  return grants;
}
