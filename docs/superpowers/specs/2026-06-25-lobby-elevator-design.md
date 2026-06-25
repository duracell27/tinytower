# Lobby & Elevator — Design Spec

> Sub-project 4 of Skyscraper Tycoon.
> Scope: Lobby (floor 0) with elevator mini-game, visitor system (4 roles),
> tip economy, daily tips plan, elevator/lobby upgrades, gems migration into
> GameState, full command-log sync.

---

## 1. Goal

Add a lobby floor (floor 0) with an elevator that the player operates to
deliver visitors to floors. Visitors arrive periodically, have different roles
that affect gameplay (tips, speedups, new workers), and the player taps to
raise the elevator. The lobby has upgrades (elevator speed, lobby capacity)
and a daily tips plan with a gem reward.

### Success criteria

- Tapping the lobby floor opens a bottom-sheet panel (same pattern as hotel).
- Visitors spawn every 2 minutes, queue up to lobby capacity.
- Player taps "Підняти" to move elevator up by `elevatorLevel` floors per tap.
- On arrival, visitor pays tips (coins or gems) based on role.
- 4 visitor roles with distinct mechanics: guest, businessman, deliverer, seller.
- Guest going to floor 1 (hotel) becomes a new worker.
- "Розвезти всіх за 💎1" delivers all queued visitors at once, shows summary modal.
- Daily tips plan tracks toward 10,000 coins; completing it grants 5 gems.
- Elevator and lobby capacity upgradeable with gems.
- All lobby state syncs through the command log pipeline.
- Gems move into shared GameState for server-validated spending.

### What is NOT in scope

- VIP visitor types beyond the 4 defined roles.
- Elevator cosmetic skins or themes.
- Social/multiplayer lobby features.
- Automated elevator (always manual taps).
- Floor construction/unlocking (separate feature).

---

## 2. Visitor Roles

| Role | Label | Color | Tip | Special effect |
|---|---|---|---|---|
| guest | Гість | `#7B52BC` | `10 * elevatorLevel * targetFloor` coins | Floor 1 → becomes worker |
| businessman | Бізнесмен | `#C28A22` | 1 gem (within daily limit) | Fallback: `100 * elevatorLevel * targetFloor` coins |
| deliverer | Доставщик | `#2E78B5` | Same as guest | Reduces delivery time by 5% of original duration |
| seller | Продавець | `#4E9A2E` | Same as guest | Reduces sell time by 5% of original duration |

### Businessman gem limit

- Daily limit: `15 + playerLevel` gems from businessmen.
- Tracked in `dailyGemsCollected`.
- After limit reached, businessman pays fallback coins instead.

### Guest → worker (floor 1)

When a guest's target floor is 1 (hotel), delivering them adds a new random
worker to the hotel (same generation logic as initial workers — random
floorType, dreamJob, level, hairColor, female). The player is notified that
a new worker is available and looking for a job. The guest still pays normal
tips (`10 * elevatorLevel * 1`).

### Deliverer / seller effects

- **Deliverer**: target floor must have at least one slot in `DELIVERING` stage.
  On delivery, reduces `stageStartedAt` on a random DELIVERING slot on that
  floor by `0.05 * deliveryDuration` (5% of the original duration, not remaining).
  Also pays normal guest tips.
- **Seller**: same logic but for `SELLING` stage, reduces by
  `0.05 * sellDuration`. Also pays normal guest tips.

---

## 3. Visitor Spawn Logic

### Timing

- One visitor spawns every 120 seconds (2 minutes).
- Tracked via `nextVisitorAt` timestamp in GameState.
- If `lobbyVisitors.length >= lobbyCapacity`, spawn is skipped (visitor lost).
- Game starts with empty lobby; first visitor at `startTime + 120_000`.

### Role selection

**Step 1** — Determine available special roles:
- `deliverer` available: any production slot on any floor is in `DELIVERING`.
- `seller` available: any production slot on any floor is in `SELLING`.

**Step 2** — Roll from the 97% non-businessman pool:

| Available specials | guest | deliverer | seller |
|---|---|---|---|
| Both | 50% | 25% | 25% |
| Only deliverer | 75% | 25% | — |
| Only seller | 75% | — | 25% |
| Neither | 100% | — | — |

**Step 3** — Apply 97/3 businessman override:
- 3% chance: role becomes `businessman` (regardless of step 2 result).
- 97% chance: keep the step 2 result.

### Target floor selection

- **guest**: random floor 1–N (N = total floors above lobby). Floor 1 = hotel.
- **businessman**: random floor 2–N (never goes to hotel).
- **deliverer**: random floor that has at least one `DELIVERING` slot.
- **seller**: random floor that has at least one `SELLING` slot.

---

## 4. Data Model

### Visitor schema

```typescript
interface Visitor {
  id: string;
  role: 'guest' | 'businessman' | 'deliverer' | 'seller';
  targetFloor: number;
  hairColor: string;
  female: boolean;
}
```

### New fields in GameState

```typescript
lobbyVisitors: Visitor[];          // queue of waiting visitors
lobbyCapacity: number;             // max visitors (default 10, +3 per upgrade)
elevatorLevel: number;             // floors per lift tap (default 1)
elevatorFloor: number;             // current cabin position (0 = lobby)
dailyTips: number;                 // coins earned today from tips
dailyGemsCollected: number;        // businessman gems collected today
dailyTipsRewardClaimed: boolean;   // daily 5-gem reward claimed
lastDailyReset: number;            // timestamp of last midnight reset
nextVisitorAt: number;             // timestamp for next visitor spawn
gems: number;                      // MOVED from client-only to GameState
```

### Initial state defaults

```typescript
lobbyVisitors: [],
lobbyCapacity: 10,
elevatorLevel: 1,
elevatorFloor: 0,
dailyTips: 0,
dailyGemsCollected: 0,
dailyTipsRewardClaimed: false,
lastDailyReset: 0,        // set to current midnight on first command
nextVisitorAt: startTime + 120_000,
gems: 20,
```

---

## 5. Constants & Config

```typescript
VISITOR_SPAWN_INTERVAL = 120_000;          // 2 minutes in ms
DAILY_TIPS_TARGET = 10_000;                // coins to complete daily plan
DAILY_TIPS_REWARD = 5;                     // gems for completing daily plan
DAILY_GEM_LIMIT_BASE = 15;                // + playerLevel = daily businessman gem cap
GUEST_TIP_BASE = 10;                       // tip = 10 * elevatorLevel * floor
BUSINESSMAN_FALLBACK_BASE = 100;           // fallback = 100 * elevatorLevel * floor
DELIVERY_SPEED_BONUS = 0.05;              // 5% of original delivery duration
SELL_SPEED_BONUS = 0.05;                   // 5% of original sell duration
ELEVATOR_UPGRADE_BASE_COST = 3;           // gems, +2 per level
LOBBY_UPGRADE_BASE_COST = 5;              // gems, +2 per tier
LOBBY_UPGRADE_SEATS = 3;                   // seats added per upgrade
```

### Upgrade formulas

- **Elevator level cost**: `3 + (currentLevel - 1) * 2` gems → 3, 5, 7, 9...
- **Elevator level cap**: total floors above lobby (currently 4: hotel + 3 production).
- **Lobby capacity cost**: `5 + ((currentCapacity - 10) / 3) * 2` gems → 5, 7, 9, 11...
- **Lobby capacity cap**: `10 + playerLevel * 3`. At level 1: max 13 (one upgrade). At level 5: max 25. At level 10: max 40.

---

## 6. Commands

### New command types

```typescript
{ type: 'spawn_visitor', id, timestamp, visitorId, role, targetFloor, hairColor, female }
{ type: 'lift_visitor', id, timestamp }
{ type: 'collect_tip', id, timestamp }
{ type: 'deliver_all', id, timestamp }
{ type: 'upgrade_elevator', id, timestamp }
{ type: 'upgrade_lobby', id, timestamp }
{ type: 'claim_daily_reward', id, timestamp }
```

### Processing rules

**`spawn_visitor`**
- Guard: `lobbyVisitors.length < lobbyCapacity`.
- Push visitor to `lobbyVisitors`.
- Set `nextVisitorAt = timestamp + 120_000`.

**`lift_visitor`**
- Guard: `lobbyVisitors.length > 0`.
- Active visitor = `lobbyVisitors[0]`.
- `elevatorFloor += min(elevatorLevel, target - elevatorFloor)`.

**`collect_tip`**
- Guard: `elevatorFloor === lobbyVisitors[0].targetFloor`.
- Apply role effects (see Section 2).
- Add tip amount to `balance` and `dailyTips`.
- For businessman within limit: add 1 to `gems`, increment `dailyGemsCollected`.
- For guest→floor 1: generate worker, push to `workers` array.
- For deliverer/seller: adjust `stageStartedAt` on target floor.
- Remove `lobbyVisitors[0]`.
- Reset `elevatorFloor = 0`.

**`deliver_all`**
- Guard: `gems >= 1`, `lobbyVisitors.length > 0`.
- Deduct 1 gem.
- Iterate all visitors, apply each role's effect.
- Clear `lobbyVisitors`.
- Reset `elevatorFloor = 0`.
- Client computes summary from `lobbyVisitors` before dispatching (no change to `ProcessResult`).

**`upgrade_elevator`**
- Guard: `gems >= cost`, `elevatorLevel < numberOfFloors`.
- Deduct gems, increment `elevatorLevel`.

**`upgrade_lobby`**
- Guard: `gems >= cost`, `lobbyCapacity < 10 + playerLevel * 3`.
- Deduct gems, `lobbyCapacity += 3`.

**`claim_daily_reward`**
- Guard: `dailyTips >= DAILY_TIPS_TARGET`, `!dailyTipsRewardClaimed`.
- Add `DAILY_TIPS_REWARD` gems.
- Set `dailyTipsRewardClaimed = true`.

### Daily reset

At the start of every command processing, check if the command's timestamp
has crossed midnight local time (relative to `lastDailyReset`). If so:
- `dailyTips = 0`
- `dailyGemsCollected = 0`
- `dailyTipsRewardClaimed = false`
- `lastDailyReset = midnight timestamp`

---

## 7. UI Components

### LobbyFloor (tower card)

The existing `LobbyFloor` component is updated:
- Shows visitor count badge and countdown timer to next visitor (`M:SS`).
- Tapping opens `LobbyPanel` (same as HotelFloor → HotelPanel).

### LobbyPanel (bottom sheet)

Same bottom-sheet pattern as `HotelPanel`:
- Reanimated `translateY`, scrim overlay, pan gesture to dismiss.
- Sheet timing: `transform .42s cubic-bezier(.4,0,.2,1)`.
- Two views: operate and upgrade.

**Header** (shared between views):
- Slate gradient background.
- Elevator icon + "ВЕСТИБЮЛЬ" title + "Ліфт · доставка гостей" subtitle.
- Coin chip (balance) + close button.
- Two stat tiles: "Очікують" (count) + "Новий гість" (countdown `M:SS`).

**Operate view:**

1. **Visitor + Shaft card** (white, radius 18):
   - Left: avatar (body color = role color), speech bubble (role label + target
     floor, or "Дякую! 🎉" on arrival), status chip (yellow riding / green arrived).
   - Action button: green "Підняти на X поверх" → gold "Отримати чайові +N"
     (or gem variant for businessman, or "Прийняти працівника" for guest→hotel).
   - Right: elevator shaft (48x148px dark gradient) with animated cabin.
   - Empty state: "Вестибюль порожній" + "Нові відвідувачі скоро прийдуть".

2. **"Розвезти всіх за 💎1"** button (when visitors > 0).

3. **Daily tips card**: progress bar (0 / 10,000), coin counter.
   When filled: blue "Отримати винагороду за план 💎5" button.
   After claimed: checkmark "План виконано · винагороду отримано".

4. **"Покращити ліфт"** button → switches to upgrade view.

**Upgrade view:**

1. Back button "Назад до ліфта".
2. **Elevator card**: "Ліфт: L-{level}", progress bar, upgrade button with gem cost.
   Disabled at max level or insufficient gems.
3. **Lobby card**: "Вестибюль · {capacity} місць", progress bar, "+3 місця за 💎N".
   Disabled at cap or insufficient gems. Max level shows checkmark strip.

### DeliverAllModal

Modal popup (same style as existing `LevelUpModal`):
- Summary of all delivered visitors by role.
- Total coins earned, gems earned, workers accepted, time saved.
- "Готово" dismiss button.

### Role colors

| Role | Color | Label |
|---|---|---|
| guest | `#7B52BC` | Гість |
| businessman | `#C28A22` | Бізнесмен |
| deliverer | `#2E78B5` | Доставщик |
| seller | `#4E9A2E` | Продавець |

### Design reference

Full visual spec (colors, typography, spacing, shadows, animations) is in
`assets/lobby design/README.md` and screenshots in `assets/lobby design/screenshots/`.
Use the design reference for pixel-level UI fidelity.

---

## 8. Sync & Server Integration

### Gems migration

`gems` moves from client-only `gameStore` into `GameState` (shared engine).
This enables server-side validation of gem spending for upgrades and deliver-all.
`playerLevel` and `playerXp` remain client-only for now.

### Schema changes

All new fields added to `GameStateSchema` in `shared/schemas/gameState.ts`.
New `VisitorSchema` in `shared/schemas/visitor.ts`.
7 new command types added to `CommandSchema` union in `shared/schemas/command.ts`.

### Server storage

GameState is stored as JSON — no new DB columns. Existing players get
default values for new fields on first sync (backfill with defaults from
Section 4).

### Reconciliation

`hydrate` and `reconcile` in `gameStore` extended to include all new lobby
fields. Same snap-to-server pattern as existing.

### What stays client-only

- Elevator cabin animation position (visual only).
- Panel open/close state, view toggle (`operate`/`upgrade`).
- Countdown timer display (derived from `nextVisitorAt - clock.now()`).
- DeliverAllModal visibility and summary data.
