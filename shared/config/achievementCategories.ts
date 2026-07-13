import type { AchievementCategoryConfig } from '../types/achievements';

// Index = level (index 0 is unused, levels are 1–7)
export const ACHIEVEMENT_GEM_REWARDS  = [0,   5,  10,  20,  35,   60,  100, 200];
export const ACHIEVEMENT_INCOME_BONUS = [0,   0,   0,   0,   1,    1,    1,   2];
export const ACHIEVEMENT_XP_BONUS     = [0,   0,   0,   0,   1,    1,    1,   2];

const BASE_THRESHOLDS     = [0, 100, 500, 2_500, 10_000, 50_000, 250_000, 1_000_000];
const ELEVATOR_THRESHOLDS = [0, 100, 2_500, 25_000, 250_000, 1_000_000, 2_500_000, 5_000_000];

export const ACHIEVEMENT_CATEGORIES: AchievementCategoryConfig[] = [
  {
    key: 'buy',
    title: 'Purchasing',
    stat: 'totalBought',
    levels: [
      { level: 1, title: 'Beginner',       threshold: BASE_THRESHOLDS[1] },
      { level: 2, title: 'Buyer',          threshold: BASE_THRESHOLDS[2] },
      { level: 3, title: 'Supplier',       threshold: BASE_THRESHOLDS[3] },
      { level: 4, title: 'Wholesaler',     threshold: BASE_THRESHOLDS[4] },
      { level: 5, title: 'Importer',       threshold: BASE_THRESHOLDS[5] },
      { level: 6, title: 'Tycoon',         threshold: BASE_THRESHOLDS[6] },
      { level: 7, title: 'Purchase King',  threshold: BASE_THRESHOLDS[7] },
    ],
  },
  {
    key: 'list',
    title: 'Stocking Shelves',
    stat: 'totalListed',
    levels: [
      { level: 1, title: 'Intern',         threshold: BASE_THRESHOLDS[1] },
      { level: 2, title: 'Salesperson',    threshold: BASE_THRESHOLDS[2] },
      { level: 3, title: 'Consultant',     threshold: BASE_THRESHOLDS[3] },
      { level: 4, title: 'Manager',        threshold: BASE_THRESHOLDS[4] },
      { level: 5, title: 'Director',       threshold: BASE_THRESHOLDS[5] },
      { level: 6, title: 'Top Manager',    threshold: BASE_THRESHOLDS[6] },
      { level: 7, title: 'Shelf Legend',   threshold: BASE_THRESHOLDS[7] },
    ],
  },
  {
    key: 'collect',
    title: 'Collecting Coins',
    stat: 'totalCollected',
    levels: [
      { level: 1, title: 'Collector',      threshold: BASE_THRESHOLDS[1] },
      { level: 2, title: 'Cashier',        threshold: BASE_THRESHOLDS[2] },
      { level: 3, title: 'Accountant',     threshold: BASE_THRESHOLDS[3] },
      { level: 4, title: 'Financier',      threshold: BASE_THRESHOLDS[4] },
      { level: 5, title: 'Banker',         threshold: BASE_THRESHOLDS[5] },
      { level: 6, title: 'Investor',       threshold: BASE_THRESHOLDS[6] },
      { level: 7, title: 'Billionaire',    threshold: BASE_THRESHOLDS[7] },
    ],
  },
  {
    key: 'elevator',
    title: 'Elevator Service',
    stat: 'totalPassengersLifted',
    levels: [
      { level: 1, title: 'Newcomer',       threshold: ELEVATOR_THRESHOLDS[1] },
      { level: 2, title: 'Elevator Boy',   threshold: ELEVATOR_THRESHOLDS[2] },
      { level: 3, title: 'Doorman',        threshold: ELEVATOR_THRESHOLDS[3] },
      { level: 4, title: 'Dispatcher',     threshold: ELEVATOR_THRESHOLDS[4] },
      { level: 5, title: 'Engineer',       threshold: ELEVATOR_THRESHOLDS[5] },
      { level: 6, title: 'Lift Master',    threshold: ELEVATOR_THRESHOLDS[6] },
      { level: 7, title: 'Elevator King',  threshold: ELEVATOR_THRESHOLDS[7] },
    ],
  },
];
