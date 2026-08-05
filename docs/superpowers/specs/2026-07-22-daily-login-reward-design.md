# Daily Login Reward — Design Spec

**Date:** 2026-07-22  
**Status:** Approved

## Overview

Once per calendar day, on the player's first sync after midnight, the server automatically grants a login reward and returns it in the sync response. The client shows a full-screen animated modal informing the player of what they received.

**Reward formula:** `floors.length × 3000` coins + `3` gems.

## Database

Add one field to `PlayerState` in `server/prisma/schema.prisma`:

```prisma
lastDailyLoginClaimedAt  BigInt  @default(0)
```

Requires a Prisma migration.

## Server (`sync.service.ts`)

At the start of `processSync`, before command processing:

1. Read `lastDailyLoginClaimedAt` from `player.state` (fallback to `0` if null).
2. Compute `todayMidnight = getMidnightBefore(serverNow)` (same helper used for `lastDailyReset`).
3. If `lastDailyLoginClaimedAt < todayMidnight`:
   - `coins = player.floors.length × 3000`
   - `gems = 3`
   - Apply to `gameState.balance` and `gameState.gems`.
   - Inside the DB transaction, set `PlayerState.lastDailyLoginClaimedAt = serverNow`.
   - Include `dailyLoginReward: { coins, gems }` in `SyncResult`.
4. Otherwise include `dailyLoginReward: null`.

**Deduplication:** Protected by the existing `FOR UPDATE` row lock in the sync transaction. Concurrent syncs for the same player will serialize; the second will see the updated `lastDailyLoginClaimedAt` and skip the grant.

**Floor count:** Taken from `player.floors` (DB rows) before command processing — server-authoritative.

**New players:** `lastDailyLoginClaimedAt = 0 < todayMidnight` is always true, so new players receive the reward on their first sync.

## Client

### `SyncResponse` (`src/services/sync.ts`)

```ts
dailyLoginReward?: { coins: number; gems: number } | null;
```

### `UIState` (`src/stores/gameStore.ts`)

```ts
pendingDailyLoginReward: { coins: number; gems: number } | null;
```

Actions: `setDailyLoginReward(reward)`, `dismissDailyLoginReward()`.

### Sync handler (`src/services/sync.ts`)

After reconcile/clearAckedCommands, if `response.dailyLoginReward` is non-null:

```ts
useGameStore.getState().setDailyLoginReward(response.dailyLoginReward);
```

### `DailyLoginRewardModal` (`src/components/DailyLoginRewardModal.tsx`)

- Full-screen modal, `visible` while `pendingDailyLoginReward !== null`.
- Scale + fade-in animation (same pattern as `AchievementModal`).
- Displays: coin amount, gem amount.
- "Забрати" button → `dismissDailyLoginReward()`.
- Mounted in `app/_layout.tsx` (global, above all screens).

## Edge Cases

| Scenario | Behavior |
|---|---|
| `player.state` is null | `lastDailyLoginClaimedAt` falls back to `0` → reward granted |
| Player has 1 floor (minimum) | Reward = 3 000 coins + 3 gems |
| App returns from background after midnight | Next sync detects new day → modal appears |
| Two concurrent syncs at midnight | Row lock serializes them; only first grants reward |
| No streak tracking | Reward is flat every day, no consecutive-day bonus |

## Day Boundary

UTC-based via `getMidnightBefore(serverNow)` — consistent with the existing `lastDailyReset` daily-reset logic.
