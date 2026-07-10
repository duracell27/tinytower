# Revenue Per Minute — Design Spec

**Date:** 2026-07-10  
**Status:** Approved

## Overview

A new rating metric: "revenue per minute" (виручка в хв). It sums the per-minute revenue across all productions currently in SELLING stage and displays the result as a pill in the TopBar, under the player's nickname.

## Formula

For each production with `stage === 'SELLING'`:

```
effectiveRevenue = Math.floor(batchValue × moodMultiplier × (1 + specialistBonus))
revenuePerMin   += Math.floor(effectiveRevenue / (sellDuration_ms / 60_000))
```

Where:
- `batchValue` — `gameConfig.productionTypes[typeId].batchValue`
- `sellDuration_ms` — `gameConfig.productionTypes[typeId].sellDuration` (base param, not time remaining)
- `moodMultiplier` — `getRevenueMultiplier(worker, floorType, typeId)` → 2.0 / 1.3 / 1.0; defaults to 1.0 if no worker assigned
- `specialistBonus` — `getFloorSpecialistBonus(workers, floorId)` → `count_of_specialists × 0.09`; 0 if no specialists
- `floorType` — from `gameConfig.floors.find(f => f.id === floorId)?.floorType` or `openedFloorTypes[String(floorId)]`

## Architecture

### 1. `shared/engine/ratingUtils.ts` (new file)

Pure function, no side effects, reusable server-side for leaderboard:

```ts
export function calcRevenuePerMin(
  floors: Floor[],
  workers: Worker[],
  openedFloorTypes: Record<string, string>,
  config: GameConfig,
): number
```

Iterates `floors → productions` where `stage === 'SELLING'`, applies the formula above, sums and returns total.

### 2. `app/(tabs)/game.tsx`

Add three selectors:
- `floors` — already selected, no change
- `workers` — `useGameStore(s => s.workers)` (new)
- `openedFloorTypes` — `useGameStore(s => s.openedFloorTypes)` (new)

Compute via `useMemo`:
```ts
const revenuePerMin = useMemo(
  () => calcRevenuePerMin(floors, workers, openedFloorTypes ?? {}, gameConfig),
  [floors, workers, openedFloorTypes],
);
```

Pass to `<TopBar revenuePerMin={revenuePerMin} />`.

`shop.tsx` and `city.tsx` — prop not passed; pill does not appear on those tabs.

### 3. `src/components/TopBar.tsx`

- Add optional prop `revenuePerMin?: number`
- Restructure `avatarSection`: flexDirection stays `row`, but the name+pill become a nested column `View`
- Render pill only when `revenuePerMin !== undefined && revenuePerMin > 0`
- Pill style mirrors `coinBadge` (white bg, borderRadius 13, Fredoka_600SemiBold)
- Pill text: `⚡ {revenuePerMin} /min`

Layout:
```
[Avatar]  PlayerName
          ⚡ 26 /min
```

## What is NOT changing

- `processCommand.ts` collect logic — untouched
- Server sync / persistence — untouched
- `shop.tsx`, `city.tsx` TopBar calls — untouched (no new prop)
- No new store actions or state

## Edge Cases

- No productions in SELLING → `revenuePerMin = 0` → pill hidden
- Production in SELLING but `typeId` is null → skip (defensive check in utility)
- No worker on slot → `moodMultiplier = 1.0`, `specialistBonus` still applies to the floor
