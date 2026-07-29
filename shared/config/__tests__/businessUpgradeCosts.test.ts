import { BUSINESS_UPGRADE_COSTS } from '../businessUpgradeCosts';

describe('BUSINESS_UPGRADE_COSTS', () => {
  it('has exactly 40 entries', () => {
    expect(BUSINESS_UPGRADE_COSTS).toHaveLength(40);
  });

  it('level 1 costs 1000 coins + 3 tokens', () => {
    const cost = BUSINESS_UPGRADE_COSTS[0];
    expect(cost.kind).toBe('coins');
    if (cost.kind === 'coins') {
      expect(cost.coins).toBe(1_000);
      expect(cost.tokens).toBe(3);
    }
  });

  it('level 5 (index 4) is a gem milestone with 50 gems', () => {
    const cost = BUSINESS_UPGRADE_COSTS[4];
    expect(cost.kind).toBe('gems');
    if (cost.kind === 'gems') expect(cost.gems).toBe(50);
  });

  it('level 40 (index 39) costs 5_000_000_000 coins + 200 tokens', () => {
    const cost = BUSINESS_UPGRADE_COSTS[39];
    expect(cost.kind).toBe('coins');
    if (cost.kind === 'coins') {
      expect(cost.coins).toBe(5_000_000_000);
      expect(cost.tokens).toBe(200);
    }
  });

  it('gem milestones are at indices 4, 8, 12, 16, 20, 24, 28, 32, 36', () => {
    const gemIndices = [4, 8, 12, 16, 20, 24, 28, 32, 36];
    gemIndices.forEach((i) => expect(BUSINESS_UPGRADE_COSTS[i].kind).toBe('gems'));
  });

  it('all non-gem entries have positive coins and tokens', () => {
    BUSINESS_UPGRADE_COSTS.forEach((cost, i) => {
      if (cost.kind === 'coins') {
        expect(cost.coins).toBeGreaterThan(0);
        expect(cost.tokens).toBeGreaterThan(0);
      }
    });
  });
});
