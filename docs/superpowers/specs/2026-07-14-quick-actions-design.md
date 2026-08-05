# Quick Actions Mode — Design Spec

**Date:** 2026-07-14  
**Status:** Approved

## Problem

Managing 15+ floors requires constant scrolling up and down. At 50+ floors this becomes unplayable. Players need a way to batch-process pending actions across all floors without scrolling.

## Solution

A Floating Action Button (FAB) on the main game screen that enters a "Quick Action Mode" — a filtered view showing only floors with a pending action, plus a single action button at the bottom.

---

## 1. FAB (Floating Action Button)

### Visibility
- Hidden when no floor has a pending action
- Visible when at least one floor has: coins to collect, items to list, items to buy, or an empty worker slot

### Priority (what the FAB shows)
```
collect → list → buy → hire
```
The FAB always shows the highest-priority available action across all floors.

### States
- **Idle (no active mode):** shows icon + label for the highest-priority action
- **Active mode:** FAB transforms into an `×` (close) button; does NOT switch to a new priority mid-session

### Position
Right side above bottom nav (placeholder — exact position TBD during implementation).

### Visual
Each action type has a distinct color/icon:
- Collect — yellow (coins)
- List — orange (shelves)
- Buy — blue (shopping)
- Hire — pink (person)

---

## 2. Mode State

```ts
const [quickActionMode, setQuickActionMode] = useState<
  null | 'collect' | 'list' | 'buy' | 'hire'
>(null);
```

Stored as local React state in `game.tsx`. Nothing added to the game store.

### Entry
Triggered by tapping the FAB. The mode type is locked at entry time.

### No-interruption rule
Once a mode is active, it does NOT switch even if a higher-priority action becomes available. Example: if coins appear while in buy-mode, buy-mode continues until its list is exhausted.

### Exit
- Player taps `×` (FAB in active state) — exit at any time
- Auto-exit when the filtered floor list becomes empty after the last action

---

## 3. Filtered Floor List

### Content
When a mode is active:
- `hotel` and `lobby` items are removed from `floorList`
- Only `production` floors relevant to the current mode are shown

### Floor inclusion rules per mode

| Mode | Floor included if… |
|---|---|
| collect | at least one slot has `stage === 'READY_TO_COLLECT'` |
| list | at least one slot has `stage === 'READY_TO_LIST'` |
| buy | at least one slot has `stage === 'IDLE'` and `typeId !== null` (regardless of balance) |
| hire | at least one slot has no assigned worker |

### Order
Same as regular tower view: highest floor ID at top, lowest floor ID at bottom (nearest the action button).

### Floor row UI
Each row in the filtered list is a compact card showing:
- Floor number + floor name
- Action-relevant summary (e.g., total coins, item count, slot needing a worker)

Not the full `FloorCard` — a lightweight summary row.

---

## 4. Action Button

Fixed at the bottom of the screen (absolute position, above bottom nav). Always visible while a mode is active.

### Target floor
The button acts on the **bottom-most floor in the filtered list** — the one visually just above the button.

### Label per mode

| Mode | Button label |
|---|---|
| collect | `Зібрати монети ($1 250)` — sum of all READY_TO_COLLECT slots on that floor |
| list (1 slot) | `Викласти товар` |
| list (>1 slots) | `Викласти товар (3 шт)` |
| buy | `Закупити [ProductName] ($350)` — highest slotIdx that is IDLE + has typeId |
| hire | `Знайти робітника` |

### On tap

**Collect:** fire one `collect` command per READY_TO_COLLECT slot on the floor. All slots collected in a single tap.

**List:** fire one `list` command per READY_TO_LIST slot on the floor. All slots listed in a single tap.

**Buy:** fire one `buy` command for the single slot with the highest `slotIdx` that has `stage === 'IDLE'` and `typeId !== null`. Only one buy per tap (one slot at a time, highest slot first: slot 3 → slot 2 → slot 1).
- If balance is insufficient → show `InsufficientResourcesModal` (standard behavior with gems↔coins exchange offer). Floor remains in the list.

**Hire:** open the hotel panel (`setHotelOpen(true)`). No command fired directly.

### After a successful tap (collect / list / buy that succeeds)
1. Commands are dispatched via `executeCommand`
2. The floor's state updates optimistically → it no longer meets the inclusion criteria
3. Floor disappears from the filtered list
4. The next floor becomes the bottom-most → button label updates
5. If the list is now empty → mode exits automatically

---

## 5. Edge Cases

| Case | Behavior |
|---|---|
| Buy with insufficient balance | InsufficientResourcesModal shown; floor stays in list |
| Hire with no workers in hotel | Hotel panel opens; player sees it's empty |
| Sync reconcile removes a floor mid-mode | Floor disappears from filtered list naturally; mode continues with remaining floors |
| All floors processed | Auto-exit mode |
| Player exits mid-mode via `×` | Mode resets to null; FAB recalculates priority and shows new state |

---

## 6. Files Affected

| File | Change |
|---|---|
| `app/(tabs)/game.tsx` | Add `quickActionMode` state, FAB component, filtered list logic, action button |
| `src/components/QuickActionFAB.tsx` | New: FAB button component (idle + active states) |
| `src/components/QuickActionBar.tsx` | New: bottom action button component |
| `src/components/QuickActionFloorRow.tsx` | New: compact floor row for the filtered list |

No changes to `gameStore`, `processCommand`, or command schemas — all existing commands are reused as-is.

---

## 7. Out of Scope

- Animations for mode transition (hotel/lobby hide) — can be added later
- Auto-scroll or snap behavior in the filtered list
- FAB exact position (finalize during implementation)
- Batch "collect all" in one tap (one tap = one floor)
