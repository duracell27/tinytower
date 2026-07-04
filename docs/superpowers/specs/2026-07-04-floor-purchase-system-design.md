# Floor Purchase & Construction System Design

**Date:** 2026-07-04  
**Status:** Approved

---

## Overview

When a player buys a new floor, a construction timer starts. After the timer expires the player opens the floor by choosing a business type and spending the required tools. The new floor then appears in the tower with empty production slots seeking workers.

---

## User Flow

1. Player taps **BuyFloorBanner** → if gems sufficient → `buy_floor` command fires, gems deducted, construction begins
2. **UnderConstructionBanner** replaces BuyFloorBanner — shows countdown timer
3. Timer hits zero → **"Відкрити поверх"** button appears on the banner
4. Player taps it → **BusinessTypePickerSheet** opens (5 types)
5. Player selects a type → required tool + count shown; if tools available → **"Відкрити бізнес"** button enabled
6. Player taps "Відкрити бізнес" → `open_floor` command fires, tools deducted, floor added to tower

---

## Data Model Changes

### `shared/schemas/gameState.ts`

Add three fields to `GameStateSchema`:

```typescript
underConstruction: z.object({
  floorId: z.number().int(),
  startedAt: z.number(),
  durationMs: z.number(),
  requiredTool: z.enum(['briks', 'glass', 'nails', 'screw']),
  requiredCount: z.number().int().positive(),
}).nullable().default(null),

openedFloorTypes: z.record(z.string(), z.string()).default({}),

tools: z.object({
  briks: z.number().int().nonnegative(),
  glass: z.number().int().nonnegative(),
  nails: z.number().int().nonnegative(),
  screw: z.number().int().nonnegative(),
}).default({ briks: 0, glass: 0, nails: 0, screw: 0 }),
```

`openedFloorTypes` maps `floorId` (as string key) → `floorType` string (e.g. `"5": "violet"`). Used by `FloorCard` to resolve config for dynamically opened floors.

`tools` moves from the Zustand store into `GameState` so it is persisted and synced with the server.

### `shared/schemas/command.ts`

Two new commands added to the discriminated union:

```typescript
BuyFloorCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('buy_floor'),
  floorId: z.number().int(),
  requiredTool: z.enum(['briks', 'glass', 'nails', 'screw']),
})

OpenFloorCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('open_floor'),
  floorId: z.number().int(),
  floorType: z.string(),
})
```

`requiredTool` is chosen randomly on the client at purchase time and embedded in the command so the server can reproduce the same state.

---

## Game Config Changes

### `shared/config/gameConfig.ts`

Add `floorUnlocks` array to `rawConfig`:

```typescript
floorUnlocks: [
  {
    floorId: 5,
    price: 250,
    currency: 'gems' as const,
    constructionDurationMs: 20 * 60 * 1000,
    requiredToolCount: 1,
  },
]
```

Add production types for `violet` and `red` floor types (already defined in `floorTypes` but missing `productionTypes` entries):

```typescript
// violet
aroma:   { buyCost: 30, deliveryDuration: 10000, sellDuration: 14000, batchValue: 58 },
soap:    { buyCost: 45, deliveryDuration: 14000, sellDuration: 20000, batchValue: 82 },
candle:  { buyCost: 60, deliveryDuration: 20000, sellDuration: 26000, batchValue: 110 },
// red
icecream:{ buyCost: 25, deliveryDuration: 9000,  sellDuration: 13000, batchValue: 50 },
shake:   { buyCost: 40, deliveryDuration: 13000, sellDuration: 19000, batchValue: 74 },
sorbet:  { buyCost: 55, deliveryDuration: 18000, sellDuration: 24000, batchValue: 98 },
```

Add `GameConfigSchema` extension for `floorUnlocks`:

```typescript
FloorUnlockConfigSchema = z.object({
  floorId: z.number().int(),
  price: z.number().int().positive(),
  currency: z.enum(['coins', 'gems']),
  constructionDurationMs: z.number().positive(),
  requiredToolCount: z.number().int().positive(),
})

GameConfigSchema gets: floorUnlocks: z.array(FloorUnlockConfigSchema)
```

---

## Engine: processCommand

### `buy_floor`

1. Find `floorUnlockConfig` by `floorId` in `gameConfig.floorUnlocks` — if not found, no-op
2. Check `state.gems >= config.price` — if not, return `{ success: false }`
3. Check `state.underConstruction === null` — only one floor at a time
4. Deduct gems
5. Set `underConstruction = { floorId, startedAt: timestamp, durationMs, requiredTool, requiredCount }`
6. Return updated state

### `open_floor`

1. Check `underConstruction !== null && underConstruction.floorId === command.floorId`
2. Check `timestamp - underConstruction.startedAt >= underConstruction.durationMs` — timer complete
3. Check `state.tools[underConstruction.requiredTool] >= underConstruction.requiredCount`
4. Deduct tools
5. Build the new floor: look up `gameConfig.floorTypes[command.floorType].dreamJobs` → create productions
6. Push new floor to `state.floors`
7. Add `command.floorType` to `state.openedFloorTypes[command.floorId]`
8. Clear `underConstruction = null`
9. Return updated state

---

## Store Changes (`src/stores/gameStore.ts`)

- Remove `ToolInventory` from the Zustand store state interface — it now lives inside `GameState.tools`
- Update all places that read `store.briks / store.glass / store.nails / store.screw` → `store.tools.briks` etc.
- Update `setToolInventory` action to write into `GameState.tools` (or remove and replace with server reconcile path)
- Add actions:

```typescript
buyFloor: (floorId: number) => void
// picks a random tool key, dispatches buy_floor command

openFloor: (floorId: number, floorType: string) => void
// dispatches open_floor command
```

---

## New Components

### `src/components/UnderConstructionBanner.tsx`

Props:
```typescript
interface UnderConstructionBannerProps {
  floorId: number;
  endsAt: number;       // startedAt + durationMs
  now: number;          // from useGameClock
  onOpenFloor: () => void;
}
```

Renders:
- Builder icon + "Будується N поверх" label
- Progress bar: `elapsed / durationMs`
- Countdown `MM:SS` while `timeLeft > 0`
- When `timeLeft === 0`: "Відкрити поверх" button (orange/builder color `#E67E22`)

### `src/components/BusinessTypePickerSheet.tsx`

Props:
```typescript
interface BusinessTypePickerSheetProps {
  visible: boolean;
  floorId: number;
  requiredTool: ToolKey;
  requiredCount: number;
  onClose: () => void;
  onOpen: (floorType: string) => void;
}
```

Renders:
- Bottom sheet (same pattern as `JobPickerSheet`)
- 5 floor type rows: color swatch + type name
- Selected row expands to show: tool icon + `requiredCount` + "на складі: X" (green if sufficient, red if not)
- "Відкрити бізнес" button: enabled only if `tools[requiredTool] >= requiredCount`

---

## `app/(tabs)/game.tsx` Changes

- `FLOOR_LIST` becomes dynamic: computed from `floors`, `underConstruction`, and `openedFloorTypes`
- When `underConstruction !== null` → insert `{ type: 'underConstruction' }` item at top of tower
- Remove static `{ type: 'buyFloor' }` when construction is active
- After `open_floor` the new floor appears automatically (store update triggers re-render)
- Pass `now` to `UnderConstructionBanner` (already available from `useGameClock`)
- Open `BusinessTypePickerSheet` when "Відкрити поверх" pressed

---

## Files Changed

| File | Change |
|------|--------|
| `shared/schemas/gameState.ts` | + `underConstruction`, `openedFloorTypes`, `tools` |
| `shared/schemas/gameConfig.ts` | + `FloorUnlockConfigSchema`, extend `GameConfigSchema` |
| `shared/schemas/command.ts` | + `BuyFloorCommandSchema`, `OpenFloorCommandSchema` |
| `shared/types/index.ts` | + `BuyFloorCommand`, `OpenFloorCommand` exported types |
| `shared/config/gameConfig.ts` | + `floorUnlocks`, production types for violet/red |
| `shared/engine/processCommand.ts` | + handle `buy_floor`, `open_floor` |
| `src/stores/gameStore.ts` | tools → GameState, + `buyFloor`, `openFloor` |
| `src/components/UnderConstructionBanner.tsx` | new |
| `src/components/BusinessTypePickerSheet.tsx` | new |
| `app/(tabs)/game.tsx` | dynamic FLOOR_LIST, new item types |

---

## Constraints & Notes

- Only one floor under construction at a time (`underConstruction` is a single nullable object, not an array)
- The `requiredTool` is picked randomly client-side at purchase time and embedded in the `buy_floor` command — this makes the command deterministic for server replay
- `FloorCard` must handle floors not present in `gameConfig.floors` — it should fall back to `openedFloorTypes` + `floorTypes` config to get available production types
- Tools migration: existing players have `briks/glass/nails/screw` in Zustand store — the `hydrate` / `reconcile` path must copy those values into `GameState.tools` on first sync
