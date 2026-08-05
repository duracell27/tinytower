# Speed Up Construction

**Date:** 2026-07-09

## Summary

Add a speed-up button next to the construction timer in `UnderConstructionBanner`. Costs 1 gem per hour remaining (minimum 1). Inline confirmation inside the banner before deducting gems.

## UI

- **Normal state:** `ribbonRight` shows `timerPill` (timer) + new speed-up pill (⚡ + gem count, blue/teal color).
- **Confirmation state:** replaces both pills with `"⚡ X💎 — Finish?"` + ✓ / ✗ buttons. Tap ✗ or outside returns to normal.
- Confirmation state is local `useState<boolean>`, reset when `floorId` changes.
- If gems insufficient on confirm → `InsufficientResourcesModal` (existing, `currency: 'gems'`).

## Gem Cost Formula

```ts
cost = Math.max(1, Math.ceil(timeLeftMs / 3_600_000))
```

## New Command: `speed_up_construction`

**Schema** (`shared/schemas/command.ts`):
```ts
{ type: 'speed_up_construction', id, timestamp, floorId: number }
```

**Handler** (`shared/engine/processCommand.ts`):
1. Find `uc` by `floorId` — error if not found.
2. `timeLeft = uc.startedAt + uc.durationMs - timestamp` — if `<= 0`, error (already done).
3. `cost = Math.max(1, Math.ceil(timeLeft / 3_600_000))`.
4. If `state.gems < cost` → `{ success: false, error: 'Insufficient gems' }`.
5. Return `{ gems: gems - cost, uc.startedAt: timestamp - uc.durationMs }` — marks construction complete.

**XP:** 0 (added to exclusion list in `xp.ts`).

## Store

New action `speedUpConstruction(floorId: number)` in `gameStore.ts`:
- Optimistic gem check → if insufficient, dispatch `setInsufficientResources({ currency: 'gems', ... })`.
- Otherwise dispatch `speed_up_construction` command.

## Files Changed

| File | Change |
|------|--------|
| `shared/schemas/command.ts` | Add `SpeedUpConstructionCommandSchema` |
| `shared/engine/processCommand.ts` | Add handler + route |
| `shared/engine/xp.ts` | Exclude `speed_up_construction` from XP |
| `src/stores/gameStore.ts` | Add `speedUpConstruction` action |
| `src/components/UnderConstructionBanner.tsx` | Add button + inline confirm UI |
