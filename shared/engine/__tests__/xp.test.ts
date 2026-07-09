import { xpForLevel, xpForCommand, applyXpGain, MAX_LEVEL } from '../xp';

describe('xpForLevel', () => {
  it('returns 130 for level 1 (reach level 2)', () => {
    expect(xpForLevel(1)).toBe(130);
  });

  it('returns 140 for level 2 (reach level 3)', () => {
    expect(xpForLevel(2)).toBe(140);
  });

  it('returns 1000 for level 6 (reach level 7)', () => {
    expect(xpForLevel(6)).toBe(1_000);
  });

  it('returns 5000 * G for level 99 (reach level 100)', () => {
    expect(xpForLevel(99)).toBe(5_000 * 1_000_000_000);
  });

  it('returns Infinity for MAX_LEVEL (no further levelling)', () => {
    expect(xpForLevel(MAX_LEVEL)).toBe(Infinity);
    expect(xpForLevel(MAX_LEVEL + 5)).toBe(Infinity);
  });

  it('MAX_LEVEL is 100', () => {
    expect(MAX_LEVEL).toBe(100);
  });
});

describe('xpForCommand', () => {
  it('returns abs coin delta for non-list commands', () => {
    expect(xpForCommand('collect', 100, 125)).toBe(25);
    expect(xpForCommand('buy', 100, 90)).toBe(10);
  });

  it('adds 10 bonus for list command', () => {
    expect(xpForCommand('list', 100, 100)).toBe(10);
    expect(xpForCommand('list', 100, 110)).toBe(20);
  });

  it('buy_floor always gives 0 XP regardless of cost', () => {
    expect(xpForCommand('buy_floor', 500, 200, 10, 10)).toBe(0);
    expect(xpForCommand('buy_floor', 500, 500, 10, 7)).toBe(0);
    expect(xpForCommand('buy_floor', 1000, 700, 10, 7)).toBe(0);
  });

  it('exchange_gems always gives 0 XP regardless of coins gained', () => {
    expect(xpForCommand('exchange_gems', 0, 1000)).toBe(0);
    expect(xpForCommand('exchange_gems', 500, 3500)).toBe(0);
  });

  it('speed_up_construction always gives 0 XP', () => {
    expect(xpForCommand('speed_up_construction', 500, 500)).toBe(0);
    expect(xpForCommand('speed_up_construction', 500, 200)).toBe(0);
  });
});

describe('applyXpGain', () => {
  it('accumulates XP without levelling up', () => {
    const result = applyXpGain(1, 50, 30);
    expect(result.playerLevel).toBe(1);
    expect(result.playerXp).toBe(80);
    expect(result.bonusCoins).toBe(0);
    expect(result.bonusGems).toBe(0);
    expect(result.levelUpEvents).toHaveLength(0);
  });

  it('triggers level-up when XP reaches threshold', () => {
    // xpForLevel(1) = 130
    const result = applyXpGain(1, 0, 130);
    expect(result.playerLevel).toBe(2);
    expect(result.playerXp).toBe(0);
    expect(result.bonusCoins).toBe(200); // newLevel * 100
    expect(result.bonusGems).toBe(2);    // newLevel * 1
    expect(result.levelUpEvents).toHaveLength(1);
    expect(result.levelUpEvents[0]).toEqual({ newLevel: 2, coinReward: 200, gemReward: 2 });
  });

  it('handles multiple level-ups in one batch', () => {
    // xpForLevel(1) = 130, xpForLevel(2) = 140 → need 270 to reach level 3
    const result = applyXpGain(1, 0, 275);
    expect(result.playerLevel).toBe(3);
    expect(result.playerXp).toBe(5);
    expect(result.levelUpEvents).toHaveLength(2);
  });

  it('carries over remaining XP after level-up', () => {
    // xpForLevel(1) = 130; gain 145 → level up, 15 XP left
    const result = applyXpGain(1, 0, 145);
    expect(result.playerLevel).toBe(2);
    expect(result.playerXp).toBe(15);
  });

  it('stops levelling up at MAX_LEVEL', () => {
    const result = applyXpGain(99, 0, 999_999_999_999_999);
    expect(result.playerLevel).toBe(100);
    expect(result.levelUpEvents).toHaveLength(1);
  });
});
