# My Workers Panel — Design Spec
**Date:** 2026-07-10

## Overview

A new "My Workers" menu item opens a bottom sheet panel that shows all workers in the skyscraper, categorized into 4 satisfaction tabs. Players can find jobs, fire workers, and upgrade eligible workers to Specialist status (which grants a revenue bonus to the floor).

---

## 1. Data Model Changes

### 1.1 Worker Schema (`shared/schemas/worker.ts`)

Add one field:

```ts
isSpecialist: z.boolean().default(false)
```

Full updated schema:
```ts
export const WorkerSchema = z.object({
  id: z.string(),
  name: z.string(),
  female: z.boolean(),
  floorType: z.string(),
  dreamJob: z.string(),
  level: z.number().int().min(1).max(9),
  hairColor: z.string(),
  assignedFloorId: z.number().nullable(),
  assignedSlotIdx: z.number().nullable(),
  isSpecialist: z.boolean().default(false),
});
```

Backward compatibility: `isSpecialist` defaults to `false`, so existing saved states hydrate correctly.

### 1.2 New Commands (`shared/schemas/command.ts`)

**`upgrade_to_specialist`**
```ts
{ type: 'upgrade_to_specialist', workerId: string }
```
Cost: 10 gems.

**`fire_and_evict_worker`**
```ts
{ type: 'fire_and_evict_worker', workerId: string }
```
Fires a worker from their job AND removes them from the game permanently (used when hotel is full).

---

## 2. Engine Changes

### 2.1 `shared/engine/workerUtils.ts`

Add:
```ts
export function getFloorSpecialistBonus(workers: Worker[], floorId: number): number {
  const count = workers.filter(
    (w) => w.assignedFloorId === floorId && w.isSpecialist,
  ).length;
  return count * 0.09;
}
```

### 2.2 `shared/engine/processCommand.ts`

**`handleUpgradeToSpecialist`**

Validations:
- Worker exists
- `assignedFloorId !== null` (must be on a job)
- `level === 9`
- `mood === 'good'` (working at dream job on correct floor type)
- `!isSpecialist` (not already a specialist)
- `gems >= 10`

Effect: deducts 10 gems, sets `worker.isSpecialist = true`.

**`handleFireAndEvictWorker`**

Validations:
- Worker exists
- `assignedFloorId !== null`
- Production at worker's slot is NOT `DELIVERING` or `SELLING`

Effect: removes worker from `state.workers` entirely (no hotel step).

**`handleCollect` — specialist bonus**

After calculating `batchValue * revenueMultiplier`, multiply by `(1 + getFloorSpecialistBonus(state.workers, floorId))`.

Example: floor with 2 specialists → `batchValue * revenueMultiplier * 1.18`.

### 2.3 `shared/engine/workerUtils.ts` — `getWorkerMood` for assigned workers

The existing function already handles mood derivation. The WorkersPanel will call it by looking up the production's `typeId` and the floor's `floorType` for each assigned worker.

---

## 3. Worker Categorization

Categories are mutually exclusive. Priority: 4 → 3 → 2 → 1.

| Tab | Label (UA) | Condition |
|-----|-----------|-----------|
| 1 | Незадоволені | `assignedFloorId === null` |
| 2 | Середньо задоволені | `assignedFloorId !== null` AND `mood !== 'good'` |
| 3 | Щасливі | `assignedFloorId !== null` AND `mood === 'good'` AND `level < 9` |
| 4 | Спеціалісти | `assignedFloorId !== null` AND `mood === 'good'` AND `level === 9` |

Tab 4 includes both trained specialists (`isSpecialist: true`, yellow star) and eligible-but-not-yet-trained workers (`isSpecialist: false`, gray star).

Mood derivation for assigned workers:
```ts
const floor = floors.find(f => f.id === worker.assignedFloorId);
const floorConfig = floors config lookup → floorType
const production = floor.productions[worker.assignedSlotIdx]
const mood = getWorkerMood(worker, floorType, production.typeId)
```

---

## 4. UI: WorkersPanel

**File:** `src/components/WorkersPanel.tsx`

Pattern: same bottom-sheet architecture as `HotelPanel` — `Modal`, scrim overlay, animated translateY, swipe-to-dismiss gesture.

### Structure

```
┌─────────────────────────────────────┐
│  [drag handle]                      │
│  My Workers                [close]  │
├─────────────────────────────────────┤
│  [😞 3] [😐 5] [😊 2] [⭐ 1]      │  ← tab bar
├─────────────────────────────────────┤
│  FlatList of worker cards           │
│  ...                                │
└─────────────────────────────────────┘
```

Tab bar shows category name + worker count badge. Active tab highlighted with accent color.

Header gradient color: `['#5B8DD9', '#3A6BBF']` (blue — distinct from hotel's pink).

### Tab 1 Cards (Незадоволені)

Reuse existing `WorkerCard` component (same as HotelPanel). Actions: "Знайти роботу" + "Виселити".

### Tab 2–4 Cards (assigned workers)

**File:** `src/components/WorkerJobCard.tsx`

Collapsed row shows:
- WorkerAvatar (60px)
- Name, floor name, current production name
- Level badge
- Chevron

Expanded section shows:
- Info rows: Skill, Dream Job, Works At (floor name + slot), Mood indicator
- **Tab 4 only:** star icon (gray if `!isSpecialist`, yellow if `isSpecialist`) + "Навчити · 💎10" button (shown only if `!isSpecialist`)
- "Звільнити" button (red)

---

## 5. Fire-from-Job Logic (Tabs 2–4)

When the player presses "Звільнити":

```
1. Find production at worker's (assignedFloorId, assignedSlotIdx)
2. Compute time remaining:
     delivering? = stage === 'DELIVERING' && now < stageStartedAt + deliveryDuration
     selling?    = stage === 'SELLING'    && now < stageStartedAt + sellDuration
3. If active (delivering or selling):
     Show popup: "[Name] зараз [доставляє/продає товар] ще Xхв. Звільнити не можна."
     [OK button only]
4. If idle:
     a. unassignedWorkers.length < hotelCapacity
        → call fireWorker(id)  → worker moves to hotel
     b. Hotel full:
        → Alert "Готель повний. [Name] назавжди покине хмарочос. Підтвердити?"
           [Скасувати] [Підтвердити → fire_and_evict_worker(id)]
```

---

## 6. Specialist Training (Tab 4)

Button "Навчити · 💎10" shown only for workers where `isSpecialist === false`.

On press:
- Check `gems >= 10`, else `showInsufficientResources({ currency: 'gems', need: 10, have: gems })`
- Call `upgradeToSpecialist(workerId)`
- Card updates: star turns yellow, button disappears

After training the worker stays in Tab 4 (still level 9 at dream job), now with a yellow star.

---

## 7. Production Card Visual Changes (`src/components/ProductionCard.tsx`)

When the worker in a slot has `isSpecialist === true`:

- Card border color: `#F5C842` (gold) instead of `shirtColor`
- Border width: `2` (same as active slot)
- Level badge background: `#F5C842` (gold)
- Level badge text: `#fff` (unchanged)

These changes are purely visual; no game logic affected here.

---

## 8. Floor Header Changes (`src/components/FloorCard.tsx`)

In the floor header, compute `specialistBonus = getFloorSpecialistBonus(workers, floorId)`.

If `specialistBonus > 0`, show a pill next to the existing discount pill:

```
┌──────────────────────────────────┐
│  [Floor name]  [-3%] [+18% 💰]   │
└──────────────────────────────────┘
```

Pill style: gold background `#F5C842`, text `+X%`, small coin icon.

---

## 9. Menu Changes (`app/(tabs)/menu.tsx`)

Add a second menu item below "Склад":

```tsx
<Pressable style={styles.menuItem} onPress={() => setWorkersOpen(true)}>
  <Image source={require('../../assets/img/menu/workers.png')} style={{ width: 56, height: 56 }} />
  <Text style={styles.menuLabel}>{t('menu.workers')}</Text>
</Pressable>

<WorkersPanel visible={workersOpen} onClose={() => setWorkersOpen(false)} />
```

Icon asset `assets/img/menu/workers.png` already exists (per git status).

---

## 10. i18n Keys to Add

**`src/i18n/locales/en/hotel.json`** (or a new `workers.json`):
```json
{
  "workersPanel": {
    "title": "My Workers",
    "tabs": {
      "unsatisfied": "Unsatisfied",
      "mid": "Mid",
      "happy": "Happy",
      "specialists": "Specialists"
    },
    "fireButton": "Fire",
    "trainButton": "Train · 💎10",
    "fireBlockedDelivering": "{{name}} is delivering, {{time}} remaining. Cannot fire.",
    "fireBlockedSelling": "{{name}} is selling, {{time}} remaining. Cannot fire.",
    "fireHotelFullTitle": "Hotel is full",
    "fireHotelFullMessage": "{{name}} will permanently leave the skyscraper. Confirm?",
    "fireHotelFullConfirm": "Confirm",
    "fireHotelFullCancel": "Cancel"
  }
}
```

**`src/i18n/locales/en/tabs.json`** — add:
```json
"menu": {
  "workers": "My Workers"
}
```

---

## 11. Store Changes (`src/stores/gameStore.ts`)

Add two actions:

```ts
upgradeToSpecialist: (workerId: string) => void;
fireAndEvictWorker: (workerId: string) => void;
```

Both delegate to `executeCommand` with the new command types.

---

## 12. Files Changed / Created

| File | Change |
|------|--------|
| `shared/schemas/worker.ts` | Add `isSpecialist` field |
| `shared/schemas/command.ts` | Add 2 new command schemas |
| `shared/engine/workerUtils.ts` | Add `getFloorSpecialistBonus` |
| `shared/engine/processCommand.ts` | Handle 2 new commands + specialist bonus in collect |
| `src/stores/gameStore.ts` | Add 2 new actions |
| `src/components/WorkersPanel.tsx` | **New** — main panel |
| `src/components/WorkerJobCard.tsx` | **New** — card for assigned workers |
| `src/components/ProductionCard.tsx` | Gold border for specialists |
| `src/components/FloorCard.tsx` | Specialist bonus pill in header |
| `app/(tabs)/menu.tsx` | Add workers menu item |
| `src/i18n/locales/en/hotel.json` | Add workers panel strings |
| `src/i18n/locales/en/tabs.json` | Add menu.workers key |
