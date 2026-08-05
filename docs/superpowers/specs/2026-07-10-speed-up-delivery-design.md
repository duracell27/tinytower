# Speed Up Production Delivery

**Date:** 2026-07-10

## Overview

Players can pay gems to instantly complete an in-progress production delivery. Cost is 1 gem per remaining hour (minimum 1 gem). No confirmation step — single tap executes immediately.

## Engine (`processCommand.ts`)

New command type: `speed_up_delivery` with fields `{ id, floorId, slotIdx, timestamp }`.

Handler `handleSpeedUpDelivery`:

1. Find floor by `floorId` → find production by `slotIdx`
2. Guard: `production.stage !== 'DELIVERING'` → error `'Not delivering'`
3. Guard: `!production.typeId` → error `'No type assigned'`
4. Resolve `typeConfig` from `config.productionTypes[production.typeId]`
5. `timeLeft = typeConfig.deliveryDuration - (command.timestamp - production.stageStartedAt)`
6. Guard: `timeLeft <= 0` → error `'Delivery already complete'`
7. `cost = Math.max(1, Math.ceil(timeLeft / MS_PER_HOUR))`
8. Guard: `state.gems < cost` → error `'Insufficient gems'`
9. Set `stageStartedAt = command.timestamp - typeConfig.deliveryDuration` — makes remaining time zero
10. Deduct gems: `gems: state.gems - cost`

After step 9, `getProductionStatus` returns `effectiveStage: 'READY_TO_LIST'` — no separate state transition needed.

`MS_PER_HOUR = 3_600_000` already defined in `processCommand.ts` — reuse it.

## Schema (`shared/schemas/command.ts`)

```typescript
export const SpeedUpDeliveryCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('speed_up_delivery'),
  floorId: z.number().int(),
  slotIdx: z.number().int().nonnegative(),
});
```

Add to `CommandSchema` discriminated union.

## Store (`src/stores/gameStore.ts`)

New action:
```typescript
speedUpDelivery: (floorId: number, slotIdx: number) => void;
```

Implementation:
```typescript
speedUpDelivery: (floorId, slotIdx) => {
  executeCommand(get, set, {
    id: uuid(),
    type: 'speed_up_delivery',
    floorId,
    slotIdx,
    timestamp: clock.now(),
  });
},
```

## ProductionCard (`src/components/ProductionCard.tsx`)

New prop: `gems: number`

When `effectiveStage === 'DELIVERING'`:
- Compute `speedUpCost = Math.max(1, Math.ceil(timeRemaining / MS_PER_HOUR))` where `MS_PER_HOUR = 3_600_000`
- Sub-text area: replace the `"delivering"` status pill with a tappable `⚡ N 💎` pill
- On tap:
  - If `gems < speedUpCost` → `store.showInsufficientResources({ currency: 'gems', need: speedUpCost, have: gems })`
  - Else → `store.speedUpDelivery(floorId, slotIdx)`

The main button (timer + truck icon + animated border) is unchanged.

## FloorCard (`src/components/FloorCard.tsx`)

Pass `gems` from store to each `ProductionCard`:
```tsx
const gems = useGameStore((s) => s.gems);
// ...
<ProductionCard
  // existing props
  gems={gems}
/>
```

## Unchanged

- `getProductionStatus` — no changes needed
- `DerivedStatus` type — no new fields
- Construction speed-up — unaffected

## Test cases

- `handleSpeedUpDelivery` succeeds: deducts correct gems, sets `stageStartedAt = now - deliveryDuration`
- Fails when slot is not `DELIVERING`
- Fails when `timeLeft <= 0` (delivery already expired)
- Fails when insufficient gems
- Cost formula: `timeLeft = 30 min → cost = 1`, `timeLeft = 61 min → cost = 2`, `timeLeft = exactly 60 min → cost = 1`
