# Worker Generation Proximity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Limit elevator worker dream jobs to businesses within `builtCount + 4` of the current floor count for that floor type category.

**Architecture:** Add a pure helper `getBuiltFloorCountForType` to `workerUtils.ts`, add a `maxBusinessIndex` cap parameter to `generateRandomWorkers`, then wire both together in the two `gameStore.ts` call sites (`collectTip`, `deliverAll`).

**Tech Stack:** TypeScript, Jest (ts-jest), Zustand (store — no unit tests needed, manual verification)

## Global Constraints

- `WORKER_LOOKAHEAD = 4` — exported named constant, defined in `workerNames.ts`
- `maxBusinessIndex` clamp: always `Math.min(builtCount + WORKER_LOOKAHEAD - 1, businesses.length - 1)`
- When `pendingFloorType` is `undefined` (non-guest visitor): no `maxBusinessIndex` passed, behaviour unchanged
- When floor type has no built floors (`builtCount = 0`): `maxBusinessIndex = WORKER_LOOKAHEAD - 1` (i.e. first 4 businesses)
- Do not change worker level generation
- Run tests: `npx jest` from repo root

---

### Task 1: `getBuiltFloorCountForType` helper + tests

**Files:**
- Modify: `shared/engine/workerUtils.ts`
- Modify: `shared/engine/__tests__/workerUtils.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function getBuiltFloorCountForType(
    floorType: string,
    floors: Floor[],
    openedFloorTypes: Record<string, string>,
    config: GameConfig,
  ): number
  ```

- [ ] **Step 1: Write the failing tests**

Append to `shared/engine/__tests__/workerUtils.test.ts`:

```ts
import { getBuiltFloorCountForType } from '../workerUtils';
import type { Floor, GameConfig } from '../../types';

const miniConfig = {
  floorTypes: {
    green: { shirtColor: '#0', accent: '#0', businesses: [] },
    blue:  { shirtColor: '#0', accent: '#0', businesses: [] },
  },
  floors: [
    { id: 1, slots: 1, floorType: 'green', availableTypes: [] },
    { id: 2, slots: 1, floorType: 'blue',  availableTypes: [] },
  ],
  productionTypes: {},
  startingBalance: 0,
  hotelCapacity: 0,
  lobbyConfig: {} as any,
  floorUnlocks: [],
} as unknown as GameConfig;

function makeFloor(id: number): Floor {
  return { id, productions: [] };
}

describe('getBuiltFloorCountForType', () => {
  it('returns 0 when no floors exist', () => {
    expect(getBuiltFloorCountForType('green', [], {}, miniConfig)).toBe(0);
  });

  it('counts static floors of matching type', () => {
    const floors = [makeFloor(1), makeFloor(2)];
    // floor 1 is green (from miniConfig.floors), floor 2 is blue
    expect(getBuiltFloorCountForType('green', floors, {}, miniConfig)).toBe(1);
    expect(getBuiltFloorCountForType('blue',  floors, {}, miniConfig)).toBe(1);
  });

  it('counts dynamic floors via openedFloorTypes', () => {
    const floors = [makeFloor(1), makeFloor(5), makeFloor(6)];
    const openedFloorTypes = { '5': 'green', '6': 'green' };
    // floor 1 static green + floors 5,6 dynamic green = 3
    expect(getBuiltFloorCountForType('green', floors, openedFloorTypes, miniConfig)).toBe(3);
  });

  it('ignores floors of a different type', () => {
    const floors = [makeFloor(2)]; // blue
    expect(getBuiltFloorCountForType('green', floors, {}, miniConfig)).toBe(0);
  });

  it('static type takes precedence over openedFloorTypes for same id', () => {
    // floor 1 is green in config; even if openedFloorTypes says blue, config wins
    const floors = [makeFloor(1)];
    const openedFloorTypes = { '1': 'blue' };
    expect(getBuiltFloorCountForType('green', floors, openedFloorTypes, miniConfig)).toBe(1);
    expect(getBuiltFloorCountForType('blue',  floors, openedFloorTypes, miniConfig)).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest workerUtils.test --no-coverage
```

Expected: FAIL — `getBuiltFloorCountForType` is not exported.

- [ ] **Step 3: Implement the helper in `shared/engine/workerUtils.ts`**

Add at the bottom of the file (after existing exports):

```ts
import type { GameConfig } from '../types';

export function getBuiltFloorCountForType(
  floorType: string,
  floors: Floor[],
  openedFloorTypes: Record<string, string>,
  config: GameConfig,
): number {
  let count = 0;
  for (const floor of floors) {
    const ft =
      config.floors.find((f) => f.id === floor.id)?.floorType ??
      openedFloorTypes[String(floor.id)];
    if (ft === floorType) count++;
  }
  return count;
}
```

Note: `Floor` and `Worker` are already imported at the top of `workerUtils.ts`. Add `GameConfig` to the existing import from `'../types'` if not already present.

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest workerUtils.test --no-coverage
```

Expected: all `getBuiltFloorCountForType` tests PASS, no regressions.

- [ ] **Step 5: Commit**

```bash
git add shared/engine/workerUtils.ts shared/engine/__tests__/workerUtils.test.ts
git commit -m "feat: add getBuiltFloorCountForType helper to workerUtils"
```

---

### Task 2: `maxBusinessIndex` cap + `WORKER_LOOKAHEAD` in `generateRandomWorkers`

**Files:**
- Modify: `shared/config/workerNames.ts`
- Create: `shared/config/__tests__/workerNames.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1 (independent)
- Produces:
  ```ts
  export const WORKER_LOOKAHEAD = 4;

  export function generateRandomWorkers(
    count: number,
    config: GameConfig,
    locale?: SupportedWorkerLocale,
    floorTypeOverride?: string,
    maxBusinessIndex?: number,   // NEW — 0-based inclusive cap on businesses array
  ): Worker[]
  ```

- [ ] **Step 1: Write the failing tests**

Create `shared/config/__tests__/workerNames.test.ts`:

```ts
import { generateRandomWorkers, WORKER_LOOKAHEAD } from '../workerNames';
import type { GameConfig } from '../../types';

const mockConfig = {
  floorTypes: {
    green: {
      shirtColor: '#0', accent: '#0',
      businesses: [
        { name: 'Biz0', dreamJobs: ['job0a', 'job0b'] },
        { name: 'Biz1', dreamJobs: ['job1a', 'job1b'] },
        { name: 'Biz2', dreamJobs: ['job2a', 'job2b'] },
        { name: 'Biz3', dreamJobs: ['job3a', 'job3b'] },
        { name: 'Biz4', dreamJobs: ['job4a', 'job4b'] },
      ],
    },
  },
  floors: [],
  productionTypes: {},
  startingBalance: 0,
  hotelCapacity: 0,
  lobbyConfig: {} as any,
  floorUnlocks: [],
} as unknown as GameConfig;

describe('WORKER_LOOKAHEAD', () => {
  it('is 4', () => {
    expect(WORKER_LOOKAHEAD).toBe(4);
  });
});

describe('generateRandomWorkers with maxBusinessIndex', () => {
  it('generates workers without restriction when maxBusinessIndex is omitted', () => {
    // all 50 workers should have some valid dreamJob from any of the 5 businesses
    const allJobs = new Set(['job0a','job0b','job1a','job1b','job2a','job2b','job3a','job3b','job4a','job4b']);
    for (let i = 0; i < 50; i++) {
      const [w] = generateRandomWorkers(1, mockConfig, 'en', 'green');
      expect(allJobs.has(w.dreamJob)).toBe(true);
    }
  });

  it('restricts dreamJob to businesses 0..maxBusinessIndex inclusive', () => {
    // maxBusinessIndex=1 → only businesses 0 and 1 → jobs job0a, job0b, job1a, job1b
    const allowed = new Set(['job0a', 'job0b', 'job1a', 'job1b']);
    for (let i = 0; i < 80; i++) {
      const [w] = generateRandomWorkers(1, mockConfig, 'en', 'green', 1);
      expect(allowed.has(w.dreamJob)).toBe(true);
    }
  });

  it('with maxBusinessIndex=0 only produces jobs from first business', () => {
    const allowed = new Set(['job0a', 'job0b']);
    for (let i = 0; i < 40; i++) {
      const [w] = generateRandomWorkers(1, mockConfig, 'en', 'green', 0);
      expect(allowed.has(w.dreamJob)).toBe(true);
    }
  });

  it('with maxBusinessIndex >= businesses.length-1 uses full pool', () => {
    const allJobs = new Set(['job0a','job0b','job1a','job1b','job2a','job2b','job3a','job3b','job4a','job4b']);
    // Sample enough times that we'd eventually hit businesses beyond index 4 if uncapped
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const [w] = generateRandomWorkers(1, mockConfig, 'en', 'green', 99);
      seen.add(w.dreamJob);
    }
    // With 200 samples and 10 jobs, all should appear eventually (probabilistic check)
    expect(seen.size).toBeGreaterThan(1);
    for (const job of seen) expect(allJobs.has(job)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest workerNames.test --no-coverage
```

Expected: FAIL — `WORKER_LOOKAHEAD` not exported, `maxBusinessIndex` param doesn't exist.

- [ ] **Step 3: Update `shared/config/workerNames.ts`**

Add the export constant and update the function signature. The changes are:

At the top of the file (before `HAIR_COLORS`), add:
```ts
export const WORKER_LOOKAHEAD = 4;
```

Change the function signature from:
```ts
export function generateRandomWorkers(
  count: number,
  config: GameConfig,
  locale: SupportedWorkerLocale = DEFAULT_WORKER_LOCALE,
  floorTypeOverride?: string,
): Worker[]
```
To:
```ts
export function generateRandomWorkers(
  count: number,
  config: GameConfig,
  locale: SupportedWorkerLocale = DEFAULT_WORKER_LOCALE,
  floorTypeOverride?: string,
  maxBusinessIndex?: number,
): Worker[]
```

Inside the loop, replace:
```ts
    const ftConfig = config.floorTypes[floorType];
    const business = ftConfig.businesses[Math.floor(Math.random() * ftConfig.businesses.length)];
```
With:
```ts
    const ftConfig = config.floorTypes[floorType];
    const businessPool = maxBusinessIndex !== undefined
      ? ftConfig.businesses.slice(0, maxBusinessIndex + 1)
      : ftConfig.businesses;
    const business = businessPool[Math.floor(Math.random() * businessPool.length)];
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest workerNames.test --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
npx jest --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add shared/config/workerNames.ts shared/config/__tests__/workerNames.test.ts
git commit -m "feat: add maxBusinessIndex cap and WORKER_LOOKAHEAD to generateRandomWorkers"
```

---

### Task 3: Wire up in `gameStore.ts` (collectTip + deliverAll)

**Files:**
- Modify: `src/stores/gameStore.ts`

**Interfaces:**
- Consumes:
  - `getBuiltFloorCountForType(floorType, floors, openedFloorTypes, config): number` from Task 1
  - `WORKER_LOOKAHEAD` from Task 2
  - `generateRandomWorkers(..., maxBusinessIndex?: number)` from Task 2

- [ ] **Step 1: Add imports to `gameStore.ts`**

Find the existing import of `generateRandomWorkers` near the top of the file:
```ts
import { generateRandomWorkers } from '../../shared/config/workerNames';
```
Extend it to also import `WORKER_LOOKAHEAD`:
```ts
import { generateRandomWorkers, WORKER_LOOKAHEAD } from '../../shared/config/workerNames';
```

Add `getBuiltFloorCountForType` to the existing workerUtils import (find the line that imports from `workerUtils`):
```ts
import { ..., getBuiltFloorCountForType } from '../../shared/engine/workerUtils';
```

- [ ] **Step 2: Update `collectTip` call site**

Find the `collectTip` method. It currently contains:
```ts
newWorker = generateRandomWorkers(1, gameConfig, undefined, active?.pendingFloorType)[0];
```

Replace the entire block that generates `newWorker` (inside `if (role === 'guest' && targetFloor === 1)`) with:
```ts
let newWorker: ReturnType<typeof generateRandomWorkers>[0] | undefined;
if (role === 'guest' && targetFloor === 1) {
  const hotelOccupied = state.workers.filter((w) => w.assignedFloorId === null).length;
  if (hotelOccupied < state.hotelCapacity) {
    const pendingFloorType = active?.pendingFloorType;
    let maxBizIdx: number | undefined;
    if (pendingFloorType && gameConfig.floorTypes[pendingFloorType]) {
      const builtCount = getBuiltFloorCountForType(
        pendingFloorType, state.floors, state.openedFloorTypes ?? {}, gameConfig,
      );
      maxBizIdx = Math.min(
        builtCount + WORKER_LOOKAHEAD - 1,
        gameConfig.floorTypes[pendingFloorType].businesses.length - 1,
      );
    }
    newWorker = generateRandomWorkers(1, gameConfig, undefined, pendingFloorType, maxBizIdx)[0];
  }
}
```

- [ ] **Step 3: Update `deliverAll` call site**

Find the loop in `deliverAll` that calls `generateRandomWorkers`:
```ts
preGeneratedWorkers.push(generateRandomWorkers(1, gameConfig, undefined, visitor.pendingFloorType)[0]);
```

Replace the entire `for (const visitor of state.lobbyVisitors)` loop body with:
```ts
for (const visitor of state.lobbyVisitors) {
  if ((visitor.role ?? 'guest') === 'guest' && visitor.targetFloor === 1 && hotelOccupied < state.hotelCapacity) {
    const pendingFloorType = visitor.pendingFloorType;
    let maxBizIdx: number | undefined;
    if (pendingFloorType && gameConfig.floorTypes[pendingFloorType]) {
      const builtCount = getBuiltFloorCountForType(
        pendingFloorType, state.floors, state.openedFloorTypes ?? {}, gameConfig,
      );
      maxBizIdx = Math.min(
        builtCount + WORKER_LOOKAHEAD - 1,
        gameConfig.floorTypes[pendingFloorType].businesses.length - 1,
      );
    }
    preGeneratedWorkers.push(
      generateRandomWorkers(1, gameConfig, undefined, pendingFloorType, maxBizIdx)[0],
    );
    hotelOccupied++;
  }
}
```

- [ ] **Step 4: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests PASS (TypeScript compilation included via ts-jest).

- [ ] **Step 5: Manual verification**

Start the app and observe new workers arriving via the elevator:
- With only 1–2 floors of a given type built, workers of that type should have dream jobs from the first 5–6 businesses in the category, not from the 10th–12th.
- Workers of a type where 0 floors are built should have dream jobs from the first 4 businesses only.

- [ ] **Step 6: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat: restrict worker dream job pool to built floors + lookahead"
```
