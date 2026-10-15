import {
  isWeekdayUTC,
  GEMS_BY_RANK,
  BONUS_TOKENS_BY_RANK,
  levelBracket,
  coinsReward,
  generateRandomTokens,
} from '../tournament.constants';

describe('isWeekdayUTC', () => {
  it('returns true on Monday (day 1)', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-12T10:00:00Z')); // Monday
    expect(isWeekdayUTC()).toBe(true);
  });
  it('returns true on Friday (day 5)', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-16T10:00:00Z')); // Friday
    expect(isWeekdayUTC()).toBe(true);
  });
  it('returns false on Saturday (day 6)', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-17T10:00:00Z')); // Saturday
    expect(isWeekdayUTC()).toBe(false);
  });
  it('returns false on Sunday (day 0)', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-18T10:00:00Z')); // Sunday
    expect(isWeekdayUTC()).toBe(false);
  });
  afterEach(() => jest.useRealTimers());
});

describe('GEMS_BY_RANK', () => {
  it('rank 1 = 1000, rank 10 = 100', () => {
    expect(GEMS_BY_RANK[1]).toBe(1000);
    expect(GEMS_BY_RANK[10]).toBe(100);
  });
  it('rank 5 = 600', () => {
    expect(GEMS_BY_RANK[5]).toBe(600);
  });
  it('has no entry for rank 11', () => {
    expect(GEMS_BY_RANK[11]).toBeUndefined();
  });
});

describe('BONUS_TOKENS_BY_RANK', () => {
  it('rank 1 = 100, rank 10 = 10', () => {
    expect(BONUS_TOKENS_BY_RANK[1]).toBe(100);
    expect(BONUS_TOKENS_BY_RANK[10]).toBe(10);
  });
});

describe('levelBracket', () => {
  it('level 1 → bracket 1', () => expect(levelBracket(1)).toBe(1));
  it('level 10 → bracket 1', () => expect(levelBracket(10)).toBe(1));
  it('level 11 → bracket 2', () => expect(levelBracket(11)).toBe(2));
  it('level 20 → bracket 2', () => expect(levelBracket(20)).toBe(2));
  it('level 21 → bracket 3', () => expect(levelBracket(21)).toBe(3));
});

describe('coinsReward', () => {
  it('10 tokens at level 5 → 10_000', () => expect(coinsReward(10, 5)).toBe(10_000));
  it('10 tokens at level 15 → 20_000', () => expect(coinsReward(10, 15)).toBe(20_000));
  it('0 tokens → 0', () => expect(coinsReward(0, 50)).toBe(0));
});

describe('generateRandomTokens', () => {
  it('sums to the requested total', () => {
    for (const total of [0, 10, 50, 100]) {
      const result = generateRandomTokens(total);
      const sum = (Object.values(result) as number[]).reduce((a, b) => a + b, 0);
      expect(sum).toBe(total);
    }
  });
  it('all values are non-negative', () => {
    const result = generateRandomTokens(30);
    Object.values(result).forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
  });
});
