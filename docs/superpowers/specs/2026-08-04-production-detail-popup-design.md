# Production Detail Popup — Design Spec

**Date:** 2026-08-04

## Overview

Long-pressing (2 s) on a `ProductionCard` opens a modal with detailed production and worker information. The modal is read-only. If the slot has no worker, long press does nothing.

## User Flow

1. User holds finger on `ProductionCard` for 2 seconds.
2. If `worker` is absent → nothing happens.
3. If `worker` is present → `ProductionDetailModal` opens via GlobalOverlay.
4. User dismisses by tapping the backdrop or a close button.

## Modal Layout

```
╔══════════════════════════════════╗
║  [product icon]  Product name    ║  ← header tinted with floor accent color
║  Status: Delivering / Selling…   ║
╠══════════════════════════════════╣
║  👷 Avatar  Name  Lv5  ⭐        ║  ← worker row (WorkerAvatar)
║  Dream job  ×2.0 bonus  🟢       ║  ← mood chip (green/yellow/grey)
╠══════════════════════════════════╣
║  REVENUE PER BATCH               ║
║  Base               100 🪙        ║
║  Floor stars        ×1.2         ║
║  Worker             ×2.0         ║
║  Specialist         +9%          ║
║  Category bonus     +5%          ║
║  Global bonus       +3%          ║  ← only shown if > 0
║  ─────────────────────           ║
║  Total              264 🪙  /min  ║  ← revenue/min appended
╠══════════════════════════════════╣
║  Delivery     5 min              ║
║  Sell time    10 min             ║
║  Buy cost     80 🪙 (-20%)       ║  ← discount shown if > 0
╚══════════════════════════════════╝
```

## Data Mapping

| Field | Source |
|-------|--------|
| Product icon | `productImage` prop (passed down from parent) |
| Product name | `productTitle` prop |
| Current status | `effectiveStage` from `getProductionStatus()` |
| Worker avatar | `WorkerAvatar` component with `worker` prop |
| Worker name/level/isSpecialist | `worker` object |
| Worker mood | `getWorkerMood(worker, floorType, production.typeId)` → `'good'`/`'mid'`/`'bad'` |
| Worker multiplier | `getRevenueMultiplier()` → 2.0 / 1.3 / 1.0 |
| Base revenue | `typeConfig.batchValue` |
| Star multiplier | `FLOOR_STAR_MULTIPLIERS[stars].value` |
| Specialist bonus | `specialistBonus` prop (already computed in parent) |
| Category bonus | `businessUpgrades[floorType] * 5` |
| Global coin bonus | `coinBonusPercent` from gameStore |
| Total revenue | `effectiveRevenue` (already computed in ProductionCard) |
| Revenue per min | `effectiveRevenue / (deliveryDuration + effectiveSellDuration) * 60_000` |
| Delivery duration | `typeConfig.deliveryDuration` (formatted) |
| Sell duration | `effectiveSellDuration` (typeConfig.sellDuration × starMult.time) |
| Buy cost | `effectiveCost` (already computed in ProductionCard) |
| Discount % | `Math.round(floorDiscount * 100)` |

## State (gameStore)

```ts
productionDetailModal: {
  floorId: number;
  slotIdx: number;
} | null;

openProductionDetailModal: (floorId: number, slotIdx: number) => void;
closeProductionDetailModal: () => void;
```

Initial value: `null`. Reset in `resetState`.

## Component: ProductionDetailModal

- File: `src/components/ProductionDetailModal.tsx`
- Reads `productionDetailModal` from gameStore
- Reads all necessary state from gameStore (workers, floors, floorStars, businessUpgrades, coinBonusPercent, openedFloorTypes, etc.)
- Uses `react-native Modal` with `transparent` + animated backdrop (same pattern as other modals)
- Header background uses `accentColor` of the floor tinted lightly
- Revenue breakdown rows only shown if the modifier is non-zero / non-1.0 (e.g. skip global bonus row if coinBonusPercent === 0)
- Mood chip colors: green (dream job), yellow (mid), grey (bad)

## Component: ProductionCard changes

- Wrap outer `View` in `Pressable` (or add `onLongPress` + `delayLongPress={2000}` to existing `Pressable` if it covers the whole card)
- `onLongPress` prop: `() => void | undefined`
- If `worker` is absent → `onLongPress` not called (guard in parent)

## Parent changes (FloorCard / TechnicalFloor)

- Pass `onLongPress={() => store.openProductionDetailModal(floorId, slotIdx)}` to `ProductionCard`
- Guard: only pass if `worker` exists for that slot

## GlobalOverlay changes

- Import and render `<ProductionDetailModal />` inside GlobalOverlay

## Out of Scope

- No navigation to worker profile from this popup
- No actions (buy/collect/etc.) inside the popup
- Slots without a worker: long press ignored
