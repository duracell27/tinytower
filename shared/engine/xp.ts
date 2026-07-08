export interface LevelUpEvent {
  newLevel: number;
  coinReward: number;
  gemReward: number;
}

export interface XpResult {
  playerLevel: number;
  playerXp: number;
  bonusCoins: number;
  bonusGems: number;
  levelUpEvents: LevelUpEvent[];
}

const G = 1_000_000_000;
const M = 1_000_000;
const K = 1_000;

// XP_TABLE[i] = XP required to advance from level (i+1) to level (i+2).
// Index 0 → level 1 → 2, index 98 → level 99 → 100.
const XP_TABLE: number[] = [
  130, 140, 150, 300, 500,                              // 1–5
  1*K, 2*K, 3*K, 5*K, 8*K,                             // 6–10
  13*K, 21*K, 34*K, 55*K, 89*K,                        // 11–15
  144*K, 233*K, 377*K, 610*K, 987*K,                   // 16–20
  1.59*M, 2.58*M, 4.18*M, 6.76*M, 10.94*M,            // 21–25
  17.71*M, 28.65*M, 46.36*M, 75.02*M, 121.39*M,       // 26–30
  196.41*M, 317.81*M, 514.22*M, 832.04*M, 1*G,        // 31–35
  1.2*G, 1.44*G, 1.72*G, 2*G, 2.40*G,                 // 36–40
  2.88*G, 3.45*G, 4.14*G, 5*G, 6*G,                   // 41–45
  7.20*G, 8.64*G, 10.36*G, 12.44*G, 14.92*G,          // 46–50
  17.92*G, 21.49*G, 25.8*G, 30.95*G, 37.16*G,         // 51–55
  44.58*G, 53.5*G, 64.2*G, 75.29*G, 80*G,             // 56–60
  96*G, 115.2*G, 138.67*G, 165.88*G, 199.06*G,        // 61–65
  238.87*G, 286.65*G, 343.98*G, 347*G, 350*G,         // 66–70
  385*G, 423.5*G, 465.85*G, 500*G, 500*G,             // 71–75
  500*G, 500*G, 500*G, 555*G, 555*G,                  // 76–80
  555*G, 555*G, 555*G, 777*G, 777*G,                  // 81–85
  777*G, 777*G, 777*G, 1000*G, 1000*G,                // 86–90
  1000*G, 1000*G, 1000*G, 1500*G, 2500*G,             // 91–95
  2500*G, 2500*G, 2500*G, 5000*G,                     // 96–99
];

export const MAX_LEVEL = 100;

export function xpForLevel(level: number): number {
  if (level >= MAX_LEVEL) return Infinity;
  return Math.round(XP_TABLE[level - 1] ?? Infinity);
}

export function xpForCommand(
  cmdType: string,
  prevBalance: number,
  nextBalance: number,
  prevGems: number = 0,
  nextGems: number = 0,
): number {
  if (cmdType === 'buy_floor') return 0;
  const coinDelta = Math.abs(nextBalance - prevBalance);
  const listBonus = cmdType === 'list' ? 10 : 0;
  return coinDelta + listBonus;
}

export function applyXpGain(
  playerLevel: number,
  playerXp: number,
  xpGained: number,
): XpResult {
  let level = playerLevel;
  let xp = playerXp + xpGained;
  let bonusCoins = 0;
  let bonusGems = 0;
  const levelUpEvents: LevelUpEvent[] = [];

  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level++;
    const coinReward = level * 100;
    const gemReward = level * 1;
    bonusCoins += coinReward;
    bonusGems += gemReward;
    levelUpEvents.push({ newLevel: level, coinReward, gemReward });
  }

  return { playerLevel: level, playerXp: xp, bonusCoins, bonusGems, levelUpEvents };
}
