# Worker Generation Proximity Design

**Date:** 2026-07-28  
**Status:** Approved

## Problem

`generateRandomWorkers` picks a dream job uniformly from all 12 businesses in a floor type category, regardless of how many floors of that type the player has built. A new player can receive a worker whose dream job belongs to the 12th business in a category while only having 1–2 floors of that type — making the worker useless for a long time.

## Solution

Limit the business pool used during worker generation to the first `builtCount + LOOKAHEAD` businesses in the category, where:
- `builtCount` = number of built floors of that floor type in the player's tower
- `LOOKAHEAD = 4` (constant, named, tunable)

### Examples

| Built green floors | Allowed green business indices (0-based) | Businesses available |
|---|---|---|
| 0 | 0–3 | 4 |
| 2 | 0–5 | 6 |
| 8 | 0–11 | 12 (all) |

## Changes

### 1. `shared/engine/workerUtils.ts` — new helper

```ts
export function getBuiltFloorCountForType(
  floorType: string,
  floors: Floor[],
  openedFloorTypes: Record<string, string>,
  config: GameConfig,
): number
```

Counts floors in `state.floors` matching `floorType`, checking `gameConfig.floors` for static floors (1–4) and `openedFloorTypes` for dynamic floors (5+).

### 2. `shared/config/workerNames.ts` — new parameter

`generateRandomWorkers` gains an optional `maxBusinessIndex?: number`. When provided, slices the business pool:

```ts
const LOOKAHEAD = 4;
const pool = maxBusinessIndex !== undefined
  ? ftConfig.businesses.slice(0, maxBusinessIndex + 1)
  : ftConfig.businesses;
```

`maxBusinessIndex` is already clamped to `businesses.length - 1` by the caller.

### 3. `src/stores/gameStore.ts` — two call sites

In both `collectTip` and `deliverAll`, before each `generateRandomWorkers` call:

```ts
const builtCount = getBuiltFloorCountForType(
  pendingFloorType, state.floors, state.openedFloorTypes ?? {}, gameConfig
);
const maxBizIdx = Math.min(
  builtCount + LOOKAHEAD - 1,
  gameConfig.floorTypes[pendingFloorType].businesses.length - 1,
);
generateRandomWorkers(1, gameConfig, undefined, pendingFloorType, maxBizIdx);
```

`LOOKAHEAD` is imported from `workerNames.ts` or defined as a local constant.

## Edge Cases

- **`pendingFloorType` is undefined** (non-guest visitor or targetFloor ≠ 1): worker generation unchanged — `maxBusinessIndex` not passed.
- **Floor type not in config:** `getBuiltFloorCountForType` returns 0, pool defaults to first 4 businesses.
- **All businesses exhausted (builtCount ≥ 9):** clamp ensures `maxBizIdx ≤ 11` so slice is always valid.

## Out of Scope

- Filtering `pendingFloorType` itself by what the player has built (currently random across all 5 types).
- Changing worker level generation.
- Any UI changes.
