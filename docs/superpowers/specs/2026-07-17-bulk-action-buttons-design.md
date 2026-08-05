# Bulk Action Buttons in QuickActionBar

**Date:** 2026-07-17  
**Status:** Approved

## Overview

Add a context-sensitive "bulk action" button to the QuickActionBar that lets the player perform an action on all eligible floors at once for 1 diamond. The button label changes based on the current quick action mode:

| Mode    | Button label  |
|---------|---------------|
| collect | Collect all   |
| list    | Deliver all   |
| buy     | Buy all       |
| hire    | (hidden)      |

## UI / Layout

**Current bar:** `[✕] [Main action flex:1]`

**New bar (collect mode):** `[✕] [Collect all ◆1] [Main action flex:1]`

The bulk button sits between the close button and the main action button. It is auto-width, height 50 px, pill-shaped, white semi-transparent background (same family as the close button). Content: `<GemIcon size={12}/> 1 · <label>` in a single row. Pressed state → opacity 0.7. Hidden entirely in `hire` mode.

## Architecture

### 1. Command schema (`shared/schemas/command.ts`)

Three new schemas, no extra payload — the engine derives eligible slots from state:

```ts
CollectAllCommandSchema: { type: 'collect_all', id, timestamp }
ListAllCommandSchema:    { type: 'list_all',    id, timestamp }
BuyAllCommandSchema:     { type: 'buy_all',     id, timestamp }
```

Add them to the `CommandSchema` union.

### 2. Engine (`shared/engine/processCommand.ts`)

Three new case handlers in `processCommand` switch. Each follows the same pattern:

1. Guard: `state.gems < 1` → `{ success: false, error: 'Insufficient gems' }`
2. Iterate all floors/slots, apply the single-slot logic (reuse existing helpers).
3. Return updated state with `gems - 1`.

**`collect_all`:** For each slot where `effectiveStage === 'READY_TO_COLLECT'`, run the same logic as `handleCollect`.

**`list_all`:** For each slot where `effectiveStage === 'READY_TO_LIST'`, run the same logic as `handleList`.

**`buy_all`:** For each slot where `stage === 'IDLE'` and `typeId !== null` and a worker is assigned and no active delivery exists on that floor, run the same logic as `handleBuy`. Skip slots that fail any sub-check silently (e.g. insufficient coins for that slot — skip it, do not abort the whole command).

### 3. Store (`src/stores/gameStore.ts`)

Three new actions:

```ts
collectAll: () => void;
listAll:    () => void;
buyAll:     () => void;
```

Each checks `gems < 1` → `showInsufficientResources({ currency: 'gems', need: 1, have: gems })`, otherwise `executeCommand(get, set, { id: uuid(), type: '…', timestamp: clock.now() })`.

### 4. QuickActionBar component (`src/components/QuickActionBar.tsx`)

New optional prop:

```ts
onBulkAll?: () => void;
```

The component renders the bulk button when `mode !== 'hire'` and `onBulkAll` is provided. Label derived from `mode` inside the component. No new state needed.

### 5. game.tsx

```ts
const handleBulkAll = useCallback(() => {
  switch (quickActionMode) {
    case 'collect': collectAll(); break;
    case 'list':    listAll();    break;
    case 'buy':     buyAll();     break;
  }
}, [quickActionMode, collectAll, listAll, buyAll]);
```

Pass `onBulkAll={handleBulkAll}` to `<QuickActionBar>`.

## Error Handling

- Insufficient gems → `showInsufficientResources` (standard modal, no new UI).
- `buy_all` with insufficient coins for some slots: skip those slots silently, still deduct 1 gem if at least one slot was bought. If zero slots eligible (state changed between render and command), still deduct gem (consistent with speed-up pattern).

## Out of Scope

- No confirmation dialog (consistent with other 1-gem actions like fill lobby).
- No "hire all" bulk action.
- No changes to XP logic (existing `xpForCommand` handles new command types via default branch).
