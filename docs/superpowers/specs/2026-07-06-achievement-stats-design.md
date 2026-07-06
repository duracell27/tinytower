# Achievement Stats System — Design Spec

**Date:** 2026-07-06  
**Status:** Approved

## Overview

Track three global production counters (`totalBought`, `totalListed`, `totalSold`) for an achievement system with multi-tier rewards. Stats are optimistic on the client (instant feedback) and authoritative on the server (leaderboards, validation). Rewards are auto-credited server-side; the client shows a popup as notification only.

---

## Section 1: Data & Schemas

### GameState (shared engine)

Add `stats` field to `GameStateSchema` (`shared/schemas/gameState.ts`):

```ts
stats: z.object({
  totalBought: z.number().int().nonnegative().default(0),
  totalListed: z.number().int().nonnegative().default(0),
  totalSold:   z.number().int().nonnegative().default(0),
}).default({ totalBought: 0, totalListed: 0, totalSold: 0 })
```

Updated in `processCommand` (`shared/engine/processCommand.ts`) on success:
- `buy` → `stats.totalBought += 1`
- `list` → `stats.totalListed += 1`
- `collect` → `stats.totalSold += 1`

Stats are included in `lobbyState` JSON on the server (alongside `tools`, `underConstruction`, etc.) so they round-trip through sync.

### Database (Prisma)

New columns on `Player` table:
```prisma
totalBought  Int  @default(0)
totalListed  Int  @default(0)
totalSold    Int  @default(0)
```

New table `PlayerAchievement`:
```prisma
model PlayerAchievement {
  id            String   @id @default(cuid())
  playerId      String
  achievementId String
  tier          Int
  grantedAt     DateTime @default(now())
  player        Player   @relation(fields: [playerId], references: [id])

  @@unique([playerId, achievementId, tier])
}
```

---

## Section 2: Achievement Config & Server Logic

### Config (`shared/config/gameConfig.ts`)

```ts
achievements: [
  {
    id: 'buyer',
    stat: 'totalBought' as const,
    tiers: [
      { tier: 1, threshold: 100,  reward: { coins: 500 } },
      { tier: 2, threshold: 500,  reward: { coins: 2000 } },
      { tier: 3, threshold: 1000, reward: { gems: 10 } },
    ],
  },
  {
    id: 'lister',
    stat: 'totalListed' as const,
    tiers: [
      { tier: 1, threshold: 100,  reward: { coins: 500 } },
      { tier: 2, threshold: 500,  reward: { coins: 2000 } },
      { tier: 3, threshold: 1000, reward: { gems: 10 } },
    ],
  },
  {
    id: 'seller',
    stat: 'totalSold' as const,
    tiers: [
      { tier: 1, threshold: 100,  reward: { coins: 500 } },
      { tier: 2, threshold: 500,  reward: { coins: 2000 } },
      { tier: 3, threshold: 1000, reward: { gems: 10 } },
    ],
  },
]
```

Exact thresholds and rewards are placeholders — to be tuned by game design.

### Server Processing (`server/src/sync/sync.service.ts`)

Inside the existing Prisma transaction during `processSync`:

1. For each accepted command, increment the corresponding column atomically:
   - `buy` → `totalBought += 1`
   - `list` → `totalListed += 1`
   - `collect` → `totalSold += 1`
2. Read updated counter values from the locked player row.
3. Read already-granted tiers from `PlayerAchievement` for this player.
4. For each achievement in config, for each tier not yet granted where `counter >= threshold`:
   - Insert row into `PlayerAchievement`.
   - Add reward to `gameState.balance` (coins) or `gameState.gems`.
5. Collect newly granted achievements into `newAchievements` list.
6. Return `newAchievements` in `SyncResponse`.

**Reward is applied inside the transaction** — if the client never sees the popup, coins/gems are already on the account.

### SyncResponse addition

```ts
newAchievements: Array<{
  achievementId: string;
  tier: number;
  reward: { coins?: number; gems?: number };
}>
```

---

## Section 3: Client-Side Flow

### Optimistic counters

`processCommand` increments `stats` immediately on the client. The user sees `+1` with no delay on every `buy`/`list`/`collect` action.

### Reconcile

During a full reconcile (server state version bump), the server's `stats` values overwrite the client's — keeping them in sync and eliminating drift.

During `clearAckedCommands` (no version change), client stats from the optimistic engine remain as-is until the next reconcile.

### Achievement popup queue

`achievementQueue: AchievementGrant[]` added to `gameStore`. On sync, `newAchievements` from `SyncResponse` are appended to this queue.

The UI renders the first item in the queue as a modal popup with:
- Achievement name + tier
- Reward description
- "Отримати нагороду" button

Pressing the button (or any dismiss) removes the item from the queue. The reward is already in the player's balance — the button is UX only.

### Persistence

`achievementQueue` is persisted in MMKV so pending popups survive app restarts.

---

## Implementation Scope

1. `shared/schemas/gameState.ts` — add `stats` field
2. `shared/config/gameConfig.ts` — add `achievements` array + types
3. `shared/engine/processCommand.ts` — increment stats in `handleBuy`, `handleList`, `handleCollect`
4. `shared/types/index.ts` — export new types
5. `server/prisma/schema.prisma` — add columns + `PlayerAchievement` table
6. `server/src/sync/sync.service.ts` — increment DB counters, check achievements, return `newAchievements`
7. `src/stores/gameStore.ts` — add `achievementQueue`, handle `newAchievements` from sync
8. `src/services/sync.ts` — pass `newAchievements` from response to store
9. MMKV persistence for `achievementQueue`
10. Achievement popup UI component
