export interface FloorStarMultiplier {
  value: number;
  time:  number;
  cost:  number;
}

// Index = star count. Index 0 = no upgrade (base values).
export const FLOOR_STAR_MULTIPLIERS: FloorStarMultiplier[] = [
  { value: 1,   time: 1,   cost: 1   }, // 0★
  { value: 2,   time: 1.5, cost: 1.5 }, // 1★
  { value: 3,   time: 2,   cost: 2   }, // 2★
  { value: 4,   time: 2.5, cost: 2.5 }, // 3★
  { value: 6,   time: 3,   cost: 3   }, // 4★
  { value: 8,   time: 4,   cost: 4   }, // 5★
];

// Index = current star count (0 → buys 1st star, 4 → buys 5th star).
export const FLOOR_UPGRADE_COSTS = [
  { gems: 10, tokens: 1 }, // 0★ → 1★
  { gems: 20, tokens: 2 }, // 1★ → 2★
  { gems: 30, tokens: 3 }, // 2★ → 3★
  { gems: 50, tokens: 4 }, // 3★ → 4★
  { gems: 80, tokens: 5 }, // 4★ → 5★
];
