# Floor Delivery Lock

**Date:** 2026-07-09

## Overview

On a single floor, only one production slot can be in the `DELIVERING` stage at a time. All slots may sell simultaneously, but a second `buy` is blocked while any slot on the same floor has an active delivery timer running.

The lock lifts automatically the moment the active delivery timer reaches zero — even before the player taps "List". Once the timer expires the truck has conceptually arrived and the floor is free.

## Engine (`processCommand.ts` — `handleBuy`)

Before deducting balance, add a floor-level delivery check:

```typescript
const hasActiveDelivery = state.floors[floorIdx].productions.some((p, i) => {
  if (i === slotIdx) return false;
  if (p.stage !== 'DELIVERING' || !p.typeId) return false;
  const tc = config.productionTypes[p.typeId];
  return tc ? (now - p.stageStartedAt) < tc.deliveryDuration : false;
});
if (hasActiveDelivery) {
  return { success: false, state, error: 'Another delivery in progress on this floor' };
}
```

This is the authoritative enforcement point. The server will reject a second `buy` command even if the client sends one.

## FloorCard (`FloorCard.tsx`)

Compute `deliveryLockMs` once per render, before the production card loop:

```typescript
const deliveryLockMs = (() => {
  const dp = floor.productions.find(p => p.stage === 'DELIVERING' && p.typeId);
  if (!dp) return 0;
  const tc = gameConfig.productionTypes[dp.typeId!];
  if (!tc) return 0;
  return Math.max(0, tc.deliveryDuration - (now - dp.stageStartedAt));
})();
```

Pass `deliveryLockMs` as a new prop to every `ProductionCard` on this floor.

## ProductionCard (`ProductionCard.tsx`)

New prop: `deliveryLockMs?: number`

```
isDeliveryLocked = (effectiveStage === 'IDLE' || effectiveStage === 'EMPTY')
                   && (deliveryLockMs ?? 0) > 0
```

When `isDeliveryLocked`:
- Button: `onPress = undefined`, `opacity: 0.5`
- Icon: lock SVG instead of `+`
- Sub-text pill (below button): `formatTime(deliveryLockMs)` showing countdown until unlock

The "Hire" path (worker absent, `isLocked = true`) is unaffected — no delivery lock shown there.

## Unchanged

- `getProductionStatus` — stays single-production scoped, no floor context added
- Selling, collecting, listing — unrestricted, any number of slots may sell simultaneously
- `DerivedStatus` type — no new fields needed

## Test cases to add

- `handleBuy` rejects when another slot on the same floor is in `DELIVERING` with `remaining > 0`
- `handleBuy` accepts when the other slot's delivery timer has expired (`remaining <= 0`)
- `handleBuy` accepts when the buy is for the same slot that is currently `IDLE` (normal restock)
- `handleBuy` accepts on a different floor even if this floor has an active delivery
