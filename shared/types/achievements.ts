export type AchievementCategoryConfig = {
  key: string;
  title: string;
  stat: 'totalBought' | 'totalListed' | 'totalCollected' | 'totalPassengersLifted';
  levels: { level: number; title: string; threshold: number }[];
};

export type NewAchievementGrant = {
  categoryKey: string;
  level: number;
  title: string;
  categoryTitle: string;
  gems: number;
  incomeBonus: number;
  xpBonus: number;
};

export type CategoryProgressState = {
  progress: number;
  currentLevel: number;
  claimedLevels: number[];
};
