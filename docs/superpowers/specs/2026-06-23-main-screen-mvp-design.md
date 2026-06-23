# Main Screen Client-Only MVP — Design Spec

> Sub-project 1 of Skyscraper Tycoon.
> Scope: standalone Expo app with the main gameplay screen, production state machine,
> local state (Zustand), MMKV persistence, mock clock. No server.

---

## 1. Goal

Deliver a playable main screen: a skyscraper with 5–10 floors, each holding up to 3
production slots. The player taps through the full production cycle
(buy → deliver → list → sell → collect), earns currency, and reinvests.
All state is local. Persistence survives app restarts via MMKV.

### Success criteria

- Tapping a production action (buy/list/collect) feels instant — zero async in the tap path.
- Only the tapped floor re-renders, not the whole list.
- Closing and reopening the app restores exact game state.
- Timer countdowns display correctly and gate transitions (no auto-advance).
- 3 distinct production types with different costs/durations/values.

### What is NOT in scope

- Server, sync, reconciliation, command log upload.
- Navigation beyond the main screen.
- Social features, leaderboards, quests, push notifications.
- Unlocking/buying new floors (all floors available from start).
- Production upgrades or tiers.

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Framework | React Native + Expo (managed workflow) |
| Language | TypeScript throughout |
| State management | Zustand |
| Local persistence | react-native-mmkv |
| List rendering | FlashList (Shopify) |
| Image loading | expo-image |
| Schema validation | Zod |
| Routing | Expo Router (file-based) |

---

## 3. Project Structure

```
tinytower/
├── app/                        # Expo Router screens
│   ├── _layout.tsx             # Root layout
│   └── index.tsx               # Main screen (skyscraper view)
├── src/
│   ├── schemas/                # Zod schemas (commands, game config, production)
│   │   ├── command.ts
│   │   ├── gameConfig.ts
│   │   └── production.ts
│   ├── types/                  # TS types derived from schemas
│   │   └── index.ts
│   ├── config/                 # Static game config data
│   │   └── gameConfig.ts
│   ├── engine/                 # Pure game logic, zero React/Zustand imports
│   │   ├── productionStatus.ts # getProductionStatus()
│   │   └── processCommand.ts   # processCommand()
│   ├── stores/                 # Zustand stores
│   │   └── gameStore.ts
│   ├── services/               # Clock, MMKV persistence
│   │   ├── clock.ts
│   │   └── persistence.ts
│   ├── components/             # React components
│   │   ├── SkyscraperScreen.tsx
│   │   ├── FloorCard.tsx
│   │   ├── ProductionSlot.tsx
│   │   └── BalanceHeader.tsx
│   └── hooks/                  # Custom hooks
│       ├── useFloor.ts
│       └── useGameClock.ts
├── assets/                     # Images, icons (user-provided)
├── package.json
├── tsconfig.json
└── app.json                    # Expo config
```

**Separation rule:** `schemas/`, `engine/`, `config/` import nothing from React, Zustand,
or any RN module. They are pure TypeScript. This is the future `shared` package boundary.

---

## 4. Production State Machine

### Stages (enum)

```
IDLE → DELIVERING → READY_TO_LIST → SELLING → READY_TO_COLLECT → IDLE
```

### Per-production state

```ts
{
  typeId: string            // e.g. "coffee_shop"
  stage: ProductionStage    // enum value
  stageStartedAt: number    // timestamp (ms), meaningful in DELIVERING and SELLING
}
```

### Transitions

| From | Command | Guard | Effect |
|---|---|---|---|
| IDLE | `buy` | `balance >= buyCost` | `balance -= buyCost`, stage → DELIVERING, `stageStartedAt = now` |
| DELIVERING | (timer elapses) | `now - stageStartedAt >= deliveryDuration` | stage → READY_TO_LIST (waits for tap) |
| READY_TO_LIST | `list` | stage is READY_TO_LIST | stage → SELLING, `stageStartedAt = now` |
| SELLING | (timer elapses) | `now - stageStartedAt >= sellDuration` | stage → READY_TO_COLLECT (waits for tap) |
| READY_TO_COLLECT | `collect` | stage is READY_TO_COLLECT | `balance += batchValue`, stage → IDLE |

Timer stages (DELIVERING, SELLING) never auto-advance. The timer elapses, the UI
updates to show the gate is ready, but the stage only changes on an explicit tap.

### Engine functions

**`getProductionStatus(production, config, now): DerivedStatus`**

Pure function. Returns:
- `stage`: the current logical stage (accounting for elapsed timers)
- `timeRemaining`: ms until timer elapses (0 if not in a timer stage or elapsed)
- `canAct`: whether a tap would do something (buy/list/collect available)
- `actionLabel`: "Buy ($X)" / "List" / "Collect ($X)" / null

Does not mutate anything. Called on every render tick.

**`processCommand(state, command, config, now): { state, success, error? }`**

Pure function. Validates the command against current state and clock, returns new state
if valid. The Zustand store calls this and applies the result.

Commands:
- `{ type: "buy", floorId, slotIdx, typeId }` — `typeId` specifies which production type
- `{ type: "list", floorId, slotIdx }`
- `{ type: "collect", floorId, slotIdx }`

---

## 5. Clock Abstraction

```ts
interface GameClock {
  now(): number  // milliseconds since epoch
}
```

**MVP implementation (`DeviceClock`):** returns `Date.now()`.

All engine functions receive `now` as a parameter — they never import or call `Date.now()`
directly. The clock is injected at the call site (store actions, hooks).

**Future:** `ServerClock` — server timestamp + local monotonic offset. The engine code
does not change; only the clock implementation swaps.

---

## 6. Zustand Store

### Shape

```ts
{
  balance: number
  floors: Floor[]
  commandQueue: Command[]
}
```

Where `Floor`:
```ts
{
  id: number
  name: string
  productions: Production[]  // length 1–3
}
```

### Actions

- `buy(floorId, slotIdx)` — calls `processCommand`, updates state, appends to queue
- `list(floorId, slotIdx)` — same
- `collect(floorId, slotIdx)` — same

All actions are synchronous. Zero `await`, zero network calls. They read `clock.now()`
once at the start, pass it to `processCommand`, and apply the result.

### Selectors

- `useBalance()` — subscribes to `state.balance` only
- `useFloor(floorId)` — subscribes to `state.floors[idx]` only (shallow equality)
- `useCommandQueueLength()` — for future sync indicator

Per-floor selectors ensure tapping one floor does not re-render others.

---

## 7. MMKV Persistence

### Hydration

On app start, before rendering the game screen:
1. Read snapshot from MMKV (key: `"gameState"`)
2. If found, parse and validate with Zod, hydrate Zustand store
3. If not found or invalid, initialize from game config defaults

### Saving

- Subscribe to Zustand store changes
- Debounce writes: save to MMKV at most every 3 seconds
- Also save immediately on `AppState` change to `"background"` or `"inactive"`
- Never save on every tap

### Schema

The persisted snapshot is the full store shape (`balance`, `floors` with production
states, `commandQueue`). Validated with Zod on read to handle version migrations.

---

## 8. UI Components

### `SkyscraperScreen`

The main (and only) screen. Contains:
- `BalanceHeader` at the top showing current balance
- `FlashList` of `FloorCard` components, ordered top-to-bottom (highest floor first)

FlashList config: `estimatedItemSize` set to floor card height, `keyExtractor` by
floor id.

### `BalanceHeader`

Displays the player's current balance. Subscribes via `useBalance()`.

### `FloorCard`

One row in the list. Shows:
- Floor number and name
- 1–3 `ProductionSlot` components side by side
- Floor image/background from assets

Subscribes to its own floor data via `useFloor(floorId)`.

### `ProductionSlot`

One production within a floor. Derives its display from `getProductionStatus()`:

| Stage | Display |
|---|---|
| IDLE | "Buy" button showing cost. Disabled if insufficient balance. |
| DELIVERING | Countdown timer (seconds remaining). No interaction. |
| READY_TO_LIST | "List" button, visually highlighted (pulsing/glow). |
| SELLING | Countdown timer. No interaction. |
| READY_TO_COLLECT | "Collect" button showing batchValue, visually highlighted. |

### Timer Display

A `useGameClock()` hook runs `setInterval(1000)` to tick a local `now` value.
`ProductionSlot` uses this to call `getProductionStatus(production, config, now)` and
display the countdown. The interval drives re-render of the countdown text only.

The interval runs only while the screen is mounted. On unmount (or app background),
it stops. On resume, `now` catches up instantly — no accumulated error.

---

## 9. Game Config

Static object for the MVP. Zod-validated at import time.

### Floor definitions (5 floors to start)

| Floor | Name | Slots | Available types |
|---|---|---|---|
| 1 | Ground Floor | 3 | coffee_shop |
| 2 | Floor 2 | 3 | coffee_shop, bookstore |
| 3 | Floor 3 | 3 | bookstore |
| 4 | Floor 4 | 3 | bookstore, electronics |
| 5 | Floor 5 | 3 | electronics |

### Production types

| Type | buyCost | deliveryDuration | sellDuration | batchValue |
|---|---|---|---|---|
| coffee_shop | 10 | 5s | 10s | 25 |
| bookstore | 50 | 15s | 30s | 120 |
| electronics | 200 | 60s | 90s | 500 |

### Starting state

- Balance: 100
- All production slots: IDLE, no type assigned yet (player chooses on first buy)
- If a floor has multiple available types, the player picks one when buying
  (simple inline buttons — one per available type, showing name + cost)
- Once a type is assigned to a slot, it stays that type permanently across cycles
  (collect returns to IDLE but keeps the typeId — player buys the same product again)

---

## 10. Command Log (local only for now)

Every successful `processCommand` appends a command to `commandQueue`:

```ts
{
  id: string           // UUID, for future idempotency
  type: "buy" | "list" | "collect"
  floorId: number
  slotIdx: number
  typeId?: string      // present on "buy" commands only
  timestamp: number    // clock.now() at time of action
}
```

In this iteration the queue is persisted in MMKV alongside the game state but never
sent anywhere. When the server arrives, this becomes the sync payload.

Queue is capped at 10,000 entries locally. Oldest entries are dropped if the cap is hit
(acceptable for client-only; with a server, the ack mechanism will keep it small).

---

## 11. Error Handling

- Invalid commands (wrong stage, insufficient balance) are silently rejected —
  `processCommand` returns `{ success: false }` and the UI doesn't change.
  No error toasts for normal gameplay flow.
- MMKV read failure on startup: start fresh with defaults, log a warning.
- Zod validation failure on hydration: start fresh with defaults.
- No network errors to handle (no server).

---

## 12. Testing Strategy

- **Engine unit tests:** `processCommand` and `getProductionStatus` are pure functions —
  test all state transitions, edge cases (insufficient balance, timer not elapsed,
  double-collect), and the full cycle.
- **Zod schema tests:** validate that game config and command schemas accept valid data
  and reject invalid data.
- **Component smoke tests (optional for MVP):** render `FloorCard` with mock data,
  verify correct buttons appear per stage.
- **Manual testing:** play the game on a device/simulator, verify tap responsiveness,
  timer accuracy, persistence across restarts.
