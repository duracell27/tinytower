import { xpForLevel, xpForCommand, applyXpGain } from '../xp';

describe('xpForLevel', () => {
  it('returns 120 for level 1', () => {
    expect(xpForLevel(1)).toBe(120);
  });

  it('returns 192 for level 2', () => {
    expect(xpForLevel(2)).toBe(192);
  });

  it('returns 307 for level 3', () => {
    expect(xpForLevel(3)).toBe(307);
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
    // xpForLevel(1) = 120, so 0 + 120 = exactly at threshold => level up
    const result = applyXpGain(1, 0, 120);
    expect(result.playerLevel).toBe(2);
    expect(result.playerXp).toBe(0);
    expect(result.bonusCoins).toBe(200); // newLevel * 100
    expect(result.bonusGems).toBe(2);    // newLevel * 1
    expect(result.levelUpEvents).toHaveLength(1);
    expect(result.levelUpEvents[0]).toEqual({ newLevel: 2, coinReward: 200, gemReward: 2 });
  });

  it('handles multiple level-ups in one batch', () => {
    // From level 1, gain enough XP to jump to level 3
    // xpForLevel(1) = 120, xpForLevel(2) = 192 → need 312 total
    const result = applyXpGain(1, 0, 320);
    expect(result.playerLevel).toBe(3);
    expect(result.levelUpEvents).toHaveLength(2);
  });

  it('carries over remaining XP after level-up', () => {
    // xpForLevel(1) = 120; gain 130 → level up, 10 XP left
    const result = applyXpGain(1, 0, 130);
    expect(result.playerLevel).toBe(2);
    expect(result.playerXp).toBe(10);
  });
});
