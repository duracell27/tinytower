# Hotel & Workers — Design Spec

> Sub-project 3 of Skyscraper Tycoon.
> Scope: Worker data model in shared GameState, hotel panel UI (bottom sheet),
> job picker UI, worker assignment/firing/eviction, revenue multipliers,
> buy cost discounts, full server sync via command log.

---

## 1. Goal

Add a worker system so production slots require assigned workers to operate.
Workers live in the hotel, can be assigned to any production slot, and provide
revenue multipliers and buy cost discounts based on their type/dream job match.
The player manages workers through a hotel panel that opens from the tower.

### Success criteria

- Game starts with 5 random workers in a 10-seat hotel. All slots locked until workers assigned.
- Player can assign any worker to any production slot via hotel panel → job picker.
- Revenue multiplier: 1x (wrong floor type), 1.3x (right floor, wrong product), 2x (dream job match).
- Buy cost discount: sum of all workers' levels on the floor × 1% applies to every slot on that floor.
- Worker mood dot reflects assignment: green=dream job, yellow=right floor, red=unemployed or wrong floor.
- Fire returns worker to hotel (only when slot is IDLE/READY_TO_LIST/READY_TO_COLLECT). Hotel-full guard with evict-or-cancel dialog.
- Evict permanently removes a worker from hotel (with confirmation dialog).
- All worker state syncs through the existing command log pipeline (shared engine, server replay).
- Slots without workers are fully locked (can't buy, list, or collect).

### What is NOT in scope

- New worker arrival mechanic (lobby → hotel is a separate feature).
- Purple (Парфумерія) and blue (Морозиво) floor construction — only their worker types exist.
- Worker leveling up.
- Hotel capacity upgrades.
- Worker customization or renaming.

---

## 2. Floor Types

Five floor types exist from the start. Only 3 have built floors currently; purple and blue floors will be added later. Workers of all 5 types are generated at game start.

| Key    | Category     | Shirt color | Accent    | Dream jobs                      |
|--------|-------------|-------------|-----------|----------------------------------|
| green  | Кондитерська | `#62B23F`  | `#4E9A2E` | Торти, Булки, Пирожені           |
| teal   | Пральня      | `#36AE9C`  | `#1F8979` | Прання, Сушка, Відбілювання      |
| amber  | Кав'ярня     | `#E7A21E`  | `#B07F12` | Кава, Млинці, Десерти            |
| purple | Парфумерія   | `#9A6FD0`  | `#7B52BC` | Аромати, Мило, Свічки            |
| blue   | Морозиво     | `#4C9BDD`  | `#2E78B5` | Пломбір, Шейки, Сорбет           |

Added to `gameConfig` as a `floorTypes` map. Each floor in `gameConfig.floors` gets a `floorType` field linking to this map.

### Production types prerequisite

The current `gameConfig.productionTypes` uses placeholder keys (`coffee_shop`, `bookstore`, `electronics`). The worker's `dreamJob` must match a production slot's `typeId`. As part of this feature, `productionTypes` is expanded to include all per-slot products from the design (e.g. `bulky`, `cupcake`, `cake` for Кондитерська; `wash`, `dry`, `bleach` for Пральня; `coffee`, `pancake`, `dessert` for Кав'ярня). Each floor's `availableTypes` is updated to list its 3 unique product typeIds. The `dreamJobs` list in `floorTypes` uses these same typeIds. Display names (Ukrainian) come from a name map in config, not from the typeId string itself.

---

## 3. Data Model

### Worker Type

```ts
interface Worker {
  id: string;                      // UUID
  name: string;
  female: boolean;
  floorType: string;               // 'green' | 'teal' | 'amber' | 'purple' | 'blue'
  dreamJob: string;                // one of floorTypes[floorType].dreamJobs
  level: number;                   // 1–9
  hairColor: string;               // hex
  assignedFloorId: number | null;  // null = unemployed (in hotel)
  assignedSlotIdx: number | null;  // null = unemployed
}
```

### GameState Extension

```ts
// Added to GameState:
workers: Worker[];
hotelCapacity: number;  // starts at 10
```

### Worker Schema (Zod)

New file `shared/schemas/worker.ts`:

```ts
WorkerSchema = z.object({
  id: z.string(),
  name: z.string(),
  female: z.boolean(),
  floorType: z.string(),
  dreamJob: z.string(),
  level: z.number().int().min(1).max(9),
  hairColor: z.string(),
  assignedFloorId: z.number().nullable(),
  assignedSlotIdx: z.number().nullable(),
})
```

### Mood (derived, not stored)

```
unemployed                              → bad  (red)
assigned, floor type mismatch           → bad  (red)
assigned, floor type match, wrong product → mid  (yellow)
assigned, floor type match, dream job   → good (green)
```

Mood colors: good `#52B847`, mid `#F0B92A`, bad `#E2685A`.

### Revenue Multiplier

| Mood | Multiplier |
|------|-----------|
| bad  | 1.0x      |
| mid  | 1.3x      |
| good | 2.0x      |

Applied at collect time: `batchValue * multiplier`.

### Buy Cost Discount

Floor-level discount = sum of levels of all workers assigned to that floor × 1%.

```
floorDiscount = sum(worker.level for workers on this floor) * 0.01
effectiveBuyCost = floor(buyCost * (1 - floorDiscount))
```

Maximum: 3 workers × level 9 = 27% discount per floor.

---

## 4. Commands

### New commands

**`assign_worker`**
```ts
{ id, type: 'assign_worker', workerId, floorId, slotIdx, timestamp }
```
Validation: worker exists and unemployed, slot exists, no other worker on that slot.
Effect: sets worker.assignedFloorId and worker.assignedSlotIdx.

**`fire_worker`**
```ts
{ id, type: 'fire_worker', workerId, timestamp }
```
Validation: worker exists and assigned, production slot is IDLE or READY_TO_LIST or READY_TO_COLLECT (not DELIVERING or SELLING).
Effect: sets worker.assignedFloorId = null, worker.assignedSlotIdx = null. Does NOT check hotel capacity — the worker always returns to hotel. The client is responsible for prompting eviction if the hotel is over capacity after firing.

**`evict_worker`**
```ts
{ id, type: 'evict_worker', workerId, timestamp }
```
Validation: worker exists and is in hotel (unemployed).
Effect: removes worker from workers array.

### Modified existing commands

**`buy`**: rejects if no worker on slot. Applies floor discount to buyCost.

**`list`**: rejects if no worker on slot.

**`collect`**: rejects if no worker on slot. Applies revenue multiplier based on worker mood.

---

## 5. Initial State & Worker Generation

At registration / `createInitialState`:
- `hotelCapacity: 10`
- 5 random workers generated:
  - Random floorType from all 5 types (uniform)
  - Random dreamJob from that floorType's dreamJobs
  - Random gender (50/50)
  - Random name from Ukrainian name pool (no duplicates), gender-matched
  - Random level 1–9
  - Random hairColor from pool: `#5C3A22`, `#E0A93C`, `#C9923A`, `#4A3322`, `#6B4A2E`, `#7A5430`, `#D8A24A`, `#B5763A`
  - All start unemployed (assignedFloorId: null, assignedSlotIdx: null)

All production slots start locked. Player must assign workers first.

Server creates worker rows in a Prisma transaction alongside player/floor/production rows at registration.

---

## 6. UI — Hotel Panel

Bottom sheet overlay, opens when player taps the Hotel floor card.

### Component hierarchy

```
HotelPanel (overlay on game screen)
├── Scrim (rgba(18,26,44,0.5), tap to close)
└── Sheet (animated slide-up from bottom)
    ├── SheetHeader
    │   ├── Title row: hotel icon + "ГОТЕЛЬ" + "Мешканці · пошук роботи" + close (X)
    │   └── Stats row: "Місць" (total) + "Вільно" (free seats)
    ├── WorkerList (ScrollView, only unemployed workers)
    │   └── WorkerCard[] (accordion, one expanded at a time)
    │       ├── Collapsed: WorkerAvatar + name/mood dot + dream job + status + level/chevron
    │       └── Expanded: info rows + "Знайти роботу" + "Виселити" buttons
    └── Empty state (if no workers in hotel)
```

### State

- `hotelOpen: boolean` — toggled by tapping Hotel floor card
- `expandedWorkerId: string | null` — accordion, local to HotelPanel

### WorkerAvatar component

Reusable flat SVG avatar (64×64 viewBox):
- Shirt color = `floorTypes[worker.floorType].shirtColor`
- Hair color = `worker.hairColor`
- Side hair ellipses only for `female: true`
- Skin tone fixed `#F0C49C`

### "Виселити" flow

Confirmation dialog: "Ви впевнені?" → "Виселити" / "Скасувати". On confirm → `evict_worker` command.

### Animations (Reanimated)

- Sheet: translateY with `withTiming`, 420ms, `Easing.bezier(0.4, 0, 0.2, 1)`
- Scrim: opacity `withTiming` 400ms
- Accordion: animated maxHeight + opacity
- Chevron: rotation 0→90deg, 250ms

### Design tokens

From `Hotel Panel.dc.html` README — sheet bg `#EAEDF2`, card bg `#fff`, header gradient `#6C7C92 → #56657C`, all radii/shadows/typography as specified in the design handoff.

---

## 7. UI — Job Picker Sheet

Opens when player taps "Знайти роботу" on a worker card.

### Component hierarchy

```
JobPickerSheet (second bottom sheet over HotelPanel)
├── Header: worker mini-info (avatar + name + floorType badge) + close button
└── FloorList (ScrollView)
    └── FloorGroup[] (one per built floor with empty slots)
        ├── Floor header (number + name + color)
        └── SlotRow[] (only slots without a worker)
            ├── Production info (type icon + name, or "Порожній слот")
            ├── Match indicator badge:
            │   ├── 🟢 "Робота мрії · 2x" (floor type + dream job match)
            │   ├── 🟡 "Підходящий тип · 1.3x" (floor type match only)
            │   └── ⚪ "Інший тип · 1x" (no match)
            └── "Призначити" button
```

### Behavior

- Only built floors shown (current 3 from gameConfig.floors)
- Only slots without an assigned worker listed
- Sorted: dream job matches first, then same floor type, then others
- Floor groups with matching floor type sorted first
- "Призначити" fires `assign_worker` command → picker closes → hotel panel updates
- Empty state: "Всі місця зайняті" if no slots available

---

## 8. UI — Worker on Production Slot

### FloorCard / ProductionCard changes

**Worker assigned:**
- Small avatar circle (24×24) in corner of production card, shirt color = worker floorType
- Tap avatar → mini popover with: worker name, level, mood dot, "Звільнити" button

**No worker (locked):**
- Production card dimmed with lock icon
- Text: "Потрібен працівник"
- All action buttons (buy/list/collect) disabled

### Fire flow

1. Tap worker avatar on production card → mini detail
2. "Звільнити" disabled if slot in DELIVERING or SELLING → hint "Очікуйте завершення"
3. If slot is IDLE/READY_TO_LIST/READY_TO_COLLECT:
   - Hotel has space → `fire_worker` command, worker returns to hotel
   - Hotel full → dialog: "В готелі немає місць" → "Виселити назовсім" (`fire_worker` then `evict_worker` in same batch) or "Скасувати"

Note: `fire_worker` always succeeds regardless of hotel capacity. The hotel-full check is a client-side UI guard — if full, the client prompts and sends `evict_worker` immediately after `fire_worker`.

### Revenue/discount display

- Collect: show effective revenue with multiplier badge (e.g. "2 800" with "×2")
- Buy: show discounted price with discount badge (e.g. "1 062" with "−15%")

---

## 9. Engine & Sync

### Shared engine changes

**`shared/engine/processCommand.ts`:**
- Three new case branches: `assign_worker`, `fire_worker`, `evict_worker`
- Modified `handleBuy`: worker-on-slot check + floor discount
- Modified `handleList`: worker-on-slot check
- Modified `handleCollect`: worker-on-slot check + revenue multiplier

**New file `shared/engine/workerUtils.ts`:**
```ts
getWorkerForSlot(workers, floorId, slotIdx): Worker | undefined
getFloorDiscount(workers, floorId): number
getRevenueMultiplier(worker, floorType, slotTypeId): number
getWorkerMood(worker, floorType, slotTypeId): 'good' | 'mid' | 'bad'
```

### Schema changes

**`shared/schemas/command.ts`:** Add AssignWorkerCommandSchema, FireWorkerCommandSchema, EvictWorkerCommandSchema to discriminated union.

**`shared/schemas/gameState.ts`:** Add `workers: z.array(WorkerSchema)`, `hotelCapacity: z.number().int()`.

**New file `shared/schemas/worker.ts`:** WorkerSchema as defined in section 3.

### Server Prisma

New Worker model:
```prisma
model Worker {
  id              String  @id
  playerId        String
  name            String
  female          Boolean
  floorType       String
  dreamJob        String
  level           Int
  hairColor       String
  assignedFloorId Int?
  assignedSlotIdx Int?
  player          Player  @relation(fields: [playerId], references: [id], onDelete: Cascade)
  @@index([playerId])
}
```

CommandLog gets `workerId String?` field for worker commands.

### Sync

No structural changes. Workers are part of GameState, so the existing sync flow (command replay → persist → return state) handles everything. Server reconstructs GameState including workers, replays commands via shared `processCommand`, persists result.

---

## 10. Testing Strategy

### Shared engine unit tests

**`shared/engine/__tests__/workerUtils.test.ts`:**
- getWorkerMood: all 4 cases (unemployed, wrong floor, right floor wrong product, dream job)
- getRevenueMultiplier: returns 1.0 / 1.3 / 2.0
- getFloorDiscount: sums correctly, 0 for empty floor, max 27%
- getWorkerForSlot: finds worker, returns undefined for empty

**`shared/engine/__tests__/processCommand.test.ts`** (extend):
- assign_worker: success + all failure cases
- fire_worker: success when IDLE/READY_TO_LIST/READY_TO_COLLECT, fail during DELIVERING/SELLING
- evict_worker: success for unemployed, fail for assigned
- buy/list/collect: reject without worker, apply discount/multiplier correctly
- Floor discount stacking: 3 workers, sum of levels

### Client tests

`src/stores/__tests__/gameStore.test.ts` (extend):
- Store hydrates workers
- Reconcile replaces worker state
- Worker command actions dispatch correctly

### Server tests

- Registration creates 5 random workers
- Sync replays worker commands correctly
- Worker state included in sync response
