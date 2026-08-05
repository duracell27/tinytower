# Achievement System v2 — Design Spec

**Date:** 2026-07-13
**Replaces:** `2026-07-06-achievement-stats-design.md` (old 3-category, 3-tier system)

---

## Overview

Replace the existing achievement system with a new one: 4 categories, 7 levels each, gem rewards per level, and permanent income/XP bonus percentages from levels 4–7. The bonus percentages feed into a global `coinBonusPercent` / `xpBonusPercent` player parameter that will also receive contributions from future systems (in-game purchases, etc.).

---

## What Is Removed

- `PlayerAchievement` DB model
- `AchievementConfigSchema`, `AchievementTierSchema`, `AchievementRewardSchema` in `shared/schemas/gameConfig.ts`
- `achievements` array in `GameConfigSchema` and `gameConfig.ts`
- `AchievementGrant`, `AchievementConfig`, `AchievementTierConfig`, `AchievementReward` types
- Old achievement check block in `sync.service.ts`

---

## Database Changes

### New model: `PlayerCategoryProgress`

```prisma
model PlayerCategoryProgress {
  playerId      String
  categoryKey   String     // "buy" | "list" | "collect" | "elevator"
  progress      Int        @default(0)
  currentLevel  Int        @default(0)   // 0 = no level earned yet
  claimedLevels Int[]      @default([])  // levels whose reward has been issued
  updatedAt     DateTime   @updatedAt
  player        Player     @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@id([playerId, categoryKey])
  @@index([playerId])
}
```

### `Player` model changes

```prisma
// rename totalSold → totalCollected (migration: ALTER COLUMN)
totalCollected        Int  @default(0)
// new field
totalPassengersLifted Int  @default(0)
// relation
categoryProgress PlayerCategoryProgress[]
```

### `PlayerState` model changes

```prisma
coinBonusPercent  Int  @default(0)
xpBonusPercent    Int  @default(0)
```

---

## Configuration (`shared/config/achievementCategories.ts`)

Single source of truth — all numbers, titles, and thresholds live here.

```ts
export const ACHIEVEMENT_GEM_REWARDS    = [0, 5, 10, 20, 35, 60, 100, 200]; // index = level
export const ACHIEVEMENT_INCOME_BONUS   = [0, 0, 0, 0, 1, 1, 1, 2];         // % per level
export const ACHIEVEMENT_XP_BONUS       = [0, 0, 0, 0, 1, 1, 1, 2];         // % per level

const BASE_THRESHOLDS = [0, 100, 500, 2_500, 10_000, 50_000, 250_000, 1_000_000];

const ELEVATOR_THRESHOLDS = [0, 100, 2_500, 25_000, 250_000, 1_000_000, 2_500_000, 5_000_000];

export const ACHIEVEMENT_CATEGORIES: AchievementCategoryConfig[] = [
  {
    key: 'buy',
    title: 'Закупівля товару',
    stat: 'totalBought',
    levels: [
      { level: 1, title: 'Початківець',    threshold: BASE_THRESHOLDS[1] },
      { level: 2, title: 'Закупник',       threshold: BASE_THRESHOLDS[2] },
      { level: 3, title: 'Постачальник',   threshold: BASE_THRESHOLDS[3] },
      { level: 4, title: 'Оптовик',        threshold: BASE_THRESHOLDS[4] },
      { level: 5, title: 'Імпортер',       threshold: BASE_THRESHOLDS[5] },
      { level: 6, title: 'Магнат',         threshold: BASE_THRESHOLDS[6] },
      { level: 7, title: 'Король закупок', threshold: BASE_THRESHOLDS[7] },
    ],
  },
  {
    key: 'list',
    title: 'Викладка товару',
    stat: 'totalListed',
    levels: [
      { level: 1, title: 'Стажер',         threshold: BASE_THRESHOLDS[1] },
      { level: 2, title: 'Продавець',      threshold: BASE_THRESHOLDS[2] },
      { level: 3, title: 'Консультант',    threshold: BASE_THRESHOLDS[3] },
      { level: 4, title: 'Менеджер',       threshold: BASE_THRESHOLDS[4] },
      { level: 5, title: 'Директор',       threshold: BASE_THRESHOLDS[5] },
      { level: 6, title: 'Топ-менеджер',   threshold: BASE_THRESHOLDS[6] },
      { level: 7, title: 'Легенда полиць', threshold: BASE_THRESHOLDS[7] },
    ],
  },
  {
    key: 'collect',
    title: 'Збір монет',
    stat: 'totalCollected',
    levels: [
      { level: 1, title: 'Збирач',         threshold: BASE_THRESHOLDS[1] },
      { level: 2, title: 'Касир',          threshold: BASE_THRESHOLDS[2] },
      { level: 3, title: 'Бухгалтер',      threshold: BASE_THRESHOLDS[3] },
      { level: 4, title: 'Фінансист',      threshold: BASE_THRESHOLDS[4] },
      { level: 5, title: 'Банкір',         threshold: BASE_THRESHOLDS[5] },
      { level: 6, title: 'Інвестор',       threshold: BASE_THRESHOLDS[6] },
      { level: 7, title: 'Мільярдер',      threshold: BASE_THRESHOLDS[7] },
    ],
  },
  {
    key: 'elevator',
    title: 'Перевезення людей ліфтом',
    stat: 'totalPassengersLifted',
    levels: [
      { level: 1, title: 'Новачок',         threshold: ELEVATOR_THRESHOLDS[1] },
      { level: 2, title: 'Ліфтер',          threshold: ELEVATOR_THRESHOLDS[2] },
      { level: 3, title: 'Швейцар',         threshold: ELEVATOR_THRESHOLDS[3] },
      { level: 4, title: 'Диспетчер',       threshold: ELEVATOR_THRESHOLDS[4] },
      { level: 5, title: 'Інженер',         threshold: ELEVATOR_THRESHOLDS[5] },
      { level: 6, title: 'Майстер ліфтів',  threshold: ELEVATOR_THRESHOLDS[6] },
      { level: 7, title: 'Король ліфтів',   threshold: ELEVATOR_THRESHOLDS[7] },
    ],
  },
];
```

---

## Types (`shared/types/achievements.ts`)

```ts
export type AchievementCategoryConfig = {
  key: string;
  title: string;
  stat: 'totalBought' | 'totalListed' | 'totalCollected' | 'totalPassengersLifted';
  levels: { level: number; title: string; threshold: number }[];
};

export type NewAchievementGrant = {
  categoryKey: string;
  level: number;
  title: string;
  categoryTitle: string;
  gems: number;
  incomeBonus: number;   // % from this level (0, 1, or 2)
  xpBonus: number;
};

export type CategoryProgressState = {
  progress: number;
  currentLevel: number;
  claimedLevels: number[];
};
```

---

## Shared Schema Changes

### `shared/schemas/gameState.ts`

```ts
export const StatsSchema = z.object({
  totalBought:           z.number().int().nonnegative().default(0),
  totalListed:           z.number().int().nonnegative().default(0),
  totalCollected:        z.number().int().nonnegative().default(0), // renamed from totalSold
  totalPassengersLifted: z.number().int().nonnegative().default(0),
});

// GameStateSchema additions:
coinBonusPercent: z.number().int().nonnegative().default(0),
xpBonusPercent:   z.number().int().nonnegative().default(0),
```

---

## Engine Changes (`shared/engine/`)

### `processCommand.ts` — new optional param

```ts
export function processCommand(
  state: GameState,
  command: Command,
  config: GameConfig,
  now: number,
  playerLevel: number,
  bonuses: { coinPercent: number; xpPercent: number } = { coinPercent: 0, xpPercent: 0 },
): ProcessResult
```

### Production collect formula (`productionCommands.ts`)

The current `getRevenueMultiplier` returns a combined multiplier (e.g. `1.27` for a 27% specialist bonus). We extract the percentage part: `specialistBonusPercent = (multiplier - 1) * 100`.

```ts
// Current (to be replaced):
const multiplier = getRevenueMultiplier(worker, floorType, typeId);  // e.g. 1.27
const revenue = Math.floor(typeConfig.batchValue * multiplier * (1 + specialistBonus));

// New:
const workerMultiplier      = getWorkerMultiplier(worker, floorType, typeId);   // 1x / 1.3x / 2x
const specialistBonusPercent = getSpecialistBonusPercent(worker, floorType, typeId); // e.g. 27

const coinMultiplier = 1 + (bonuses.coinPercent + specialistBonusPercent) / 100;
const revenue = Math.floor(typeConfig.batchValue * coinMultiplier * workerMultiplier);

const xpMultiplier = 1 + bonuses.xpPercent / 100;
const xpGained = Math.floor(typeConfig.batchValue * xpMultiplier * workerMultiplier);
```

`ProcessResult` gains an optional `xpGained?: number` field. The collect handler sets it. `sync.service.ts` uses `result.xpGained` instead of calling `xpForCommand` for collect commands. Non-collect commands keep the existing `xpForCommand(coinDelta)` logic.

`getWorkerMultiplier` and `getSpecialistBonusPercent` are split out from the existing `getRevenueMultiplier` helper.

### Passenger delivery tracking (`shared/engine/lobbyCommands.ts`)

In `handleLiftVisitor`, when `elevatorFloor + move >= visitor.targetFloor` (delivery occurs):

```ts
stats: { ...state.stats, totalPassengersLifted: state.stats.totalPassengersLifted + 1 }
```

Sync.service.ts computes delta: `after.stats.totalPassengersLifted - before.stats.totalPassengersLifted`.

---

## Server: Achievement Service (`server/src/achievement/`)

### `achievement.service.ts`

```ts
async incrementProgress(
  tx: PrismaTransactionClient,
  playerId: string,
  categoryKey: string,
  amount: number,
): Promise<{
  newGrants: NewAchievementGrant[];
  gemsToAdd: number;
  coinBonusDelta: number;
  xpBonusDelta: number;
}>
```

Logic:
1. `upsert` `PlayerCategoryProgress` to increment `progress`
2. Get category config from `ACHIEVEMENT_CATEGORIES`
3. For each level 1–7: if `progress >= threshold` and level not in `claimedLevels` → new grant
4. Update `currentLevel` (max newly reached), add to `claimedLevels`
5. Sum `gemsToAdd`, `coinBonusDelta`, `xpBonusDelta` from `ACHIEVEMENT_GEM_REWARDS` / `ACHIEVEMENT_INCOME_BONUS` / `ACHIEVEMENT_XP_BONUS`
6. Return grants list

One `upsert` + one `update` per category per sync call. Runs inside the existing transaction.

### Integration in `sync.service.ts`

Replace the old achievement block with:

```ts
const collectCount    = acceptedCommands.filter(c => c.type === 'collect').length;
const passengersCount = gameStateAfter.stats.totalPassengersLifted
                      - gameStateBefore.stats.totalPassengersLifted;

let coinBonusDelta = 0, xpBonusDelta = 0;
const allNewGrants: NewAchievementGrant[] = [];

const categoryDeltas: [string, number][] = [
  ['buy',      boughtCount],
  ['list',     listedCount],
  ['collect',  collectCount],
  ['elevator', passengersCount],
];
for (const [key, amount] of categoryDeltas) {
  if (amount === 0) continue;
  const r = await achievementService.incrementProgress(tx, playerId, key, amount);
  gameState = { ...gameState, gems: gameState.gems + r.gemsToAdd };
  coinBonusDelta += r.coinBonusDelta;
  xpBonusDelta   += r.xpBonusDelta;
  allNewGrants.push(...r.newGrants);
}

if (coinBonusDelta > 0 || xpBonusDelta > 0) {
  await tx.playerState.update({
    where: { playerId },
    data: {
      coinBonusPercent: { increment: coinBonusDelta },
      xpBonusPercent:   { increment: xpBonusDelta },
    },
  });
}
```

`SyncResult` gains:
```ts
newAchievements:  NewAchievementGrant[];
coinBonusPercent: number;
xpBonusPercent:   number;
categoryProgress: Record<string, CategoryProgressState>;  // all 4 categories, keyed by categoryKey
```

Server populates `categoryProgress` by reading `PlayerCategoryProgress` rows for this player after the transaction (one query, 4 rows max).

---

## Client Changes

### `gameStore.ts`

New state fields:
```ts
coinBonusPercent: number;  // default 0
xpBonusPercent:   number;  // default 0
categoryProgress: Record<string, CategoryProgressState>;  // keyed by categoryKey
```

Updated after sync:
```ts
set({
  coinBonusPercent: result.coinBonusPercent,
  xpBonusPercent:   result.xpBonusPercent,
});
// push newAchievements into achievementQueue
```

### `processCommand` calls (client)

```ts
processCommand(state, cmd, gameConfig, timestamp, playerLevel, {
  coinPercent: useGameStore.getState().coinBonusPercent,
  xpPercent:   useGameStore.getState().xpBonusPercent,
})
```

### `AchievementModal.tsx`

Show income/XP bonus lines only for levels 4–7 (`grant.incomeBonus > 0`):

```tsx
{grant.incomeBonus > 0 && <Text>+{grant.incomeBonus}% до монет</Text>}
{grant.xpBonus     > 0 && <Text>+{grant.xpBonus}% до досвіду</Text>}
```

### `ProductionCard.tsx`

```ts
const coinBonus = useGameStore(s => s.coinBonusPercent);
// adjustedValue = batchValue * (1 + (coinBonus + specialistBonus%) / 100)
// shown as the "base" value; worker multiplier shown separately as ×N
```

### New screen `app/(tabs)/achievements.tsx`

Accessible from `profile.tsx` via a button showing count of earned levels (sum of `currentLevel` across all categories). Screen shows all 4 categories with:
- Icon for current level (0–7, shared visual language)
- Current title, progress number, progress bar
- Next level reward (gems + bonuses if level ≥ 4)
- "Максимальний рівень досягнуто" when `currentLevel === 7`

Category progress is loaded from `categoryProgress` in the store, which is populated from the sync response.

---

## Reward Summary

| Level | Gems | Income bonus | XP bonus | Cumulative income | Cumulative XP |
|-------|-----:|-------------:|---------:|------------------:|--------------:|
| 1     |    5 |           0% |       0% |                0% |            0% |
| 2     |   10 |           0% |       0% |                0% |            0% |
| 3     |   20 |           0% |       0% |                0% |            0% |
| 4     |   35 |          +1% |      +1% |               +1% |           +1% |
| 5     |   60 |          +1% |      +1% |               +2% |           +2% |
| 6     |  100 |          +1% |      +1% |               +3% |           +3% |
| 7     |  200 |          +2% |      +2% |               +5% |           +5% |

One fully completed category: 430 gems, +5% income, +5% XP.
All 4 categories completed: 1 720 gems, +20% income, +20% XP.

---

## Migration Notes

- `totalSold` column in `Player` → `ALTER COLUMN ... RENAME TO totalCollected`
- All references to `totalSold` in sync.service.ts, gameState schema, store, and tests must be updated
- `PlayerAchievement` table → `DROP TABLE` after confirming no rollback needed
- `categoryProgress` in store starts empty; populated on first sync after deploy
- `coinBonusPercent` / `xpBonusPercent` default to 0 for all existing players — no retroactive recalculation of past achievements (clean start for v2)
