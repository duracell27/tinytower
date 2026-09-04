export interface BoostPackage {
  id:         string;
  boostType:  'coin' | 'xp';
  percent:    number;
  durationMs: number;
  gemCost:    number;
}

const DURATION_MS = 30 * 60 * 60 * 1000; // 30 hours

export const BOOST_PACKAGES: BoostPackage[] = [
  { id: 'coin_50',  boostType: 'coin', percent: 50,  durationMs: DURATION_MS, gemCost: 0 },
  { id: 'coin_100', boostType: 'coin', percent: 100, durationMs: DURATION_MS, gemCost: 0 },
  { id: 'coin_200', boostType: 'coin', percent: 200, durationMs: DURATION_MS, gemCost: 0 },
  { id: 'coin_300', boostType: 'coin', percent: 300, durationMs: DURATION_MS, gemCost: 0 },
  { id: 'xp_50',   boostType: 'xp',   percent: 50,  durationMs: DURATION_MS, gemCost: 0 },
  { id: 'xp_100',  boostType: 'xp',   percent: 100, durationMs: DURATION_MS, gemCost: 0 },
  { id: 'xp_200',  boostType: 'xp',   percent: 200, durationMs: DURATION_MS, gemCost: 0 },
  { id: 'xp_300',  boostType: 'xp',   percent: 300, durationMs: DURATION_MS, gemCost: 0 },
];
