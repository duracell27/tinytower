# Optimistic Achievements

**Date:** 2026-07-13  
**Status:** Approved

## Problem

Achievement modals currently appear only after a server sync (up to 30 seconds after the threshold is crossed). The stats that drive achievements (`totalBought`, `totalListed`, `totalCollected`, `totalPassengersLifted`) are already updated optimistically on the client via `processCommand`. We have all the information needed to detect the threshold crossing immediately.

## Goal

Show the achievement modal (and credit gems) the moment a command crosses a threshold — before server sync. The server remains authoritative and still validates; we just don't wait for it.

## Approach: Client-side detection via a pure helper

### New file: `src/utils/detectOptimisticGrants.ts`

A pure function with no side effects:

```ts
detectOptimisticGrants(
  oldStats: GameStats,
  newStats: GameStats,
  categoryProgress: Record<string, CategoryProgressState>,
  alreadyGranted: Set<string>,
): NewAchievementGrant[]
```

**Logic:**
1. Iterate `ACHIEVEMENT_CATEGORIES` — each maps a `stat` key to a set of `{ level, threshold, title }`.
2. For each level: fire only if `newStats[stat] >= threshold && oldStats[stat] < threshold`.
3. Exclude levels already in `categoryProgress[key].claimedLevels` (confirmed by server) or in `alreadyGranted` (shown this session, not yet confirmed).
4. Build `NewAchievementGrant` objects from config data (`ACHIEVEMENT_GEM_REWARDS`, `ACHIEVEMENT_INCOME_BONUS`, `ACHIEVEMENT_XP_BONUS`).

This function is easily unit-testable in isolation.

### Changes to `gameStore.ts`

**New store field:**
```ts
locallyGrantedAchievements: Set<string>   // e.g. "buy-1", "collect-3"
```
Initialized as `new Set()`. Not persisted to AsyncStorage (intentionally ephemeral).

**In `executeCommand`**, after `processCommand` returns and before calling `set()`:
```ts
const grants = detectOptimisticGrants(
  oldStats, result.state.stats,
  store.categoryProgress, store.locallyGrantedAchievements,
);
if (grants.length > 0) {
  newGems += grants.reduce((sum, g) => sum + g.gems, 0);
  // merge grants into achievementQueue and locallyGrantedAchievements in the set() call
}
```

Gems are credited immediately alongside the optimistic state update. When `reconcile` fires, the server's gem balance (which already includes the awarded gems) overwrites the local value — no double-credit.

**In `reconcile`:**
```ts
locallyGrantedAchievements: new Set()
```
Reset after server confirmation arrives, since `categoryProgress` returned by the server now reflects all claimed levels.

### Changes to `sync.ts`

Filter server-returned achievements before pushing to queue:
```ts
const store = useGameStore.getState();
const unshown = (response.newAchievements ?? []).filter(
  g => !store.locallyGrantedAchievements.has(`${g.categoryKey}-${g.level}`)
);
if (unshown.length > 0) store.addAchievements(unshown);
```

If the server returns an achievement the client never showed (e.g., a stat correction applied server-side), it still surfaces normally.

## Edge cases

| Scenario | Handling |
|---|---|
| Server rejects command (insufficient balance, etc.) | Gems credited optimistically will be overwritten by reconcile. Modal already dismissed — acceptable UX trade-off. |
| User offline for a long time, `categoryProgress` stale | `alreadyGranted` set prevents double-show within the same session. On reconnect, reconcile resets the set; server sends any missed grants. |
| Multiple thresholds crossed in one command | `detectOptimisticGrants` returns all crossed levels; all pushed to `achievementQueue` and dequeued one by one. |
| `categoryProgress` missing a category (first session) | `claimedLevels` defaults to `[]` — all crossed thresholds fire. Matches server behavior. |

## Files changed

| File | Change |
|---|---|
| `src/utils/detectOptimisticGrants.ts` | New — pure detection helper |
| `src/stores/gameStore.ts` | Add `locallyGrantedAchievements`, update `executeCommand`, update `reconcile` |
| `src/services/sync.ts` | Filter already-shown achievements before enqueuing |
