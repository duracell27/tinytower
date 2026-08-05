# Fill Lobby Button — Design Spec

**Date:** 2026-07-08  
**Status:** Approved

## Overview

Add a "Fill Lobby" button to the elevator panel's empty state. The button appears only when the lobby is completely empty (`lobbyVisitors.length === 0`) and instantly fills the lobby to full capacity for a gem cost that scales with daily usage.

## Cost Scaling

The cost resets to 1 gem each midnight (same daily reset cycle as `dailyTips`, `dailyGemsCollected`).

| Use # today | Cost |
|-------------|------|
| 1–5         | 1 gem |
| 6–10        | 2 gems |
| 11–15       | 3 gems |
| 16+         | 5 gems |

Cost is determined by `dailyFillLobbyUses` (count before this press):
```
function getFillLobbyCost(uses: number): number {
  if (uses < 5)  return 1;
  if (uses < 10) return 2;
  if (uses < 15) return 3;
  return 5;
}
```

## UI

- Location: inside the empty state card in `LobbyPanel`, below the "Lobby is empty" / "New visitors will arrive soon" text
- Button shows: gem icon + current cost number
- No usage counter displayed on the button
- If player has insufficient gems: triggers existing `showInsufficientResources` flow

## Behavior

On press the lobby is filled to `lobbyCapacity` visitors (all slots). Visitor roles and attributes are pre-generated client-side (same pattern as `spawn_visitor`) and embedded in the command for deterministic replay.

## Data Model Changes

### `shared/schemas/gameState.ts`
Add to `GameStateSchema`:
```ts
dailyFillLobbyUses: z.number().int().nonnegative().default(0),
```

### `shared/engine/lobbyUtils.ts`
- Add `getFillLobbyCost(uses: number): number` helper
- Add `dailyFillLobbyUses: 0` to the reset object in `checkDailyReset`

### `shared/schemas/command.ts`
New command schema:
```ts
export const FillLobbyCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('fill_lobby'),
  visitors: z.array(z.object({
    visitorId: z.string(),
    role: VisitorRoleSchema,
    targetFloor: z.number().int().positive(),
    hairColor: z.string(),
    female: z.boolean(),
    pendingFloorType: z.string().optional(),
  })),
});
```
Add to `CommandSchema` discriminated union.

### `shared/engine/lobbyCommands.ts`
- Add `'fill_lobby'` to `LobbyCommand` union type
- Add `case 'fill_lobby'` to switch → `handleFillLobby`
- `handleFillLobby`: validates gems >= cost, deducts gems, spawns all visitors from command, increments `dailyFillLobbyUses`, sets `nextVisitorAt = 0` (lobby is full)

### `src/stores/gameStore.ts`
- Add `fillLobby: () => void` to `GameActions`
- Thread `dailyFillLobbyUses` through `executeCommand` (GameState extraction + `set` call)
- Expose `dailyFillLobbyUses` via `useLobbyState` selector
- `fillLobby` action: reads current `lobbyCapacity` and `lobbyVisitors.length`, pre-generates `lobbyCapacity - lobbyVisitors.length` visitors using `generateRandomVisitorRole` + `generateRandomWorkers` pattern, dispatches `fill_lobby` command

### `src/components/LobbyPanel.tsx`
- Add `fillLobby` and `dailyFillLobbyUses` from store
- In the empty state block: add button below subtitle using existing button style (matching `deliverAllCard` style), showing `GemIcon` + cost
- Cost computed from `getFillLobbyCost(dailyFillLobbyUses)` (import from `lobbyUtils`)

### `src/i18n/locales/en/lobby.json`
```json
"fillLobby": {
  "button": "Fill Lobby"
}
```

## Error Handling

- Insufficient gems → `showInsufficientResources({ currency: 'gems', need: cost, have: gems })`
- Lobby already has visitors → command returns `{ success: false }` (guard in engine)

## Out of Scope

- No animation on fill
- No partial fill (button only shown when completely empty)
- No usage counter displayed on the button
