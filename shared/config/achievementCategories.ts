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
    title: 'Закупівля товару',
    stat: 'totalBought',
    levels: [
      { level: 1, title: 'Початківець',    threshold: BASE_THRESHOLDS[1] },
      { level: 2, title: 'Закупник',       threshold: BASE_THRESHOLDS[2] },
      { level: 3, title: 'Постачальник',   threshold: BASE_THRESHOLDS[3] },
      { level: 4, title: 'Оптовик',        threshold: BASE_THRESHOLDS[4] },
      { level: 5, title: 'Імпортер',       threshold: BASE_THRESHOLDS[5] },
      { level: 6, title: 'Магнат',         threshold: BASE_THRESHOLDS[6] },
      { level: 7, title: 'Король закупок', threshold: BASE_THRESHOLDS[7] },
    ],
  },
  {
    key: 'list',
    title: 'Викладка товару',
    stat: 'totalListed',
    levels: [
      { level: 1, title: 'Стажер',         threshold: BASE_THRESHOLDS[1] },
      { level: 2, title: 'Продавець',      threshold: BASE_THRESHOLDS[2] },
      { level: 3, title: 'Консультант',    threshold: BASE_THRESHOLDS[3] },
      { level: 4, title: 'Менеджер',       threshold: BASE_THRESHOLDS[4] },
      { level: 5, title: 'Директор',       threshold: BASE_THRESHOLDS[5] },
      { level: 6, title: 'Топ-менеджер',   threshold: BASE_THRESHOLDS[6] },
      { level: 7, title: 'Легенда полиць', threshold: BASE_THRESHOLDS[7] },
    ],
  },
  {
    key: 'collect',
    title: 'Збір монет',
    stat: 'totalCollected',
    levels: [
      { level: 1, title: 'Збирач',         threshold: BASE_THRESHOLDS[1] },
      { level: 2, title: 'Касир',          threshold: BASE_THRESHOLDS[2] },
      { level: 3, title: 'Бухгалтер',      threshold: BASE_THRESHOLDS[3] },
      { level: 4, title: 'Фінансист',      threshold: BASE_THRESHOLDS[4] },
      { level: 5, title: 'Банкір',         threshold: BASE_THRESHOLDS[5] },
      { level: 6, title: 'Інвестор',       threshold: BASE_THRESHOLDS[6] },
      { level: 7, title: 'Мільярдер',      threshold: BASE_THRESHOLDS[7] },
    ],
  },
  {
    key: 'elevator',
    title: 'Перевезення людей ліфтом',
    stat: 'totalPassengersLifted',
    levels: [
      { level: 1, title: 'Новачок',         threshold: ELEVATOR_THRESHOLDS[1] },
      { level: 2, title: 'Ліфтер',          threshold: ELEVATOR_THRESHOLDS[2] },
      { level: 3, title: 'Швейцар',         threshold: ELEVATOR_THRESHOLDS[3] },
      { level: 4, title: 'Диспетчер',       threshold: ELEVATOR_THRESHOLDS[4] },
      { level: 5, title: 'Інженер',         threshold: ELEVATOR_THRESHOLDS[5] },
      { level: 6, title: 'Майстер ліфтів',  threshold: ELEVATOR_THRESHOLDS[6] },
      { level: 7, title: 'Король ліфтів',   threshold: ELEVATOR_THRESHOLDS[7] },
    ],
  },
];
