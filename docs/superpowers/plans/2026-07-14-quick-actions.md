# Quick Actions Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a floating action button that enters a bulk-action mode, letting players process pending floor actions (collect coins, list items, buy stock, hire workers) one floor at a time without scrolling through the full tower.

**Architecture:** Local `quickActionMode` state in `game.tsx` drives a filtered floor list and a fixed bottom action button. Three new presentational components handle the FAB, compact floor row, and action bar. Pure utility functions in `src/utils/quickAction.ts` handle priority detection, floor filtering, and per-floor action info — all tested in isolation.

**Tech Stack:** React Native (Expo), Zustand, TypeScript, existing `executeCommand`-backed store actions (`collect`, `list`, `buy`), `react-native-reanimated`, `expo-linear-gradient`.

## Global Constraints

- All new game actions must use existing store methods (`collect`, `list`, `buy`, `showInsufficientResources`) — no direct `executeCommand` calls from UI components.
- `quickActionMode` is local React state only — nothing added to `gameStore`.
- Floors listed highest ID at top, lowest ID at bottom (nearest action button) — same visual order as the tower.
- `getWorkerForSlot` from `shared/engine/workerUtils` is the canonical way to check worker assignment.
- `formatNum` from `src/utils/format.ts` is the canonical number formatter.
- No new i18n keys — Ukrainian strings hardcoded in components for this iteration.
- Run `npx jest` to verify tests; no test should be skipped or mocked via `jest.mock`.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/utils/quickAction.ts` | Create | Pure functions: priority detection, floor filtering, per-floor action info |
| `src/utils/__tests__/quickAction.test.ts` | Create | Unit tests for the above |
| `src/components/QuickActionFAB.tsx` | Create | Floating button: shows available action or × when mode active |
| `src/components/QuickActionFloorRow.tsx` | Create | Compact floor card used in the filtered list |
| `src/components/QuickActionBar.tsx` | Create | Fixed bottom action button with context label |
| `app/(tabs)/game.tsx` | Modify | State, derived values, handlers, FlashList swap, component wiring |

---

## Task 1: Quick action utilities

**Files:**
- Create: `src/utils/quickAction.ts`
- Create: `src/utils/__tests__/quickAction.test.ts`

**Interfaces:**
- Produces:
  - `QuickActionMode = 'collect' | 'list' | 'buy' | 'hire'`
  - `FloorActionInfo` (discriminated union, see Step 3)
  - `getAvailableMode(floors, workers, now): QuickActionMode | null`
  - `getFloorsForMode(mode, floors, workers, now): Floor[]`
  - `getFloorActionInfo(mode, floor, now): FloorActionInfo | null`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/__tests__/quickAction.test.ts`:

```ts
import { getAvailableMode, getFloorsForMode, getFloorActionInfo } from '../quickAction';
import { gameConfig } from '../../../shared/config/gameConfig';
import type { Floor, Worker } from '../../../shared/types';

// Pick the first real typeId from config so tests stay in sync with config changes
const REAL_TYPE = Object.keys(gameConfig.productionTypes)[0];

function makeFloor(id: number, productions: Floor['productions']): Floor {
  return { id, productions };
}

function makeWorker(
  id: string,
  assignedFloorId: number | null,
  assignedSlotIdx: number | null,
): Worker {
  return {
    id,
    name: 'Test',
    female: false,
    floorType: 'green',
    dreamJob: REAL_TYPE,
    level: 1,
    hairColor: '#000',
    assignedFloorId,
    assignedSlotIdx,
    isSpecialist: false,
  };
}

describe('getAvailableMode', () => {
  const now = 100_000;

  it('returns null when floors array is empty', () => {
    expect(getAvailableMode([], [], now)).toBeNull();
  });

  it('returns null when all productions are actively selling', () => {
    const floor = makeFloor(1, [
      { typeId: REAL_TYPE, stage: 'SELLING', stageStartedAt: now - 100 },
    ]);
    // sellDuration is much longer than 100ms, so timer has not elapsed
    expect(getAvailableMode([floor], [makeWorker('w1', 1, 0)], now)).toBeNull();
  });

  it('returns collect when floor has READY_TO_COLLECT', () => {
    const floor = makeFloor(1, [
      { typeId: REAL_TYPE, stage: 'READY_TO_COLLECT', stageStartedAt: 0 },
    ]);
    expect(getAvailableMode([floor], [], now)).toBe('collect');
  });

  it('returns list when floor has READY_TO_LIST and no collect', () => {
    const floor = makeFloor(1, [
      { typeId: REAL_TYPE, stage: 'READY_TO_LIST', stageStartedAt: 0 },
    ]);
    expect(getAvailableMode([floor], [], now)).toBe('list');
  });

  it('returns buy when floor has IDLE typeId and no collect/list', () => {
    const floor = makeFloor(1, [
      { typeId: REAL_TYPE, stage: 'IDLE', stageStartedAt: 0 },
    ]);
    expect(getAvailableMode([floor], [makeWorker('w1', 1, 0)], now)).toBe('buy');
  });

  it('returns hire when floor has typed slot with no worker and no collect/list/buy', () => {
    const floor = makeFloor(1, [
      { typeId: REAL_TYPE, stage: 'SELLING', stageStartedAt: now - 100 },
    ]);
    // workers = [] means no worker on slot 0 of floor 1
    expect(getAvailableMode([floor], [], now)).toBe('hire');
  });

  it('prioritizes collect over list', () => {
    const floors = [
      makeFloor(1, [{ typeId: REAL_TYPE, stage: 'READY_TO_LIST', stageStartedAt: 0 }]),
      makeFloor(2, [{ typeId: REAL_TYPE, stage: 'READY_TO_COLLECT', stageStartedAt: 0 }]),
    ];
    expect(getAvailableMode(floors, [], now)).toBe('collect');
  });

  it('prioritizes list over buy', () => {
    const floors = [
      makeFloor(1, [{ typeId: REAL_TYPE, stage: 'IDLE', stageStartedAt: 0 }]),
      makeFloor(2, [{ typeId: REAL_TYPE, stage: 'READY_TO_LIST', stageStartedAt: 0 }]),
    ];
    expect(getAvailableMode(floors, [], now)).toBe('list');
  });

  it('prioritizes buy over hire', () => {
    // floor 1 has IDLE (buy) + no worker (hire); floor 2 has selling + no worker (hire only)
    const floors = [
      makeFloor(1, [{ typeId: REAL_TYPE, stage: 'IDLE', stageStartedAt: 0 }]),
      makeFloor(2, [{ typeId: REAL_TYPE, stage: 'SELLING', stageStartedAt: now - 100 }]),
    ];
    expect(getAvailableMode(floors, [], now)).toBe('buy');
  });

  it('detects READY_TO_COLLECT derived from an elapsed SELLING timer', () => {
    const tc = gameConfig.productionTypes[REAL_TYPE]!;
    const floor = makeFloor(1, [
      {
        typeId: REAL_TYPE,
        stage: 'SELLING',
        stageStartedAt: now - tc.sellDuration - 1,
      },
    ]);
    expect(getAvailableMode([floor], [makeWorker('w1', 1, 0)], now)).toBe('collect');
  });

  it('detects READY_TO_LIST derived from an elapsed DELIVERING timer', () => {
    const tc = gameConfig.productionTypes[REAL_TYPE]!;
    const floor = makeFloor(1, [
      {
        typeId: REAL_TYPE,
        stage: 'DELIVERING',
        stageStartedAt: now - tc.deliveryDuration - 1,
      },
    ]);
    expect(getAvailableMode([floor], [makeWorker('w1', 1, 0)], now)).toBe('list');
  });
});

describe('getFloorsForMode', () => {
  const now = 100_000;

  it('returns only floors with matching collect slot', () => {
    const f1 = makeFloor(1, [{ typeId: REAL_TYPE, stage: 'READY_TO_COLLECT', stageStartedAt: 0 }]);
    const f2 = makeFloor(2, [{ typeId: REAL_TYPE, stage: 'SELLING', stageStartedAt: now - 100 }]);
    const result = getFloorsForMode('collect', [f1, f2], [], now);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('returns floors sorted by ID descending (highest first)', () => {
    const f1 = makeFloor(1, [{ typeId: REAL_TYPE, stage: 'READY_TO_COLLECT', stageStartedAt: 0 }]);
    const f5 = makeFloor(5, [{ typeId: REAL_TYPE, stage: 'READY_TO_COLLECT', stageStartedAt: 0 }]);
    const f3 = makeFloor(3, [{ typeId: REAL_TYPE, stage: 'READY_TO_COLLECT', stageStartedAt: 0 }]);
    const result = getFloorsForMode('collect', [f1, f5, f3], [], now);
    expect(result.map((f) => f.id)).toEqual([5, 3, 1]);
  });

  it('includes buy floors regardless of balance', () => {
    const floor = makeFloor(1, [{ typeId: REAL_TYPE, stage: 'IDLE', stageStartedAt: 0 }]);
    expect(getFloorsForMode('buy', [floor], [], now)).toHaveLength(1);
  });

  it('excludes floor from hire mode when all typed slots have workers', () => {
    const floor = makeFloor(1, [
      { typeId: REAL_TYPE, stage: 'SELLING', stageStartedAt: now - 100 },
    ]);
    const worker = makeWorker('w1', 1, 0);
    expect(getFloorsForMode('hire', [floor], [worker], now)).toHaveLength(0);
  });

  it('includes floor in hire mode when at least one typed slot has no worker', () => {
    const floor = makeFloor(1, [
      { typeId: REAL_TYPE, stage: 'SELLING', stageStartedAt: now - 100 },
      { typeId: REAL_TYPE, stage: 'SELLING', stageStartedAt: now - 100 },
    ]);
    const worker = makeWorker('w1', 1, 0); // slot 0 covered, slot 1 empty
    expect(getFloorsForMode('hire', [floor], [worker], now)).toHaveLength(1);
  });

  it('excludes floor from buy mode when slot has no typeId', () => {
    const floor = makeFloor(1, [{ typeId: null, stage: 'IDLE', stageStartedAt: 0 }]);
    expect(getFloorsForMode('buy', [floor], [], now)).toHaveLength(0);
  });
});

describe('getFloorActionInfo', () => {
  const now = 100_000;
  const tc = gameConfig.productionTypes[REAL_TYPE]!;

  it('collect — returns sum of batchValues for all READY_TO_COLLECT slots', () => {
    const floor = makeFloor(1, [
      { typeId: REAL_TYPE, stage: 'READY_TO_COLLECT', stageStartedAt: 0 },
      { typeId: REAL_TYPE, stage: 'READY_TO_COLLECT', stageStartedAt: 0 },
      { typeId: REAL_TYPE, stage: 'SELLING', stageStartedAt: now - 100 }, // not ready
    ]);
    const info = getFloorActionInfo('collect', floor, now);
    expect(info).toEqual({ mode: 'collect', totalCoins: tc.batchValue * 2 });
  });

  it('collect — returns null when no slot is ready', () => {
    const floor = makeFloor(1, [{ typeId: REAL_TYPE, stage: 'SELLING', stageStartedAt: now - 100 }]);
    expect(getFloorActionInfo('collect', floor, now)).toBeNull();
  });

  it('list — returns count 1 for a single ready slot', () => {
    const floor = makeFloor(1, [{ typeId: REAL_TYPE, stage: 'READY_TO_LIST', stageStartedAt: 0 }]);
    expect(getFloorActionInfo('list', floor, now)).toEqual({ mode: 'list', count: 1 });
  });

  it('list — returns count for multiple ready slots', () => {
    const floor = makeFloor(1, [
      { typeId: REAL_TYPE, stage: 'READY_TO_LIST', stageStartedAt: 0 },
      { typeId: REAL_TYPE, stage: 'READY_TO_LIST', stageStartedAt: 0 },
    ]);
    expect(getFloorActionInfo('list', floor, now)).toEqual({ mode: 'list', count: 2 });
  });

  it('buy — returns highest slotIdx that is IDLE', () => {
    const floor = makeFloor(1, [
      { typeId: REAL_TYPE, stage: 'IDLE', stageStartedAt: 0 },    // slot 0
      { typeId: REAL_TYPE, stage: 'IDLE', stageStartedAt: 0 },    // slot 1
    ]);
    const info = getFloorActionInfo('buy', floor, now);
    expect(info).toMatchObject({ mode: 'buy', slotIdx: 1, typeId: REAL_TYPE, buyCost: tc.buyCost });
  });

  it('buy — skips non-IDLE slots and picks next eligible', () => {
    const floor = makeFloor(1, [
      { typeId: REAL_TYPE, stage: 'IDLE', stageStartedAt: 0 },      // slot 0
      { typeId: REAL_TYPE, stage: 'SELLING', stageStartedAt: now },  // slot 1 — not IDLE
    ]);
    const info = getFloorActionInfo('buy', floor, now);
    expect(info).toMatchObject({ mode: 'buy', slotIdx: 0 });
  });

  it('buy — returns null when no IDLE slot with typeId', () => {
    const floor = makeFloor(1, [{ typeId: REAL_TYPE, stage: 'SELLING', stageStartedAt: now - 100 }]);
    expect(getFloorActionInfo('buy', floor, now)).toBeNull();
  });

  it('hire — always returns hire info', () => {
    const floor = makeFloor(1, [{ typeId: REAL_TYPE, stage: 'SELLING', stageStartedAt: now - 100 }]);
    expect(getFloorActionInfo('hire', floor, now)).toEqual({ mode: 'hire' });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest src/utils/__tests__/quickAction.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../quickAction'`

- [ ] **Step 3: Implement `src/utils/quickAction.ts`**

```ts
import { gameConfig } from '../../shared/config/gameConfig';
import { getProductionStatus } from '../../shared/engine/productionStatus';
import { getWorkerForSlot } from '../../shared/engine/workerUtils';
import type { Floor, Worker, Production } from '../../shared/types';

export type QuickActionMode = 'collect' | 'list' | 'buy' | 'hire';

export type FloorActionInfo =
  | { mode: 'collect'; totalCoins: number }
  | { mode: 'list'; count: number }
  | { mode: 'buy'; slotIdx: number; typeId: string; buyCost: number }
  | { mode: 'hire' };

function derivedStage(prod: Production, now: number): string {
  if (!prod.typeId) return 'EMPTY';
  const tc = gameConfig.productionTypes[prod.typeId];
  if (!tc) return 'EMPTY';
  return getProductionStatus(prod, tc, now, 0).effectiveStage;
}

export function getAvailableMode(
  floors: Floor[],
  workers: Worker[],
  now: number,
): QuickActionMode | null {
  let hasList = false;
  let hasBuy = false;
  let hasHire = false;

  for (const floor of floors) {
    for (let slotIdx = 0; slotIdx < floor.productions.length; slotIdx++) {
      const prod = floor.productions[slotIdx];
      const stage = derivedStage(prod, now);

      if (stage === 'READY_TO_COLLECT') return 'collect';
      if (stage === 'READY_TO_LIST') hasList = true;
      if (prod.stage === 'IDLE' && prod.typeId !== null) hasBuy = true;
      if (prod.typeId !== null && !getWorkerForSlot(workers, floor.id, slotIdx)) hasHire = true;
    }
  }

  if (hasList) return 'list';
  if (hasBuy) return 'buy';
  if (hasHire) return 'hire';
  return null;
}

export function getFloorsForMode(
  mode: QuickActionMode,
  floors: Floor[],
  workers: Worker[],
  now: number,
): Floor[] {
  return [...floors]
    .sort((a, b) => b.id - a.id)
    .filter((floor) =>
      floor.productions.some((prod, slotIdx) => {
        switch (mode) {
          case 'collect': return derivedStage(prod, now) === 'READY_TO_COLLECT';
          case 'list':    return derivedStage(prod, now) === 'READY_TO_LIST';
          case 'buy':     return prod.stage === 'IDLE' && prod.typeId !== null;
          case 'hire':    return prod.typeId !== null && !getWorkerForSlot(workers, floor.id, slotIdx);
        }
      }),
    );
}

export function getFloorActionInfo(
  mode: QuickActionMode,
  floor: Floor,
  now: number,
): FloorActionInfo | null {
  switch (mode) {
    case 'collect': {
      const totalCoins = floor.productions.reduce((sum, prod) => {
        if (!prod.typeId) return sum;
        const tc = gameConfig.productionTypes[prod.typeId];
        if (!tc) return sum;
        return derivedStage(prod, now) === 'READY_TO_COLLECT' ? sum + tc.batchValue : sum;
      }, 0);
      return totalCoins > 0 ? { mode: 'collect', totalCoins } : null;
    }

    case 'list': {
      const count = floor.productions.filter(
        (prod) => prod.typeId !== null && derivedStage(prod, now) === 'READY_TO_LIST',
      ).length;
      return count > 0 ? { mode: 'list', count } : null;
    }

    case 'buy': {
      for (let slotIdx = floor.productions.length - 1; slotIdx >= 0; slotIdx--) {
        const prod = floor.productions[slotIdx];
        if (prod.stage === 'IDLE' && prod.typeId !== null) {
          const tc = gameConfig.productionTypes[prod.typeId];
          if (!tc) continue;
          return { mode: 'buy', slotIdx, typeId: prod.typeId, buyCost: tc.buyCost };
        }
      }
      return null;
    }

    case 'hire':
      return { mode: 'hire' };
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest src/utils/__tests__/quickAction.test.ts --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/quickAction.ts src/utils/__tests__/quickAction.test.ts
git commit -m "feat(quick-actions): add utility functions with tests"
```

---

## Task 2: QuickActionFAB component

**Files:**
- Create: `src/components/QuickActionFAB.tsx`

**Interfaces:**
- Consumes: `QuickActionMode` from `src/utils/quickAction.ts`
- Produces: `<QuickActionFAB availableMode={…} activeMode={…} onPress={…} />`

- [ ] **Step 1: Create `src/components/QuickActionFAB.tsx`**

```tsx
import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { QuickActionMode } from '../utils/quickAction';

interface Props {
  availableMode: QuickActionMode | null;
  activeMode: QuickActionMode | null;
  onPress: () => void;
}

const MODE_META: Record<QuickActionMode, { label: string; colors: [string, string]; shadow: string }> = {
  collect:  { label: 'Монети',    colors: ['#F5C842', '#D4A017'], shadow: '#9A6E00' },
  list:     { label: 'Викладка',  colors: ['#F07A3A', '#C45A18'], shadow: '#8A3800' },
  buy:      { label: 'Закупівля', colors: ['#4A90D9', '#2563EB'], shadow: '#1A3E9A' },
  hire:     { label: 'Пошук',     colors: ['#D96E8A', '#B84E6A'], shadow: '#7A2840' },
};

export default function QuickActionFAB({ availableMode, activeMode, onPress }: Props) {
  if (activeMode !== null) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.75 }]}
      >
        <LinearGradient colors={['#8A95A8', '#6A7585']} style={styles.closeBtnGradient}>
          <Text style={styles.closeIcon}>✕</Text>
        </LinearGradient>
        <View style={[styles.shadow, { backgroundColor: '#45505F' }]} />
      </Pressable>
    );
  }

  if (availableMode === null) return null;

  const meta = MODE_META[availableMode];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.fab, pressed && { opacity: 0.82 }]}
    >
      <LinearGradient colors={meta.colors} style={styles.fabGradient}>
        <Text style={styles.fabLabel}>{meta.label}</Text>
      </LinearGradient>
      <View style={[styles.shadow, { backgroundColor: meta.shadow }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 96,
    borderRadius: 22,
    overflow: 'visible',
  },
  fabGradient: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    zIndex: 1,
  },
  fabLabel: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.4,
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    bottom: 96,
    borderRadius: 22,
    overflow: 'visible',
  },
  closeBtnGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    zIndex: 1,
  },
  closeIcon: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 18,
    color: '#fff',
  },
  shadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/QuickActionFAB.tsx
git commit -m "feat(quick-actions): add QuickActionFAB component"
```

---

## Task 3: QuickActionFloorRow component

**Files:**
- Create: `src/components/QuickActionFloorRow.tsx`

**Interfaces:**
- Consumes: `QuickActionMode`, `FloorActionInfo` from `src/utils/quickAction.ts`; `formatNum` from `src/utils/format.ts`
- Produces: `<QuickActionFloorRow floorId={…} floorName={…} mode={…} info={…} />`

- [ ] **Step 1: Create `src/components/QuickActionFloorRow.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatNum } from '../utils/format';
import type { QuickActionMode, FloorActionInfo } from '../utils/quickAction';

interface Props {
  floorId: number;
  floorName: string;
  mode: QuickActionMode;
  info: FloorActionInfo | null;
}

function summaryText(mode: QuickActionMode, info: FloorActionInfo | null): string {
  if (!info) return '';
  switch (info.mode) {
    case 'collect': return `$${formatNum(info.totalCoins)}`;
    case 'list':    return info.count === 1 ? 'до викладки' : `${info.count} шт`;
    case 'buy':     return `$${formatNum(info.buyCost)}`;
    case 'hire':    return 'потрібен робітник';
  }
}

const MODE_CHIP_COLOR: Record<QuickActionMode, string> = {
  collect: '#72C24F',
  list:    '#F2AC40',
  buy:     '#4A90D9',
  hire:    '#C9637E',
};

export default function QuickActionFloorRow({ floorId, floorName, mode, info }: Props) {
  const chipColor = MODE_CHIP_COLOR[mode];
  const summary = summaryText(mode, info);

  return (
    <View style={styles.row}>
      <View style={[styles.badge, { borderColor: chipColor }]}>
        <Text style={[styles.badgeText, { color: chipColor }]}>{floorId}</Text>
      </View>
      <Text style={styles.name} numberOfLines={1}>{floorName}</Text>
      {summary !== '' && (
        <View style={[styles.chip, { backgroundColor: chipColor }]}>
          <Text style={styles.chipText}>{summary}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    shadowColor: 'rgba(60,80,45,1)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 3,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 13,
  },
  name: {
    flex: 1,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    color: '#2A3040',
  },
  chip: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
    color: '#fff',
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/QuickActionFloorRow.tsx
git commit -m "feat(quick-actions): add QuickActionFloorRow component"
```

---

## Task 4: QuickActionBar component

**Files:**
- Create: `src/components/QuickActionBar.tsx`

**Interfaces:**
- Consumes: `QuickActionMode`, `FloorActionInfo` from `src/utils/quickAction.ts`; `formatNum` from `src/utils/format.ts`
- Produces: `<QuickActionBar mode={…} info={…} onPress={…} />`

- [ ] **Step 1: Create `src/components/QuickActionBar.tsx`**

```tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { formatNum } from '../utils/format';
import type { QuickActionMode, FloorActionInfo } from '../utils/quickAction';

interface Props {
  mode: QuickActionMode;
  info: FloorActionInfo | null;
  onPress: () => void;
}

const MODE_COLORS: Record<QuickActionMode, { colors: [string, string]; shadow: string }> = {
  collect: { colors: ['#72C24F', '#4A8A2E'], shadow: '#2E6018' },
  list:    { colors: ['#F2AC40', '#C9760F'], shadow: '#8A4A00' },
  buy:     { colors: ['#4A90D9', '#2563EB'], shadow: '#1A3E9A' },
  hire:    { colors: ['#D96E8A', '#B84E6A'], shadow: '#7A2840' },
};

export default function QuickActionBar({ mode, info, onPress }: Props) {
  const { t: tContent } = useTranslation('gameContent');
  const { colors, shadow } = MODE_COLORS[mode];

  const label = (() => {
    if (!info) return '…';
    switch (info.mode) {
      case 'collect':
        return `Зібрати монети ($${formatNum(info.totalCoins)})`;
      case 'list':
        return info.count === 1 ? 'Викласти товар' : `Викласти товар (${info.count} шт)`;
      case 'buy': {
        const productName = tContent(`productionTypes.${info.typeId}.displayName`, {
          defaultValue: info.typeId,
        });
        return `Закупити ${productName} ($${formatNum(info.buyCost)})`;
      }
      case 'hire':
        return 'Знайти робітника';
    }
  })();

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
      >
        <LinearGradient colors={colors} style={styles.btnGradient}>
          <Text style={styles.btnLabel} numberOfLines={1}>{label}</Text>
        </LinearGradient>
        <View style={[styles.btnShadow, { backgroundColor: shadow }]} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 90,
    paddingTop: 10,
    backgroundColor: 'rgba(248,252,248,0.92)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  btn: {
    borderRadius: 18,
    overflow: 'visible',
  },
  btnGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    zIndex: 1,
  },
  btnLabel: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 17,
    color: '#fff',
    letterSpacing: 0.3,
  },
  btnShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/QuickActionBar.tsx
git commit -m "feat(quick-actions): add QuickActionBar component"
```

---

## Task 5: Wire up in game.tsx

**Files:**
- Modify: `app/(tabs)/game.tsx`

**Interfaces:**
- Consumes all three new components and utility functions from Tasks 1–4.

- [ ] **Step 1: Add imports to `app/(tabs)/game.tsx`**

Add these imports after the existing ones (around line 26):

```tsx
import { useTranslation } from 'react-i18next';  // already present for 'tabs' — add 'gameContent' below
import QuickActionFAB from '../../src/components/QuickActionFAB';
import QuickActionFloorRow from '../../src/components/QuickActionFloorRow';
import QuickActionBar from '../../src/components/QuickActionBar';
import {
  getAvailableMode,
  getFloorsForMode,
  getFloorActionInfo,
  type QuickActionMode,
} from '../../src/utils/quickAction';
import { getProductionStatus } from '../../shared/engine/productionStatus';
```

Also add `tContent` to the existing translation hook on line 54:

```tsx
// Replace:
const { t } = useTranslation('tabs');
// With:
const { t } = useTranslation('tabs');
const { t: tContent } = useTranslation('gameContent');
```

- [ ] **Step 2: Add `collect`, `list`, `buy` store selectors**

After the existing `devAddGems` selector (around line 61), add:

```tsx
const storeCollect = useGameStore((s) => s.collect);
const storeList = useGameStore((s) => s.list);
const storeBuy = useGameStore((s) => s.buy);
```

- [ ] **Step 3: Add `quickActionMode` state and derived values**

After the `[hotelOpen, lobbyOpen, listRef]` declarations (around line 148), add:

```tsx
const [quickActionMode, setQuickActionMode] = useState<QuickActionMode | null>(null);

// Highest-priority mode currently available — only computed when not already in a mode
const availableMode = React.useMemo(
  () => (quickActionMode !== null ? null : getAvailableMode(floors, workers, now)),
  [quickActionMode, floors, workers, now],
);

// Floors matching the active mode, sorted highest ID first
const filteredFloors = React.useMemo(
  () => (quickActionMode !== null ? getFloorsForMode(quickActionMode, floors, workers, now) : []),
  [quickActionMode, floors, workers, now],
);

// The bottom-most floor (last in sorted-descending list = lowest ID = nearest the bar)
const bottomFloor = filteredFloors.length > 0 ? filteredFloors[filteredFloors.length - 1] : null;

// Action info for the bottom floor — drives the QuickActionBar label
const bottomFloorInfo = React.useMemo(
  () =>
    bottomFloor !== null && quickActionMode !== null
      ? getFloorActionInfo(quickActionMode, bottomFloor, now)
      : null,
  [bottomFloor, quickActionMode, now],
);
```

- [ ] **Step 4: Add auto-exit effect and floor-name helper**

After the visitor-spawning `useEffect` (around line 170), add:

```tsx
// Auto-exit when the filtered list empties after the last action
useEffect(() => {
  if (quickActionMode !== null && filteredFloors.length === 0) {
    setQuickActionMode(null);
  }
}, [quickActionMode, filteredFloors.length]);
```

Add a floor-name helper function inside the component (before `renderItem`):

```tsx
const resolveFloorName = useCallback(
  (floorId: number, floor: { productions: { typeId: string | null }[] }): string => {
    const dynamicType = openedFloorTypes?.[String(floorId)];
    if (dynamicType) {
      const firstTypeId = floor.productions[0]?.typeId;
      if (firstTypeId) {
        const biz = gameConfig.floorTypes[dynamicType]?.businesses.find((b) =>
          b.dreamJobs.includes(firstTypeId),
        );
        if (biz?.name) return biz.name;
      }
    }
    return tContent(`floors.${floorId}.name`, { defaultValue: `Floor ${floorId}` });
  },
  [openedFloorTypes, tContent],
);
```

- [ ] **Step 5: Add action callbacks**

Before the `renderItem` definition, add:

```tsx
const handleFABPress = useCallback(() => {
  if (quickActionMode !== null) {
    setQuickActionMode(null);
  } else if (availableMode !== null) {
    setQuickActionMode(availableMode);
  }
}, [quickActionMode, availableMode]);

const handleQuickAction = useCallback(() => {
  if (!quickActionMode || !bottomFloor) return;

  if (quickActionMode === 'collect') {
    bottomFloor.productions.forEach((prod, slotIdx) => {
      if (!prod.typeId) return;
      const tc = gameConfig.productionTypes[prod.typeId];
      if (!tc) return;
      if (getProductionStatus(prod, tc, now, balance).effectiveStage === 'READY_TO_COLLECT') {
        storeCollect(bottomFloor.id, slotIdx);
      }
    });
    return;
  }

  if (quickActionMode === 'list') {
    bottomFloor.productions.forEach((prod, slotIdx) => {
      if (!prod.typeId) return;
      const tc = gameConfig.productionTypes[prod.typeId];
      if (!tc) return;
      if (getProductionStatus(prod, tc, now, balance).effectiveStage === 'READY_TO_LIST') {
        storeList(bottomFloor.id, slotIdx);
      }
    });
    return;
  }

  if (quickActionMode === 'buy') {
    if (!bottomFloorInfo || bottomFloorInfo.mode !== 'buy') return;
    if (balance < bottomFloorInfo.buyCost) {
      showInsufficientResources({ currency: 'coins', need: bottomFloorInfo.buyCost, have: balance });
      return;
    }
    storeBuy(bottomFloor.id, bottomFloorInfo.slotIdx, bottomFloorInfo.typeId);
    return;
  }

  if (quickActionMode === 'hire') {
    setHotelOpen(true);
  }
}, [
  quickActionMode, bottomFloor, bottomFloorInfo, now, balance,
  storeCollect, storeList, storeBuy, showInsufficientResources,
]);
```

- [ ] **Step 6: Update `renderItem` to render quick-action rows when mode active**

Inside the existing `renderItem` callback, add this block at the top (before the `underConstruction` check):

```tsx
if (item.type === 'production' && quickActionMode !== null) {
  const floor = floors.find((f) => f.id === item.id);
  if (!floor) return null;
  const info = getFloorActionInfo(quickActionMode, floor, now);
  return (
    <View style={styles.floorWrapper}>
      <QuickActionFloorRow
        floorId={item.id}
        floorName={resolveFloorName(item.id, floor)}
        mode={quickActionMode}
        info={info}
      />
    </View>
  );
}
```

Also add `resolveFloorName`, `quickActionMode`, `floors` to the `useCallback` dependency array of `renderItem`.

- [ ] **Step 7: Swap FlashList data when mode is active**

Find the `<FlashList` in the return JSX (around line 258). Change the `data` prop:

```tsx
// Replace:
data={floorList}
// With:
data={
  quickActionMode !== null
    ? filteredFloors.map((f) => ({ type: 'production' as const, id: f.id }))
    : floorList
}
```

Also add `quickActionMode` and `filteredFloors` to the `extraData` prop so FlashList re-renders on mode change:

```tsx
// Replace:
extraData={now}
// With:
extraData={{ now, quickActionMode }}
```

- [ ] **Step 8: Add FAB and QuickActionBar to the JSX**

Inside `<ImageBackground>`, after `<TopBar ... />` and before `</ImageBackground>`, add:

```tsx
<QuickActionFAB
  availableMode={availableMode}
  activeMode={quickActionMode}
  onPress={handleFABPress}
/>

{quickActionMode !== null && (
  <QuickActionBar
    mode={quickActionMode}
    info={bottomFloorInfo}
    onPress={handleQuickAction}
  />
)}
```

- [ ] **Step 9: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: All tests PASS (no regressions).

- [ ] **Step 10: Commit**

```bash
git add app/\(tabs\)/game.tsx
git commit -m "feat(quick-actions): wire FAB and bulk-action mode into game screen"
```

---

## Self-Review

**Spec coverage:**
- ✅ FAB visible when any pending action exists, hidden when none
- ✅ Priority: collect → list → buy → hire
- ✅ Mode locked at entry, no interruption rule (mode stays until list empty or × pressed)
- ✅ Hotel/lobby rows hidden in active mode (FlashList data swapped to `filteredFloors`)
- ✅ Button acts on bottom-most floor (lowest ID)
- ✅ Collect: all READY_TO_COLLECT slots on floor collected at once
- ✅ List: all READY_TO_LIST slots on floor listed at once; count shown if >1
- ✅ Buy: highest slotIdx first; InsufficientResourcesModal if balance insufficient; shows cost
- ✅ Hire: opens hotel panel
- ✅ Auto-exit when filtered list becomes empty
- ✅ × button to exit at any time

**Placeholder scan:** None found.

**Type consistency:**
- `QuickActionMode` defined in Task 1, imported in Tasks 2, 3, 4, 5 ✓
- `FloorActionInfo` defined in Task 1, imported in Tasks 3, 4, 5 ✓
- `getFloorActionInfo` defined in Task 1, called in Tasks 5 (`renderItem` and `bottomFloorInfo`) ✓
- `getFloorsForMode` defined in Task 1, called in Task 5 ✓
- `getAvailableMode` defined in Task 1, called in Task 5 ✓
