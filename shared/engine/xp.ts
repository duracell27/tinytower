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

export function xpForLevel(level: number): number {
  return Math.floor(120 * Math.pow(1.6, level - 1));
}

export function xpForCommand(
  cmdType: string,
  prevBalance: number,
  nextBalance: number,
): number {
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
    const gemReward = level * 3;
    bonusCoins += coinReward;
    bonusGems += gemReward;
    levelUpEvents.push({ newLevel: level, coinReward, gemReward });
  }

  return { playerLevel: level, playerXp: xp, bonusCoins, bonusGems, levelUpEvents };
}
