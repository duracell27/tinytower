# Daily Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Daily Tasks — 11 fixed tasks that reset at midnight, tracked automatically, manually claimed for coins/gems/materials/tokens, with a double-reward bonus for completing 7+ tasks in a day.

**Architecture:** Extends the command-sourcing pattern. Progress lives in `GameState.dailyTasks` (resets via `checkDailyReset()`). Tokens accumulate in `GameState.tokens` (persisted in `PlayerState`). Claiming uses a new `claim_daily_task` command with pre-computed random values (tokenCount, tokenColor, materialType) embedded for deterministic server replay.

**Tech Stack:** React Native (Expo), Zustand, NestJS + Prisma (PostgreSQL), Zod, shared engine (shared/engine/).

## Global Constraints

- All random values (tokenCount, tokenColor, materialType) are pre-computed on the client and passed in the command payload — never randomised inside `processCommand`.
- Gems rewards are NEVER doubled by `doubleRewardActive` — only coins and materials are.
- Tokens are NEVER doubled by `doubleRewardActive`.
- `vipsLifted` counter is wired but always stays 0 — VIP visitors are not implemented yet.
- "Easy money" task reads `state.dailyGemsCollected` (not a `dailyTasks.progress` field).
- `claim_daily_task` must be added to the `switch` in `processCommand.ts` (not `lobbyCommands.ts`).
- Follow existing Fredoka/Nunito font conventions in all UI components.
- i18n namespace for new strings: `hotel`.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `shared/schemas/gameState.ts` | Modify | Add `TokensSchema`, `DailyTaskProgressSchema`, `DailyTasksSchema` to `GameStateSchema` |
| `shared/schemas/command.ts` | Modify | Add `ClaimDailyTaskCommandSchema`, add to `CommandSchema` union |
| `shared/config/dailyTasksConfig.ts` | **Create** | Task definitions, `getCoinMultiplier`, `getMaterialCount` |
| `shared/config/__tests__/dailyTasksConfig.test.ts` | **Create** | Tests for config helpers |
| `shared/config/gameConfig.ts` | Modify | Add `tokens` and `dailyTasks` to `createInitialState` |
| `shared/engine/lobbyUtils.ts` | Modify | Update `checkDailyReset` to reset `dailyTasks` + set `doubleRewardActive` |
| `shared/engine/lobbyCommands.ts` | Modify | Increment `visitorsLifted` in `handleCollectTip`/`handleDeliverAll`; `residentsAdded` in `applyVisitorEffect` |
| `shared/engine/processCommand.ts` | Modify | Increment `goodsBought`/`goodsListed`/`goodsCollected`/`residentsEvicted`/`floorsBuilt`; add `claim_daily_task` handler |
| `shared/engine/__tests__/dailyTasks.test.ts` | **Create** | Tests for progress tracking and claim handler |
| `server/prisma/schema.prisma` | Modify | Add token fields + daily task JSON fields to `PlayerState` |
| `server/src/sync/sync.service.ts` | Modify | Add tokens + dailyTasks to upsert and `gameStateFromDb` |
| `src/stores/gameStore.ts` | Modify | Add `claimDailyTask` action; update `hydrate`, `reset` for new fields |
| `src/services/sync.ts` | Modify | (No-op — tokens flow through GameState reconcile automatically) |
| `src/i18n/locales/en/hotel.json` | Modify | Add `dailyTasks.*` keys |
| `app/daily-tasks.tsx` | **Create** | Daily Tasks screen |
| `app/_layout.tsx` | Modify | Register `daily-tasks` route |
| `src/components/DailyTasksFAB.tsx` | **Create** | FAB indicator for unclaimed tasks |
| `app/(tabs)/game.tsx` | Modify | Render `DailyTasksFAB` alongside `QuickActionFAB` |
| `app/(tabs)/profile.tsx` | Modify | Add Daily Tasks button |

---

### Task 1: Shared Schemas + Daily Task Config

**Files:**
- Modify: `shared/schemas/gameState.ts`
- Modify: `shared/schemas/command.ts`
- Create: `shared/config/dailyTasksConfig.ts`
- Create: `shared/config/__tests__/dailyTasksConfig.test.ts`

**Interfaces:**
- Produces:
  - `TokensSchema` — Zod schema; `Tokens` type
  - `DailyTaskProgressSchema` — Zod schema; `DailyTaskProgress` type
  - `DailyTasksSchema` — Zod schema; `DailyTasks` type
  - `GameStateSchema` (updated) — includes `tokens` and `dailyTasks`
  - `ClaimDailyTaskCommandSchema` / `Command` union (updated)
  - `DAILY_TASKS: DailyTaskConfig[]`
  - `getCoinMultiplier(playerLevel: number): number`
  - `getMaterialCount(playerLevel: number): number`
  - `getTaskProgress(state: GameState, task: DailyTaskConfig): number`

- [ ] **Step 1: Add schemas to `shared/schemas/gameState.ts`**

At the top, after `StatsSchema`, add:

```ts
export const TokensSchema = z.object({
  green:  z.number().int().nonnegative().default(0),
  blue:   z.number().int().nonnegative().default(0),
  yellow: z.number().int().nonnegative().default(0),
  purple: z.number().int().nonnegative().default(0),
  red:    z.number().int().nonnegative().default(0),
});

export const DailyTaskProgressSchema = z.object({
  visitorsLifted:   z.number().int().nonnegative().default(0),
  vipsLifted:       z.number().int().nonnegative().default(0),
  goodsBought:      z.number().int().nonnegative().default(0),
  residentsAdded:   z.number().int().nonnegative().default(0),
  gemsPurchased:    z.number().int().nonnegative().default(0),
  goodsCollected:   z.number().int().nonnegative().default(0),
  floorsBuilt:      z.number().int().nonnegative().default(0),
  residentsEvicted: z.number().int().nonnegative().default(0),
  goodsListed:      z.number().int().nonnegative().default(0),
});

export const DailyTasksSchema = z.object({
  progress:           DailyTaskProgressSchema.default({}),
  claimed:            z.array(z.string()).default([]),
  doubleRewardActive: z.boolean().default(false),
});
```

In `GameStateSchema`, add after `xpBonusPercent`:

```ts
tokens:     TokensSchema.default({}),
dailyTasks: DailyTasksSchema.default({}),
```

- [ ] **Step 2: Add `ClaimDailyTaskCommandSchema` to `shared/schemas/command.ts`**

After `BuyAllCommandSchema`, add:

```ts
export const ClaimDailyTaskCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('claim_daily_task'),
  taskKey: z.string(),
  tokenCount: z.number().int().min(1).max(5),
  tokenColor: z.enum(['green', 'blue', 'yellow', 'purple', 'red']),
  materialType: z.enum(['briks', 'glass', 'nails', 'screw']).optional(),
});
```

Add `ClaimDailyTaskCommandSchema` to the `CommandSchema` discriminated union.

- [ ] **Step 3: Create `shared/config/dailyTasksConfig.ts`**

```ts
import type { GameState } from '../types';

export type DailyTaskKey =
  | 'transporter' | 'vip_transporter' | 'wholesale' | 'new_residents'
  | 'easy_money' | 'investor' | 'money_collector' | 'build_floor'
  | 'major_investor' | 'hasta_la_vista' | 'goods_to_sell';

export type DailyTaskProgressKey = keyof GameState['dailyTasks']['progress'];

export type DailyTaskConfig = {
  key: DailyTaskKey;
  title: string;
  progressSource: DailyTaskProgressKey | 'dailyGemsCollected';
  threshold: number;
  rewards: {
    baseCoins: number;
    gems: number;
    hasMaterials: boolean;
  };
};

export const DAILY_TASKS: DailyTaskConfig[] = [
  { key: 'transporter',     title: 'Transporter',            progressSource: 'visitorsLifted',   threshold: 100,  rewards: { baseCoins: 1300, gems: 1,   hasMaterials: false } },
  { key: 'vip_transporter', title: 'VIP-Transporter',        progressSource: 'vipsLifted',        threshold: 10,   rewards: { baseCoins: 1600, gems: 2,   hasMaterials: false } },
  { key: 'wholesale',       title: 'Wholesale purchase',     progressSource: 'goodsBought',       threshold: 50,   rewards: { baseCoins: 1100, gems: 1,   hasMaterials: false } },
  { key: 'new_residents',   title: 'New residents',          progressSource: 'residentsAdded',    threshold: 25,   rewards: { baseCoins: 1600, gems: 1,   hasMaterials: false } },
  { key: 'easy_money',      title: 'Easy money',             progressSource: 'dailyGemsCollected',threshold: 10,   rewards: { baseCoins: 1300, gems: 1,   hasMaterials: false } },
  { key: 'investor',        title: 'Investor',               progressSource: 'gemsPurchased',     threshold: 200,  rewards: { baseCoins: 1300, gems: 100, hasMaterials: false } },
  { key: 'money_collector', title: 'Money Collector',        progressSource: 'goodsCollected',    threshold: 150,  rewards: { baseCoins: 1100, gems: 1,   hasMaterials: false } },
  { key: 'build_floor',     title: 'Higher and higher!',     progressSource: 'floorsBuilt',       threshold: 1,    rewards: { baseCoins: 1600, gems: 5,   hasMaterials: true  } },
  { key: 'major_investor',  title: 'Major investor',         progressSource: 'gemsPurchased',     threshold: 1000, rewards: { baseCoins: 3200, gems: 200, hasMaterials: false } },
  { key: 'hasta_la_vista',  title: 'Hasta la vista, Baby!', progressSource: 'residentsEvicted',  threshold: 15,   rewards: { baseCoins: 1300, gems: 1,   hasMaterials: false } },
  { key: 'goods_to_sell',   title: 'Goods to sell',         progressSource: 'goodsListed',       threshold: 100,  rewards: { baseCoins: 1100, gems: 1,   hasMaterials: false } },
];

export function getCoinMultiplier(playerLevel: number): number {
  if (playerLevel <= 10) return 1;
  if (playerLevel <= 20) return 3;
  if (playerLevel <= 30) return 6;
  if (playerLevel <= 40) return 12;
  if (playerLevel <= 50) return 20;
  return 35;
}

export function getMaterialCount(playerLevel: number): number {
  if (playerLevel <= 10) return 2;
  if (playerLevel <= 20) return 3;
  if (playerLevel <= 30) return 4;
  if (playerLevel <= 40) return 5;
  if (playerLevel <= 50) return 6;
  if (playerLevel <= 60) return 7;
  return 8;
}

export function getTaskProgress(state: GameState, task: DailyTaskConfig): number {
  if (task.progressSource === 'dailyGemsCollected') return state.dailyGemsCollected;
  return state.dailyTasks.progress[task.progressSource as DailyTaskProgressKey] ?? 0;
}
```

- [ ] **Step 4: Write failing tests in `shared/config/__tests__/dailyTasksConfig.test.ts`**

```ts
import { DAILY_TASKS, getCoinMultiplier, getMaterialCount, getTaskProgress } from '../dailyTasksConfig';
import type { GameState } from '../../types';

const baseState = {
  dailyGemsCollected: 0,
  dailyTasks: {
    progress: {
      visitorsLifted: 0, vipsLifted: 0, goodsBought: 0, residentsAdded: 0,
      gemsPurchased: 0, goodsCollected: 0, floorsBuilt: 0, residentsEvicted: 0, goodsListed: 0,
    },
    claimed: [],
    doubleRewardActive: false,
  },
} as unknown as GameState;

describe('DAILY_TASKS', () => {
  it('has 11 tasks', () => {
    expect(DAILY_TASKS).toHaveLength(11);
  });

  it('major_investor threshold is 1000', () => {
    expect(DAILY_TASKS.find(t => t.key === 'major_investor')?.threshold).toBe(1000);
  });

  it('investor gems reward is 100', () => {
    expect(DAILY_TASKS.find(t => t.key === 'investor')?.rewards.gems).toBe(100);
  });

  it('only build_floor has hasMaterials true', () => {
    const withMaterials = DAILY_TASKS.filter(t => t.rewards.hasMaterials);
    expect(withMaterials).toHaveLength(1);
    expect(withMaterials[0].key).toBe('build_floor');
  });
});

describe('getCoinMultiplier', () => {
  it('returns 1 for level 1', () => expect(getCoinMultiplier(1)).toBe(1));
  it('returns 1 for level 10', () => expect(getCoinMultiplier(10)).toBe(1));
  it('returns 3 for level 11', () => expect(getCoinMultiplier(11)).toBe(3));
  it('returns 3 for level 20', () => expect(getCoinMultiplier(20)).toBe(3));
  it('returns 6 for level 25', () => expect(getCoinMultiplier(25)).toBe(6));
  it('returns 6 for level 30', () => expect(getCoinMultiplier(30)).toBe(6));
  it('returns 12 for level 40', () => expect(getCoinMultiplier(40)).toBe(12));
  it('returns 20 for level 50', () => expect(getCoinMultiplier(50)).toBe(20));
  it('returns 35 for level 51', () => expect(getCoinMultiplier(51)).toBe(35));
});

describe('getMaterialCount', () => {
  it('returns 2 for level 5', () => expect(getMaterialCount(5)).toBe(2));
  it('returns 4 for level 25', () => expect(getMaterialCount(25)).toBe(4));
  it('returns 6 for level 50', () => expect(getMaterialCount(50)).toBe(6));
  it('returns 8 for level 70', () => expect(getMaterialCount(70)).toBe(8));
});

describe('getTaskProgress', () => {
  it('reads dailyGemsCollected for easy_money', () => {
    const s = { ...baseState, dailyGemsCollected: 7 };
    const task = DAILY_TASKS.find(t => t.key === 'easy_money')!;
    expect(getTaskProgress(s, task)).toBe(7);
  });

  it('reads progress field for transporter', () => {
    const s = { ...baseState, dailyTasks: { ...baseState.dailyTasks, progress: { ...baseState.dailyTasks.progress, visitorsLifted: 55 } } };
    const task = DAILY_TASKS.find(t => t.key === 'transporter')!;
    expect(getTaskProgress(s, task)).toBe(55);
  });
});
```

- [ ] **Step 5: Run tests to verify they fail**

```bash
cd /Users/Apple/IT/tinytower
npx jest dailyTasksConfig --no-coverage 2>&1 | tail -20
```

Expected: FAIL — module not found or type errors.

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd /Users/Apple/IT/tinytower
npx jest dailyTasksConfig --no-coverage 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 7: Update `createInitialState` in `shared/config/gameConfig.ts`**

Add after `xpBonusPercent: 0`:

```ts
tokens: { green: 0, blue: 0, yellow: 0, purple: 0, red: 0 },
dailyTasks: {
  progress: {
    visitorsLifted: 0, vipsLifted: 0, goodsBought: 0, residentsAdded: 0,
    gemsPurchased: 0, goodsCollected: 0, floorsBuilt: 0, residentsEvicted: 0, goodsListed: 0,
  },
  claimed: [],
  doubleRewardActive: false,
},
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
cd /Users/Apple/IT/tinytower
git add shared/schemas/gameState.ts shared/schemas/command.ts \
        shared/config/dailyTasksConfig.ts shared/config/__tests__/dailyTasksConfig.test.ts \
        shared/config/gameConfig.ts
git commit -m "feat: add daily tasks schemas, config, and reward helpers"
```

---

### Task 2: Daily Reset + Progress Tracking

**Files:**
- Modify: `shared/engine/lobbyUtils.ts`
- Modify: `shared/engine/processCommand.ts`
- Modify: `shared/engine/lobbyCommands.ts`
- Create: `shared/engine/__tests__/dailyTasks.test.ts`

**Interfaces:**
- Consumes: `DAILY_TASKS`, `getTaskProgress` from Task 1; `GameState.dailyTasks`
- Produces: Updated `checkDailyReset`; progress counters incremented in command handlers

- [ ] **Step 1: Write failing tests in `shared/engine/__tests__/dailyTasks.test.ts`**

```ts
import { checkDailyReset } from '../lobbyUtils';
import { processCommand } from '../processCommand';
import { gameConfig, createInitialState } from '../../config/gameConfig';

const DAY_MS = 24 * 60 * 60 * 1000;

function makeState(overrides = {}) {
  return {
    ...createInitialState(gameConfig),
    lastDailyReset: 1000,
    ...overrides,
  };
}

describe('checkDailyReset — dailyTasks', () => {
  it('resets progress and claimed at midnight', () => {
    const state = makeState({
      dailyTasks: {
        progress: { visitorsLifted: 50, vipsLifted: 0, goodsBought: 30, residentsAdded: 0,
          gemsPurchased: 0, goodsCollected: 0, floorsBuilt: 0, residentsEvicted: 0, goodsListed: 0 },
        claimed: ['transporter'],
        doubleRewardActive: false,
      },
    });
    const next = checkDailyReset(state, 1000 + DAY_MS + 1);
    expect(next.dailyTasks.progress.visitorsLifted).toBe(0);
    expect(next.dailyTasks.progress.goodsBought).toBe(0);
    expect(next.dailyTasks.claimed).toEqual([]);
  });

  it('sets doubleRewardActive when 7+ tasks were completed', () => {
    // Complete 7 tasks: visitorsLifted >=100, goodsBought >=50, goodsListed >=100,
    // goodsCollected >=150, floorsBuilt >=1, residentsEvicted >=15, residentsAdded >=25
    const state = makeState({
      dailyTasks: {
        progress: { visitorsLifted: 100, vipsLifted: 0, goodsBought: 50, residentsAdded: 25,
          gemsPurchased: 0, goodsCollected: 150, floorsBuilt: 1, residentsEvicted: 15, goodsListed: 100 },
        claimed: [],
        doubleRewardActive: false,
      },
    });
    const next = checkDailyReset(state, 1000 + DAY_MS + 1);
    expect(next.dailyTasks.doubleRewardActive).toBe(true);
  });

  it('does not set doubleRewardActive when fewer than 7 tasks completed', () => {
    const state = makeState({
      dailyTasks: {
        progress: { visitorsLifted: 100, vipsLifted: 0, goodsBought: 0, residentsAdded: 0,
          gemsPurchased: 0, goodsCollected: 0, floorsBuilt: 0, residentsEvicted: 0, goodsListed: 0 },
        claimed: [],
        doubleRewardActive: false,
      },
    });
    const next = checkDailyReset(state, 1000 + DAY_MS + 1);
    expect(next.dailyTasks.doubleRewardActive).toBe(false);
  });

  it('does not reset if not past midnight', () => {
    const state = makeState({ dailyTasks: { ...createInitialState(gameConfig).dailyTasks, progress: { ...createInitialState(gameConfig).dailyTasks.progress, visitorsLifted: 42 } } });
    const next = checkDailyReset(state, 1000 + 100);
    expect(next.dailyTasks.progress.visitorsLifted).toBe(42);
  });
});

describe('progress tracking', () => {
  it('increments goodsBought on buy command', () => {
    const state = makeState({ balance: 999999 });
    const floor = state.floors[0];
    const cmd = { id: '1', type: 'buy' as const, floorId: floor.id, slotIdx: 0, typeId: floor.productions[0].typeId!, timestamp: Date.now() };
    const result = processCommand(state, cmd, gameConfig, Date.now());
    expect(result.success).toBe(true);
    expect(result.state.dailyTasks.progress.goodsBought).toBe(1);
  });

  it('increments residentsEvicted on evict_worker', () => {
    const state = makeState();
    const hotelWorker = state.workers.find(w => w.assignedFloorId === null);
    if (!hotelWorker) throw new Error('No hotel worker in initial state');
    const cmd = { id: '2', type: 'evict_worker' as const, workerId: hotelWorker.id, timestamp: Date.now() };
    const result = processCommand(state, cmd, gameConfig, Date.now());
    expect(result.success).toBe(true);
    expect(result.state.dailyTasks.progress.residentsEvicted).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/Apple/IT/tinytower
npx jest dailyTasks --no-coverage 2>&1 | tail -20
```

Expected: FAIL.

- [ ] **Step 3: Update `checkDailyReset` in `shared/engine/lobbyUtils.ts`**

Add import at the top:

```ts
import { DAILY_TASKS, getTaskProgress } from '../config/dailyTasksConfig';
```

Replace the reset block inside `checkDailyReset` (the `if (commandTimestamp >= nextMidnight)` branch):

```ts
if (commandTimestamp >= nextMidnight) {
  const completedCount = DAILY_TASKS.filter(
    (task) => getTaskProgress(state, task) >= task.threshold,
  ).length;

  return {
    ...state,
    dailyTips: 0,
    dailyGemsCollected: 0,
    dailyTipsStage1Claimed: false,
    dailyTipsStage2Claimed: false,
    dailyFillLobbyUses: 0,
    lastDailyReset: getMidnightBefore(commandTimestamp),
    dailyTasks: {
      progress: {
        visitorsLifted: 0, vipsLifted: 0, goodsBought: 0, residentsAdded: 0,
        gemsPurchased: 0, goodsCollected: 0, floorsBuilt: 0, residentsEvicted: 0, goodsListed: 0,
      },
      claimed: [],
      doubleRewardActive: completedCount >= 7,
    },
  };
}
```

- [ ] **Step 4: Increment progress counters in `shared/engine/processCommand.ts`**

**4a. `handleBuy`** — in the return `state` object, add after `stats`:

```ts
dailyTasks: {
  ...state.dailyTasks,
  progress: { ...state.dailyTasks.progress, goodsBought: state.dailyTasks.progress.goodsBought + 1 },
},
```

**4b. `handleList`** — same pattern, `goodsListed: state.dailyTasks.progress.goodsListed + 1`.

**4c. `handleCollect`** — same pattern, `goodsCollected: state.dailyTasks.progress.goodsCollected + 1`.

**4d. `handleEvictWorker`** — same pattern, `residentsEvicted: state.dailyTasks.progress.residentsEvicted + 1`.

**4e. `handleOpenFloor`** — in the return `state` object, add `dailyTasks` with `floorsBuilt: state.dailyTasks.progress.floorsBuilt + 1`.

- [ ] **Step 5: Increment `visitorsLifted` and `residentsAdded` in `shared/engine/lobbyCommands.ts`**

**5a. `handleCollectTip`** — in the `newState = { ...newState, ... }` block, add:

```ts
dailyTasks: {
  ...newState.dailyTasks,
  progress: {
    ...newState.dailyTasks.progress,
    visitorsLifted: newState.dailyTasks.progress.visitorsLifted + 1,
  },
},
```

**5b. `handleDeliverAll`** — in the final `newState = { ...newState, ... }` block, add:

```ts
dailyTasks: {
  ...newState.dailyTasks,
  progress: {
    ...newState.dailyTasks.progress,
    visitorsLifted: newState.dailyTasks.progress.visitorsLifted + passengersDelivered,
  },
},
```

**5c. `applyVisitorEffect`** — wrap the existing residents logic to count additions:

After `let { balance, gems, dailyTips, dailyGemsCollected, workers, floors } = state;` add:

```ts
const workersBefore = workers.length;
```

After the existing `if (role === 'guest' && targetFloor === 1) { ... }` block, add:

```ts
const residentsGained = workers.length - workersBefore;
```

Then in the `return` statement of `applyVisitorEffect`, spread in (the function returns `{ ...state, balance, gems, ... }`):

```ts
dailyTasks: residentsGained > 0 ? {
  ...state.dailyTasks,
  progress: {
    ...state.dailyTasks.progress,
    residentsAdded: state.dailyTasks.progress.residentsAdded + residentsGained,
  },
} : state.dailyTasks,
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd /Users/Apple/IT/tinytower
npx jest dailyTasks --no-coverage 2>&1 | tail -20
```

Expected: all PASS.

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 8: Commit**

```bash
cd /Users/Apple/IT/tinytower
git add shared/engine/lobbyUtils.ts shared/engine/processCommand.ts \
        shared/engine/lobbyCommands.ts shared/engine/__tests__/dailyTasks.test.ts
git commit -m "feat: track daily task progress in game engine"
```

---

### Task 3: `claim_daily_task` Command Handler

**Files:**
- Modify: `shared/engine/processCommand.ts`

**Interfaces:**
- Consumes: `DAILY_TASKS`, `getCoinMultiplier`, `getMaterialCount`, `getTaskProgress` (Task 1); `ClaimDailyTaskCommandSchema` (Task 1)
- Produces: `processCommand` handles `'claim_daily_task'`

- [ ] **Step 1: Add failing tests to `shared/engine/__tests__/dailyTasks.test.ts`**

Append at the bottom of the file:

```ts
describe('claim_daily_task', () => {
  const baseCmd = {
    id: 'c1', type: 'claim_daily_task' as const, timestamp: Date.now(),
    taskKey: 'transporter', tokenCount: 3, tokenColor: 'green' as const,
  };

  function stateWithProgress(visitorsLifted: number) {
    return makeState({
      balance: 0, gems: 0,
      tokens: { green: 0, blue: 0, yellow: 0, purple: 0, red: 0 },
      dailyTasks: {
        progress: { visitorsLifted, vipsLifted: 0, goodsBought: 0, residentsAdded: 0,
          gemsPurchased: 0, goodsCollected: 0, floorsBuilt: 0, residentsEvicted: 0, goodsListed: 0 },
        claimed: [],
        doubleRewardActive: false,
      },
    });
  }

  it('fails when progress not reached', () => {
    const result = processCommand(stateWithProgress(50), baseCmd, gameConfig, Date.now(), 1);
    expect(result.success).toBe(false);
  });

  it('fails when already claimed', () => {
    const state = { ...stateWithProgress(100), dailyTasks: { ...stateWithProgress(100).dailyTasks, claimed: ['transporter'] } };
    const result = processCommand(state, baseCmd, gameConfig, Date.now(), 1);
    expect(result.success).toBe(false);
  });

  it('adds coins (baseCoins × multiplier) to balance', () => {
    // transporter baseCoins=1300, level 1 → multiplier 1 → +1300
    const result = processCommand(stateWithProgress(100), baseCmd, gameConfig, Date.now(), 1);
    expect(result.success).toBe(true);
    expect(result.state.balance).toBe(1300);
  });

  it('adds fixed gems regardless of level', () => {
    const result = processCommand(stateWithProgress(100), baseCmd, gameConfig, Date.now(), 25);
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(1); // transporter gems = 1
  });

  it('doubles coins when doubleRewardActive', () => {
    const state = { ...stateWithProgress(100), dailyTasks: { ...stateWithProgress(100).dailyTasks, doubleRewardActive: true } };
    const result = processCommand(state, baseCmd, gameConfig, Date.now(), 1);
    expect(result.state.balance).toBe(2600); // 1300 × 2
  });

  it('does NOT double gems when doubleRewardActive', () => {
    const state = { ...stateWithProgress(100), dailyTasks: { ...stateWithProgress(100).dailyTasks, doubleRewardActive: true } };
    const result = processCommand(state, baseCmd, gameConfig, Date.now(), 1);
    expect(result.state.gems).toBe(1); // still 1
  });

  it('adds tokens of specified color and count', () => {
    const result = processCommand(stateWithProgress(100), baseCmd, gameConfig, Date.now(), 1);
    expect(result.state.tokens.green).toBe(3);
  });

  it('marks task as claimed', () => {
    const result = processCommand(stateWithProgress(100), baseCmd, gameConfig, Date.now(), 1);
    expect(result.state.dailyTasks.claimed).toContain('transporter');
  });

  it('adds materials for build_floor task', () => {
    const stateWithFloor = makeState({
      tokens: { green: 0, blue: 0, yellow: 0, purple: 0, red: 0 },
      tools: { briks: 0, glass: 0, nails: 0, screw: 0 },
      dailyTasks: {
        progress: { visitorsLifted: 0, vipsLifted: 0, goodsBought: 0, residentsAdded: 0,
          gemsPurchased: 0, goodsCollected: 0, floorsBuilt: 1, residentsEvicted: 0, goodsListed: 0 },
        claimed: [],
        doubleRewardActive: false,
      },
    });
    const buildCmd = { ...baseCmd, taskKey: 'build_floor', materialType: 'briks' as const };
    // level 1 → getMaterialCount(1) = 2
    const result = processCommand(stateWithFloor, buildCmd, gameConfig, Date.now(), 1);
    expect(result.success).toBe(true);
    expect(result.state.tools.briks).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/Apple/IT/tinytower
npx jest dailyTasks --no-coverage 2>&1 | tail -20
```

Expected: FAIL.

- [ ] **Step 3: Add `claim_daily_task` to the `switch` in `processCommand.ts`**

In the `switch` statement, after `case 'dev_add_gems':`, add:

```ts
case 'claim_daily_task':
  return handleClaimDailyTask(state, command, playerLevel);
```

Then add the handler function after `handleEvictWorker`:

```ts
function handleClaimDailyTask(
  state: GameState,
  command: Extract<Command, { type: 'claim_daily_task' }>,
  playerLevel: number,
): ProcessResult {
  const taskConfig = DAILY_TASKS.find((t) => t.key === command.taskKey);
  if (!taskConfig) return { success: false, state, error: 'Unknown task' };
  if (state.dailyTasks.claimed.includes(command.taskKey)) {
    return { success: false, state, error: 'Already claimed' };
  }

  const progress = getTaskProgress(state, taskConfig);
  if (progress < taskConfig.threshold) {
    return { success: false, state, error: 'Task not complete' };
  }

  const multiplier = getCoinMultiplier(playerLevel);
  const doubleMultiplier = state.dailyTasks.doubleRewardActive ? 2 : 1;
  const coins = taskConfig.rewards.baseCoins * multiplier * doubleMultiplier;

  let tools = state.tools;
  if (taskConfig.rewards.hasMaterials && command.materialType) {
    const matCount = getMaterialCount(playerLevel) * doubleMultiplier;
    tools = { ...tools, [command.materialType]: (tools[command.materialType] ?? 0) + matCount };
  }

  const tokens = {
    ...state.tokens,
    [command.tokenColor]: state.tokens[command.tokenColor] + command.tokenCount,
  };

  return {
    success: true,
    state: {
      ...state,
      balance: state.balance + coins,
      gems: state.gems + taskConfig.rewards.gems,
      tools,
      tokens,
      dailyTasks: {
        ...state.dailyTasks,
        claimed: [...state.dailyTasks.claimed, command.taskKey],
      },
    },
  };
}
```

Add imports at the top of `processCommand.ts`:

```ts
import { DAILY_TASKS, getCoinMultiplier, getMaterialCount, getTaskProgress } from '../config/dailyTasksConfig';
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/Apple/IT/tinytower
npx jest dailyTasks --no-coverage 2>&1 | tail -20
```

Expected: all PASS.

- [ ] **Step 5: Run full shared test suite**

```bash
cd /Users/Apple/IT/tinytower
npx jest --testPathPattern="shared" --no-coverage 2>&1 | tail -20
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/Apple/IT/tinytower
git add shared/engine/processCommand.ts shared/engine/__tests__/dailyTasks.test.ts
git commit -m "feat: add claim_daily_task command handler"
```

---

### Task 4: Prisma Migration + Server Sync

**Files:**
- Modify: `server/prisma/schema.prisma`
- Modify: `server/src/sync/sync.service.ts`

**Interfaces:**
- Consumes: `GameState.tokens`, `GameState.dailyTasks` (Task 1)
- Produces: tokens and daily task state persisted and restored via `PlayerState`

- [ ] **Step 1: Add fields to `server/prisma/schema.prisma`**

In `model PlayerState`, after `lastDailyLoginClaimedAt`, add:

```prisma
tokenGreen             Int     @default(0)
tokenBlue              Int     @default(0)
tokenYellow            Int     @default(0)
tokenPurple            Int     @default(0)
tokenRed               Int     @default(0)
dailyTasksProgress     Json    @default("{}")
dailyTasksClaimed      Json    @default("[]")
dailyTasksDoubleReward Boolean @default(false)
```

- [ ] **Step 2: Run migration**

```bash
cd /Users/Apple/IT/tinytower/server
npx prisma migrate dev --name add_daily_tasks_and_tokens
```

Expected: ends with `✔ Generated Prisma Client`.

- [ ] **Step 3: Verify generated client has the fields**

```bash
grep -n "tokenGreen\|dailyTasksProgress" /Users/Apple/IT/tinytower/server/node_modules/.prisma/client/index.d.ts | head -5
```

Expected: at least one match.

- [ ] **Step 4: Update `playerState.upsert` in `sync.service.ts`**

In both the `create` and `update` sections of the `tx.playerState.upsert` call, add:

```ts
tokenGreen:             gameState.tokens.green,
tokenBlue:              gameState.tokens.blue,
tokenYellow:            gameState.tokens.yellow,
tokenPurple:            gameState.tokens.purple,
tokenRed:               gameState.tokens.red,
dailyTasksProgress:     gameState.dailyTasks.progress,
dailyTasksClaimed:      gameState.dailyTasks.claimed,
dailyTasksDoubleReward: gameState.dailyTasks.doubleRewardActive,
```

- [ ] **Step 5: Update `gameStateFromDb` in `sync.service.ts`**

In the returned object of `gameStateFromDb`, after `xpBonusPercent`, add:

```ts
tokens: {
  green:  s?.tokenGreen  ?? 0,
  blue:   s?.tokenBlue   ?? 0,
  yellow: s?.tokenYellow ?? 0,
  purple: s?.tokenPurple ?? 0,
  red:    s?.tokenRed    ?? 0,
},
dailyTasks: {
  progress: (s?.dailyTasksProgress as GameState['dailyTasks']['progress']) ?? {
    visitorsLifted: 0, vipsLifted: 0, goodsBought: 0, residentsAdded: 0,
    gemsPurchased: 0, goodsCollected: 0, floorsBuilt: 0, residentsEvicted: 0, goodsListed: 0,
  },
  claimed: (s?.dailyTasksClaimed as string[]) ?? [],
  doubleRewardActive: s?.dailyTasksDoubleReward ?? false,
},
```

Add the `GameState` import if not already present:

```ts
import type { GameState } from '@shared/schemas/gameState';
```

- [ ] **Step 6: Run server tests**

```bash
cd /Users/Apple/IT/tinytower/server
npx jest --no-coverage 2>&1 | tail -20
```

Expected: all PASS (no regressions).

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower/server
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 8: Commit**

```bash
cd /Users/Apple/IT/tinytower
git add server/prisma/schema.prisma server/prisma/migrations/ server/src/sync/sync.service.ts
git commit -m "feat: persist daily task progress and tokens in PlayerState"
```

---

### Task 5: Client Store

**Files:**
- Modify: `src/stores/gameStore.ts`

**Interfaces:**
- Consumes: `ClaimDailyTaskCommandSchema` (Task 1); `DAILY_TASKS` (Task 1)
- Produces:
  - `useGameStore(s => s.claimDailyTask)` → `(taskKey: string) => void`
  - `hydrate`, `reset` handle `tokens` and `dailyTasks`

- [ ] **Step 1: Add `claimDailyTask` to `GameActions` interface**

After `dismissDailyLoginReward`:

```ts
claimDailyTask: (taskKey: string) => void;
```

- [ ] **Step 2: Add `claimDailyTask` implementation in `create()`**

After `dismissDailyLoginReward`:

```ts
claimDailyTask: (taskKey) => {
  const COLORS = ['green', 'blue', 'yellow', 'purple', 'red'] as const;
  const MATERIAL_TYPES = ['briks', 'glass', 'nails', 'screw'] as const;
  const taskConfig = DAILY_TASKS.find((t) => t.key === taskKey);
  const tokenCount = Math.floor(Math.random() * 5) + 1;
  const tokenColor = COLORS[Math.floor(Math.random() * COLORS.length)];
  const materialType = taskConfig?.rewards.hasMaterials
    ? MATERIAL_TYPES[Math.floor(Math.random() * MATERIAL_TYPES.length)]
    : undefined;
  executeCommand(get, set, {
    id: uuid(),
    type: 'claim_daily_task',
    taskKey,
    tokenCount,
    tokenColor,
    materialType,
    timestamp: clock.now(),
  });
},
```

Add import at the top of `gameStore.ts` (near other shared imports):

```ts
import { DAILY_TASKS } from '../../shared/config/dailyTasksConfig';
```

- [ ] **Step 3: Update `hydrate` to include new fields**

After `categoryProgress: state.categoryProgress ?? {}` in `hydrate`, add:

```ts
tokens: state.tokens ?? { green: 0, blue: 0, yellow: 0, purple: 0, red: 0 },
dailyTasks: state.dailyTasks ?? { progress: { visitorsLifted: 0, vipsLifted: 0, goodsBought: 0, residentsAdded: 0, gemsPurchased: 0, goodsCollected: 0, floorsBuilt: 0, residentsEvicted: 0, goodsListed: 0 }, claimed: [], doubleRewardActive: false },
```

- [ ] **Step 4: Update `reset` to clear new fields**

After `pendingDailyLoginReward: null` in `reset`, add:

```ts
tokens: { green: 0, blue: 0, yellow: 0, purple: 0, red: 0 },
dailyTasks: { progress: { visitorsLifted: 0, vipsLifted: 0, goodsBought: 0, residentsAdded: 0, gemsPurchased: 0, goodsCollected: 0, floorsBuilt: 0, residentsEvicted: 0, goodsListed: 0 }, claimed: [], doubleRewardActive: false },
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/Apple/IT/tinytower
git add src/stores/gameStore.ts
git commit -m "feat: add claimDailyTask action to game store"
```

---

### Task 6: Daily Tasks Screen

**Files:**
- Create: `app/daily-tasks.tsx`
- Modify: `app/_layout.tsx`
- Modify: `src/i18n/locales/en/hotel.json`

**Interfaces:**
- Consumes: `useGameStore`, `DAILY_TASKS`, `getCoinMultiplier`, `getMaterialCount`, `getTaskProgress`
- Produces: `/daily-tasks` screen navigable via `router.push('/daily-tasks')`

- [ ] **Step 1: Add i18n keys to `src/i18n/locales/en/hotel.json`**

Add a `dailyTasks` block:

```json
"dailyTasks": {
  "title": "Daily Tasks",
  "resetsIn": "Resets in {{time}}",
  "doubleReward": "⚡ Double rewards active today!",
  "collect": "Collect",
  "progress": "{{current}} of {{total}}",
  "tokens": "Tokens"
}
```

- [ ] **Step 2: Register route in `app/_layout.tsx`**

After the `forum-screen` Stack.Screen, add:

```tsx
<Stack.Screen name="daily-tasks" options={{ animation: 'slide_from_right' }} />
```

- [ ] **Step 3: Create `app/daily-tasks.tsx`**

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, ImageBackground,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../src/stores/gameStore';
import {
  DAILY_TASKS, getCoinMultiplier, getMaterialCount, getTaskProgress,
} from '../shared/config/dailyTasksConfig';
import { formatNum } from '../src/utils/format';

const TOKEN_COLORS: Record<string, string> = {
  green: '#3FA535', blue: '#3376E5', yellow: '#E5A72E', purple: '#9A6FD0', red: '#E05A4A',
};

const TOKEN_ICONS: Record<string, ReturnType<typeof require>> = {
  green:  require('../assets/img/tokens/token_green.png'),
  blue:   require('../assets/img/tokens/token_blue.png'),
  yellow: require('../assets/img/tokens/token_yellow.png'),
  purple: require('../assets/img/tokens/token_purple.png'),
  red:    require('../assets/img/tokens/token_red.png'),
};

const DIAMOND_ICON = require('../assets/img/diamond.png');
const COIN_ICON = require('../assets/img/coin.png');

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0h 0m';
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(value / max, 1);
  return (
    <View style={styles.barBg}>
      <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
    </View>
  );
}

export default function DailyTasksScreen() {
  const { t } = useTranslation('hotel');
  const state = useGameStore((s) => s);
  const claimDailyTask = useGameStore((s) => s.claimDailyTask);
  const playerLevel = useGameStore((s) => s.playerLevel);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const resetAt = state.lastDailyReset + 24 * 60 * 60 * 1000;
  const msUntilReset = resetAt - now;

  const handleClaim = useCallback((taskKey: string) => {
    claimDailyTask(taskKey);
  }, [claimDailyTask]);

  const multiplier = getCoinMultiplier(playerLevel);
  const matCount = getMaterialCount(playerLevel);

  return (
    <ImageBackground
      source={require('../assets/img/backgroung/bg15.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>{t('dailyTasks.title')}</Text>

        {/* Token balance */}
        <View style={styles.tokenRow}>
          {(['green', 'blue', 'yellow', 'purple', 'red'] as const).map((color) => (
            <View key={color} style={styles.tokenChip}>
              <Image source={TOKEN_ICONS[color]} style={styles.tokenIcon} contentFit="contain" />
              <Text style={[styles.tokenCount, { color: TOKEN_COLORS[color] }]}>
                {state.tokens[color]}
              </Text>
            </View>
          ))}
        </View>

        {/* Timer */}
        <Text style={styles.timer}>
          {t('dailyTasks.resetsIn', { time: formatCountdown(msUntilReset) })}
        </Text>

        {/* Double reward banner */}
        {state.dailyTasks.doubleRewardActive && (
          <View style={styles.doubleBanner}>
            <Text style={styles.doubleBannerText}>{t('dailyTasks.doubleReward')}</Text>
          </View>
        )}

        {/* Task cards */}
        {DAILY_TASKS.map((task) => {
          const progress = getTaskProgress(state, task);
          const completed = progress >= task.threshold;
          const claimed = state.dailyTasks.claimed.includes(task.key);
          const coins = task.rewards.baseCoins * multiplier * (state.dailyTasks.doubleRewardActive ? 2 : 1);

          return (
            <View key={task.key} style={[styles.card, claimed && styles.cardClaimed]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, claimed && styles.cardTitleClaimed]}>
                  {task.title}
                </Text>
                {claimed && <Text style={styles.claimedCheck}>✓</Text>}
              </View>

              <ProgressBar value={progress} max={task.threshold} />

              <View style={styles.progressRow}>
                <Text style={styles.progressText}>
                  {t('dailyTasks.progress', {
                    current: Math.min(progress, task.threshold),
                    total: task.threshold,
                  })}
                </Text>
              </View>

              {!claimed && (
                <View style={styles.rewardRow}>
                  <View style={styles.rewardChip}>
                    <Image source={COIN_ICON} style={styles.rewardIcon} contentFit="contain" />
                    <Text style={styles.rewardCoins}>+{formatNum(coins)}</Text>
                  </View>
                  <View style={styles.rewardChip}>
                    <Image source={DIAMOND_ICON} style={styles.rewardIcon} contentFit="contain" />
                    <Text style={styles.rewardGems}>+{task.rewards.gems}</Text>
                  </View>
                  {task.rewards.hasMaterials && (
                    <View style={styles.rewardChip}>
                      <Text style={styles.rewardMat}>
                        +{matCount * (state.dailyTasks.doubleRewardActive ? 2 : 1)} 🧱
                      </Text>
                    </View>
                  )}
                  <View style={styles.rewardChip}>
                    <Text style={styles.rewardToken}>+1–5 🎲</Text>
                  </View>
                </View>
              )}

              {completed && !claimed && (
                <Pressable
                  onPress={() => handleClaim(task.key)}
                  style={({ pressed }) => [styles.collectBtn, pressed && { opacity: 0.8 }]}
                >
                  <LinearGradient colors={['#74D44F', '#5BA63C']} style={styles.collectGradient}>
                    <Text style={styles.collectText}>{t('dailyTasks.collect')}</Text>
                  </LinearGradient>
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.closeBtnText}>✕</Text>
      </Pressable>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingTop: 64, paddingHorizontal: 16, paddingBottom: 120, gap: 12 },
  heading: { fontFamily: 'Fredoka_700Bold', fontSize: 28, color: '#27331F', marginBottom: 4 },

  tokenRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  tokenChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  tokenIcon: { width: 18, height: 18 },
  tokenCount: { fontFamily: 'Fredoka_700Bold', fontSize: 15 },

  timer: { fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: '#9BA3B0', marginBottom: 4 },

  doubleBanner: { backgroundColor: '#FFF4D6', borderRadius: 14, padding: 10, alignItems: 'center', marginBottom: 4 },
  doubleBannerText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14, color: '#B07A00' },

  card: { backgroundColor: '#fff', borderRadius: 20, padding: 16, gap: 10, shadowColor: 'rgba(60,80,45,1)', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  cardClaimed: { opacity: 0.55 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16, color: '#27331F', flex: 1 },
  cardTitleClaimed: { color: '#9BA3B0' },
  claimedCheck: { fontSize: 18, color: '#3FA535' },

  barBg: { height: 7, borderRadius: 4, backgroundColor: 'rgba(63,165,53,0.15)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: '#3FA535' },

  progressRow: { alignItems: 'flex-end' },
  progressText: { fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: '#7C8A6E' },

  rewardRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rewardChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F4F8F2', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  rewardIcon: { width: 14, height: 14 },
  rewardCoins: { fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: '#C28A22' },
  rewardGems: { fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: '#2592AB' },
  rewardMat: { fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: '#6B7A5E' },
  rewardToken: { fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: '#7A6B9E' },

  collectBtn: { borderRadius: 12, overflow: 'hidden' },
  collectGradient: { alignItems: 'center', paddingVertical: 10 },
  collectText: { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#fff' },

  closeBtn: { position: 'absolute', bottom: 40, alignSelf: 'center', width: 56, height: 56, borderRadius: 28, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 20, color: '#fff', lineHeight: 22 },
});
```

> **Note:** Token icons at `assets/img/tokens/token_{color}.png` are provided by the user. If they don't exist yet, use placeholder `require('../assets/img/diamond.png')` for all 5 and replace later.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
cd /Users/Apple/IT/tinytower
git add app/daily-tasks.tsx app/_layout.tsx src/i18n/locales/en/hotel.json
git commit -m "feat: add daily tasks screen and route"
```

---

### Task 7: Profile Button + FAB Indicator

**Files:**
- Modify: `app/(tabs)/profile.tsx`
- Create: `src/components/DailyTasksFAB.tsx`
- Modify: `app/(tabs)/game.tsx`

**Interfaces:**
- Consumes: `useGameStore`, `DAILY_TASKS`, `getTaskProgress`
- Produces: Profile button navigating to `/daily-tasks`; FAB indicator badge on game screen

- [ ] **Step 1: Add Daily Tasks button to `app/(tabs)/profile.tsx`**

Find the existing `<Pressable onPress={() => router.push('/achievements')} ...>` block. After the Referrals button (which follows it), add a new button using the same pattern:

```tsx
<Pressable
  onPress={() => router.push('/daily-tasks')}
  style={({ pressed }) => [styles.achievementsButton, pressed && styles.achievementsButtonPressed]}
>
  <Image source={require('../../assets/img/dayliQuests.png')} style={styles.achievementsIcon} />
  <Text style={styles.achievementsButtonText}>Daily Tasks</Text>
</Pressable>
```

- [ ] **Step 2: Create `src/components/DailyTasksFAB.tsx`**

```tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';

const DAILY_ICON = require('../../assets/img/dayliQuests.png');

interface Props {
  unclaimedCount: number;
  hasQuickAction: boolean;
}

export default function DailyTasksFAB({ unclaimedCount, hasQuickAction }: Props) {
  if (unclaimedCount === 0) return null;

  const handlePress = () => router.push('/daily-tasks');

  if (hasQuickAction) {
    return (
      <View style={styles.badge} pointerEvents="none">
        <Text style={styles.badgeText}>{unclaimedCount}</Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.fab, pressed && { opacity: 0.82 }]}
    >
      <Image source={DAILY_ICON} style={styles.icon} contentFit="contain" />
      <View style={styles.fabBadge}>
        <Text style={styles.badgeText}>{unclaimedCount}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 96,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#3FA535',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 16,
    elevation: 14,
  },
  icon: { width: 28, height: 28 },
  badge: {
    position: 'absolute',
    right: 16,
    bottom: 144,  // above FAB at bottom: 96 + 54 - 6
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3FA535',
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  fabBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3FA535',
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 11,
    color: '#fff',
    lineHeight: 13,
  },
});
```

- [ ] **Step 3: Add `unclaimedDailyTasksCount` selector and `DailyTasksFAB` to `app/(tabs)/game.tsx`**

Add import near other component imports:

```tsx
import DailyTasksFAB from '../../src/components/DailyTasksFAB';
import { DAILY_TASKS, getTaskProgress } from '../../shared/config/dailyTasksConfig';
```

Add selector near other `useGameStore` selectors (e.g., after `playerLevel`):

```tsx
const unclaimedDailyTasksCount = useGameStore((s) =>
  DAILY_TASKS.filter((task) => {
    const progress = getTaskProgress(s, task);
    return progress >= task.threshold && !s.dailyTasks.claimed.includes(task.key);
  }).length,
);
```

Render `DailyTasksFAB` immediately after `<QuickActionFAB ... />`:

```tsx
<DailyTasksFAB
  unclaimedCount={unclaimedDailyTasksCount}
  hasQuickAction={availableMode !== null}
/>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/Apple/IT/tinytower
git add app/\(tabs\)/profile.tsx src/components/DailyTasksFAB.tsx app/\(tabs\)/game.tsx
git commit -m "feat: add daily tasks profile button and FAB indicator"
```
