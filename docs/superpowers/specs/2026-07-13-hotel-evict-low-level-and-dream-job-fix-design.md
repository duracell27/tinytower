# Design: Hotel — Evict Low-Level Workers Button + Dream Job Floor Name Fix

Date: 2026-07-13

## Overview

Two small hotel UI improvements:

1. **Evict low-level button** — a new button in the hotel panel that evicts all unassigned workers with level < 9 for 1 diamond, appearing before the "Expand hotel" card.
2. **Dream job floor name** — in the expanded WorkerCard section, the Dream Job info row should show `"Floor Name · Product Name"` instead of just `"Product Name"`.

---

## Feature 1: Evict Low-Level Workers Button

### Behaviour

- The button is visible only when at least one unassigned worker in the hotel has `level < 9`.
- Pressing it immediately evicts all such workers (no confirmation dialog) and deducts 1 gem.
- If the player has 0 gems, the `InsufficientResourcesModal` is shown instead (existing pattern).
- Workers with `level === 9` or with `assignedFloorId !== null` (assigned to a floor) are never touched.

### Architecture

**Command layer (shared/schemas/command.ts)**

New schema:
```ts
export const EvictLowLevelWorkersCommandSchema = z.object({
  id: z.string(),
  type: z.literal('evict_low_level_workers'),
  timestamp: z.number(),
});
```

Added to the `CommandSchema` union. Exported as `EvictLowLevelWorkersCommand` type from `shared/types/index.ts`.

**Engine handler (shared/engine/lobbyCommands.ts)**

New `handleEvictLowLevelWorkers(state)`:
- Returns `{ success: false }` if `state.gems < 1`.
- Returns new state with `gems - 1` and `workers` filtered to keep only those where `level === 9` OR `assignedFloorId !== null`.

Routed from `processLobbyCommand` via `case 'evict_low_level_workers'`.

**processCommand.ts**

Add `'evict_low_level_workers'` to the lobby command dispatch case.

**Store (src/stores/gameStore.ts)**

New action `evictLowLevelWorkers()`:
```ts
evictLowLevelWorkers: () => {
  const state = get();
  if (state.gems < 1) {
    state.showInsufficientResources({ currency: 'gems', need: 1, have: state.gems });
    return;
  }
  executeCommand(get, set, { id: uuid(), type: 'evict_low_level_workers', timestamp: clock.now() });
},
```

**UI (src/components/HotelPanel.tsx)**

- Add `{ kind: 'evict-low' }` to the `ListItem` union type.
- Compute `hasLowLevelWorkers = unemployedWorkers.some(w => w.level < 9)`.
- Insert `{ kind: 'evict-low' }` into `listData` just before `{ kind: 'buy' }` when `hasLowLevelWorkers` is true.
- `renderItem` handles `'evict-low'` by rendering a new `EvictLowLevelCard` component.
- `handleEvictLowLevel` callback calls `useGameStore.getState().evictLowLevelWorkers()`.

**EvictLowLevelCard component (inline in HotelPanel.tsx)**

Styled similarly to `BuySlotCard` — card with label on left and gem-cost button on right. Cost badge shows `💎 1`. Uses the same gradient/shadow button pattern.

**i18n (src/i18n/locales/en/hotel.json)**

```json
"evictLowLevelCard": {
  "title": "Evict all below level 9",
  "cost": "1"
}
```

---

## Feature 2: Dream Job Floor Name (Both Collapsed and Expanded)

**Problem:** `dreamFloorName` is only set when the dream-job floor already exists in `state.floors`. When the floor hasn't been built yet, both views fall back to `category` (e.g., "Food") — too broad. The user wants the specific business name (e.g., "Confectionery") from `gameConfig`.

**Fix — `src/components/WorkerCard.tsx`:**

Compute `dreamBusinessName` inside WorkerCard from `gameConfig`:
```tsx
const ft = gameConfig.floorTypes[worker.floorType];
const dreamBusinessName = ft?.businesses.find(b => b.dreamJobs.includes(worker.dreamJob))?.name;
```

Use `dreamFloorName ?? dreamBusinessName ?? category` in both places:

**Collapsed row** (currently `dreamFloorName ?? category`, line ~101):
```tsx
{`${dreamFloorName ?? dreamBusinessName ?? category} · ${dreamJobName}`}
```

**Expanded InfoRow** (currently just `dreamJobName`, line ~155):
```tsx
<InfoRow label={t('workerCard.info.dreamJob')} value={`${dreamFloorName ?? dreamBusinessName ?? category} · ${dreamJobName}`} />
```

`dreamFloorName` is passed as prop from `HotelPanel` (already exists). `dreamBusinessName` is derived locally from `gameConfig` which is already imported.

---

## Files Changed

| File | Change |
|------|--------|
| `shared/schemas/command.ts` | Add `EvictLowLevelWorkersCommandSchema`, add to union |
| `shared/types/index.ts` | Export `EvictLowLevelWorkersCommand` type |
| `shared/engine/lobbyCommands.ts` | Add `handleEvictLowLevelWorkers`, route in `processLobbyCommand` |
| `shared/engine/processCommand.ts` | Add `'evict_low_level_workers'` to lobby dispatch case |
| `src/stores/gameStore.ts` | Add `evictLowLevelWorkers` action |
| `src/components/HotelPanel.tsx` | Add list item kind, `EvictLowLevelCard`, handler |
| `src/i18n/locales/en/hotel.json` | Add `evictLowLevelCard` keys |
| `src/components/WorkerCard.tsx` | Fix Dream Job InfoRow value |

---

## Out of Scope

- No confirmation dialog (per user decision).
- No changes to WorkersPanel or any other panel.
- No localisation changes beyond English (existing convention).
