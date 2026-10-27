import { DAILY_LOGIN_REWARD_SCHEDULE, DAILY_LOGIN_BOOST_DURATION_MS } from '../dailyLoginRewardConfig';

describe('DAILY_LOGIN_REWARD_SCHEDULE', () => {
  it('has exactly 7 days', () => {
    expect(DAILY_LOGIN_REWARD_SCHEDULE).toHaveLength(7);
  });

  it('day 1 has no extra', () => {
    expect(DAILY_LOGIN_REWARD_SCHEDULE[0].extra).toBeNull();
  });

  it('day 1 starts at 1.5x coins multiplier', () => {
    expect(DAILY_LOGIN_REWARD_SCHEDULE[0].coinsMultiplier).toBe(1.5);
  });

  it('day 2 has 1 tool', () => {
    expect(DAILY_LOGIN_REWARD_SCHEDULE[1].extra).toEqual({ type: 'tool', count: 1 });
  });

  it('day 3 has 1 token', () => {
    expect(DAILY_LOGIN_REWARD_SCHEDULE[2].extra).toEqual({ type: 'token', count: 1 });
  });

  it('day 4 has xp boost 50%', () => {
    expect(DAILY_LOGIN_REWARD_SCHEDULE[3].extra).toMatchObject({ type: 'xpBoost', percent: 50 });
  });

  it('day 5 has 2 tools', () => {
    expect(DAILY_LOGIN_REWARD_SCHEDULE[4].extra).toEqual({ type: 'tool', count: 2 });
  });

  it('day 6 has coin boost 50%', () => {
    expect(DAILY_LOGIN_REWARD_SCHEDULE[5].extra).toMatchObject({ type: 'coinBoost', percent: 50 });
  });

  it('day 7 has coin boost 100%', () => {
    expect(DAILY_LOGIN_REWARD_SCHEDULE[6].extra).toMatchObject({ type: 'coinBoost', percent: 100 });
  });

  it('coins multiplier is non-decreasing each day', () => {
    for (let i = 1; i < DAILY_LOGIN_REWARD_SCHEDULE.length; i++) {
      expect(DAILY_LOGIN_REWARD_SCHEDULE[i].coinsMultiplier).toBeGreaterThanOrEqual(
        DAILY_LOGIN_REWARD_SCHEDULE[i - 1].coinsMultiplier,
      );
    }
  });

  it('boost duration is 1 hour', () => {
    expect(DAILY_LOGIN_BOOST_DURATION_MS).toBe(3_600_000);
  });

  it('boost entries reference the correct DAILY_LOGIN_BOOST_DURATION_MS', () => {
    const boostDays = DAILY_LOGIN_REWARD_SCHEDULE.filter(
      (d) => d.extra?.type === 'coinBoost' || d.extra?.type === 'xpBoost',
    );
    for (const day of boostDays) {
      expect((day.extra as { durationMs: number }).durationMs).toBe(DAILY_LOGIN_BOOST_DURATION_MS);
    }
  });
});
