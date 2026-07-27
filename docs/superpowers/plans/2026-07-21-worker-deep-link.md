# Worker Deep-Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tap the worker avatar mini-badge on a ProductionCard to open WorkersPanel on the correct tab, scrolled to and expanded on that worker.

**Architecture:** A `pendingWorkerFocus` field in `gameStore` (UIState) acts as the cross-tab coordination signal. ProductionCard writes the workerId and navigates to the menu tab; `menu.tsx` reads it and opens WorkersPanel; WorkersPanel consumes it to switch tabs, scroll, and expand the card, then clears it from the store.

**Tech Stack:** React Native, Zustand (gameStore), Expo Router (`useRouter`), FlatList `scrollToIndex`.

## Global Constraints

- Follow existing UIState pattern in gameStore (see `insufficientResources: null` / `showInsufficientResources` / `clearInsufficientResources`)
- No new files — modify only the four files listed below
- Keep `pendingWorkerFocus` in UIState (not persisted, not a command)
- `clearPendingWorkerFocus` is called from inside WorkersPanel after consuming, not from ProductionCard

---

## File Map

| File | Change |
|------|--------|
| `src/stores/gameStore.ts` | Add `pendingWorkerFocus` to UIState + two actions |
| `src/components/ProductionCard.tsx` | Make workerBadgeColumn pressable, write store + navigate |
| `app/(tabs)/menu.tsx` | Watch store, open panel, pass targetWorkerId |
| `src/components/WorkersPanel.tsx` | Accept prop, determine tab, scroll + expand on open |

---

### Task 1: Add pendingWorkerFocus to gameStore

**Files:**
- Modify: `src/stores/gameStore.ts`

**Interfaces:**
- Produces: `pendingWorkerFocus: string | null`, `setPendingWorkerFocus(workerId: string): void`, `clearPendingWorkerFocus(): void` — consumed by Tasks 2, 3, 4

- [ ] **Step 1: Add field to UIState interface (line ~61)**

```ts
interface UIState {
  insufficientResources: InsufficientResourcesPayload | null;
  builderToolDrop: ToolKey | null;
  achievementQueue: NewAchievementGrant[];
  coinBonusPercent: number;
  xpBonusPercent: number;
  categoryProgress: Record<string, CategoryProgressState>;
  locallyGrantedAchievements: Set<string>;
  failedCommandLog: FailedCommandEntry[];
  pendingReferralNotifications: ReferralNotification[];
  pendingWorkerFocus: string | null;   // ← add this line
}
```

- [ ] **Step 2: Add actions to GameActions interface (after `dismissReferralNotification` line ~126)**

```ts
  setPendingWorkerFocus: (workerId: string) => void;
  clearPendingWorkerFocus: () => void;
```

- [ ] **Step 3: Add initial value (line ~268, after `pendingReferralNotifications: []`)**

```ts
  pendingReferralNotifications: [],
  pendingWorkerFocus: null,
```

- [ ] **Step 4: Add to reset (line ~369, after `pendingReferralNotifications: []`)**

```ts
    pendingReferralNotifications: [],
    pendingWorkerFocus: null,
```

- [ ] **Step 5: Implement actions (after `clearInsufficientResources` line ~306)**

```ts
  setPendingWorkerFocus: (workerId) => set({ pendingWorkerFocus: workerId }),
  clearPendingWorkerFocus: () => set({ pendingWorkerFocus: null }),
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `pendingWorkerFocus`.

- [ ] **Step 7: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat: add pendingWorkerFocus UI state to gameStore"
```

---

### Task 2: Make worker avatar tappable in ProductionCard

**Files:**
- Modify: `src/components/ProductionCard.tsx`

**Interfaces:**
- Consumes: `useGameStore.getState().setPendingWorkerFocus(workerId: string)` from Task 1
- Consumes: `useRouter` from `expo-router`

- [ ] **Step 1: Add router import at top of file**

```ts
import { useRouter } from 'expo-router';
```

- [ ] **Step 2: Add router hook inside the component body (after existing hooks, before `typeConfig` line ~203)**

```ts
  const router = useRouter();
```

- [ ] **Step 3: Replace the static workerBadgeColumn View with a Pressable**

Find this block (line ~441):
```tsx
        {worker && (
          <View style={styles.workerBadgeColumn}>
            <View style={[styles.workerBadge, worker.isSpecialist && { borderColor: '#F5C842' }]}>
              <WorkerAvatar worker={worker} size={24} />
            </View>
            <View style={[styles.workerLevelBadge, { backgroundColor: levelBadgeBg }]}>
              <Text style={[styles.workerLevelText, { color: levelBadgeTextColor }]}>{worker.level}</Text>
            </View>
            {hasMultiplier && (
              <View style={[styles.bonusBubble, { backgroundColor: accentColor }]}>
                <Text style={styles.bonusBubbleText}>×{multiplier}</Text>
              </View>
            )}
          </View>
        )}
```

Replace with:
```tsx
        {worker && (
          <Pressable
            style={({ pressed }) => [styles.workerBadgeColumn, pressed && { opacity: 0.7 }]}
            hitSlop={6}
            onPress={() => {
              useGameStore.getState().setPendingWorkerFocus(worker.id);
              router.navigate('/(tabs)/menu');
            }}
          >
            <View style={[styles.workerBadge, worker.isSpecialist && { borderColor: '#F5C842' }]}>
              <WorkerAvatar worker={worker} size={24} />
            </View>
            <View style={[styles.workerLevelBadge, { backgroundColor: levelBadgeBg }]}>
              <Text style={[styles.workerLevelText, { color: levelBadgeTextColor }]}>{worker.level}</Text>
            </View>
            {hasMultiplier && (
              <View style={[styles.bonusBubble, { backgroundColor: accentColor }]}>
                <Text style={styles.bonusBubbleText}>×{multiplier}</Text>
              </View>
            )}
          </Pressable>
        )}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ProductionCard.tsx
git commit -m "feat: make worker avatar badge tappable for deep link to WorkersPanel"
```

---

### Task 3: Open WorkersPanel in response to deep link (menu.tsx)

**Files:**
- Modify: `app/(tabs)/menu.tsx`

**Interfaces:**
- Consumes: `pendingWorkerFocus: string | null` from gameStore (Task 1)
- Produces: `targetWorkerId` prop on WorkersPanel — consumed by Task 4

- [ ] **Step 1: Add useGameStore import**

`menu.tsx` currently has no store import. Add after the existing imports:

```ts
import { useGameStore } from '../../src/stores/gameStore';
```

- [ ] **Step 2: Read pendingWorkerFocus in MenuScreen**

Add inside `MenuScreen` component, after the existing `useState` lines:

```ts
  const pendingWorkerFocus = useGameStore((s) => s.pendingWorkerFocus);
```

- [ ] **Step 3: Open WorkersPanel automatically when focus is pending**

Add a `useEffect` import to the React import line (if not already there), then add after the `pendingWorkerFocus` line:

```ts
  useEffect(() => {
    if (pendingWorkerFocus) {
      setWorkersOpen(true);
    }
  }, [pendingWorkerFocus]);
```

- [ ] **Step 4: Pass targetWorkerId to WorkersPanel**

Change the existing WorkersPanel usage (line ~55):
```tsx
      <WorkersPanel visible={workersOpen} onClose={() => setWorkersOpen(false)} />
```
to:
```tsx
      <WorkersPanel
        visible={workersOpen}
        onClose={() => setWorkersOpen(false)}
        targetWorkerId={pendingWorkerFocus}
      />
```

- [ ] **Step 5: Add React import for useEffect if missing**

The file's first line should be:
```ts
import React, { useState, useEffect } from 'react';
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -30
```

Expected: error about `targetWorkerId` prop not existing on WorkersPanel — this is correct, it'll be fixed in Task 4.

- [ ] **Step 7: Commit**

```bash
git add app/(tabs)/menu.tsx
git commit -m "feat: open WorkersPanel and forward targetWorkerId on pendingWorkerFocus"
```

---

### Task 4: Tab-switch, scroll, and expand in WorkersPanel

**Files:**
- Modify: `src/components/WorkersPanel.tsx`

**Interfaces:**
- Consumes: `targetWorkerId?: string | null` prop (from Task 3)
- Consumes: `clearPendingWorkerFocus()` from gameStore (Task 1)
- Consumes: `categorizeWorkers`, `resolveFloorType`, `getWorkerMood` — already imported

- [ ] **Step 1: Add targetWorkerId to WorkersPanelProps**

Find (line ~42):
```ts
interface WorkersPanelProps {
  visible: boolean;
  onClose: () => void;
}
```
Replace with:
```ts
interface WorkersPanelProps {
  visible: boolean;
  onClose: () => void;
  targetWorkerId?: string | null;
}
```

- [ ] **Step 2: Destructure the new prop**

Find (line ~146):
```ts
export default function WorkersPanel({ visible, onClose }: WorkersPanelProps) {
```
Replace with:
```ts
export default function WorkersPanel({ visible, onClose, targetWorkerId }: WorkersPanelProps) {
```

- [ ] **Step 3: Add pendingFocusId state after existing useState declarations (line ~153)**

Using state (not a ref) so React effects re-run when it changes — this correctly handles both the "tab changes" and "tab already correct" cases.

```ts
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
```

- [ ] **Step 4: Add Effect 1 — determine tab and queue focus (after `useEffect([activeTab])` block, ~line 214)**

```ts
  useEffect(() => {
    if (!visible || !targetWorkerId) return;
    const worker = workers.find((w) => w.id === targetWorkerId);
    if (!worker || worker.assignedFloorId === null) return;

    const floorType = resolveFloorType(openedFloorTypes, worker.assignedFloorId);
    const floor = floors.find((f) => f.id === worker.assignedFloorId);
    const production = floor?.productions[worker.assignedSlotIdx!];
    const mood = getWorkerMood(worker, floorType, production?.typeId ?? null);

    let targetTab: Tab;
    if (mood === 'good' && worker.level === 9) targetTab = 'specialists';
    else if (mood === 'good') targetTab = 'happy';
    else targetTab = 'mid';

    setPendingFocusId(targetWorkerId);
    setActiveTab(targetTab);
  }, [visible, targetWorkerId]);
```

- [ ] **Step 5: Add Effect 2 — scroll and expand when worker appears in list (immediately after Effect 1)**

This fires when either `pendingFocusId` or `filteredWorkers` changes. The `idx < 0` guard ensures it waits until the correct tab's workers are loaded. Works for both "tab switched" and "tab already correct" cases — React batches all state updates from both effects in one render, so `setExpandedWorkerId(workerId)` from this effect wins over `setExpandedWorkerId(null)` from the `[activeTab]` effect.

```ts
  useEffect(() => {
    if (!pendingFocusId) return;
    const idx = filteredWorkers.findIndex((w) => w.id === pendingFocusId);
    if (idx < 0) return;

    setPendingFocusId(null);
    pendingScrollReset.current = false;
    setExpandedWorkerId(pendingFocusId);
    useGameStore.getState().clearPendingWorkerFocus();
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.2 });
    });
  }, [pendingFocusId, filteredWorkers]);
```

- [ ] **Step 6: Add onScrollToIndexFailed to the FlatList (add after the existing `onContentSizeChange` prop)**

```tsx
            onScrollToIndexFailed={(info) => {
              flatListRef.current?.scrollToOffset({
                offset: info.averageItemLength * info.index,
                animated: true,
              });
            }}
```

- [ ] **Step 7: Verify TypeScript compiles clean**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 8: Manual test**

1. Open the game tab, find a floor with an assigned worker
2. Tap the small worker avatar badge on a ProductionCard
3. App should switch to the menu tab and WorkersPanel should open automatically
4. WorkersPanel should be on the correct tab (mid / happy / specialists) with the worker's card scrolled into view and expanded
5. Verify that opening WorkersPanel normally from the menu button still works correctly (no unintended scroll/expand)

- [ ] **Step 9: Commit**

```bash
git add src/components/WorkersPanel.tsx
git commit -m "feat: scroll and expand worker on deep link from ProductionCard"
```
