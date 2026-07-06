# Achievement Stats System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track global production counters (totalBought / totalListed / totalSold) for a multi-tier achievement system; rewards auto-credited server-side, popup notifications on client.

**Architecture:** Stats live in `GameState` for optimistic client updates and in dedicated DB columns for authoritative leaderboards. The server detects newly unlocked achievement tiers during sync, applies rewards inside the transaction, and returns them in `SyncResponse`. The client shows a popup queue and persists it in MMKV.

**Tech Stack:** React Native / Expo, Zustand, react-native-mmkv, Zod, NestJS, Prisma / PostgreSQL, TypeScript.

## Global Constraints

- All shared engine code must remain pure (no side effects, no imports from `src/` or `server/`).
- Every new Zod schema field that has a `.default()` must also be explicitly set in `createInitialState` and in all `PersistedGameState` save/load helpers.
- Do not change command IDs, command schemas, or the sync wire format beyond the `newAchievements` addition.
- `AchievementGrant` is the shared type used by both client and server for newly-unlocked tiers.
- Exact thresholds and reward values in `gameConfig.ts` are placeholders — marked with `// TODO: tune`.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `shared/schemas/gameState.ts` | Modify | Add `StatsSchema`, add `stats` field to `GameStateSchema` |
| `shared/schemas/gameConfig.ts` | Modify | Add `AchievementRewardSchema`, `AchievementTierSchema`, `AchievementConfigSchema`, add `achievements` to `GameConfigSchema` |
| `shared/types/index.ts` | Modify | Export `Stats`, `AchievementConfig`, `AchievementTierConfig`, `AchievementGrant` |
| `shared/config/gameConfig.ts` | Modify | Add `achievements` array to `rawConfig`, add `stats` to `createInitialState` |
| `shared/engine/processCommand.ts` | Modify | Increment `stats` in `handleBuy`, `handleList`, `handleCollect` |
| `shared/engine/__tests__/processCommand.test.ts` | Modify | Add `achievements: []` to testConfig; add stats-increment tests |
| `shared/engine/__tests__/lobbyCommands.test.ts` | Modify | Add `achievements: []` to testConfig |
| `shared/engine/__tests__/lobbyUtils.test.ts` | Modify | Add `achievements: []` to testConfig |
| `server/prisma/schema.prisma` | Modify | Add stat columns to Player, add `PlayerAchievement` model |
| `server/src/sync/sync.service.ts` | Modify | Increment DB counters, check achievement tiers, return `newAchievements` |
| `src/stores/gameStore.ts` | Modify | Add `achievementQueue`, `dismissAchievement`; update `executeCommand`, `reconcile`, `hydrate` |
| `src/services/sync.ts` | Modify | Add `newAchievements` to `SyncResponse`, pass to store |
| `src/services/persistence.ts` | Modify | Add `stats` and `achievementQueue` to save/load |
| `src/components/AchievementModal.tsx` | Create | Popup UI for achievement notification |
| `app/(tabs)/game.tsx` | Modify | Render `<AchievementModal />` |

---

## Task 1: Shared Schemas + Types

**Files:**
- Modify: `shared/schemas/gameState.ts`
- Modify: `shared/schemas/gameConfig.ts`
- Modify: `shared/types/index.ts`

**Interfaces:**
- Produces: `StatsSchema`, `AchievementConfigSchema`, `AchievementGrant` — consumed by Tasks 2, 3, 5, 6

- [ ] **Step 1: Add StatsSchema to `shared/schemas/gameState.ts`**

Open `shared/schemas/gameState.ts`. After the existing imports, add `StatsSchema` and add `stats` to `GameStateSchema`:

```ts
// After ToolsSchema and before FloorStateSchema, add:
export const StatsSchema = z.object({
  totalBought: z.number().int().nonnegative().default(0),
  totalListed: z.number().int().nonnegative().default(0),
  totalSold:   z.number().int().nonnegative().default(0),
});

// Inside GameStateSchema, add after openedFloorTypes:
  stats: StatsSchema.default({ totalBought: 0, totalListed: 0, totalSold: 0 }),
```

Final `GameStateSchema` should end with:
```ts
  openedFloorTypes: z.record(z.string(), z.string()).default({}),
  stats: StatsSchema.default({ totalBought: 0, totalListed: 0, totalSold: 0 }),
});
```

- [ ] **Step 2: Add achievement schemas to `shared/schemas/gameConfig.ts`**

At the bottom of the file, before the closing, add:

```ts
export const AchievementRewardSchema = z.object({
  coins: z.number().int().nonnegative().optional(),
  gems:  z.number().int().nonnegative().optional(),
});

export const AchievementTierSchema = z.object({
  tier:      z.number().int().positive(),
  threshold: z.number().int().positive(),
  reward:    AchievementRewardSchema,
});

export const AchievementConfigSchema = z.object({
  id:   z.string(),
  stat: z.enum(['totalBought', 'totalListed', 'totalSold']),
  tiers: z.array(AchievementTierSchema).min(1),
});
```

Then add `achievements` to `GameConfigSchema`:
```ts
export const GameConfigSchema = z.object({
  floors: z.array(FloorConfigSchema).min(1),
  productionTypes: z.record(z.string(), ProductionTypeConfigSchema),
  floorTypes: z.record(z.string(), FloorTypeConfigSchema),
  startingBalance: z.number().nonnegative(),
  hotelCapacity: z.number().int().positive(),
  lobbyConfig: LobbyConfigSchema,
  floorUnlocks: z.array(FloorUnlockConfigSchema).default([]),
  achievements: z.array(AchievementConfigSchema).default([]),  // add this line
});
```

- [ ] **Step 3: Export new types from `shared/types/index.ts`**

Add to imports at top:
```ts
import { StatsSchema } from '../schemas/gameState';
import { AchievementConfigSchema, AchievementTierSchema, AchievementRewardSchema } from '../schemas/gameConfig';
```

Add to exports:
```ts
export type Stats = z.infer<typeof StatsSchema>;
export type AchievementConfig = z.infer<typeof AchievementConfigSchema>;
export type AchievementTierConfig = z.infer<typeof AchievementTierSchema>;
export type AchievementReward = z.infer<typeof AchievementRewardSchema>;

export interface AchievementGrant {
  achievementId: string;
  tier: number;
  reward: { coins?: number; gems?: number };
}
```

- [ ] **Step 4: Run TypeScript check to verify schemas compile**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit -p shared/tsconfig.json 2>&1 | head -30
```

Expected: no errors (or only pre-existing errors unrelated to stats/achievements).

- [ ] **Step 5: Commit**

```bash
git add shared/schemas/gameState.ts shared/schemas/gameConfig.ts shared/types/index.ts
git commit -m "feat: add StatsSchema and AchievementConfigSchema to shared schemas"
```

---

## Task 2: Engine — Stats Tracking in processCommand

**Files:**
- Modify: `shared/engine/processCommand.ts`
- Test: `shared/engine/__tests__/processCommand.test.ts`

**Interfaces:**
- Consumes: `Stats` type from Task 1 (via `GameState.stats`)
- Produces: `processCommand` now increments `state.stats` on successful buy/list/collect

- [ ] **Step 1: Write failing tests for stats increments**

In `shared/engine/__tests__/processCommand.test.ts`, find the `makeState` function (line ~59). Add `achievements: []` to `testConfig` (the `GameConfig` object defined at top of file — add it after `floorUnlocks: [...]`):

```ts
  floorUnlocks: [
    { floorId: 5, price: 10, currency: 'gems' as const, constructionDurationMs: 60000, requiredToolCount: 1 },
    { floorId: 6, price: 50, currency: 'coins' as const, constructionDurationMs: 60000, requiredToolCount: 2 },
  ],
  achievements: [],   // add this line
```

Then add a new describe block at the bottom of the test file:

```ts
describe('stats tracking', () => {
  const worker = makeWorker({ assignedFloorId: 1, assignedSlotIdx: 0 });

  it('increments totalBought on successful buy', () => {
    const state = makeState({
      balance: 1000,
      workers: [worker],
      stats: { totalBought: 5, totalListed: 0, totalSold: 0 },
    });
    const cmd: Command = { id: 'b1', type: 'buy', floorId: 1, slotIdx: 0, typeId: 'coffee_shop', timestamp: 1000 };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.stats.totalBought).toBe(6);
    expect(result.state.stats.totalListed).toBe(0);
    expect(result.state.stats.totalSold).toBe(0);
  });

  it('increments totalListed on successful list', () => {
    const state = makeState({
      balance: 1000,
      workers: [worker],
      floors: [{
        id: 1,
        productions: [{ typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 0 }, { typeId: 'bookstore', stage: 'IDLE', stageStartedAt: 0 }],
      }],
      stats: { totalBought: 0, totalListed: 3, totalSold: 0 },
    });
    const cmd: Command = { id: 'l1', type: 'list', floorId: 1, slotIdx: 0, timestamp: 10000 };
    const result = processCommand(state, cmd, testConfig, 10000);
    expect(result.success).toBe(true);
    expect(result.state.stats.totalListed).toBe(4);
    expect(result.state.stats.totalBought).toBe(0);
    expect(result.state.stats.totalSold).toBe(0);
  });

  it('increments totalSold on successful collect', () => {
    const state = makeState({
      balance: 0,
      workers: [worker],
      floors: [{
        id: 1,
        productions: [{ typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 0 }, { typeId: 'bookstore', stage: 'IDLE', stageStartedAt: 0 }],
      }],
      stats: { totalBought: 0, totalListed: 0, totalSold: 7 },
    });
    const cmd: Command = { id: 'c1', type: 'collect', floorId: 1, slotIdx: 0, timestamp: 15000 };
    const result = processCommand(state, cmd, testConfig, 15000);
    expect(result.success).toBe(true);
    expect(result.state.stats.totalSold).toBe(8);
    expect(result.state.stats.totalBought).toBe(0);
    expect(result.state.stats.totalListed).toBe(0);
  });

  it('does not increment stats on failed command', () => {
    const state = makeState({
      balance: 0,  // insufficient balance
      workers: [worker],
      stats: { totalBought: 5, totalListed: 0, totalSold: 0 },
    });
    const cmd: Command = { id: 'b2', type: 'buy', floorId: 1, slotIdx: 0, typeId: 'coffee_shop', timestamp: 1000 };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(false);
    expect(result.state.stats.totalBought).toBe(5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/Apple/IT/tinytower && npx jest shared/engine/__tests__/processCommand.test.ts --no-coverage 2>&1 | tail -20
```

Expected: FAIL — "Cannot read properties of undefined (reading 'totalBought')" or TypeScript compile error about missing `stats`.

- [ ] **Step 3: Implement stats increment in `shared/engine/processCommand.ts`**

In `handleBuy`, find the return statement (currently returns `{ success: true, state: { ...state, balance: ..., floors: ... } }`). Change it to:

```ts
  return {
    success: true,
    state: {
      ...state,
      balance: state.balance - effectiveCost,
      floors: updateProduction(state.floors, floorIdx, slotIdx, {
        typeId: command.typeId,
        stage: 'DELIVERING',
        stageStartedAt: now,
      }),
      stats: { ...state.stats, totalBought: state.stats.totalBought + 1 },
    },
  };
```

In `handleList`, change the return statement to:

```ts
  return {
    success: true,
    state: {
      ...state,
      floors: updateProduction(state.floors, floorIdx, slotIdx, {
        ...production,
        stage: 'SELLING',
        stageStartedAt: now,
      }),
      stats: { ...state.stats, totalListed: state.stats.totalListed + 1 },
    },
  };
```

In `handleCollect`, change the return statement to:

```ts
  return {
    success: true,
    state: {
      ...state,
      balance: state.balance + revenue,
      floors: updateProduction(state.floors, floorIdx, slotIdx, {
        typeId: production.typeId,
        stage: 'IDLE',
        stageStartedAt: 0,
      }),
      stats: { ...state.stats, totalSold: state.stats.totalSold + 1 },
    },
  };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/Apple/IT/tinytower && npx jest shared/engine/__tests__/processCommand.test.ts --no-coverage 2>&1 | tail -20
```

Expected: PASS — all tests including the new stats describe block.

- [ ] **Step 5: Commit**

```bash
git add shared/engine/processCommand.ts shared/engine/__tests__/processCommand.test.ts
git commit -m "feat: increment stats in processCommand for buy/list/collect"
```

---

## Task 3: Config — achievements + fix testConfigs

**Files:**
- Modify: `shared/config/gameConfig.ts`
- Modify: `shared/engine/__tests__/lobbyCommands.test.ts`
- Modify: `shared/engine/__tests__/lobbyUtils.test.ts`

**Interfaces:**
- Consumes: `AchievementConfig` type from Task 1
- Produces: `gameConfig.achievements` — consumed by Task 5 (server achievement check)

- [ ] **Step 1: Add `achievements` to rawConfig and `stats` to `createInitialState`**

In `shared/config/gameConfig.ts`, add `achievements` array to `rawConfig` (after `floorUnlocks`):

```ts
  achievements: [
    {
      id: 'buyer',
      stat: 'totalBought' as const,
      tiers: [
        { tier: 1, threshold: 100,  reward: { coins: 500 } },   // TODO: tune
        { tier: 2, threshold: 500,  reward: { coins: 2000 } },  // TODO: tune
        { tier: 3, threshold: 1000, reward: { gems: 10 } },     // TODO: tune
      ],
    },
    {
      id: 'lister',
      stat: 'totalListed' as const,
      tiers: [
        { tier: 1, threshold: 100,  reward: { coins: 500 } },   // TODO: tune
        { tier: 2, threshold: 500,  reward: { coins: 2000 } },  // TODO: tune
        { tier: 3, threshold: 1000, reward: { gems: 10 } },     // TODO: tune
      ],
    },
    {
      id: 'seller',
      stat: 'totalSold' as const,
      tiers: [
        { tier: 1, threshold: 100,  reward: { coins: 500 } },   // TODO: tune
        { tier: 2, threshold: 500,  reward: { coins: 2000 } },  // TODO: tune
        { tier: 3, threshold: 1000, reward: { gems: 10 } },     // TODO: tune
      ],
    },
  ],
```

In `createInitialState`, add `stats` to the returned object:

```ts
    stats: { totalBought: 0, totalListed: 0, totalSold: 0 },
```

- [ ] **Step 2: Add `achievements: []` to lobbyCommands.test.ts testConfig**

In `shared/engine/__tests__/lobbyCommands.test.ts`, find `const testConfig: GameConfig = {` (line 5). Add after `floorUnlocks: [],`:

```ts
  achievements: [],
```

- [ ] **Step 3: Add `achievements: []` to lobbyUtils.test.ts testConfig**

In `shared/engine/__tests__/lobbyUtils.test.ts`, find `const testConfig: GameConfig = {` (line 13). Add after `floorUnlocks`:

```ts
  achievements: [],
```

- [ ] **Step 4: Run all shared tests to verify no regressions**

```bash
cd /Users/Apple/IT/tinytower && npx jest shared/ --no-coverage 2>&1 | tail -30
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/config/gameConfig.ts shared/engine/__tests__/lobbyCommands.test.ts shared/engine/__tests__/lobbyUtils.test.ts
git commit -m "feat: add achievements config and stats to createInitialState"
```

---

## Task 4: Database Migration

**Files:**
- Modify: `server/prisma/schema.prisma`

**Interfaces:**
- Produces: `Player.totalBought`, `Player.totalListed`, `Player.totalSold` columns; `PlayerAchievement` table — consumed by Task 5

- [ ] **Step 1: Update Prisma schema**

In `server/prisma/schema.prisma`, add three columns to the `Player` model (after `playerXp`):

```prisma
  totalBought   Int       @default(0)
  totalListed   Int       @default(0)
  totalSold     Int       @default(0)
  achievements  PlayerAchievement[]
```

Add the new model at the bottom of the file (after `CommandLog`):

```prisma
model PlayerAchievement {
  id            String   @id @default(cuid())
  playerId      String
  achievementId String
  tier          Int
  grantedAt     DateTime @default(now())
  player        Player   @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@unique([playerId, achievementId, tier])
  @@index([playerId])
}
```

- [ ] **Step 2: Run migration**

```bash
cd /Users/Apple/IT/tinytower/server && npx prisma migrate dev --name add_achievement_stats
```

Expected output contains: "The following migration(s) have been applied" and lists the new columns and table.

- [ ] **Step 3: Verify schema compiles**

```bash
cd /Users/Apple/IT/tinytower/server && npx prisma generate 2>&1 | tail -5
```

Expected: "Generated Prisma Client" with no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/Apple/IT/tinytower && git add server/prisma/schema.prisma server/prisma/migrations/
git commit -m "feat: add achievement stat columns and PlayerAchievement table"
```

---

## Task 5: Server Sync — Achievement Detection + SyncResponse

**Files:**
- Modify: `server/src/sync/sync.service.ts`

**Interfaces:**
- Consumes: `Player.totalBought/Listed/Sold` from Task 4; `gameConfig.achievements` from Task 3; `AchievementGrant` from Task 1
- Produces: `SyncResult.newAchievements: AchievementGrant[]` — consumed by Task 6

- [ ] **Step 1: Write the logic — update `SyncResult` interface and `processSync`**

In `server/src/sync/sync.service.ts`:

**a) Update import** — add `AchievementGrant` and `AchievementConfig`:
```ts
import type { GameState, Command, Floor, Production, Worker, AchievementGrant } from '@shared/types';
```

**b) Update `SyncResult` interface** — add `newAchievements`:
```ts
export interface SyncResult {
  state: GameState;
  stateVersion: number;
  ackCursor: number;
  serverTime: number;
  playerLevel: number;
  playerXp: number;
  newAchievements: AchievementGrant[];
}
```

**c) Count command types in `processSync`** — after the `for (const command of newCommands)` loop that builds `acceptedCommands`, add:

```ts
    let boughtCount = 0;
    let listedCount = 0;
    let soldCount   = 0;
    for (const cmd of acceptedCommands) {
      if (cmd.type === 'buy')     boughtCount++;
      if (cmd.type === 'list')    listedCount++;
      if (cmd.type === 'collect') soldCount++;
    }
```

**d) Inside the `$transaction`, after the `player.update` call**, add stat increment and achievement check. Add this block immediately after the `await tx.player.update(...)` call:

```ts
        // Increment stat counters atomically
        if (boughtCount > 0 || listedCount > 0 || soldCount > 0) {
          await tx.player.update({
            where: { id: playerId },
            data: {
              totalBought: { increment: boughtCount },
              totalListed: { increment: listedCount },
              totalSold:   { increment: soldCount },
            },
          });
        }

        // Check for newly unlocked achievement tiers
        const updatedStats = await tx.player.findUnique({
          where: { id: playerId },
          select: { totalBought: true, totalListed: true, totalSold: true },
        });

        const grantedRows = await tx.playerAchievement.findMany({
          where: { playerId },
          select: { achievementId: true, tier: true },
        });
        const grantedSet = new Set(grantedRows.map((r) => `${r.achievementId}:${r.tier}`));

        const newAchievements: AchievementGrant[] = [];
        for (const achievement of gameConfig.achievements) {
          const statValue = updatedStats
            ? updatedStats[achievement.stat as 'totalBought' | 'totalListed' | 'totalSold']
            : 0;
          for (const tierConfig of achievement.tiers) {
            const key = `${achievement.id}:${tierConfig.tier}`;
            if (!grantedSet.has(key) && statValue >= tierConfig.threshold) {
              await tx.playerAchievement.create({
                data: { playerId, achievementId: achievement.id, tier: tierConfig.tier },
              });
              if (tierConfig.reward.coins) {
                gameState = { ...gameState, balance: gameState.balance + tierConfig.reward.coins };
              }
              if (tierConfig.reward.gems) {
                gameState = { ...gameState, gems: gameState.gems + tierConfig.reward.gems };
              }
              newAchievements.push({
                achievementId: achievement.id,
                tier: tierConfig.tier,
                reward: tierConfig.reward,
              });
            }
          }
        }
```

Note: `newAchievements` is declared inside the transaction callback. You need to lift it to the outer scope. Declare `let newAchievements: AchievementGrant[] = [];` before the `$transaction` call, and assign inside the transaction:

```ts
    let newAchievements: AchievementGrant[] = [];

    if (acceptedCommands.length > 0 || newCommands.length === 0) {
      await this.prisma.$transaction(async (tx) => {
        // ... existing code ...
        // At the end of the transaction, assign:
        newAchievements = localNewAchievements;  // use a local variable inside transaction
      });
    }
```

Full pattern: inside the transaction, use `const localNewAchievements: AchievementGrant[] = [];`, push to it, and at the end of the transaction body do `newAchievements = localNewAchievements;`.

**e) Update the `lobbyState` write** — add `stats` to lobbyState so it round-trips to the client. Inside the `tx.player.update` data.lobbyState object, add:

```ts
              stats: {
                totalBought: (updatedStats?.totalBought ?? player.totalBought) + boughtCount,
                totalListed: (updatedStats?.totalListed ?? player.totalListed) + listedCount,
                totalSold:   (updatedStats?.totalSold   ?? player.totalSold)   + soldCount,
              },
```

Wait — since we do the stat increment *after* the first player.update, we need to be careful about ordering. Simplify: read the stats *after* the increment update. Move the `updatedStats` read to after the increment update:

```ts
        // First update: balance, lobbyState, stateVersion (existing update)
        await tx.player.update({ where: { id: playerId }, data: { ...existingFields } });

        // Second update: increment counters
        if (boughtCount > 0 || listedCount > 0 || soldCount > 0) {
          await tx.player.update({
            where: { id: playerId },
            data: {
              totalBought: { increment: boughtCount },
              totalListed: { increment: listedCount },
              totalSold:   { increment: soldCount },
            },
          });
        }

        // Read updated stats (includes increments from above)
        const updatedStats = await tx.player.findUnique({
          where: { id: playerId },
          select: { totalBought: true, totalListed: true, totalSold: true },
        });
```

Then update `gameState.stats` to mirror DB values so the sync response returns accurate stats:

```ts
        if (updatedStats) {
          gameState = {
            ...gameState,
            stats: {
              totalBought: updatedStats.totalBought,
              totalListed: updatedStats.totalListed,
              totalSold:   updatedStats.totalSold,
            },
          };
        }
```

Also update `lobbyState` to include stats. In the first `tx.player.update`, add to the `lobbyState` object:
```ts
              stats: gameState.stats,
```
(This is added after the gameState.stats assignment above, so it will be set correctly. Since it runs *before* the stats update in the transaction, you'll need to do the lobbyState update with the final stats *after* the stats increment. The cleanest approach: move the lobbyState `stats` write to after the increment — split the player update into two calls, or update lobbyState in a third update. Simplest: merge both updates into one single `player.update` at the end of the transaction.)

**Simplified approach:** restructure the transaction to do one `player.update` at the very end, after computing all final values:

```ts
        // At end of transaction, single consolidated player update:
        const finalStats = {
          totalBought: player.totalBought + boughtCount,
          totalListed: player.totalListed + listedCount,
          totalSold:   player.totalSold   + soldCount,
        };
        gameState = { ...gameState, stats: finalStats };

        await tx.player.update({
          where: { id: playerId },
          data: {
            balance: gameState.balance,
            playerLevel: xpResult.playerLevel,
            playerXp: xpResult.playerXp,
            totalBought: { increment: boughtCount },
            totalListed: { increment: listedCount },
            totalSold:   { increment: soldCount },
            lobbyState: {
              ...existingLs,
              gems: gameState.gems,
              // ... all existing lobbyState fields ...
              stats: finalStats,
            },
            stateVersion: { increment: acceptedCommands.length > 0 ? 1 : 0 },
            lastSeenAt: new Date(serverNow),
          },
        });
```

This replaces the existing `tx.player.update` call entirely. Use `player.totalBought + boughtCount` to compute the final value (works because we read player at start under row lock).

**f) Update return statement** — add `newAchievements`:
```ts
    return {
      state: gameState,
      stateVersion: updatedPlayer?.stateVersion ?? player.stateVersion,
      ackCursor,
      serverTime: serverNow,
      playerLevel: updatedPlayer?.playerLevel ?? xpResult.playerLevel,
      playerXp: updatedPlayer?.playerXp ?? xpResult.playerXp,
      newAchievements,
    };
```

**g) Update `dbToGameState`** — add `stats` to the return value:
```ts
      stats: {
        totalBought: (ls.stats as any)?.totalBought ?? player.totalBought ?? 0,
        totalListed: (ls.stats as any)?.totalListed ?? player.totalListed ?? 0,
        totalSold:   (ls.stats as any)?.totalSold   ?? player.totalSold   ?? 0,
      },
```

- [ ] **Step 2: Run server TypeScript check**

```bash
cd /Users/Apple/IT/tinytower/server && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/Apple/IT/tinytower && git add server/src/sync/sync.service.ts
git commit -m "feat: server achievement detection, stat counters, newAchievements in SyncResponse"
```

---

## Task 6: Client Store + Persistence + Sync Service

**Files:**
- Modify: `src/stores/gameStore.ts`
- Modify: `src/services/sync.ts`
- Modify: `src/services/persistence.ts`

**Interfaces:**
- Consumes: `AchievementGrant` from Task 1; `newAchievements` from Task 5 (via SyncResponse)
- Produces: `useGameStore().achievementQueue`, `dismissAchievement` — consumed by Task 7

- [ ] **Step 1: Update `src/services/sync.ts` — add `newAchievements` to SyncResponse**

Find the `SyncResponse` interface at the top of the file and add:
```ts
interface SyncResponse {
  state: GameState;
  stateVersion: number;
  ackCursor: number;
  serverTime: number;
  playerLevel: number;
  playerXp: number;
  newAchievements?: AchievementGrant[];  // add this
}
```

Add import at top:
```ts
import type { GameState, AchievementGrant } from '../../shared/types';
```

In `doSync`, after `store.reconcile(...)` and `store.clearAckedCommands(...)` calls, add:
```ts
    if (response.newAchievements && response.newAchievements.length > 0) {
      useGameStore.getState().addAchievements(response.newAchievements);
    }
```

- [ ] **Step 2: Update `src/stores/gameStore.ts`**

**a) Add import:**
```ts
import type { GameState, Command, Floor, Worker, ToolsState, AchievementGrant } from '../../shared/types';
```

**b) Add `achievementQueue` to store type.** In the `UIState` interface, add:
```ts
interface UIState {
  insufficientResources: InsufficientResourcesPayload | null;
  builderToolDrop: ToolKey | null;
  achievementQueue: AchievementGrant[];
}
```

**c) Add `addAchievements` and `dismissAchievement` to `GameActions`:**
```ts
  addAchievements: (grants: AchievementGrant[]) => void;
  dismissAchievement: () => void;
```

**d) Update `executeCommand`** — in the `const gameState: GameState = { ... }` object (lines ~93-98), add `stats`:
```ts
  const gameState: GameState = {
    balance, gems, floors, commandQueue, workers, hotelCapacity,
    lobbyVisitors, lobbyCapacity, elevatorLevel, elevatorFloor,
    dailyTips, dailyGemsCollected, dailyTipsRewardClaimed, lastDailyReset, nextVisitorAt,
    tools, underConstruction, openedFloorTypes, stats,
  };
```

Also destructure `stats` from `store` at the top of `executeCommand`:
```ts
  const { balance, gems, floors, commandQueue, workers, hotelCapacity,
    lobbyVisitors, lobbyCapacity, elevatorLevel, elevatorFloor,
    dailyTips, dailyGemsCollected, dailyTipsRewardClaimed, lastDailyReset, nextVisitorAt,
    tools, underConstruction, openedFloorTypes, stats,
  } = store;
```

In the `set({ ... })` call inside `executeCommand`, add:
```ts
    stats: result.state.stats,
```

**e) In store initial values** (the `create` call around line 138), add:
```ts
  achievementQueue: [],
```

**f) Add actions to the store object:**
```ts
  addAchievements: (grants) => set((cur) => ({
    achievementQueue: [...cur.achievementQueue, ...grants],
  })),

  dismissAchievement: () => set((cur) => ({
    achievementQueue: cur.achievementQueue.slice(1),
  })),
```

**g) Update `hydrate`** — add `stats` and `achievementQueue`:
```ts
    stats: state.stats ?? { totalBought: 0, totalListed: 0, totalSold: 0 },
    achievementQueue: (state as any).achievementQueue ?? [],
```

**h) Update `reconcile`** — add `stats`:
```ts
    stats: serverState.stats ?? { totalBought: 0, totalListed: 0, totalSold: 0 },
```

- [ ] **Step 3: Update `src/services/persistence.ts` — save/load `stats` and `achievementQueue`**

In `PersistedGameState` interface, add:
```ts
interface PersistedGameState extends GameState {
  lastAckCursor?: number;
  stateVersion?: number;
  playerLevel?: number;
  playerXp?: number;
  achievementQueue?: AchievementGrant[];
}
```

Add import:
```ts
import type { GameState, AchievementGrant } from '../../shared/types';
```

In `loadGameState`, in the `withDefaults` object, add:
```ts
      stats: parsed.stats ?? { totalBought: 0, totalListed: 0, totalSold: 0 },
```

After the `if (result.success)` return, add `achievementQueue` to the spread:
```ts
      return {
        ...result.data,
        lastAckCursor: ...,
        stateVersion: ...,
        playerLevel: ...,
        playerXp: ...,
        achievementQueue: Array.isArray(parsed.achievementQueue) ? parsed.achievementQueue : [],
      };
```

In `saveGameState`, add to the JSON object:
```ts
    stats: state.stats ?? { totalBought: 0, totalListed: 0, totalSold: 0 },
    achievementQueue: (state as any).achievementQueue ?? [],
```

In `setupPersistence`, update the `hydrate` call (it already calls `useGameStore.getState().hydrate(savedState)` — the `achievementQueue` will now be available from the loaded state and set via `hydrate`).

- [ ] **Step 4: Run TypeScript check on client**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/stores/gameStore.ts src/services/sync.ts src/services/persistence.ts
git commit -m "feat: client achievementQueue, stats in store and persistence"
```

---

## Task 7: Achievement Popup UI

**Files:**
- Create: `src/components/AchievementModal.tsx`
- Modify: `app/(tabs)/game.tsx`

**Interfaces:**
- Consumes: `useGameStore().achievementQueue[0]`, `useGameStore().dismissAchievement` from Task 6

- [ ] **Step 1: Create `src/components/AchievementModal.tsx`**

Model this after `LevelUpModal.tsx` (same animation pattern, same gradient style).

```tsx
import React, { useCallback } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Dimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';

const { width: SCREEN_W } = Dimensions.get('window');

function formatNumber(n: number): string {
  if (n >= 1000) {
    const str = String(n);
    const parts: string[] = [];
    for (let i = str.length; i > 0; i -= 3) {
      parts.unshift(str.slice(Math.max(0, i - 3), i));
    }
    return parts.join(' ');
  }
  return String(n);
}

export default function AchievementModal() {
  const { t } = useTranslation('hotel');
  const grant = useGameStore((s) => s.achievementQueue[0] ?? null);
  const dismiss = useGameStore((s) => s.dismissAchievement);

  const scale = useSharedValue(0.5);
  const rewardsOpacity = useSharedValue(0);
  const rewardsY = useSharedValue(20);

  const triggerAnimations = useCallback(() => {
    scale.value = 0.5;
    rewardsOpacity.value = 0;
    rewardsY.value = 20;
    scale.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.back(1.4)) });
    rewardsOpacity.value = withDelay(250, withTiming(1, { duration: 250 }));
    rewardsY.value = withDelay(250, withTiming(0, { duration: 300, easing: Easing.out(Easing.back(1.3)) }));
  }, []);

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const rewardsStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: rewardsY.value }],
    opacity: rewardsOpacity.value,
  }));

  return (
    <Modal
      visible={!!grant}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
      onShow={triggerAnimations}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.scrim}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />

          {grant && (
            <Animated.View style={[styles.card, cardStyle]}>
              <LinearGradient colors={['#E8F4FF', '#D0E8FF']} style={styles.cardGradient}>
                <Text style={styles.trophy}>🏆</Text>
                <Text style={styles.tierBadge}>{t('achievement.tier', { tier: grant.tier })}</Text>
                <Text style={styles.title}>{t(`achievement.${grant.achievementId}.title`)}</Text>

                <Animated.View style={[styles.rewardsContainer, rewardsStyle]}>
                  {grant.reward.coins != null && (
                    <View style={styles.rewardRow}>
                      <View style={styles.coinIcon} />
                      <Text style={styles.rewardText}>+{formatNumber(grant.reward.coins)}</Text>
                    </View>
                  )}
                  {grant.reward.gems != null && (
                    <View style={styles.rewardRow}>
                      <View style={styles.gemIcon} />
                      <Text style={styles.rewardTextGem}>+{grant.reward.gems}</Text>
                    </View>
                  )}
                </Animated.View>

                <Pressable
                  onPress={dismiss}
                  style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                >
                  <LinearGradient colors={['#4A9FE0', '#2F7BC0']} style={styles.buttonGradient}>
                    <Text style={styles.buttonText}>{t('achievement.claim')}</Text>
                  </LinearGradient>
                  <View style={styles.buttonShadow} />
                </Pressable>
              </LinearGradient>
            </Animated.View>
          )}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: SCREEN_W * 0.78,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: 'rgba(20,60,120,1)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 12,
  },
  cardGradient: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  trophy: {
    fontSize: 52,
    marginBottom: 6,
  },
  tierBadge: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    color: '#5A8AB0',
    letterSpacing: 1,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 22,
    color: '#1A3D6B',
    marginBottom: 18,
    textAlign: 'center',
  },
  rewardsContainer: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 22,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 14,
    borderRadius: 14,
    shadowColor: 'rgba(30,60,120,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  coinIcon: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#F2B330',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)',
  },
  rewardText: {
    fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#C28A22',
  },
  gemIcon: {
    width: 16, height: 16,
    backgroundColor: '#3FB8D6',
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)',
  },
  rewardTextGem: {
    fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#2592AB',
  },
  button: {
    width: '100%', borderRadius: 14, overflow: 'hidden',
  },
  buttonPressed: { opacity: 0.85 },
  buttonGradient: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, zIndex: 1,
  },
  buttonText: {
    fontFamily: 'Fredoka_700Bold', fontSize: 18, color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  buttonShadow: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 3, backgroundColor: 'rgba(20,60,100,0.35)',
  },
});
```

- [ ] **Step 2: Add i18n keys**

In `src/i18n/locales/en/common.json` (or the `hotel` namespace file — check which file has `levelUp`), add:

```json
"achievement": {
  "claim": "Collect Reward",
  "tier": "Tier {{tier}}",
  "buyer": { "title": "Shopaholic" },
  "lister": { "title": "Merchant" },
  "seller": { "title": "Sales Star" }
}
```

Find which locale file uses `levelUp` key to confirm the correct namespace:
```bash
grep -rn "levelUp" /Users/Apple/IT/tinytower/src/i18n/ | head -5
```

- [ ] **Step 3: Render `AchievementModal` in `app/(tabs)/game.tsx`**

Find the existing imports at the top of `game.tsx` and add:
```tsx
import AchievementModal from '../../src/components/AchievementModal';
```

Find where `<LevelUpModal />` is rendered (line ~266) and add below it:
```tsx
      <LevelUpModal suppressWhileOpen={lobbyOpen || hotelOpen} />
      <AchievementModal />
      <InsufficientResourcesModal />
```

- [ ] **Step 4: Run TypeScript check on full project**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/AchievementModal.tsx app/(tabs)/game.tsx src/i18n/locales/
git commit -m "feat: AchievementModal UI with claim popup and i18n"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Track totalBought/totalListed/totalSold → Tasks 1+2 (schema + engine)
- [x] Server-side DB columns → Task 4 (Prisma migration)
- [x] Multi-tier config → Task 3 (gameConfig achievements array)
- [x] Server detects tiers, auto-credits rewards → Task 5 (sync.service)
- [x] Client optimistic stats → Task 2 (engine) + Task 6 (store executeCommand)
- [x] achievementQueue persisted in MMKV → Task 6 (persistence.ts)
- [x] Popup with dismiss button (reward already credited) → Task 7 (AchievementModal)
- [x] Reconcile overwrites client stats with server values → Task 6 (reconcile update)

**Type consistency:**
- `AchievementGrant` defined in `shared/types/index.ts` (Task 1) — used identically in Tasks 5, 6, 7.
- `dismissAchievement` defined in `GameActions` (Task 6) — consumed in `AchievementModal` (Task 7).
- `addAchievements` defined in `GameActions` (Task 6) — called from `sync.ts` (Task 6).
- `stats` field added to `executeCommand` destructure and `set()` spread (Task 6) — matches `GameState.stats` (Task 1).

**Placeholder scan:** achievement thresholds marked `// TODO: tune` — intentional, no logic gaps.
