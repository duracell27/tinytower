# Exhausted Floor Type Picker

**Date:** 2026-07-10

## Problem

`BusinessTypePickerSheet` shows all 5 floor types even when a type has reached its maximum (3 floors built). The user can tap an exhausted type and the command fails silently in the engine.

## Solution

Compute exhausted types in `game.tsx` and pass them to the picker as a `Set<string>`. The picker grays out exhausted rows and prevents tapping them.

## What counts as "exhausted" for floor X

A floor type is exhausted when `usedCount >= floorTypeConfig.businesses.length` (currently 3), where `usedCount` is:

1. Static config floors of that type already present in `state.floors`
2. Entries in `state.openedFloorTypes` of that type
3. Other UC floors (excluding floor X itself) with `selectedFloorType === type`

This mirrors the tier-counting logic already in `processCommand.ts` `handleOpenFloor`.

## Changes

### `game.tsx`

Add a `useMemo` that computes `exhaustedTypes: Set<string>` per UC floor. Pass it to `BusinessTypePickerSheet` alongside the existing `underConstruction` prop.

```ts
// For each uc in underConstruction, keyed by floorId:
const exhaustedByFloor = useMemo(() => {
  const map = new Map<number, Set<string>>();
  for (const uc of underConstruction) {
    const exhausted = new Set<string>();
    for (const [ft, cfg] of Object.entries(gameConfig.floorTypes)) {
      const staticCount = gameConfig.floors
        .filter(f => f.floorType === ft && floors.some(sf => sf.id === f.id))
        .length;
      const openedCount = Object.values(openedFloorTypes ?? {})
        .filter(t => t === ft).length;
      const pendingCount = underConstruction
        .filter(u => u.floorId !== uc.floorId && u.selectedFloorType === ft)
        .length;
      if (staticCount + openedCount + pendingCount >= cfg.businesses.length) {
        exhausted.add(ft);
      }
    }
    map.set(uc.floorId, exhausted);
  }
  return map;
}, [underConstruction, floors, openedFloorTypes]);
```

### `BusinessTypePickerSheet`

- Add prop `exhaustedTypes: Set<string>` (default empty set)
- For each type row: if `exhaustedTypes.has(ft)`:
  - Wrap row in `opacity: 0.4`
  - Disable `onPress` (pass `undefined`)
  - Show subtext "All floors of this category already built" in gray below the type name

## Visual

```
[ icon ]  Products                   ← normal, tappable
[ icon ]  Service        (grayed)
          All floors of this category already built
[ icon ]  Rest                        ← normal
```

## Out of scope

- No counter badge (e.g. "3/3")
- No reordering (exhausted types stay in their original position)
- No engine changes (validation already exists in `processCommand.ts`)
