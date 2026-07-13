# Achievement System v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old 3-category/3-tier achievement system with a new 4-category/7-level system that awards gems and permanent income/XP bonus percentages, stored in a global `coinBonusPercent`/`xpBonusPercent` player parameter.

**Architecture:** A new `PlayerCategoryProgress` DB model tracks per-category progress and claimed levels. A new `AchievementService` runs inside the sync transaction, awards gems and increments bonus percentages in `PlayerState`. The engine's collect formula is updated to apply `coinBonusPercent`+`xpBonusPercent` from game state before the worker multiplier. Passenger deliveries are tracked via `totalPassengersLifted` in `Stats`.

**Tech Stack:** NestJS, Prisma (PostgreSQL), Zod, TypeScript, React Native (Expo Router), Zustand.

## Global Constraints

- All achievement numbers (gem rewards, thresholds, level titles, bonus percentages) live exclusively in `shared/config/achievementCategories.ts` — no hardcoded values elsewhere.
- Server is the sole authority for awarding gems and bonus percentages — client never self-awards.
- Rewards are idempotent: `claimedLevels[]` prevents double-awarding.
- All DB writes for a sync happen in a single Prisma transaction.
- `collect_tip` = 1 passenger delivered; `deliver_all` = N passengers (all lobby visitors).
- Collect XP formula: `floor(batchValue * (1 + xpBonusPercent/100) * workerMultiplier)`.
- Collect coin formula: `floor(batchValue * (1 + (coinBonusPercent + specialistBonusPercent)/100) * workerMultiplier)`.
- `specialistBonusPercent` = `round(getFloorSpecialistBonus(workers, floorId) * 100)` (e.g., 3 specialists = 27).
- The new `bonuses` param to `processCommand` defaults to `{ coinPercent: 0, xpPercent: 0 }` (backwards-compatible).
- Server test command: `cd server && npm test`.
- Shared/root test command (from repo root): `npm test`.

---

## File Map

### New files
- `shared/config/achievementCategories.ts` — category config, thresholds, rewards
- `shared/types/achievements.ts` — `AchievementCategoryConfig`, `NewAchievementGrant`, `CategoryProgressState`
- `server/src/achievement/achievement.service.ts` — `incrementProgress` logic
- `server/src/achievement/achievement.module.ts` — NestJS module
- `server/src/achievement/__tests__/achievement.service.spec.ts` — unit tests
- `app/(tabs)/achievements.tsx` — achievements screen

### Modified files
- `server/prisma/schema.prisma` — drop `PlayerAchievement`, add `PlayerCategoryProgress`, new `PlayerState`/`Player` fields
- `shared/schemas/gameConfig.ts` — remove old achievement schemas
- `shared/config/gameConfig.ts` — remove `achievements` from config and `GameConfigSchema`
- `shared/types/index.ts` — remove old achievement types, add imports for new ones
- `shared/schemas/gameState.ts` — `StatsSchema` (rename `totalSold`→`totalCollected`, add `totalPassengersLifted`), `GameStateSchema` (add `coinBonusPercent`, `xpBonusPercent`)
- `shared/engine/processCommand.ts` — add `bonuses` param, add `xpGained` to `ProcessResult`, update `handleCollect`
- `shared/engine/lobbyCommands.ts` — increment `totalPassengersLifted` in `handleCollectTip` and `handleDeliverAll`
- `shared/engine/__tests__/processCommand.test.ts` — rename `totalSold`→`totalCollected`, add bonus formula tests
- `shared/engine/__tests__/lobbyCommands.test.ts` — add passenger tracking tests
- `server/src/sync/sync.service.ts` — integrate `AchievementService`, update `SyncResult`, update `dbToGameState`
- `server/src/sync/sync.module.ts` — import `AchievementModule`
- `src/stores/gameStore.ts` — add `coinBonusPercent`, `xpBonusPercent`, `categoryProgress`; update `executeCommand` to use `result.xpGained`
- `src/components/AchievementModal.tsx` — show `incomeBonus`/`xpBonus` lines
- `src/components/ProductionCard.tsx` — display adjusted coin value with bonuses
- `app/(tabs)/profile.tsx` — achievements button with level count

---

### Task 1: DB migration — drop old table, add new models and fields

**Files:**
- Modify: `server/prisma/schema.prisma`

**Interfaces:**
- Produces: `PlayerCategoryProgress` model; `PlayerState.coinBonusPercent`, `PlayerState.xpBonusPercent`; `Player.totalCollected` (renamed from `totalSold`), `Player.totalPassengersLifted`

- [ ] **Step 1: Update schema.prisma**

Open `server/prisma/schema.prisma`. Make these changes:

**Remove** the entire `PlayerAchievement` model (lines 132–142).

**Remove** `achievements PlayerAchievement[]` from the `Player` model (line 31).

**Add** to `Player` model (after `totalSold` line):
```prisma
totalCollected        Int                 @default(0)
totalPassengersLifted Int                 @default(0)
categoryProgress      PlayerCategoryProgress[]
```
**Remove** `totalSold Int @default(0)` from `Player` (it is replaced by `totalCollected`).

**Add** to `PlayerState` model (after `lastDailyReset` line):
```prisma
coinBonusPercent  Int  @default(0)
xpBonusPercent    Int  @default(0)
```

**Add** new model at the end of the file:
```prisma
model PlayerCategoryProgress {
  playerId      String
  categoryKey   String
  progress      Int        @default(0)
  currentLevel  Int        @default(0)
  claimedLevels Int[]      @default([])
  updatedAt     DateTime   @updatedAt
  player        Player     @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@id([playerId, categoryKey])
  @@index([playerId])
}
```

- [ ] **Step 2: Generate and run migration**

```bash
cd server
npx prisma migrate dev --name achievement_v2
```

Expected output: `The following migration(s) have been applied:` followed by the migration name. The migration file will be generated automatically.

- [ ] **Step 3: Verify schema**

```bash
npx prisma studio
```

Check that `PlayerCategoryProgress` table exists, `PlayerAchievement` is gone, `Player` has `totalCollected` and `totalPassengersLifted`, `PlayerState` has `coinBonusPercent` and `xpBonusPercent`. Then close Prisma Studio.

- [ ] **Step 4: Commit**

```bash
cd server
git add prisma/
git commit -m "feat(db): achievement v2 migration — drop PlayerAchievement, add PlayerCategoryProgress"
```

---

### Task 2: Remove old achievement system from shared code

**Files:**
- Modify: `shared/schemas/gameConfig.ts`
- Modify: `shared/config/gameConfig.ts`
- Modify: `shared/types/index.ts`

**Interfaces:**
- Produces: `GameConfig` no longer has `achievements`; old types removed

- [ ] **Step 1: Remove schemas from `shared/schemas/gameConfig.ts`**

Delete these three exports (lines 52–67):
```ts
export const AchievementRewardSchema = z.object({ ... });
export const AchievementTierSchema = z.object({ ... });
export const AchievementConfigSchema = z.object({ ... });
```

In `GameConfigSchema`, remove the line:
```ts
achievements: z.array(AchievementConfigSchema).default([]),
```

- [ ] **Step 2: Remove from `shared/config/gameConfig.ts`**

Remove the named imports of the three achievement schemas from the top import line.

Delete the `achievements: [ ... ]` array (lines 145–180) from the `rawConfig` object.

- [ ] **Step 3: Clean up `shared/types/index.ts`**

Remove from the import line at line 4:
```ts
AchievementConfigSchema, AchievementTierSchema, AchievementRewardSchema
```

Remove these four type exports (lines 44–52):
```ts
export type AchievementConfig = z.infer<typeof AchievementConfigSchema>;
export type AchievementTierConfig = z.infer<typeof AchievementTierSchema>;
export type AchievementReward = z.infer<typeof AchievementRewardSchema>;

export interface AchievementGrant {
  achievementId: string;
  tier: number;
  reward: { coins?: number; gems?: number };
}
```

- [ ] **Step 4: Update test config in `shared/engine/__tests__/processCommand.test.ts`**

Remove `achievements: [],` from the `testConfig` object (line 56). The field no longer exists on `GameConfig`.

- [ ] **Step 5: Run shared tests to confirm no type errors**

```bash
npm test -- --testPathPattern="shared/engine/__tests__/processCommand"
```

Expected: all existing tests pass (the `achievements` field removal causes no functional change).

- [ ] **Step 6: Commit**

```bash
git add shared/
git commit -m "feat: remove old achievement system from shared schemas and config"
```

---

### Task 3: New shared achievement config and types

**Files:**
- Create: `shared/config/achievementCategories.ts`
- Create: `shared/types/achievements.ts`

**Interfaces:**
- Produces:
  - `ACHIEVEMENT_CATEGORIES: AchievementCategoryConfig[]`
  - `ACHIEVEMENT_GEM_REWARDS: number[]` (index = level, 0 = unused)
  - `ACHIEVEMENT_INCOME_BONUS: number[]`
  - `ACHIEVEMENT_XP_BONUS: number[]`
  - `NewAchievementGrant`, `CategoryProgressState`, `AchievementCategoryConfig`

- [ ] **Step 1: Create `shared/types/achievements.ts`**

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
  incomeBonus: number;
  xpBonus: number;
};

export type CategoryProgressState = {
  progress: number;
  currentLevel: number;
  claimedLevels: number[];
};
```

- [ ] **Step 2: Create `shared/config/achievementCategories.ts`**

```ts
import type { AchievementCategoryConfig } from '../types/achievements';

// Index = level (index 0 is unused, levels are 1–7)
export const ACHIEVEMENT_GEM_REWARDS  = [0,   5,  10,  20,  35,   60,  100, 200];
export const ACHIEVEMENT_INCOME_BONUS = [0,   0,   0,   0,   1,    1,    1,   2];
export const ACHIEVEMENT_XP_BONUS     = [0,   0,   0,   0,   1,    1,    1,   2];

const BASE_THRESHOLDS     = [0, 100, 500, 2_500, 10_000, 50_000, 250_000, 1_000_000];
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

- [ ] **Step 3: Verify import resolves**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep achievementCategories
```

Expected: no output (no errors for these files).

- [ ] **Step 4: Commit**

```bash
git add shared/config/achievementCategories.ts shared/types/achievements.ts
git commit -m "feat: add achievement categories config and types"
```

---

### Task 4: Update GameState and Stats schemas

**Files:**
- Modify: `shared/schemas/gameState.ts`
- Modify: `shared/config/gameConfig.ts` (`createInitialState`)
- Modify: `shared/engine/__tests__/processCommand.test.ts`
- Modify: `shared/engine/__tests__/lobbyCommands.test.ts`

**Interfaces:**
- Produces:
  - `Stats.totalCollected` (was `totalSold`)
  - `Stats.totalPassengersLifted`
  - `GameState.coinBonusPercent`
  - `GameState.xpBonusPercent`

- [ ] **Step 1: Update `StatsSchema` in `shared/schemas/gameState.ts`**

Replace the existing `StatsSchema`:
```ts
export const StatsSchema = z.object({
  totalBought:           z.number().int().nonnegative().default(0),
  totalListed:           z.number().int().nonnegative().default(0),
  totalCollected:        z.number().int().nonnegative().default(0),
  totalPassengersLifted: z.number().int().nonnegative().default(0),
});
```

Add to `GameStateSchema` (after `stats` line):
```ts
coinBonusPercent: z.number().int().nonnegative().default(0),
xpBonusPercent:   z.number().int().nonnegative().default(0),
```

- [ ] **Step 2: Update `createInitialState` in `shared/config/gameConfig.ts`**

Inside the returned object, the `stats` field needs updating and new top-level fields added:

```ts
stats: {
  totalBought: 0,
  totalListed: 0,
  totalCollected: 0,
  totalPassengersLifted: 0,
},
coinBonusPercent: 0,
xpBonusPercent: 0,
```

- [ ] **Step 3: Write failing tests for renamed stat**

In `shared/engine/__tests__/processCommand.test.ts`, find all `totalSold` references (lines ~556–599) and rename them to `totalCollected`. Also update the default stats objects in test states:

```ts
// Before (example):
stats: { totalBought: 0, totalListed: 0, totalSold: 7 },

// After:
stats: { totalBought: 0, totalListed: 0, totalCollected: 7, totalPassengersLifted: 0 },
```

The test at line 584 (`'increments totalSold on successful collect'`) becomes:
```ts
it('increments totalCollected on successful collect', () => {
  const state: GameState = {
    ...createInitialState(testConfig),
    balance: 1000,
    stats: { totalBought: 0, totalListed: 0, totalCollected: 7, totalPassengersLifted: 0 },
    // ... rest of state setup
  };
  // ... collect command
  expect(result.state.stats.totalCollected).toBe(8);
  expect(result.state.stats.totalBought).toBe(0);
  expect(result.state.stats.totalListed).toBe(0);
});
```

Update ALL other test objects that include `totalSold` — search with: `grep -n totalSold shared/engine/__tests__/processCommand.test.ts`

- [ ] **Step 4: Run tests to verify they fail for the right reason**

```bash
npm test -- --testPathPattern="shared/engine/__tests__/processCommand"
```

Expected: TypeScript errors about `totalSold` not existing on `Stats`, or test assertion failures. This confirms the rename is needed.

- [ ] **Step 5: Update lobbyCommands test state objects**

In `shared/engine/__tests__/lobbyCommands.test.ts`, find any `stats` objects and update them:

```bash
grep -n "totalSold\|stats:" shared/engine/__tests__/lobbyCommands.test.ts
```

Update each to include the new shape:
```ts
stats: { totalBought: 0, totalListed: 0, totalCollected: 0, totalPassengersLifted: 0 },
```

- [ ] **Step 6: Run all shared tests**

```bash
npm test -- --testPathPattern="shared/"
```

Expected: all pass. TypeScript should now resolve `totalCollected` correctly.

- [ ] **Step 7: Commit**

```bash
git add shared/
git commit -m "feat: update Stats schema — rename totalSold→totalCollected, add totalPassengersLifted and bonus percent fields"
```

---

### Task 5: Engine — update collect formula with bonuses and xpGained

**Files:**
- Modify: `shared/engine/processCommand.ts`
- Modify: `shared/engine/__tests__/processCommand.test.ts`

**Interfaces:**
- Consumes: `getFloorSpecialistBonus` from `workerUtils.ts` (already imported)
- Produces:
  - `ProcessResult.xpGained?: number`
  - `processCommand(state, command, config, now, playerLevel, bonuses?)` — new optional last param
  - `handleCollect` uses new coin/XP formula

- [ ] **Step 1: Write failing tests for the new formula**

Add to `shared/engine/__tests__/processCommand.test.ts`:

```ts
describe('collect with coinBonusPercent', () => {
  it('applies coinBonusPercent to collect revenue', () => {
    const worker = makeWorker({ floorType: 'green', dreamJob: 'coffee_shop', assignedFloorId: 1, assignedSlotIdx: 0 });
    // worker mood = good → workerMultiplier = 2.0, specialistBonusPercent = 0
    const state: GameState = {
      ...createInitialState(testConfig),
      balance: 0,
      coinBonusPercent: 50,
      xpBonusPercent: 0,
      workers: [worker],
      stats: { totalBought: 0, totalListed: 0, totalCollected: 0, totalPassengersLifted: 0 },
      floors: [{
        id: 1,
        productions: [
          { typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 0 },
          { typeId: null, stage: 'IDLE', stageStartedAt: 0 },
        ],
      }],
    };
    // batchValue=25, coinMultiplier=1+(50+0)/100=1.5, workerMultiplier=2.0
    // revenue = floor(25 * 1.5 * 2.0) = floor(75) = 75
    const cmd = { id: 'c1', type: 'collect' as const, floorId: 1, slotIdx: 0, timestamp: 100_000 };
    const result = processCommand(state, cmd, testConfig, 100_000, 1, { coinPercent: 50, xpPercent: 0 });
    expect(result.success).toBe(true);
    expect(result.state.balance).toBe(75);
  });

  it('returns xpGained based on xpBonusPercent not coinDelta', () => {
    const worker = makeWorker({ floorType: 'green', dreamJob: 'coffee_shop', assignedFloorId: 1, assignedSlotIdx: 0 });
    const state: GameState = {
      ...createInitialState(testConfig),
      balance: 0,
      coinBonusPercent: 50,
      xpBonusPercent: 20,
      workers: [worker],
      stats: { totalBought: 0, totalListed: 0, totalCollected: 0, totalPassengersLifted: 0 },
      floors: [{
        id: 1,
        productions: [
          { typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 0 },
          { typeId: null, stage: 'IDLE', stageStartedAt: 0 },
        ],
      }],
    };
    // xpMultiplier = 1 + 20/100 = 1.2, workerMultiplier = 2.0
    // xpGained = floor(25 * 1.2 * 2.0) = floor(60) = 60
    const cmd = { id: 'c1', type: 'collect' as const, floorId: 1, slotIdx: 0, timestamp: 100_000 };
    const result = processCommand(state, cmd, testConfig, 100_000, 1, { coinPercent: 50, xpPercent: 20 });
    expect(result.success).toBe(true);
    expect(result.xpGained).toBe(60);
    // coin delta = 75 (from coinBonus=50%), but xpGained = 60 (from xpBonus=20%)
    expect(result.state.balance).toBe(75);
  });

  it('works with default bonuses (zero) — same as before', () => {
    const worker = makeWorker({ floorType: 'green', dreamJob: 'coffee_shop', assignedFloorId: 1, assignedSlotIdx: 0 });
    const state: GameState = {
      ...createInitialState(testConfig),
      balance: 0,
      workers: [worker],
      stats: { totalBought: 0, totalListed: 0, totalCollected: 0, totalPassengersLifted: 0 },
      floors: [{
        id: 1,
        productions: [
          { typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 0 },
          { typeId: null, stage: 'IDLE', stageStartedAt: 0 },
        ],
      }],
    };
    // batchValue=25, no bonus, workerMultiplier=2.0 → floor(25 * 1.0 * 2.0) = 50
    const cmd = { id: 'c1', type: 'collect' as const, floorId: 1, slotIdx: 0, timestamp: 100_000 };
    const result = processCommand(state, cmd, testConfig, 100_000);
    expect(result.success).toBe(true);
    expect(result.state.balance).toBe(50);
    expect(result.xpGained).toBe(50);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern="shared/engine/__tests__/processCommand"
```

Expected: FAIL — `processCommand` does not yet accept bonuses param and `result.xpGained` is undefined.

- [ ] **Step 3: Add `xpGained` to `ProcessResult` and `bonuses` param to `processCommand`**

In `shared/engine/processCommand.ts`, update `ProcessResult`:

```ts
export interface ProcessResult {
  success: boolean;
  state: GameState;
  error?: string;
  xpGained?: number;
}
```

Update the `processCommand` signature:

```ts
export function processCommand(
  state: GameState,
  command: Command,
  config: GameConfig,
  now: number,
  playerLevel: number = 1,
  bonuses: { coinPercent: number; xpPercent: number } = { coinPercent: 0, xpPercent: 0 },
): ProcessResult {
```

Pass `bonuses` through to `processProductionCommand`:

```ts
case 'buy':
case 'list':
case 'collect':
case 'buy_floor':
case 'open_floor':
case 'speed_up_delivery':
  return processProductionCommand(state, command, config, now, bonuses);
```

Update `processProductionCommand` signature:

```ts
function processProductionCommand(
  state: GameState,
  command: Extract<Command, { type: 'buy' | 'list' | 'collect' | 'buy_floor' | 'open_floor' | 'speed_up_delivery' }>,
  config: GameConfig,
  now: number,
  bonuses: { coinPercent: number; xpPercent: number } = { coinPercent: 0, xpPercent: 0 },
): ProcessResult {
```

Pass `bonuses` to `handleCollect` in the switch case.

- [ ] **Step 4: Update `handleCollect` with new formula**

Replace the revenue calculation inside `handleCollect` in `shared/engine/processCommand.ts`:

```ts
// Old code to remove:
const multiplier = getRevenueMultiplier(worker, floorType, production.typeId);
const specialistBonus = getFloorSpecialistBonus(state.workers, floorId);
const revenue = Math.floor(typeConfig.batchValue * multiplier * (1 + specialistBonus));

// New code:
const workerMultiplier = getRevenueMultiplier(worker, floorType, production.typeId);
const specialistBonusPercent = Math.round(getFloorSpecialistBonus(state.workers, floorId) * 100);

const coinMultiplier = 1 + (bonuses.coinPercent + specialistBonusPercent) / 100;
const revenue = Math.floor(typeConfig.batchValue * coinMultiplier * workerMultiplier);

const xpMultiplier = 1 + bonuses.xpPercent / 100;
const xpGained = Math.floor(typeConfig.batchValue * xpMultiplier * workerMultiplier);
```

Add `xpGained` to the return value:

```ts
return {
  success: true,
  xpGained,
  state: {
    ...state,
    balance: state.balance + revenue,
    floors: updateProduction(state.floors, floorIdx, slotIdx, {
      typeId: production.typeId,
      stage: 'IDLE',
      stageStartedAt: 0,
    }),
    stats: { ...state.stats, totalCollected: state.stats.totalCollected + 1 },
  },
};
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="shared/engine/__tests__/processCommand"
```

Expected: all tests pass including the new bonus formula tests.

- [ ] **Step 6: Commit**

```bash
git add shared/engine/processCommand.ts shared/engine/__tests__/processCommand.test.ts
git commit -m "feat(engine): new collect formula with coinBonusPercent/xpBonusPercent, xpGained in ProcessResult"
```

---

### Task 6: Engine — track passenger deliveries in lobbyCommands

**Files:**
- Modify: `shared/engine/lobbyCommands.ts`
- Modify: `shared/engine/__tests__/lobbyCommands.test.ts`

**Interfaces:**
- Produces: `totalPassengersLifted` incremented in `handleCollectTip` (+1) and `handleDeliverAll` (+N)

- [ ] **Step 1: Write failing tests**

Find existing lobby tests and add passenger tracking assertions. Add to `shared/engine/__tests__/lobbyCommands.test.ts`:

```ts
describe('passenger tracking', () => {
  const baseState = (): GameState => ({
    ...createInitialState(testConfig),
    stats: { totalBought: 0, totalListed: 0, totalCollected: 0, totalPassengersLifted: 5 },
    lobbyVisitors: [
      { id: 'v1', role: 'guest', targetFloor: 2, hairColor: 'black', female: false, pendingFloorType: null },
    ],
    elevatorFloor: 2,
    elevatorLevel: 1,
  });

  it('collect_tip increments totalPassengersLifted by 1', () => {
    const cmd = {
      id: 'ct1', type: 'collect_tip' as const, timestamp: 1000,
      newWorker: null, builderTool: null,
    };
    const result = processCommand(baseState(), cmd, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.stats.totalPassengersLifted).toBe(6);
  });

  it('deliver_all increments totalPassengersLifted by lobby size', () => {
    const state = {
      ...baseState(),
      gems: 5,
      lobbyVisitors: [
        { id: 'v1', role: 'guest' as const, targetFloor: 2, hairColor: 'black', female: false, pendingFloorType: null },
        { id: 'v2', role: 'guest' as const, targetFloor: 3, hairColor: 'brown', female: true, pendingFloorType: null },
        { id: 'v3', role: 'businessman' as const, targetFloor: 1, hairColor: 'blonde', female: false, pendingFloorType: null },
      ],
    };
    const cmd = {
      id: 'da1', type: 'deliver_all' as const, timestamp: 1000,
      builderTools: [],
    };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.stats.totalPassengersLifted).toBe(8); // 5 + 3 lobby visitors
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern="shared/engine/__tests__/lobbyCommands"
```

Expected: FAIL — `totalPassengersLifted` not yet incremented.

- [ ] **Step 3: Update `handleCollectTip` in `shared/engine/lobbyCommands.ts`**

Find the `handleCollectTip` function. After `applyVisitorEffect` call and before the final return, update `newState` to include the stat increment:

```ts
function handleCollectTip(
  state: GameState,
  config: GameConfig,
  playerLevel: number,
  now: number,
  command: Extract<Command, { type: 'collect_tip' }>,
): ProcessResult {
  if (state.lobbyVisitors.length === 0) {
    return { success: false, state, error: 'No visitors' };
  }
  const active = state.lobbyVisitors[0];
  if (state.elevatorFloor !== active.targetFloor) {
    return { success: false, state, error: 'Elevator not at target floor' };
  }
  let newState = applyVisitorEffect(state, active, config, playerLevel, command.newWorker, command.builderTool);
  const nextVisitorAt = (state.nextVisitorAt === 0 || state.nextVisitorAt <= now)
    ? now + config.lobbyConfig.visitorSpawnInterval
    : state.nextVisitorAt;
  newState = {
    ...newState,
    lobbyVisitors: newState.lobbyVisitors.slice(1),
    elevatorFloor: 0,
    nextVisitorAt,
    stats: { ...newState.stats, totalPassengersLifted: newState.stats.totalPassengersLifted + 1 },
  };
  return { success: true, state: newState };
}
```

- [ ] **Step 4: Update `handleDeliverAll` in `shared/engine/lobbyCommands.ts`**

At the end of `handleDeliverAll`, before the `return`, capture the lobby count and increment:

```ts
function handleDeliverAll(
  state: GameState,
  config: GameConfig,
  playerLevel: number,
  now: number,
  command: Extract<Command, { type: 'deliver_all' }>,
): ProcessResult {
  if (state.gems < 1) {
    return { success: false, state, error: 'Not enough gems' };
  }
  if (state.lobbyVisitors.length === 0) {
    return { success: false, state, error: 'No visitors to deliver' };
  }
  const passengersDelivered = state.lobbyVisitors.length;
  const builderTools = command.builderTools ?? [];
  let builderIdx = 0;
  let newState = { ...state, gems: state.gems - 1 };
  for (const visitor of state.lobbyVisitors) {
    const isBuilder = (visitor.role ?? 'guest') === 'builder';
    const tool = isBuilder ? builderTools[builderIdx++] : undefined;
    newState = applyVisitorEffect(newState, visitor, config, playerLevel, undefined, tool);
  }
  const nextVisitorAt = (state.nextVisitorAt === 0 || state.nextVisitorAt <= now)
    ? now + config.lobbyConfig.visitorSpawnInterval
    : state.nextVisitorAt;
  newState = {
    ...newState,
    lobbyVisitors: [],
    elevatorFloor: 0,
    nextVisitorAt,
    stats: { ...newState.stats, totalPassengersLifted: newState.stats.totalPassengersLifted + passengersDelivered },
  };
  return { success: true, state: newState };
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="shared/engine/__tests__/lobbyCommands"
```

Expected: all tests pass.

- [ ] **Step 6: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add shared/engine/lobbyCommands.ts shared/engine/__tests__/lobbyCommands.test.ts
git commit -m "feat(engine): track totalPassengersLifted in collect_tip and deliver_all"
```

---

### Task 7: Server — AchievementService

**Files:**
- Create: `server/src/achievement/achievement.service.ts`
- Create: `server/src/achievement/achievement.module.ts`
- Create: `server/src/achievement/__tests__/achievement.service.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  AchievementService.incrementProgress(
    tx: Prisma.TransactionClient,
    playerId: string,
    categoryKey: string,
    amount: number,
  ): Promise<{ newGrants: NewAchievementGrant[]; gemsToAdd: number; coinBonusDelta: number; xpBonusDelta: number }>
  ```

- [ ] **Step 1: Write failing tests in `server/src/achievement/__tests__/achievement.service.spec.ts`**

```ts
import { AchievementService } from '../achievement.service';
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_GEM_REWARDS,
  ACHIEVEMENT_INCOME_BONUS,
  ACHIEVEMENT_XP_BONUS,
} from '@shared/config/achievementCategories';

function makeTx(overrides: Partial<{
  findUnique: jest.Mock;
  upsert: jest.Mock;
  update: jest.Mock;
}> = {}) {
  return {
    playerCategoryProgress: {
      findUnique: overrides.findUnique ?? jest.fn(),
      upsert: overrides.upsert ?? jest.fn(),
      update: overrides.update ?? jest.fn(),
    },
  } as any;
}

describe('AchievementService.incrementProgress', () => {
  let service: AchievementService;

  beforeEach(() => {
    service = new AchievementService();
  });

  it('returns no grants when threshold not yet reached', async () => {
    const tx = makeTx({
      upsert: jest.fn().mockResolvedValue({
        progress: 50,
        currentLevel: 0,
        claimedLevels: [],
      }),
      update: jest.fn().mockResolvedValue({}),
    });

    const result = await service.incrementProgress(tx, 'player1', 'buy', 50);
    expect(result.newGrants).toHaveLength(0);
    expect(result.gemsToAdd).toBe(0);
    expect(result.coinBonusDelta).toBe(0);
    expect(result.xpBonusDelta).toBe(0);
  });

  it('awards level 1 when progress crosses 100 threshold', async () => {
    const tx = makeTx({
      upsert: jest.fn().mockResolvedValue({
        progress: 100,
        currentLevel: 0,
        claimedLevels: [],
      }),
      update: jest.fn().mockResolvedValue({}),
    });

    const result = await service.incrementProgress(tx, 'player1', 'buy', 100);
    expect(result.newGrants).toHaveLength(1);
    expect(result.newGrants[0].level).toBe(1);
    expect(result.newGrants[0].gems).toBe(ACHIEVEMENT_GEM_REWARDS[1]); // 5
    expect(result.newGrants[0].incomeBonus).toBe(ACHIEVEMENT_INCOME_BONUS[1]); // 0
    expect(result.gemsToAdd).toBe(5);
    expect(result.coinBonusDelta).toBe(0);
  });

  it('awards multiple levels when progress jumps across several thresholds', async () => {
    // progress was 90, now becomes 3000 → should unlock levels 1, 2, 3
    const tx = makeTx({
      upsert: jest.fn().mockResolvedValue({
        progress: 3000,
        currentLevel: 0,
        claimedLevels: [],
      }),
      update: jest.fn().mockResolvedValue({}),
    });

    const result = await service.incrementProgress(tx, 'player1', 'buy', 2910);
    expect(result.newGrants).toHaveLength(3);
    expect(result.newGrants.map(g => g.level)).toEqual([1, 2, 3]);
    expect(result.gemsToAdd).toBe(5 + 10 + 20); // 35
    expect(result.coinBonusDelta).toBe(0); // levels 1-3 give no income bonus
  });

  it('awards income and xp bonus for level 4', async () => {
    const tx = makeTx({
      upsert: jest.fn().mockResolvedValue({
        progress: 10_000,
        currentLevel: 3,
        claimedLevels: [1, 2, 3],
      }),
      update: jest.fn().mockResolvedValue({}),
    });

    const result = await service.incrementProgress(tx, 'player1', 'buy', 0);
    expect(result.newGrants).toHaveLength(1);
    expect(result.newGrants[0].level).toBe(4);
    expect(result.newGrants[0].incomeBonus).toBe(1);
    expect(result.newGrants[0].xpBonus).toBe(1);
    expect(result.gemsToAdd).toBe(ACHIEVEMENT_GEM_REWARDS[4]); // 35
    expect(result.coinBonusDelta).toBe(1);
    expect(result.xpBonusDelta).toBe(1);
  });

  it('does not re-award already claimed levels', async () => {
    const tx = makeTx({
      upsert: jest.fn().mockResolvedValue({
        progress: 3000,
        currentLevel: 2,
        claimedLevels: [1, 2],
      }),
      update: jest.fn().mockResolvedValue({}),
    });

    const result = await service.incrementProgress(tx, 'player1', 'buy', 500);
    // progress=3000 >= threshold[3]=2500, levels 1 and 2 already claimed
    expect(result.newGrants).toHaveLength(1);
    expect(result.newGrants[0].level).toBe(3);
  });

  it('calls tx.playerCategoryProgress.update with new claimedLevels and currentLevel', async () => {
    const mockUpdate = jest.fn().mockResolvedValue({});
    const tx = makeTx({
      upsert: jest.fn().mockResolvedValue({
        progress: 100,
        currentLevel: 0,
        claimedLevels: [],
      }),
      update: mockUpdate,
    });

    await service.incrementProgress(tx, 'player1', 'buy', 100);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { playerId_categoryKey: { playerId: 'player1', categoryKey: 'buy' } },
      data: {
        currentLevel: 1,
        claimedLevels: [1],
      },
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd server && npm test -- --testPathPattern="achievement.service"
```

Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Create `server/src/achievement/achievement.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { ACHIEVEMENT_CATEGORIES, ACHIEVEMENT_GEM_REWARDS, ACHIEVEMENT_INCOME_BONUS, ACHIEVEMENT_XP_BONUS } from '@shared/config/achievementCategories';
import type { NewAchievementGrant } from '@shared/types/achievements';

@Injectable()
export class AchievementService {
  async incrementProgress(
    tx: any,
    playerId: string,
    categoryKey: string,
    amount: number,
  ): Promise<{
    newGrants: NewAchievementGrant[];
    gemsToAdd: number;
    coinBonusDelta: number;
    xpBonusDelta: number;
  }> {
    const category = ACHIEVEMENT_CATEGORIES.find(c => c.key === categoryKey);
    if (!category) return { newGrants: [], gemsToAdd: 0, coinBonusDelta: 0, xpBonusDelta: 0 };

    // Upsert: increment progress, read current state
    const current = await tx.playerCategoryProgress.upsert({
      where: { playerId_categoryKey: { playerId, categoryKey } },
      create: { playerId, categoryKey, progress: amount, currentLevel: 0, claimedLevels: [] },
      update: { progress: { increment: amount } },
      // Re-read after update
    });

    const { progress, claimedLevels } = current;
    const claimedSet = new Set<number>(claimedLevels);

    const newGrants: NewAchievementGrant[] = [];
    let gemsToAdd = 0;
    let coinBonusDelta = 0;
    let xpBonusDelta = 0;
    let maxNewLevel = current.currentLevel;

    for (const levelConfig of category.levels) {
      const { level, title, threshold } = levelConfig;
      if (progress >= threshold && !claimedSet.has(level)) {
        const gems = ACHIEVEMENT_GEM_REWARDS[level] ?? 0;
        const incomeBonus = ACHIEVEMENT_INCOME_BONUS[level] ?? 0;
        const xpBonus = ACHIEVEMENT_XP_BONUS[level] ?? 0;

        newGrants.push({
          categoryKey,
          level,
          title,
          categoryTitle: category.title,
          gems,
          incomeBonus,
          xpBonus,
        });

        gemsToAdd += gems;
        coinBonusDelta += incomeBonus;
        xpBonusDelta += xpBonus;
        claimedSet.add(level);
        if (level > maxNewLevel) maxNewLevel = level;
      }
    }

    if (newGrants.length > 0) {
      await tx.playerCategoryProgress.update({
        where: { playerId_categoryKey: { playerId, categoryKey } },
        data: {
          currentLevel: maxNewLevel,
          claimedLevels: Array.from(claimedSet).sort((a, b) => a - b),
        },
      });
    }

    return { newGrants, gemsToAdd, coinBonusDelta, xpBonusDelta };
  }
}
```

- [ ] **Step 4: Create `server/src/achievement/achievement.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { AchievementService } from './achievement.service';

@Module({
  providers: [AchievementService],
  exports: [AchievementService],
})
export class AchievementModule {}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd server && npm test -- --testPathPattern="achievement.service"
```

Expected: all 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/src/achievement/
git commit -m "feat(server): AchievementService with incrementProgress"
```

---

### Task 8: Server — integrate AchievementService into sync

**Files:**
- Modify: `server/src/sync/sync.service.ts`
- Modify: `server/src/sync/sync.module.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Consumes: `AchievementService.incrementProgress`
- Produces:
  ```ts
  SyncResult {
    // existing fields...
    newAchievements: NewAchievementGrant[];
    coinBonusPercent: number;
    xpBonusPercent:   number;
    categoryProgress: Record<string, CategoryProgressState>;
  }
  ```

- [ ] **Step 1: Register AchievementModule in sync module and app module**

In `server/src/sync/sync.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { AchievementModule } from '../achievement/achievement.module';

@Module({
  imports: [AchievementModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
```

In `server/src/app.module.ts`, add `AchievementModule` to imports:
```ts
import { AchievementModule } from './achievement/achievement.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    PlayerModule,
    SyncModule,
    LeaderboardModule,
    AchievementModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 2: Update `SyncResult` type in `sync.service.ts`**

Replace the old `SyncResult` interface:

```ts
import type { GameState, Command, Floor, Production, Worker } from '@shared/types';
import type { NewAchievementGrant, CategoryProgressState } from '@shared/types/achievements';

export interface SyncResult {
  state: GameState;
  stateVersion: number;
  ackCursor: number;
  serverTime: number;
  playerLevel: number;
  playerXp: number;
  newAchievements: NewAchievementGrant[];
  coinBonusPercent: number;
  xpBonusPercent: number;
  categoryProgress: Record<string, CategoryProgressState>;
}
```

- [ ] **Step 3: Inject `AchievementService` in `SyncService`**

Update the constructor:
```ts
constructor(
  private prisma: PrismaService,
  private achievementService: AchievementService,
) {}
```

Add the import at the top:
```ts
import { AchievementService } from '../achievement/achievement.service';
```

- [ ] **Step 4: Update the `FOR UPDATE` query to include new fields**

The raw SQL lock query needs `totalCollected` (renamed from `totalSold`) and `totalPassengersLifted`:

```ts
const [locked] = await tx.$queryRaw<{
  playerLevel: number;
  playerXp: number;
  totalBought: number;
  totalListed: number;
  totalCollected: number;
  totalPassengersLifted: number;
  maxRevenuePerMin: number;
}[]>`
  SELECT "playerLevel", "playerXp", "totalBought", "totalListed", "totalCollected", "totalPassengersLifted", "maxRevenuePerMin"
  FROM "Player" WHERE id = ${playerId} FOR UPDATE
`;
```

- [ ] **Step 5: Update stat delta counting in the transaction**

Replace `soldCount` with `collectCount`, add `passengersCount`:

```ts
let boughtCount = 0;
let listedCount = 0;
let collectCount = 0;
for (const cmd of acceptedCommands) {
  if (cmd.type === 'buy')     boughtCount++;
  if (cmd.type === 'list')    listedCount++;
  if (cmd.type === 'collect') collectCount++;
}
```

For passengers, compute delta from engine state:
```ts
// Capture state before processing commands
const gameStateBefore = this.dbToGameState(player);
// ... [existing command processing loop] ...
// After loop, gameStateAfter = gameState
const passengersCount = gameState.stats.totalPassengersLifted - gameStateBefore.stats.totalPassengersLifted;
```

Note: rename `gameStateBefore` variable — add `const gameStateBefore = this.dbToGameState(player);` right after `let gameState = this.dbToGameState(player);`.

- [ ] **Step 6: Update `finalStats` to use renamed field**

```ts
const finalStats = {
  totalBought:           (locked?.totalBought          ?? player.totalBought)          + boughtCount,
  totalListed:           (locked?.totalListed           ?? player.totalListed)           + listedCount,
  totalCollected:        (locked?.totalCollected        ?? player.totalCollected)        + collectCount,
  totalPassengersLifted: (locked?.totalPassengersLifted ?? player.totalPassengersLifted) + passengersCount,
};
gameState = { ...gameState, stats: finalStats };
```

- [ ] **Step 7: Replace the old achievement block with AchievementService calls**

Remove the old achievement block (lines 140–169) and replace with:

```ts
// Achievement progress
let coinBonusDelta = 0;
let xpBonusDelta = 0;
const allNewGrants: NewAchievementGrant[] = [];

const categoryDeltas: [string, number][] = [
  ['buy',      boughtCount],
  ['list',     listedCount],
  ['collect',  collectCount],
  ['elevator', passengersCount],
];
for (const [key, amount] of categoryDeltas) {
  if (amount === 0) continue;
  const r = await this.achievementService.incrementProgress(tx, playerId, key, amount);
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

- [ ] **Step 8: Update `Player.update` to use renamed field**

In the consolidated `tx.player.update` call, replace `totalSold` with `totalCollected` and add `totalPassengersLifted`:

```ts
await tx.player.update({
  where: { id: playerId },
  data: {
    balance: gameState.balance,
    playerLevel: xpResult.playerLevel,
    playerXp: xpResult.playerXp,
    totalBought:           { increment: boughtCount },
    totalListed:           { increment: listedCount },
    totalCollected:        { increment: collectCount },
    totalPassengersLifted: { increment: passengersCount },
    stateVersion: {
      increment: (acceptedCommands.length > 0 || allNewGrants.length > 0) ? 1 : 0,
    },
    lastSeenAt: new Date(serverNow),
    openedFloorsCount: currentOpenedFloors,
    ...(currentRevenue > (locked?.maxRevenuePerMin ?? player.maxRevenuePerMin ?? 0)
      ? { maxRevenuePerMin: currentRevenue }
      : {}),
  },
});
```

Set `newAchievements = allNewGrants;` after the transaction.

- [ ] **Step 9: Use `xpGained` from `ProcessResult` for collect commands**

In the command processing loop, update XP accounting:

```ts
for (const command of newCommands) {
  const prevBalance = gameState.balance;
  const result = processCommand(
    gameState, command, gameConfig, command.timestamp, player.playerLevel,
    { coinPercent: gameState.coinBonusPercent, xpPercent: gameState.xpBonusPercent },
  );
  if (result.success) {
    const xp = result.xpGained !== undefined
      ? result.xpGained
      : xpForCommand(command.type, prevBalance, result.state.balance);
    totalXpGained += xp;
    gameState = result.state;
    acceptedCommands.push(command);
  } else {
    this.logger.warn(`Command ${command.id} (${command.type}) failed: ${result.error}`);
  }
}
```

- [ ] **Step 10: Update `dbToGameState` for renamed/new fields**

In the `dbToGameState` method, update the `stats` object and add bonus fields:

```ts
stats: {
  totalBought:           player.totalBought,
  totalListed:           player.totalListed,
  totalCollected:        player.totalCollected ?? 0,
  totalPassengersLifted: player.totalPassengersLifted ?? 0,
},
coinBonusPercent: s?.coinBonusPercent ?? 0,
xpBonusPercent:   s?.xpBonusPercent   ?? 0,
```

- [ ] **Step 11: Read `categoryProgress` after transaction and update `SyncResult` return**

After the transaction and the `updatedPlayer` re-read, add:

```ts
const progressRows = await this.prisma.playerCategoryProgress.findMany({
  where: { playerId },
  select: { categoryKey: true, progress: true, currentLevel: true, claimedLevels: true },
});
const categoryProgress: Record<string, CategoryProgressState> = {};
for (const row of progressRows) {
  categoryProgress[row.categoryKey] = {
    progress: row.progress,
    currentLevel: row.currentLevel,
    claimedLevels: row.claimedLevels,
  };
}
```

Update the return:
```ts
return {
  state: gameState,
  stateVersion: updatedPlayer?.stateVersion ?? player.stateVersion,
  ackCursor,
  serverTime: serverNow,
  playerLevel: updatedPlayer?.playerLevel ?? xpResult.playerLevel,
  playerXp: updatedPlayer?.playerXp ?? xpResult.playerXp,
  newAchievements: allNewGrants,
  coinBonusPercent: updatedPlayer ? (await this.prisma.playerState.findUnique({ where: { playerId } }))?.coinBonusPercent ?? 0 : gameState.coinBonusPercent,
  xpBonusPercent:   updatedPlayer ? (await this.prisma.playerState.findUnique({ where: { playerId } }))?.xpBonusPercent   ?? 0 : gameState.xpBonusPercent,
  categoryProgress,
};
```

**Note:** To avoid an extra query for coinBonusPercent/xpBonusPercent, read them directly from the state that was computed in the transaction (already updated via `{ increment: ... }`). Replace the lazy reads with:

```ts
const finalCoinBonus = gameState.coinBonusPercent + coinBonusDelta;
const finalXpBonus   = gameState.xpBonusPercent   + xpBonusDelta;
```

And return `coinBonusPercent: finalCoinBonus, xpBonusPercent: finalXpBonus`.

- [ ] **Step 12: Build server to catch type errors**

```bash
cd server && npm run build 2>&1 | head -40
```

Expected: build succeeds with no errors.

- [ ] **Step 13: Commit**

```bash
git add server/src/
git commit -m "feat(server): integrate AchievementService into sync, update SyncResult with achievement grants and bonuses"
```

---

### Task 9: Client — update gameStore with bonus and progress fields

**Files:**
- Modify: `src/stores/gameStore.ts`

**Interfaces:**
- Consumes: `SyncResult.coinBonusPercent`, `SyncResult.xpBonusPercent`, `SyncResult.categoryProgress`, `SyncResult.newAchievements` (now `NewAchievementGrant[]`)
- Produces:
  - `gameStore.coinBonusPercent: number`
  - `gameStore.xpBonusPercent: number`
  - `gameStore.categoryProgress: Record<string, CategoryProgressState>`
  - `gameStore.achievementQueue: NewAchievementGrant[]`

- [ ] **Step 1: Update imports and state types in `src/stores/gameStore.ts`**

Add imports:
```ts
import type { NewAchievementGrant, CategoryProgressState } from '../../shared/types/achievements';
```

Remove the old `AchievementGrant` import from `@shared/types` if present.

- [ ] **Step 2: Replace old achievement state fields with new ones**

Find the `achievementQueue: AchievementGrant[]` field (line ~48) and update:
```ts
achievementQueue: NewAchievementGrant[];
coinBonusPercent: number;
xpBonusPercent: number;
categoryProgress: Record<string, CategoryProgressState>;
```

Update `addAchievements`:
```ts
addAchievements: (grants: NewAchievementGrant[]) => void;
```

- [ ] **Step 3: Update initial state and persistence defaults**

In the `create` call, update defaults:
```ts
achievementQueue: [],
coinBonusPercent: 0,
xpBonusPercent: 0,
categoryProgress: {},
```

In the persistence hydration section (around line 503), add:
```ts
coinBonusPercent: (state as any).coinBonusPercent ?? 0,
xpBonusPercent:   (state as any).xpBonusPercent   ?? 0,
categoryProgress: (state as any).categoryProgress  ?? {},
```

- [ ] **Step 4: Update `executeCommand` to use `result.xpGained`**

Find the `executeCommand` function (line ~109). The current XP line is:
```ts
const xpGained = xpForCommand(command.type, balance, result.state.balance, gems, result.state.gems);
```

Replace with:
```ts
const xpGained = result.xpGained !== undefined
  ? result.xpGained
  : xpForCommand(command.type, balance, result.state.balance, gems, result.state.gems);
```

Also pass bonuses to `processCommand`:
```ts
const result = processCommand(
  gameState, command, gameConfig, command.timestamp, store.playerLevel,
  { coinPercent: store.coinBonusPercent, xpPercent: store.xpBonusPercent },
);
```

- [ ] **Step 5: Update the sync result handler**

Find where the sync result is applied to the store (search for `addAchievements` or `newAchievements` usage). Update to:

```ts
// After applying state from server:
if (result.newAchievements.length > 0) {
  get().addAchievements(result.newAchievements);
}
set({
  coinBonusPercent: result.coinBonusPercent,
  xpBonusPercent:   result.xpBonusPercent,
  categoryProgress: result.categoryProgress,
});
```

- [ ] **Step 6: Update the state rebuild from GameState**

Find the section (around line 538) where the store fields are set from `serverState.stats`. Update stats usage to use renamed field:

```ts
stats: serverState.stats ?? {
  totalBought: 0, totalListed: 0, totalCollected: 0, totalPassengersLifted: 0
},
coinBonusPercent: result.coinBonusPercent ?? 0,
xpBonusPercent:   result.xpBonusPercent   ?? 0,
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing errors unrelated to this change).

- [ ] **Step 8: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat(client): update gameStore with coinBonusPercent, xpBonusPercent, categoryProgress"
```

---

### Task 10: Client — update ProductionCard to show adjusted coin value

**Files:**
- Modify: `src/components/ProductionCard.tsx`

**Interfaces:**
- Consumes: `gameStore.coinBonusPercent`, `getFloorSpecialistBonus`, `getRevenueMultiplier`

- [ ] **Step 1: Find where `batchValue` is displayed in `ProductionCard.tsx`**

```bash
grep -n "batchValue\|revenue\|value\|price" src/components/ProductionCard.tsx | head -20
```

Identify the line where production value is shown to the user.

- [ ] **Step 2: Import what's needed and compute adjusted value**

At the top of the component or inside the render, add:
```ts
import { getRevenueMultiplier, getFloorSpecialistBonus } from '../../shared/engine/workerUtils';
import { useGameStore } from '../stores/gameStore';

// Inside component:
const coinBonusPercent = useGameStore(s => s.coinBonusPercent);
const workers = useGameStore(s => s.workers);

// When rendering a production slot that has a worker:
const specialistBonusPercent = Math.round(getFloorSpecialistBonus(workers, floorId) * 100);
const adjustedValue = Math.floor(
  typeConfig.batchValue * (1 + (coinBonusPercent + specialistBonusPercent) / 100)
);
// Display adjustedValue (before worker multiplier)
// Worker multiplier (1x/1.3x/2x) shown separately if needed
```

- [ ] **Step 3: Replace the displayed value**

Wherever `typeConfig.batchValue` or the existing revenue calculation is displayed, use `adjustedValue` instead.

- [ ] **Step 4: Manually verify in the app**

Start the dev server:
```bash
npm run ios
```

Open a floor card with a production slot. Confirm the displayed coin value changes when `coinBonusPercent` is non-zero (you can temporarily hard-code `coinBonusPercent: 50` in the store initial state to test, then revert).

- [ ] **Step 5: Commit**

```bash
git add src/components/ProductionCard.tsx
git commit -m "feat(client): show bonus-adjusted coin value in ProductionCard"
```

---

### Task 11: Client — update AchievementModal for new grant type

**Files:**
- Modify: `src/components/AchievementModal.tsx`

**Interfaces:**
- Consumes: `NewAchievementGrant` (replaces old `AchievementGrant`)
- The `grant` object now has: `categoryKey`, `level`, `title`, `categoryTitle`, `gems`, `incomeBonus`, `xpBonus`

- [ ] **Step 1: Update the modal to use `NewAchievementGrant` fields**

In `AchievementModal.tsx`, the `grant` comes from `achievementQueue[0]`. Update the displayed fields:

Replace:
```tsx
<Text style={styles.tierBadge}>{t('achievement.tier', { tier: grant.tier })}</Text>
<Text style={styles.title}>{t(`achievement.${grant.achievementId}.title`)}</Text>
```

With:
```tsx
<Text style={styles.tierBadge}>{grant.categoryTitle}</Text>
<Text style={styles.title}>{grant.title}</Text>
```

- [ ] **Step 2: Update reward display**

Replace the coin/gem reward rows with:
```tsx
<Animated.View style={[styles.rewardsContainer, rewardsStyle]}>
  {grant.gems > 0 && (
    <View style={styles.rewardRow}>
      <GemIcon size={16} />
      <Text style={styles.rewardTextGem}>+{grant.gems}</Text>
    </View>
  )}
  {grant.incomeBonus > 0 && (
    <View style={styles.rewardRow}>
      <Text style={styles.rewardText}>+{grant.incomeBonus}% до монет</Text>
    </View>
  )}
  {grant.xpBonus > 0 && (
    <View style={styles.rewardRow}>
      <Text style={styles.rewardText}>+{grant.xpBonus}% до досвіду</Text>
    </View>
  )}
</Animated.View>
```

Remove the `{grant.reward.coins != null && ...}` block (old structure no longer exists).

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep AchievementModal
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/AchievementModal.tsx
git commit -m "feat(client): update AchievementModal for NewAchievementGrant — gems + bonus % display"
```

---

### Task 12: Client — profile button and achievements screen

**Files:**
- Modify: `app/(tabs)/profile.tsx`
- Create: `app/(tabs)/achievements.tsx`

**Interfaces:**
- Consumes: `gameStore.categoryProgress`, `ACHIEVEMENT_CATEGORIES`, `ACHIEVEMENT_GEM_REWARDS`, `ACHIEVEMENT_INCOME_BONUS`

- [ ] **Step 1: Add achievements button to `profile.tsx`**

Add import:
```ts
import { useGameStore } from '../../src/stores/gameStore';
import { ACHIEVEMENT_CATEGORIES } from '../../shared/config/achievementCategories';
```

Inside `ProfileScreen`, compute the total earned levels:
```ts
const categoryProgress = useGameStore(s => s.categoryProgress);
const totalEarnedLevels = ACHIEVEMENT_CATEGORIES.reduce(
  (sum, cat) => sum + (categoryProgress[cat.key]?.currentLevel ?? 0),
  0,
);
```

Add a pressable button in the ScrollView (after the sync card, before the logout button):
```tsx
<Pressable
  onPress={() => router.push('/achievements')}
  style={({ pressed }) => [styles.achievementsButton, pressed && styles.achievementsButtonPressed]}
>
  <Text style={styles.achievementsButtonText}>
    Досягнення ({totalEarnedLevels})
  </Text>
</Pressable>
```

Add styles:
```ts
achievementsButton: {
  marginHorizontal: 20,
  marginTop: 14,
  backgroundColor: '#fff',
  borderRadius: 18,
  padding: 16,
  alignItems: 'center',
  borderWidth: 1,
  borderColor: '#3FA535',
},
achievementsButtonPressed: { opacity: 0.7 },
achievementsButtonText: {
  fontFamily: 'Fredoka_600SemiBold',
  fontSize: 16,
  color: '#3FA535',
},
```

- [ ] **Step 2: Create `app/(tabs)/achievements.tsx`**

```tsx
import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useGameStore } from '../../src/stores/gameStore';
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_GEM_REWARDS,
  ACHIEVEMENT_INCOME_BONUS,
  ACHIEVEMENT_XP_BONUS,
} from '../../shared/config/achievementCategories';

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(value / max, 1);
  return (
    <View style={styles.barBg}>
      <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
    </View>
  );
}

export default function AchievementsScreen() {
  const categoryProgress = useGameStore(s => s.categoryProgress);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Назад</Text>
        </Pressable>
        <Text style={styles.heading}>Досягнення</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {ACHIEVEMENT_CATEGORIES.map(category => {
          const prog = categoryProgress[category.key] ?? { progress: 0, currentLevel: 0, claimedLevels: [] };
          const { progress, currentLevel } = prog;
          const isMaxed = currentLevel === 7;
          const currentLevelConfig = category.levels.find(l => l.level === currentLevel);
          const nextLevelConfig = category.levels.find(l => l.level === currentLevel + 1);

          return (
            <View key={category.key} style={styles.card}>
              <Text style={styles.categoryTitle}>{category.title}</Text>

              <Text style={styles.currentTitle}>
                {currentLevel === 0 ? 'Рівень не отримано' : currentLevelConfig?.title ?? ''}
              </Text>

              {isMaxed ? (
                <>
                  <Text style={styles.progressText}>
                    {formatNum(progress)} / {formatNum(category.levels[6].threshold)}
                  </Text>
                  <ProgressBar value={1} max={1} />
                  <Text style={styles.maxedText}>Максимальний рівень досягнуто</Text>
                </>
              ) : nextLevelConfig ? (
                <>
                  <Text style={styles.progressText}>
                    {formatNum(progress)} / {formatNum(nextLevelConfig.threshold)}
                  </Text>
                  <ProgressBar value={progress} max={nextLevelConfig.threshold} />
                  <Text style={styles.nextLabel}>
                    Наступне звання: <Text style={styles.nextTitle}>{nextLevelConfig.title}</Text>
                  </Text>
                  <View style={styles.rewardRow}>
                    <Text style={styles.rewardLabel}>Нагорода: </Text>
                    <Text style={styles.rewardValue}>
                      {ACHIEVEMENT_GEM_REWARDS[nextLevelConfig.level]} 💎
                      {ACHIEVEMENT_INCOME_BONUS[nextLevelConfig.level] > 0
                        ? `  +${ACHIEVEMENT_INCOME_BONUS[nextLevelConfig.level]}% до монет`
                        : ''}
                      {ACHIEVEMENT_XP_BONUS[nextLevelConfig.level] > 0
                        ? `  +${ACHIEVEMENT_XP_BONUS[nextLevelConfig.level]}% до досвіду`
                        : ''}
                    </Text>
                  </View>
                </>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F3EC' },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: { padding: 4 },
  backText: { fontFamily: 'Fredoka_500Medium', fontSize: 16, color: '#3FA535' },
  heading: { fontFamily: 'Fredoka_700Bold', fontSize: 24, color: '#27331F' },
  scroll: { padding: 16, paddingBottom: 120, gap: 14 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: 'rgba(60,80,45,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  categoryTitle: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 18,
    color: '#27331F',
    marginBottom: 4,
  },
  currentTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    color: '#7C8A6E',
    marginBottom: 10,
  },
  progressText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: '#5A6652',
    marginBottom: 6,
  },
  barBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(60,120,40,0.12)',
    overflow: 'hidden',
    marginBottom: 10,
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#3FA535',
  },
  nextLabel: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: '#7C8A6E',
    marginBottom: 4,
  },
  nextTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    color: '#27331F',
  },
  rewardRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  rewardLabel: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: '#7C8A6E',
  },
  rewardValue: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    color: '#3FA535',
  },
  maxedText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#3FA535',
    marginTop: 4,
  },
});
```

- [ ] **Step 3: Manually verify the screen**

```bash
npm run ios
```

Navigate to Profile → tap "Досягнення (0)". The achievements screen should open showing 4 category cards, all at level 0 with no progress. Tap back to return to profile.

- [ ] **Step 4: Commit**

```bash
git add app/(tabs)/achievements.tsx app/(tabs)/profile.tsx
git commit -m "feat(client): achievements screen and profile button with earned level count"
```

---

### Task 13: Clean up remaining `totalSold` references

**Files:**
- Modify: `server/src/sync/sync.service.ts` (persistence section)
- Modify: any remaining test files

**Interfaces:**
- Produces: zero `totalSold` references remaining in the codebase

- [ ] **Step 1: Find all remaining totalSold references**

```bash
grep -rn "totalSold" /Users/Apple/IT/tinytower --include="*.ts" --include="*.tsx"
```

- [ ] **Step 2: Fix each occurrence**

Common locations:
- `sync.service.ts` line ~502 and ~538: store hydration fallback objects use `{ totalBought: 0, totalListed: 0, totalSold: 0 }` — update to `{ totalBought: 0, totalListed: 0, totalCollected: 0, totalPassengersLifted: 0 }`
- Any remaining test files with `totalSold` in state objects

- [ ] **Step 3: Verify zero occurrences**

```bash
grep -rn "totalSold" /Users/Apple/IT/tinytower --include="*.ts" --include="*.tsx"
```

Expected: no output.

- [ ] **Step 4: Build server and run all tests**

```bash
cd server && npm run build && npm test
```

```bash
cd .. && npm test
```

Expected: all tests pass, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix: remove all remaining totalSold references, replace with totalCollected"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Drop `PlayerAchievement`, add `PlayerCategoryProgress` | Task 1 |
| `coinBonusPercent` / `xpBonusPercent` in `PlayerState` | Task 1 |
| Rename `totalSold` → `totalCollected`, add `totalPassengersLifted` | Task 1 + Task 4 |
| `ACHIEVEMENT_CATEGORIES` config | Task 3 |
| `NewAchievementGrant`, `CategoryProgressState` types | Task 3 |
| `StatsSchema` and `GameStateSchema` updates | Task 4 |
| New collect formula (coinBonusPercent + specialistBonusPercent) | Task 5 |
| `xpGained` in `ProcessResult`, XP formula | Task 5 |
| Passenger tracking in `collect_tip` and `deliver_all` | Task 6 |
| `AchievementService.incrementProgress` with tests | Task 7 |
| Multi-level jump (one action unlocks 1,2,3) | Task 7 (test case) |
| Idempotent: no re-award of claimed levels | Task 7 (test case) |
| Sync integration, `SyncResult` updated | Task 8 |
| `categoryProgress` returned in `SyncResult` | Task 8 |
| Client store: new fields, sync handling | Task 9 |
| Client `processCommand` call with bonuses | Task 9 |
| `ProductionCard` adjusted value display | Task 10 |
| `AchievementModal` updated for new grant type | Task 11 |
| Profile button with count | Task 12 |
| Achievements screen with all 4 categories | Task 12 |
| All `totalSold` references cleaned up | Task 13 |
| Gems default to 0 for existing players | Task 1 (Prisma default) |

**All spec requirements covered.**
