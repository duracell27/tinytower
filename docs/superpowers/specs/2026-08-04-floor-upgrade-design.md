# Floor Upgrade System — Design Spec

**Date:** 2026-08-04  
**Status:** Approved

---

## Overview

Each unlocked business floor can be upgraded up to 5 times (5 stars). Upgrades are paid with **gems + floor-type tokens** and permanently multiply the floor's production values: revenue, sell duration, and buy cost all scale together. The UI entry point is the existing star row in the floor card header — tapping it opens an upgrade modal.

---

## Cost Table

Each star costs **gems** and **tokens of the floor's type** (green/blue/yellow/purple/red).

| Star | Gems | Tokens |
|------|------|--------|
| 1★   | 10   | 1      |
| 2★   | 20   | 2      |
| 3★   | 30   | 3      |
| 4★   | 50   | 4      |
| 5★   | 80   | 5      |

Upgrades are sequential — must reach star N before buying star N+1.

---

## Production Multipliers

All three production values scale together by star level.

| Stars | `batchValue` | `sellDuration` | `buyCost` | Efficiency (value/time) |
|-------|-------------|----------------|----------|-------------------------|
| 0★    | ×1          | ×1             | ×1       | ×1.00                   |
| 1★    | ×2          | ×1.5           | ×1.5     | ×1.33                   |
| 2★    | ×3          | ×2             | ×2       | ×1.50                   |
| 3★    | ×4          | ×2.5           | ×2.5     | ×1.60                   |
| 4★    | ×6          | ×3             | ×3       | ×2.00                   |
| 5★    | ×8          | ×4             | ×4       | ×2.00                   |

**Verification (Bakery, no bonuses):**

| Stars | Revenue | Cost | Net profit | vs. 0★  |
|-------|---------|------|------------|---------|
| 0★    | 638     | 211  | 427        | ×1.0    |
| 1★    | 1 276   | 317  | 959        | ×2.25   |
| 2★    | 1 914   | 422  | 1 492      | ×3.50   |
| 3★    | 2 552   | 528  | 2 024      | ×4.74   |
| 4★    | 3 828   | 633  | 3 195      | ×7.48   |
| 5★    | 5 104   | 844  | 4 260      | ≈×10 ✓  |

`deliveryDuration` is **not** affected — same delivery time at all star levels.

---

## State

### New field in `GameStateSchema`

```ts
floorStars: z.record(z.string(), z.number().int().min(0).max(5)).default({})
// key = floorId.toString(), value = current star count (0 = no upgrades)
```

Follows the same pattern as the existing `openedFloorTypes` field.

### New command: `upgrade_floor`

```ts
UpgradeFloorCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('upgrade_floor'),
  floorId: z.number().int().positive(),
})
```

---

## Engine: `processCommand.ts`

### New handler: `handleUpgradeFloor`

Validations (in order):
1. Floor exists in `state.floors` and is open (has a `floorType` via `resolveFloorType`)
2. Current stars < 5 — already at max → error `'Floor already at max stars'`
3. Cost lookup: `nextStar = currentStars + 1`, fetch from `FLOOR_UPGRADE_COSTS[nextStar - 1]`
4. `state.gems >= cost.gems` — else error `'Insufficient gems'`
5. `state.tokens[floorType] >= cost.tokens` — else error `'Insufficient tokens'`

On success:
```ts
state.gems          -= cost.gems
state.tokens[floorType] -= cost.tokens
state.floorStars[floorId] = nextStar
```

### New config: `floorUpgradeConfig.ts`

```ts
export const FLOOR_UPGRADE_COSTS = [
  { gems: 10, tokens: 1 }, // → 1★
  { gems: 20, tokens: 2 }, // → 2★
  { gems: 30, tokens: 3 }, // → 3★
  { gems: 50, tokens: 4 }, // → 4★
  { gems: 80, tokens: 5 }, // → 5★
];

export const FLOOR_STAR_MULTIPLIERS = [
  { value: 1,   time: 1,   cost: 1   }, // 0★ base
  { value: 2,   time: 1.5, cost: 1.5 }, // 1★
  { value: 3,   time: 2,   cost: 2   }, // 2★
  { value: 4,   time: 2.5, cost: 2.5 }, // 3★
  { value: 6,   time: 3,   cost: 3   }, // 4★
  { value: 8,   time: 4,   cost: 4   }, // 5★
];
```

### Applying multipliers in existing handlers

Multipliers are read at command-processing time — not stored in ProductionState.

| Location | Field affected | How |
|----------|----------------|-----|
| `handleBuy` (processCommand) | `typeConfig.buyCost` | `× multiplier.cost` (after discount) |
| `handleCollect` (processCommand) | `typeConfig.sellDuration` | `× multiplier.time` (sell-complete check at line 583) |
| `handleCollect` (processCommand) | `typeConfig.batchValue` | `× multiplier.value` (before coinMultiplier) |
| `handleCollectAll` | same as collect | calls `handleCollect` — inherited automatically |
| `handleBuyAll` | same as buy | calls `handleBuy` — inherited automatically |
| `getProductionStatus` (productionStatus.ts) | `typeConfig.sellDuration` | add optional `sellDurationOverride` param so UI timer shows correct remaining time |
| `ProductionCard` (UI) | — | read `floorStars[floorId]` from store, compute `effectiveSellDuration`, pass to `getProductionStatus` |

`handleList` does **not** use `sellDuration` — it only checks `deliveryDuration`. No change needed there.

Helper (shared, in processCommand.ts):
```ts
function getFloorStarMultiplier(state: GameState, floorId: number) {
  const stars = state.floorStars?.[String(floorId)] ?? 0;
  return FLOOR_STAR_MULTIPLIERS[stars];
}
```

---

## UI

### Entry point: `FloorCard` header

The `Stars` component (line 262, `FloorCard.tsx`) already renders 0–5 stars from `scheme.stars`. Changes needed:

1. Read `floorStars[floorId]` from `useGameStore` instead of `scheme.stars`
2. Wrap the `<Stars>` row in a `<TouchableOpacity>` that opens the upgrade modal
3. Pass `floorId` to the modal

### New modal: `FloorUpgradeModal`

Registered in `GlobalOverlay` (following existing pattern).

**Trigger state in gameStore:**
```ts
floorUpgradeModal: { floorId: number } | null
```
Actions: `openFloorUpgradeModal(floorId)`, `closeFloorUpgradeModal()`

**Modal content:**
- Floor name + current star count
- Star row showing current/next state
- Cost display: `N gems + N tokens (🟢/🔵/...)`
- Current resource balance for gems + relevant token
- **Upgrade** button (disabled if insufficient resources or already 5★)
- **Close** button

**Resource check:** same pattern as `InsufficientResourcesModal` — show which resource is missing if the player can't afford it.

---

## Files to create / modify

| File | Action |
|------|--------|
| `shared/config/floorUpgradeConfig.ts` | **Create** — cost table + multiplier table |
| `shared/schemas/gameState.ts` | **Modify** — add `floorStars` field |
| `shared/schemas/command.ts` | **Modify** — add `UpgradeFloorCommandSchema`, register in union |
| `shared/types/index.ts` | **Modify** — export new command type |
| `shared/engine/processCommand.ts` | **Modify** — add handler, apply multipliers in buy/list/collect |
| `src/stores/gameStore.ts` | **Modify** — add `upgradeFloor()` action + modal state |
| `src/components/FloorCard.tsx` | **Modify** — connect stars to store, add tap handler |
| `src/components/ProductionCard.tsx` | **Modify** — read `floorStars`, pass effective sellDuration to `getProductionStatus` |
| `shared/engine/productionStatus.ts` | **Modify** — add optional `sellDurationOverride` param |
| `src/components/FloorUpgradeModal.tsx` | **Create** — upgrade modal UI |
| `src/components/GlobalOverlay.tsx` | **Modify** — register `FloorUpgradeModal` |
| `src/i18n/locales/en/hotel.json` | **Modify** — add upgrade modal strings |

---

## Out of scope

- No achievement tracking for floor upgrades (can be added later)
- No daily task progress tied to floor upgrades
- No visual change to the floor body or card appearance based on star level (stars in header only)
