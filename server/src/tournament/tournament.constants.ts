export function isWeekdayUTC(): boolean {
  const day = new Date().getUTCDay(); // 0=Sun, 6=Sat
  return day >= 1 && day <= 5;
}

export const GEMS_BY_RANK: Record<number, number> = {
  1: 1000, 2: 900, 3: 800,
  4: 700,  5: 600, 6: 500,
  7: 400,  8: 300, 9: 200, 10: 100,
};

export const BONUS_TOKENS_BY_RANK: Record<number, number> = {
  1: 100, 2: 90, 3: 80,
  4: 70,  5: 60, 6: 50,
  7: 40,  8: 30, 9: 20, 10: 10,
};

export function levelBracket(playerLevel: number): number {
  return Math.floor((playerLevel - 1) / 10) + 1;
}

export function coinsReward(tokenCount: number, playerLevel: number): number {
  return tokenCount * levelBracket(playerLevel) * 1000;
}

const TOKEN_COLOR_KEYS = ['green', 'blue', 'yellow', 'purple', 'red'] as const;
export type TokenColor = typeof TOKEN_COLOR_KEYS[number];

export function generateRandomTokens(total: number): Record<TokenColor, number> {
  const result: Record<TokenColor, number> = { green: 0, blue: 0, yellow: 0, purple: 0, red: 0 };
  if (total <= 0) return result;
  let remaining = total;
  for (let i = 0; i < TOKEN_COLOR_KEYS.length - 1; i++) {
    const maxShare = remaining - (TOKEN_COLOR_KEYS.length - 1 - i);
    const share = Math.floor(Math.random() * (maxShare + 1));
    result[TOKEN_COLOR_KEYS[i]] = share;
    remaining -= share;
  }
  result[TOKEN_COLOR_KEYS[TOKEN_COLOR_KEYS.length - 1]] = remaining;
  return result;
}
