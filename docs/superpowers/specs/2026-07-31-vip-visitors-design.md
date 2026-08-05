# VIP Visitors Design

**Date:** 2026-07-31
**Status:** Approved

## Overview

Add VIP variants of all 5 existing elevator visitor types. A VIP visitor has a 2% chance to spawn instead of a regular visitor and produces a significantly amplified effect. Visually distinguished by a golden background on their icon and a "VIP" prefix in their label.

## Schema Changes

### `shared/schemas/visitor.ts`

Add optional `isVip` field to `VisitorSchema`:

```ts
export const VisitorSchema = z.object({
  id: z.string(),
  role: VisitorRoleSchema.optional(),
  isVip: z.boolean().optional(),   // NEW
  targetFloor: z.number().int().positive().optional(),
  hairColor: z.string(),
  female: z.boolean(),
  pendingFloorType: z.string().optional(),
});
```

`VisitorRoleSchema` is unchanged — roles remain `'guest' | 'businessman' | 'deliverer' | 'seller' | 'builder'`.

## Spawning

### `shared/engine/lobbyUtils.ts` — `generateRandomVisitorRole`

After role and targetFloor are determined, roll independently for VIP:

```ts
const isVip = Math.random() < 0.02;
return { role, targetFloor, isVip };
```

The 2% chance is independent of role — any visitor type can be VIP. All callers that spread the return value (`SpawnVisitorCommand`, `DeliverAll`) propagate `isVip` automatically.

## Effects

### `shared/engine/lobbyCommands.ts` — `applyVisitorEffect`

| Role | Regular effect | VIP effect |
|------|---------------|------------|
| `guest` | Tip coins; floor 1 → add 1 resident to hotel | Tip × 10; floor 1 → fill hotel to capacity with generated workers |
| `businessman` | +1 gem (or fallback tip at daily gem limit) | +1 gem (unchanged); fallback tip × 10 |
| `builder` | +1 tool (random material) | If target floor is under construction → complete construction (set `stageStartedAt` so timer expires); otherwise +2 tools |
| `deliverer` | Reduce delivery time by `deliveryDuration × deliverySpeedBonus` | Fully complete the DELIVERING slot (`stageStartedAt = now - deliveryDuration`) |
| `seller` | Reduce sell time by `sellDuration × sellSpeedBonus` | Fully complete the SELLING slot with the longest remaining time |

### VIP guest — hotel fill

```ts
const spotsLeft = state.hotelCapacity - workers.filter(w => w.assignedFloorId === null).length;
const newWorkers = generateRandomWorkers(spotsLeft, config);
workers = [...workers, ...newWorkers.map(w => ({ ...w, assignedFloorId: null, assignedSlotIdx: null, isSpecialist: false }))];
```

### VIP builder — complete construction

Find the `underConstruction` entry for `targetFloor` and set its `startedAt` so that `now - startedAt >= durationMs`:

```ts
state.underConstruction = state.underConstruction.map(uc =>
  uc.floorId === targetFloor
    ? { ...uc, startedAt: now - uc.durationMs }
    : uc
);
```

The floor then becomes available for `open_floor` — it is not opened automatically.

### VIP seller — longest remaining time

Among all SELLING slots on the target floor, pick the one with the largest `(typeConfig.sellDuration - (now - p.stageStartedAt))` value and complete it fully.

## Stats Tracking

In `applyVisitorEffect`, after applying effects:

```ts
// always
visitorsLifted += 1;
// VIP only
if (isVip) vipsLifted += 1;
```

The existing daily task `vip_transporter` (lift 10 VIP guests, threshold 10) reads `vipsLifted` and works without changes.

## Command Propagation

`isVip` must be carried through:

- `SpawnVisitorCommandSchema` — add `isVip: z.boolean().optional()`
- `LiftVisitorCommandSchema` — add `isVip: z.boolean().optional()`
- `DeliverAllCommand` — the per-visitor payload already spreads visitor fields; ensure `isVip` is included
- `handleSpawnVisitor`, `handleLiftVisitor`, `handleDeliverAll` in `lobbyCommands.ts` — pass `isVip` through to `applyVisitorEffect`

## Pre-generated Data

`DeliverAll` pre-generates workers and tools for the batch before applying effects. VIP guest may fill the hotel entirely, consuming all pre-generated workers in one shot. The pre-generation count should use `hotelCapacity - currentOccupancy` as the upper bound, same as today, which already handles this correctly.

## UI Changes

### Visitor icon background
- Regular: existing background
- VIP: golden/yellow tint on the icon background container

### Visitor label
- Regular: `"Guest"`, `"Businessman"`, `"Builder"`, `"Deliverer"`, `"Seller"`
- VIP: `"VIP Guest"`, `"VIP Businessman"`, `"VIP Builder"`, `"VIP Deliverer"`, `"VIP Seller"`

## Out of Scope

- VIP-specific animations or sound effects
- Configurable VIP spawn rate (hardcoded 2%)
- Per-role VIP probability variation
