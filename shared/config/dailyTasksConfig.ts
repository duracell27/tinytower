import type { GameState } from '../types';

export type DailyTaskKey =
  | 'transporter' | 'vip_transporter' | 'wholesale' | 'new_residents'
  | 'easy_money' | 'investor' | 'money_collector' | 'build_floor'
  | 'major_investor' | 'hasta_la_vista' | 'goods_to_sell';

export type DailyTaskProgressKey = keyof GameState['dailyTasks']['progress'];

export type DailyTaskConfig = {
  key: DailyTaskKey;
  title: string;
  description: string;
  progressSource: DailyTaskProgressKey | 'dailyGemsCollected';
  threshold: number;
  hidden?: boolean;
  rewards: {
    baseCoins: number;
    gems: number;
    hasMaterials: boolean;
  };
};

export const DAILY_TASKS: DailyTaskConfig[] = [
  { key: 'transporter',     title: 'Transporter',            description: 'Lift 100 visitors in the elevator',        progressSource: 'visitorsLifted',    threshold: 100,  rewards: { baseCoins: 1300, gems: 1,   hasMaterials: false } },
  { key: 'vip_transporter', title: 'VIP-Transporter',        description: 'Lift 10 VIP guests in the elevator',       progressSource: 'vipsLifted',         threshold: 10,   rewards: { baseCoins: 1600, gems: 2,   hasMaterials: false } },
  { key: 'wholesale',       title: 'Wholesale purchase',     description: 'Buy 50 products in the market',            progressSource: 'goodsBought',        threshold: 50,   rewards: { baseCoins: 1100, gems: 1,   hasMaterials: false } },
  { key: 'new_residents',   title: 'New residents',          description: 'Welcome 25 new residents to your hotel',   progressSource: 'residentsAdded',     threshold: 25,   rewards: { baseCoins: 1600, gems: 1,   hasMaterials: false } },
  { key: 'easy_money',      title: 'Easy money',             description: 'Collect 10 gems from elevator visitors',   progressSource: 'dailyGemsCollected', threshold: 10,   rewards: { baseCoins: 1300, gems: 1,   hasMaterials: false } },
  { key: 'investor',        title: 'Investor',               description: 'Purchase 200 gems in the store',           progressSource: 'gemsPurchased',      threshold: 200,  rewards: { baseCoins: 1300, gems: 100, hasMaterials: false } },
  { key: 'money_collector', title: 'Money Collector',        description: 'Collect 150 products from your businesses', progressSource: 'goodsCollected',    threshold: 150,  rewards: { baseCoins: 1100, gems: 1,   hasMaterials: false } },
  { key: 'build_floor',     title: 'Higher and higher!',     description: 'Build 1 new floor in your tower',          progressSource: 'floorsBuilt',        threshold: 1,    rewards: { baseCoins: 1600, gems: 5,   hasMaterials: true  } },
  { key: 'major_investor',  title: 'Major investor',         description: 'Purchase 1,000 gems in the store',         progressSource: 'gemsPurchased',      threshold: 1000, rewards: { baseCoins: 3200, gems: 200, hasMaterials: false } },
  { key: 'hasta_la_vista',  title: 'Hasta la vista, Baby!', description: 'Evict 15 residents from your hotel',       progressSource: 'residentsEvicted',   threshold: 15,   rewards: { baseCoins: 1300, gems: 1,   hasMaterials: false } },
  { key: 'goods_to_sell',   title: 'Goods to sell',         description: 'Sell 100 products for sale',               progressSource: 'goodsListed',        threshold: 100,  rewards: { baseCoins: 1100, gems: 1,   hasMaterials: false } },
];

export function getCoinMultiplier(playerLevel: number): number {
  if (playerLevel <= 10) return 1;
  if (playerLevel <= 20) return 3;
  if (playerLevel <= 30) return 6;
  if (playerLevel <= 40) return 12;
  if (playerLevel <= 50) return 20;
  return 35;
}

export function getMaterialCount(playerLevel: number): number {
  if (playerLevel <= 10) return 2;
  if (playerLevel <= 20) return 3;
  if (playerLevel <= 30) return 4;
  if (playerLevel <= 40) return 5;
  if (playerLevel <= 50) return 6;
  if (playerLevel <= 60) return 7;
  return 8;
}

export function getTaskProgress(
  state: Pick<GameState, 'dailyGemsCollected' | 'dailyTasks'>,
  task: DailyTaskConfig,
): number {
  if (task.progressSource === 'dailyGemsCollected') return state.dailyGemsCollected;
  return state.dailyTasks.progress[task.progressSource as DailyTaskProgressKey] ?? 0;
}
