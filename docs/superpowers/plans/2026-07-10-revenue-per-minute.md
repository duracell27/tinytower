# Revenue Per Minute Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "revenue per minute" metric that sums effective revenue-per-minute across all SELLING productions and shows it as a pill under the player's name in the TopBar.

**Architecture:** A pure utility function in `shared/engine/ratingUtils.ts` computes the metric from floors, workers, openedFloorTypes, and gameConfig. `game.tsx` subscribes to those three store slices, runs the computation with `React.useMemo`, and passes the result to `TopBar`. `TopBar` renders a white pill when the value is > 0.

**Tech Stack:** React Native, Zustand (useGameStore), TypeScript, Jest

## Global Constraints

- Formula: `effectiveRevenue = Math.floor(batchValue × moodMultiplier × (1 + specialistBonus))`, then `Math.floor(effectiveRevenue / (sellDuration_ms / 60_000))`, summed across all productions with `stage === 'SELLING'`
- `sellDuration_ms` is the base config param — NOT the remaining countdown time
- `moodMultiplier` defaults to `1.0` when no worker is assigned to the slot
- `specialistBonus` = `getFloorSpecialistBonus(workers, floorId)`, defaults to 0
- Productions with `typeId === null` are skipped
- Pill is hidden when `revenuePerMin === 0`
- Pill text format: `⚡ {n} /min`
- Font: `Fredoka_600SemiBold` (matches rest of TopBar)
- Pill not rendered in `shop.tsx` or `city.tsx`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `shared/engine/ratingUtils.ts` | Pure `calcRevenuePerMin` function |
| Create | `shared/engine/__tests__/ratingUtils.test.ts` | Unit tests for the utility |
| Modify | `app/(tabs)/game.tsx` | Add selectors, useMemo, pass prop |
| Modify | `src/components/TopBar.tsx` | Add prop, render revenue pill |

---

### Task 1: `calcRevenuePerMin` utility function

**Files:**
- Create: `shared/engine/ratingUtils.ts`
- Create: `shared/engine/__tests__/ratingUtils.test.ts`

**Interfaces:**
- Consumes: `getWorkerForSlot`, `getRevenueMultiplier`, `getFloorSpecialistBonus` from `./workerUtils`; types `Floor`, `Worker`, `GameConfig` from `../types`
- Produces: `calcRevenuePerMin(floors, workers, openedFloorTypes, config): number`

- [ ] **Step 1: Write the failing tests**

Create `shared/engine/__tests__/ratingUtils.test.ts`:

```ts
import { calcRevenuePerMin } from '../ratingUtils';
import type { Floor, Worker, GameConfig } from '../../types';

function makeWorker(overrides?: Partial<Worker>): Worker {
  return {
    id: 'w1', name: 'Test', female: false, floorType: 'green',
    dreamJob: 'buns', level: 1, hairColor: '#000000',
    assignedFloorId: null, assignedSlotIdx: null,
    isSpecialist: false,
    ...overrides,
  };
}

const mockConfig = {
  productionTypes: {
    // sellDuration 300_000ms = 5 min, batchValue 64
    buns: { buyCost: 10, deliveryDuration: 105_000, sellDuration: 300_000, batchValue: 64 },
    // sellDuration 480_000ms = 8 min, batchValue 128
    cards: { buyCost: 20, deliveryDuration: 120_000, sellDuration: 480_000, batchValue: 128 },
  },
  floors: [
    { id: 2, slots: 3, floorType: 'green', availableTypes: ['buns'] },
  ],
} as unknown as GameConfig;

describe('calcRevenuePerMin', () => {
  it('returns 0 when no floors', () => {
    expect(calcRevenuePerMin([], [], {}, mockConfig)).toBe(0);
  });

  it('returns 0 when no productions are SELLING', () => {
    const floors: Floor[] = [{
      id: 2,
      productions: [{ typeId: 'buns', stage: 'DELIVERING', stageStartedAt: 0 }],
    }];
    expect(calcRevenuePerMin(floors, [], {}, mockConfig)).toBe(0);
  });

  it('skips production with null typeId', () => {
    const floors: Floor[] = [{
      id: 2,
      productions: [{ typeId: null, stage: 'SELLING', stageStartedAt: 0 }],
    }];
    expect(calcRevenuePerMin(floors, [], {}, mockConfig)).toBe(0);
  });

  it('computes revenuePerMin for one SELLING production with no worker', () => {
    // effectiveRevenue = Math.floor(64 * 1 * 1) = 64
    // sellDurationMin = 300_000 / 60_000 = 5
    // revenuePerMin = Math.floor(64 / 5) = 12
    const floors: Floor[] = [{
      id: 2,
      productions: [{ typeId: 'buns', stage: 'SELLING', stageStartedAt: 0 }],
    }];
    expect(calcRevenuePerMin(floors, [], {}, mockConfig)).toBe(12);
  });

  it('applies 2x multiplier for dream-job worker', () => {
    // effectiveRevenue = Math.floor(64 * 2 * 1) = 128
    // revenuePerMin = Math.floor(128 / 5) = 25
    const floors: Floor[] = [{
      id: 2,
      productions: [{ typeId: 'buns', stage: 'SELLING', stageStartedAt: 0 }],
    }];
    const workers = [makeWorker({
      floorType: 'green', dreamJob: 'buns',
      assignedFloorId: 2, assignedSlotIdx: 0,
    })];
    expect(calcRevenuePerMin(floors, workers, {}, mockConfig)).toBe(25);
  });

  it('applies 1.3x multiplier for mid-mood worker', () => {
    // effectiveRevenue = Math.floor(64 * 1.3 * 1) = Math.floor(83.2) = 83
    // revenuePerMin = Math.floor(83 / 5) = 16
    const floors: Floor[] = [{
      id: 2,
      productions: [{ typeId: 'buns', stage: 'SELLING', stageStartedAt: 0 }],
    }];
    const workers = [makeWorker({
      floorType: 'green', dreamJob: 'other',
      assignedFloorId: 2, assignedSlotIdx: 0,
    })];
    expect(calcRevenuePerMin(floors, workers, {}, mockConfig)).toBe(16);
  });

  it('applies specialist bonus from same floor', () => {
    // 1 specialist on floor 2: specialistBonus = 0.09
    // effectiveRevenue = Math.floor(64 * 1 * 1.09) = Math.floor(69.76) = 69
    // revenuePerMin = Math.floor(69 / 5) = 13
    const floors: Floor[] = [{
      id: 2,
      productions: [{ typeId: 'buns', stage: 'SELLING', stageStartedAt: 0 }],
    }];
    const workers = [makeWorker({
      assignedFloorId: 2, assignedSlotIdx: 1, isSpecialist: true,
    })];
    expect(calcRevenuePerMin(floors, workers, {}, mockConfig)).toBe(13);
  });

  it('sums across multiple SELLING productions on different floors', () => {
    // floor 2: buns, no worker → 12
    // floor 3 (dynamic): cards, no worker
    //   effectiveRevenue = Math.floor(128 * 1 * 1) = 128
    //   revenuePerMin = Math.floor(128 / 8) = 16
    // total = 28
    const floors: Floor[] = [
      { id: 2, productions: [{ typeId: 'buns', stage: 'SELLING', stageStartedAt: 0 }] },
      { id: 3, productions: [{ typeId: 'cards', stage: 'SELLING', stageStartedAt: 0 }] },
    ];
    expect(calcRevenuePerMin(floors, [], { '3': 'blue' }, mockConfig)).toBe(28);
  });

  it('resolves floorType from openedFloorTypes for dynamic floors', () => {
    // floor 99 not in config.floors → uses openedFloorTypes['99'] = 'green'
    // worker with floorType 'green' dreamJob 'buns' on slot 0 → multiplier 2x
    // effectiveRevenue = Math.floor(64 * 2 * 1) = 128
    // revenuePerMin = Math.floor(128 / 5) = 25
    const floors: Floor[] = [{
      id: 99,
      productions: [{ typeId: 'buns', stage: 'SELLING', stageStartedAt: 0 }],
    }];
    const workers = [makeWorker({
      floorType: 'green', dreamJob: 'buns',
      assignedFloorId: 99, assignedSlotIdx: 0,
    })];
    expect(calcRevenuePerMin(floors, workers, { '99': 'green' }, mockConfig)).toBe(25);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/Apple/IT/tinytower
npx jest shared/engine/__tests__/ratingUtils.test.ts --no-coverage
```

Expected: `Cannot find module '../ratingUtils'`

- [ ] **Step 3: Implement `calcRevenuePerMin`**

Create `shared/engine/ratingUtils.ts`:

```ts
import type { Floor, Worker, GameConfig } from '../types';
import { getWorkerForSlot, getRevenueMultiplier, getFloorSpecialistBonus } from './workerUtils';

export function calcRevenuePerMin(
  floors: Floor[],
  workers: Worker[],
  openedFloorTypes: Record<string, string>,
  config: GameConfig,
): number {
  let total = 0;
  for (const floor of floors) {
    const floorConfig = config.floors.find((f) => f.id === floor.id);
    const floorType = floorConfig?.floorType ?? openedFloorTypes[String(floor.id)] ?? null;
    const specialistBonus = getFloorSpecialistBonus(workers, floor.id);

    floor.productions.forEach((production, slotIdx) => {
      if (production.stage !== 'SELLING' || !production.typeId) return;
      const typeConfig = config.productionTypes[production.typeId];
      if (!typeConfig) return;

      const worker = getWorkerForSlot(workers, floor.id, slotIdx);
      const multiplier = worker && floorType
        ? getRevenueMultiplier(worker, floorType, production.typeId)
        : 1;

      const effectiveRevenue = Math.floor(typeConfig.batchValue * multiplier * (1 + specialistBonus));
      const sellDurationMinutes = typeConfig.sellDuration / 60_000;
      total += Math.floor(effectiveRevenue / sellDurationMinutes);
    });
  }
  return total;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx jest shared/engine/__tests__/ratingUtils.test.ts --no-coverage
```

Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add shared/engine/ratingUtils.ts shared/engine/__tests__/ratingUtils.test.ts
git commit -m "feat(engine): add calcRevenuePerMin utility for rating metric"
```

---

### Task 2: Wire `revenuePerMin` into `game.tsx`

**Files:**
- Modify: `app/(tabs)/game.tsx`

**Interfaces:**
- Consumes: `calcRevenuePerMin` from `../../shared/engine/ratingUtils`; `useGameStore` (already imported); `gameConfig` (already imported)
- Produces: `revenuePerMin: number` passed as prop to `<TopBar>`

- [ ] **Step 1: Add import for `calcRevenuePerMin`**

In `app/(tabs)/game.tsx`, add to the existing imports after line 22 (`import { xpForLevel } from '../../shared/engine/xp';`):

```ts
import { calcRevenuePerMin } from '../../shared/engine/ratingUtils';
```

- [ ] **Step 2: Add `workers` and `openedFloorTypes` selectors**

In `game.tsx`, after line 77 (`const floors = useGameStore((s) => s.floors);`), add:

```ts
const workers = useGameStore((s) => s.workers);
const openedFloorTypes = useGameStore((s) => s.openedFloorTypes);
```

- [ ] **Step 3: Add `revenuePerMin` useMemo**

After the two new selectors, add:

```ts
const revenuePerMin = React.useMemo(
  () => calcRevenuePerMin(floors, workers, openedFloorTypes ?? {}, gameConfig),
  [floors, workers, openedFloorTypes],
);
```

- [ ] **Step 4: Pass prop to `<TopBar>`**

Find the `<TopBar>` JSX (around line 246). Change it from:

```tsx
<TopBar
  name={playerName}
  level={playerLevel}
  xp={playerXp}
  xpForNextLevel={xpForLevel(playerLevel)}
  initial={initial}
  coins={formatCoins(balance)}
  gems={String(gems)}
/>
```

To:

```tsx
<TopBar
  name={playerName}
  level={playerLevel}
  xp={playerXp}
  xpForNextLevel={xpForLevel(playerLevel)}
  initial={initial}
  coins={formatCoins(balance)}
  gems={String(gems)}
  revenuePerMin={revenuePerMin}
/>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower
npx tsc --noEmit 2>&1 | head -20
```

Expected: Error about unknown prop `revenuePerMin` on TopBar (TopBar doesn't accept it yet — this is expected and will be resolved in Task 3). If there are other unrelated errors, note them but do not fix them.

- [ ] **Step 6: Commit**

```bash
git add "app/(tabs)/game.tsx"
git commit -m "feat(game): compute revenuePerMin and pass to TopBar"
```

---

### Task 3: Render revenue pill in `TopBar`

**Files:**
- Modify: `src/components/TopBar.tsx`

**Interfaces:**
- Consumes: `revenuePerMin?: number` new optional prop
- Produces: white pill rendered below player name when `revenuePerMin > 0`

- [ ] **Step 1: Add `revenuePerMin` to `TopBarProps`**

In `src/components/TopBar.tsx`, change the interface from:

```ts
interface TopBarProps {
  name: string;
  level: number;
  xp: number;
  xpForNextLevel: number;
  initial: string;
  coins: string;
  gems: string;
}
```

To:

```ts
interface TopBarProps {
  name: string;
  level: number;
  xp: number;
  xpForNextLevel: number;
  initial: string;
  coins: string;
  gems: string;
  revenuePerMin?: number;
}
```

- [ ] **Step 2: Destructure the new prop**

Change the function signature from:

```ts
export default function TopBar({ name, level, xp, xpForNextLevel, initial, coins, gems }: TopBarProps) {
```

To:

```ts
export default function TopBar({ name, level, xp, xpForNextLevel, initial, coins, gems, revenuePerMin }: TopBarProps) {
```

- [ ] **Step 3: Wrap name in a column view with pill**

In the JSX, the `avatarSection` currently contains `avatarWrapper` and a bare `<Text style={styles.nameText}>{name}</Text>`. Replace that `<Text>` with a wrapper column:

Before:
```tsx
<View style={styles.avatarSection}>
  <View style={styles.avatarWrapper}>
    <ProgressRing progress={progress} size={50} />
    <LinearGradient
      colors={['#74D3C4', '#3FA9A0']}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={styles.avatarInner}
    >
      <Text style={styles.avatarText}>{initial}</Text>
    </LinearGradient>
    <View style={styles.levelBadge}>
      <Text style={styles.levelText}>{level}</Text>
    </View>
  </View>
  <Text style={styles.nameText}>{name}</Text>
</View>
```

After:
```tsx
<View style={styles.avatarSection}>
  <View style={styles.avatarWrapper}>
    <ProgressRing progress={progress} size={50} />
    <LinearGradient
      colors={['#74D3C4', '#3FA9A0']}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={styles.avatarInner}
    >
      <Text style={styles.avatarText}>{initial}</Text>
    </LinearGradient>
    <View style={styles.levelBadge}>
      <Text style={styles.levelText}>{level}</Text>
    </View>
  </View>
  <View style={styles.nameColumn}>
    <Text style={styles.nameText}>{name}</Text>
    {revenuePerMin !== undefined && revenuePerMin > 0 && (
      <View style={styles.revenuePill}>
        <Text style={styles.revenuePillText}>⚡ {revenuePerMin} /min</Text>
      </View>
    )}
  </View>
</View>
```

- [ ] **Step 4: Add styles for `nameColumn` and `revenuePill`**

In the `StyleSheet.create({...})` block, add after the `nameText` style:

```ts
nameColumn: {
  flexDirection: 'column',
  gap: 3,
},
revenuePill: {
  alignSelf: 'flex-start',
  backgroundColor: '#fff',
  paddingVertical: 2,
  paddingHorizontal: 7,
  borderRadius: 10,
  shadowColor: 'rgba(120,110,60,1)',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.12,
  shadowRadius: 2,
  elevation: 2,
},
revenuePillText: {
  fontFamily: 'Fredoka_600SemiBold',
  fontSize: 11,
  color: '#27331F',
},
```

- [ ] **Step 5: Verify TypeScript compiles clean**

```bash
cd /Users/Apple/IT/tinytower
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors (or only pre-existing unrelated errors identical to baseline).

- [ ] **Step 6: Run full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -20
```

Expected: All tests pass (including the new ratingUtils tests from Task 1).

- [ ] **Step 7: Commit**

```bash
git add src/components/TopBar.tsx
git commit -m "feat(ui): show revenue-per-minute pill in TopBar under player name"
```
