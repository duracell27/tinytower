export const DAILY_LOGIN_BOOST_DURATION_MS = 3_600_000; // 1 hour

export type DailyLoginExtra =
  | { type: 'tool'; count: number }
  | { type: 'token'; count: number }
  | { type: 'coinBoost'; percent: 50 | 100; durationMs: number }
  | { type: 'xpBoost'; percent: 50 | 100; durationMs: number }
  | null;

export interface DailyLoginDayConfig {
  coinsMultiplier: number;
  gems: number;
  extra: DailyLoginExtra;
}

export const DAILY_LOGIN_REWARD_SCHEDULE: DailyLoginDayConfig[] = [
  { coinsMultiplier: 1.0,  gems: 2, extra: null },
  { coinsMultiplier: 1.15, gems: 2, extra: { type: 'tool', count: 1 } },
  { coinsMultiplier: 1.3,  gems: 2, extra: { type: 'token', count: 1 } },
  { coinsMultiplier: 1.5,  gems: 3, extra: { type: 'xpBoost', percent: 50, durationMs: DAILY_LOGIN_BOOST_DURATION_MS } },
  { coinsMultiplier: 1.65, gems: 3, extra: { type: 'tool', count: 2 } },
  { coinsMultiplier: 1.8,  gems: 3, extra: { type: 'coinBoost', percent: 50, durationMs: DAILY_LOGIN_BOOST_DURATION_MS } },
  { coinsMultiplier: 2.0,  gems: 4, extra: { type: 'coinBoost', percent: 100, durationMs: DAILY_LOGIN_BOOST_DURATION_MS } },
];
