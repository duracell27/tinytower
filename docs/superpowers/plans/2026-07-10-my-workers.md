# My Workers Feature — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "My Workers" panel to the menu with 4 satisfaction tabs, specialist upgrade system (+9% floor revenue per specialist), fire-from-job mechanic with hotel-capacity check, and gold visual treatment for specialists on the production floor.

**Architecture:** Pure command-sourcing — two new commands (`upgrade_to_specialist`, `fire_and_evict_worker`) go through `processCommand`; UI reads store state and calls store actions. WorkersPanel is an isolated bottom-sheet component (same pattern as HotelPanel) with four tabs. Visual changes to ProductionCard and FloorCard are prop-driven with no new state.

**Tech Stack:** React Native (Expo), Zustand, Zod, react-i18next, react-native-reanimated, react-native-gesture-handler, expo-linear-gradient.

## Global Constraints

- All new worker objects created in the engine must include `isSpecialist: false`.
- Existing saved state must hydrate without `isSpecialist` — Zod `.default(false)` handles this.
- All UI strings go through `i18next` — no hardcoded text.
- Follow existing naming/style conventions: `Fredoka_*` fonts, same border-radius values, same bottom-sheet animation pattern.
- `isSpecialist` is never reset to `false` — once trained, always a specialist (even if fired from job and rehired, they remain a specialist).
- Specialist bonus only applies if the worker is assigned to that floor (`assignedFloorId === floorId`).
- `fire_and_evict_worker` is blocked if production stage is `DELIVERING` or `SELLING` (same check as `fire_worker`).

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `shared/schemas/worker.ts` | Modify | Add `isSpecialist: z.boolean().default(false)` |
| `shared/schemas/command.ts` | Modify | Add `UpgradeToSpecialistCommandSchema`, `FireAndEvictWorkerCommandSchema`, register in union |
| `shared/types/index.ts` | Modify | Export 2 new command types |
| `shared/engine/workerUtils.ts` | Modify | Add `getFloorSpecialistBonus` |
| `shared/engine/processCommand.ts` | Modify | Handle 2 new commands; apply specialist bonus in `handleCollect` |
| `shared/engine/lobbyCommands.ts` | Modify | Add `isSpecialist: false` to new worker creation at line 142 |
| `shared/engine/__tests__/workerUtils.test.ts` | Modify | Add tests for `getFloorSpecialistBonus`; add `isSpecialist: false` to `makeWorker` |
| `shared/engine/__tests__/processCommand.test.ts` | Modify | Add tests for 2 new commands + specialist bonus in collect; add `isSpecialist: false` to `makeWorker` |
| `src/stores/gameStore.ts` | Modify | Add `upgradeToSpecialist`, `fireAndEvictWorker` actions |
| `src/i18n/locales/en/hotel.json` | Modify | Add `workersPanel` key block |
| `src/i18n/locales/en/tabs.json` | Modify | Add `menu.workers` key |
| `src/components/WorkerJobCard.tsx` | **Create** | Card for assigned workers (tabs 2–4) |
| `src/components/WorkersPanel.tsx` | **Create** | Main panel with 4 tabs |
| `app/(tabs)/menu.tsx` | Modify | Add workers menu item + WorkersPanel |
| `src/components/ProductionCard.tsx` | Modify | Gold border/level badge for `isSpecialist` workers |
| `src/components/FloorCard.tsx` | Modify | Specialist bonus pill in floor header |

---

## Task 1 — Worker Schema: add `isSpecialist`

**Files:**
- Modify: `shared/schemas/worker.ts`
- Modify: `shared/engine/lobbyCommands.ts:142`
- Modify: `shared/engine/__tests__/workerUtils.test.ts` (makeWorker helper)
- Modify: `shared/engine/__tests__/processCommand.test.ts` (makeWorker helper)

**Interfaces:**
- Produces: `Worker` type gains `isSpecialist: boolean`; all downstream files that construct `Worker` objects must add `isSpecialist: false`

- [ ] **Step 1: Write a failing test** — open `shared/engine/__tests__/workerUtils.test.ts` and add at the top of the file (after imports):

```ts
describe('Worker schema isSpecialist default', () => {
  it('defaults isSpecialist to false when field is absent', () => {
    const { WorkerSchema } = require('../../schemas/worker');
    const result = WorkerSchema.parse({
      id: 'w1', name: 'Test', female: false, floorType: 'green',
      dreamJob: 'buns', level: 5, hairColor: '#5C3A22',
      assignedFloorId: null, assignedSlotIdx: null,
    });
    expect(result.isSpecialist).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/Apple/IT/tinytower && npx jest shared/engine/__tests__/workerUtils.test.ts --testNamePattern="isSpecialist default" --no-coverage
```

Expected: FAIL — `result.isSpecialist` is `undefined`.

- [ ] **Step 3: Add `isSpecialist` to schema** — replace the entire content of `shared/schemas/worker.ts`:

```ts
import { z } from 'zod';

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

- [ ] **Step 4: Fix `makeWorker` helpers** — in BOTH test files (`workerUtils.test.ts` AND `processCommand.test.ts`) add `isSpecialist: false` to the `makeWorker` function:

```ts
function makeWorker(overrides?: Partial<Worker>): Worker {
  return {
    id: 'w1', name: 'Test', female: false, floorType: 'green',
    dreamJob: 'coffee_shop', level: 5, hairColor: '#5C3A22',
    assignedFloorId: null, assignedSlotIdx: null,
    isSpecialist: false,
    ...overrides,
  };
}
```

Note: `processCommand.test.ts` uses `dreamJob: 'coffee_shop'` — keep that value unchanged.

- [ ] **Step 5: Fix `lobbyCommands.ts` line 142** — add `isSpecialist: false` to the new worker object:

```ts
const newWorker: Worker = { ...workerData, assignedFloorId: null, assignedSlotIdx: null, isSpecialist: false };
```

- [ ] **Step 6: Run all tests to verify they pass**

```bash
cd /Users/Apple/IT/tinytower && npx jest --no-coverage
```

Expected: all PASS (or same failures as before this task).

- [ ] **Step 7: Commit**

```bash
git add shared/schemas/worker.ts shared/engine/lobbyCommands.ts shared/engine/__tests__/workerUtils.test.ts shared/engine/__tests__/processCommand.test.ts
git commit -m "feat(schema): add isSpecialist field to Worker"
```

---

## Task 2 — New Commands: `upgrade_to_specialist` + `fire_and_evict_worker`

**Files:**
- Modify: `shared/schemas/command.ts`
- Modify: `shared/types/index.ts`

**Interfaces:**
- Produces: `UpgradeToSpecialistCommand = { id, type: 'upgrade_to_specialist', workerId, timestamp }` and `FireAndEvictWorkerCommand = { id, type: 'fire_and_evict_worker', workerId, timestamp }`

- [ ] **Step 1: Add schemas to `shared/schemas/command.ts`** — add these two schemas after `EvictWorkerCommandSchema` (around line 45) and register them in the union:

```ts
export const UpgradeToSpecialistCommandSchema = z.object({
  id: z.string(),
  type: z.literal('upgrade_to_specialist'),
  workerId: z.string(),
  timestamp: z.number(),
});

export const FireAndEvictWorkerCommandSchema = z.object({
  id: z.string(),
  type: z.literal('fire_and_evict_worker'),
  workerId: z.string(),
  timestamp: z.number(),
});
```

Then add both to the `CommandSchema` discriminated union (at the bottom of the file):

```ts
export const CommandSchema = z.discriminatedUnion('type', [
  BuyCommandSchema,
  ListCommandSchema,
  CollectCommandSchema,
  AssignWorkerCommandSchema,
  FireWorkerCommandSchema,
  EvictWorkerCommandSchema,
  UpgradeToSpecialistCommandSchema,
  FireAndEvictWorkerCommandSchema,
  SpawnVisitorCommandSchema,
  LiftVisitorCommandSchema,
  CollectTipCommandSchema,
  DeliverAllCommandSchema,
  UpgradeElevatorCommandSchema,
  UpgradeLobbyCommandSchema,
  ClaimDailyRewardCommandSchema,
  ExpandHotelCommandSchema,
  FillLobbyCommandSchema,
  BuyFloorCommandSchema,
  OpenFloorCommandSchema,
  ExchangeGemsCommandSchema,
  SpeedUpConstructionCommandSchema,
  SpeedUpDeliveryCommandSchema,
]);
```

- [ ] **Step 2: Export new types from `shared/types/index.ts`** — add two lines after the `EvictWorkerCommand` export (around line 17):

```ts
export type UpgradeToSpecialistCommand = z.infer<typeof UpgradeToSpecialistCommandSchema>;
export type FireAndEvictWorkerCommand = z.infer<typeof FireAndEvictWorkerCommandSchema>;
```

Also add both to the import at the top of `shared/types/index.ts`:

```ts
import { CommandSchema, BuyCommandSchema, ListCommandSchema, CollectCommandSchema,
  AssignWorkerCommandSchema, FireWorkerCommandSchema, EvictWorkerCommandSchema,
  UpgradeToSpecialistCommandSchema, FireAndEvictWorkerCommandSchema,
  SpawnVisitorCommandSchema, LiftVisitorCommandSchema, CollectTipCommandSchema,
  DeliverAllCommandSchema, UpgradeElevatorCommandSchema, UpgradeLobbyCommandSchema,
  ClaimDailyRewardCommandSchema, ExpandHotelCommandSchema, BuyFloorCommandSchema,
  OpenFloorCommandSchema, SpeedUpDeliveryCommandSchema } from '../schemas/command';
```

- [ ] **Step 3: Run TypeScript check**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add shared/schemas/command.ts shared/types/index.ts
git commit -m "feat(schema): add upgrade_to_specialist and fire_and_evict_worker commands"
```

---

## Task 3 — Engine: specialist bonus + two new command handlers

**Files:**
- Modify: `shared/engine/workerUtils.ts`
- Modify: `shared/engine/processCommand.ts`
- Modify: `shared/engine/__tests__/workerUtils.test.ts`
- Modify: `shared/engine/__tests__/processCommand.test.ts`

**Interfaces:**
- Consumes: `getWorkerMood` (existing), `Worker.isSpecialist`, both new command types
- Produces: `getFloorSpecialistBonus(workers: Worker[], floorId: number): number`

- [ ] **Step 1: Write failing tests for `getFloorSpecialistBonus`** — add at the end of `shared/engine/__tests__/workerUtils.test.ts`:

```ts
describe('getFloorSpecialistBonus', () => {
  it('returns 0 when no workers on floor', () => {
    expect(getFloorSpecialistBonus([], 1)).toBe(0);
  });

  it('returns 0 when workers are not specialists', () => {
    const workers = [
      makeWorker({ id: 'w1', assignedFloorId: 1, assignedSlotIdx: 0, isSpecialist: false }),
    ];
    expect(getFloorSpecialistBonus(workers, 1)).toBe(0);
  });

  it('returns 0.09 for one specialist', () => {
    const workers = [
      makeWorker({ id: 'w1', assignedFloorId: 1, assignedSlotIdx: 0, isSpecialist: true }),
    ];
    expect(getFloorSpecialistBonus(workers, 1)).toBeCloseTo(0.09);
  });

  it('returns 0.27 for three specialists', () => {
    const workers = [
      makeWorker({ id: 'w1', assignedFloorId: 1, assignedSlotIdx: 0, isSpecialist: true }),
      makeWorker({ id: 'w2', assignedFloorId: 1, assignedSlotIdx: 1, isSpecialist: true }),
      makeWorker({ id: 'w3', assignedFloorId: 1, assignedSlotIdx: 2, isSpecialist: true }),
    ];
    expect(getFloorSpecialistBonus(workers, 1)).toBeCloseTo(0.27);
  });

  it('ignores specialists on other floors', () => {
    const workers = [
      makeWorker({ id: 'w1', assignedFloorId: 2, assignedSlotIdx: 0, isSpecialist: true }),
    ];
    expect(getFloorSpecialistBonus(workers, 1)).toBe(0);
  });
});
```

Also add the import for `getFloorSpecialistBonus` to the import line at the top of the file:

```ts
import { getWorkerForSlot, getFloorDiscount, getRevenueMultiplier, getWorkerMood, getFloorSpecialistBonus } from '../workerUtils';
```

- [ ] **Step 2: Write failing tests for new commands** — add at the end of `shared/engine/__tests__/processCommand.test.ts`:

```ts
// ---- helpers needed for these tests ----
function stateWithAssignedWorker(overrides?: Partial<Worker>): GameState {
  const worker = makeWorker({
    id: 'w-specialist', assignedFloorId: 1, assignedSlotIdx: 0,
    floorType: 'green', dreamJob: 'coffee_shop', level: 9,
    isSpecialist: false,
    ...overrides,
  });
  return makeState({ workers: [worker], gems: 50 });
}

describe('upgrade_to_specialist', () => {
  it('converts eligible level-9 dream-job worker to specialist, costs 10 gems', () => {
    const state = stateWithAssignedWorker();
    // worker is at slot 0 which has typeId 'coffee_shop' = dreamJob → mood 'good'
    // We need a production in place so mood resolves to 'good':
    const stateWithProd: GameState = {
      ...state,
      floors: [{ id: 1, productions: [
        { typeId: 'coffee_shop', stage: 'IDLE', stageStartedAt: 0 },
        { typeId: 'bookstore',   stage: 'IDLE', stageStartedAt: 0 },
      ]}],
    };
    const cmd: Command = { id: 'c1', type: 'upgrade_to_specialist', workerId: 'w-specialist', timestamp: 1000 };
    const result = processCommand(stateWithProd, cmd, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.workers[0].isSpecialist).toBe(true);
    expect(result.state.gems).toBe(40);
  });

  it('fails if worker is already a specialist', () => {
    const state = stateWithAssignedWorker({ isSpecialist: true });
    const stateWithProd: GameState = {
      ...state,
      floors: [{ id: 1, productions: [
        { typeId: 'coffee_shop', stage: 'IDLE', stageStartedAt: 0 },
        { typeId: 'bookstore',   stage: 'IDLE', stageStartedAt: 0 },
      ]}],
    };
    const cmd: Command = { id: 'c1', type: 'upgrade_to_specialist', workerId: 'w-specialist', timestamp: 1000 };
    const result = processCommand(stateWithProd, cmd, testConfig, 1000);
    expect(result.success).toBe(false);
  });

  it('fails if worker is not level 9', () => {
    const state = stateWithAssignedWorker({ level: 5 });
    const stateWithProd: GameState = {
      ...state,
      floors: [{ id: 1, productions: [
        { typeId: 'coffee_shop', stage: 'IDLE', stageStartedAt: 0 },
        { typeId: 'bookstore',   stage: 'IDLE', stageStartedAt: 0 },
      ]}],
    };
    const cmd: Command = { id: 'c1', type: 'upgrade_to_specialist', workerId: 'w-specialist', timestamp: 1000 };
    const result = processCommand(stateWithProd, cmd, testConfig, 1000);
    expect(result.success).toBe(false);
  });

  it('fails if insufficient gems', () => {
    const state = { ...stateWithAssignedWorker(), gems: 5 };
    const stateWithProd: GameState = {
      ...state,
      floors: [{ id: 1, productions: [
        { typeId: 'coffee_shop', stage: 'IDLE', stageStartedAt: 0 },
        { typeId: 'bookstore',   stage: 'IDLE', stageStartedAt: 0 },
      ]}],
    };
    const cmd: Command = { id: 'c1', type: 'upgrade_to_specialist', workerId: 'w-specialist', timestamp: 1000 };
    const result = processCommand(stateWithProd, cmd, testConfig, 1000);
    expect(result.success).toBe(false);
  });
});

describe('fire_and_evict_worker', () => {
  it('removes assigned worker permanently', () => {
    const worker = makeWorker({ id: 'w1', assignedFloorId: 1, assignedSlotIdx: 0 });
    const state: GameState = {
      ...makeState({ workers: [worker] }),
      floors: [{ id: 1, productions: [
        { typeId: 'coffee_shop', stage: 'IDLE', stageStartedAt: 0 },
        { typeId: 'bookstore',   stage: 'IDLE', stageStartedAt: 0 },
      ]}],
    };
    const cmd: Command = { id: 'c1', type: 'fire_and_evict_worker', workerId: 'w1', timestamp: 1000 };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.workers).toHaveLength(0);
  });

  it('fails if worker is delivering', () => {
    const worker = makeWorker({ id: 'w1', assignedFloorId: 1, assignedSlotIdx: 0 });
    const state: GameState = {
      ...makeState({ workers: [worker] }),
      floors: [{ id: 1, productions: [
        { typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 500 },
        { typeId: 'bookstore',   stage: 'IDLE',       stageStartedAt: 0 },
      ]}],
    };
    const cmd: Command = { id: 'c1', type: 'fire_and_evict_worker', workerId: 'w1', timestamp: 1000 };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(false);
  });

  it('fails if worker is selling', () => {
    const worker = makeWorker({ id: 'w1', assignedFloorId: 1, assignedSlotIdx: 0 });
    const state: GameState = {
      ...makeState({ workers: [worker] }),
      floors: [{ id: 1, productions: [
        { typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 500 },
        { typeId: 'bookstore',   stage: 'IDLE',    stageStartedAt: 0 },
      ]}],
    };
    const cmd: Command = { id: 'c1', type: 'fire_and_evict_worker', workerId: 'w1', timestamp: 1000 };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(false);
  });

  it('fails if worker not assigned', () => {
    const worker = makeWorker({ id: 'w1' });
    const state = makeState({ workers: [worker] });
    const cmd: Command = { id: 'c1', type: 'fire_and_evict_worker', workerId: 'w1', timestamp: 1000 };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(false);
  });
});

describe('specialist bonus in collect', () => {
  it('applies 9% bonus when one specialist is on the floor', () => {
    const worker = makeWorker({
      id: 'w1', assignedFloorId: 1, assignedSlotIdx: 0,
      floorType: 'green', dreamJob: 'coffee_shop',
      isSpecialist: true,
    });
    const state: GameState = {
      ...makeState({ workers: [worker] }),
      floors: [{ id: 1, productions: [
        { typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 0 },
        { typeId: 'bookstore',   stage: 'IDLE',    stageStartedAt: 0 },
      ]}],
    };
    // coffee_shop batchValue=25, worker mood='good' → multiplier=2.0, specialist bonus=0.09
    // revenue = floor(25 * 2.0 * 1.09) = floor(54.5) = 54
    const cmd: Command = { id: 'c1', type: 'collect', floorId: 1, slotIdx: 0, timestamp: 20000 };
    const result = processCommand(state, cmd, testConfig, 20000);
    expect(result.success).toBe(true);
    expect(result.state.balance).toBe(state.balance + 54);
  });

  it('no bonus when worker is not a specialist', () => {
    const worker = makeWorker({
      id: 'w1', assignedFloorId: 1, assignedSlotIdx: 0,
      floorType: 'green', dreamJob: 'coffee_shop',
      isSpecialist: false,
    });
    const state: GameState = {
      ...makeState({ workers: [worker] }),
      floors: [{ id: 1, productions: [
        { typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 0 },
        { typeId: 'bookstore',   stage: 'IDLE',    stageStartedAt: 0 },
      ]}],
    };
    // revenue = floor(25 * 2.0 * 1.0) = 50
    const cmd: Command = { id: 'c1', type: 'collect', floorId: 1, slotIdx: 0, timestamp: 20000 };
    const result = processCommand(state, cmd, testConfig, 20000);
    expect(result.success).toBe(true);
    expect(result.state.balance).toBe(state.balance + 50);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /Users/Apple/IT/tinytower && npx jest shared/engine/__tests__/workerUtils.test.ts shared/engine/__tests__/processCommand.test.ts --no-coverage 2>&1 | tail -20
```

Expected: new tests FAIL.

- [ ] **Step 4: Add `getFloorSpecialistBonus` to `shared/engine/workerUtils.ts`** — append after `getWorkerForSlot`:

```ts
export function getFloorSpecialistBonus(workers: Worker[], floorId: number): number {
  const count = workers.filter(
    (w) => w.assignedFloorId === floorId && w.isSpecialist,
  ).length;
  return count * 0.09;
}
```

- [ ] **Step 5: Update imports in `processCommand.ts`** — add `getFloorSpecialistBonus` to the import line at the top:

```ts
import { getWorkerForSlot, getFloorDiscount, getRevenueMultiplier, getFloorSpecialistBonus } from './workerUtils';
```

- [ ] **Step 6: Add `handleUpgradeToSpecialist` function** in `shared/engine/processCommand.ts` — add after `handleEvictWorker` (around line 302):

```ts
function handleUpgradeToSpecialist(
  state: GameState,
  command: Extract<Command, { type: 'upgrade_to_specialist' }>,
  config: GameConfig,
): ProcessResult {
  const worker = state.workers.find((w) => w.id === command.workerId);
  if (!worker) return { success: false, state, error: 'Worker not found' };
  if (worker.assignedFloorId === null) return { success: false, state, error: 'Worker not assigned' };
  if (worker.level !== 9) return { success: false, state, error: 'Worker must be level 9' };
  if (worker.isSpecialist) return { success: false, state, error: 'Already a specialist' };
  if (state.gems < 10) return { success: false, state, error: 'Insufficient gems' };

  const floorConfig = config.floors.find((f) => f.id === worker.assignedFloorId);
  const floorType = floorConfig?.floorType ?? state.openedFloorTypes?.[String(worker.assignedFloorId)] ?? '';
  const floor = state.floors.find((f) => f.id === worker.assignedFloorId);
  const production = floor?.productions[worker.assignedSlotIdx!];
  const mood = getWorkerMood(worker, floorType, production?.typeId ?? null);
  if (mood !== 'good') return { success: false, state, error: 'Worker not at dream job' };

  return {
    success: true,
    state: {
      ...state,
      gems: state.gems - 10,
      workers: state.workers.map((w) =>
        w.id === command.workerId ? { ...w, isSpecialist: true } : w,
      ),
    },
  };
}
```

- [ ] **Step 7: Add `handleFireAndEvictWorker` function** — add after `handleUpgradeToSpecialist`:

```ts
function handleFireAndEvictWorker(
  state: GameState,
  command: Extract<Command, { type: 'fire_and_evict_worker' }>,
): ProcessResult {
  const worker = state.workers.find((w) => w.id === command.workerId);
  if (!worker) return { success: false, state, error: 'Worker not found' };
  if (worker.assignedFloorId === null) return { success: false, state, error: 'Worker not assigned' };

  const floorIdx = state.floors.findIndex((f) => f.id === worker.assignedFloorId);
  if (floorIdx === -1) return { success: false, state, error: 'Floor not found' };

  const production = state.floors[floorIdx].productions[worker.assignedSlotIdx!];
  if (production && (production.stage === 'DELIVERING' || production.stage === 'SELLING')) {
    return { success: false, state, error: 'Cannot fire during active production' };
  }

  return {
    success: true,
    state: {
      ...state,
      workers: state.workers.filter((w) => w.id !== command.workerId),
    },
  };
}
```

- [ ] **Step 8: Add both cases to the `switch` in `processCommand`** — add inside the switch statement:

```ts
case 'upgrade_to_specialist':
  return handleUpgradeToSpecialist(state, command, config);
case 'fire_and_evict_worker':
  return handleFireAndEvictWorker(state, command);
```

Also update the function signature to pass `config` if not already done. The switch already receives `config` so just add the two new cases.

- [ ] **Step 9: Apply specialist bonus in `handleCollect`** — find the line `const revenue = Math.floor(typeConfig.batchValue * multiplier);` (around line 462) and replace with:

```ts
const specialistBonus = getFloorSpecialistBonus(state.workers, floorId);
const revenue = Math.floor(typeConfig.batchValue * multiplier * (1 + specialistBonus));
```

- [ ] **Step 10: Update `getWorkerMood` import in `processCommand.ts`** — add `getWorkerMood` to the import:

```ts
import { getWorkerForSlot, getFloorDiscount, getRevenueMultiplier, getFloorSpecialistBonus, getWorkerMood } from './workerUtils';
```

- [ ] **Step 11: Run tests to verify they pass**

```bash
cd /Users/Apple/IT/tinytower && npx jest --no-coverage 2>&1 | tail -10
```

Expected: all PASS.

- [ ] **Step 12: Commit**

```bash
git add shared/engine/workerUtils.ts shared/engine/processCommand.ts shared/engine/__tests__/workerUtils.test.ts shared/engine/__tests__/processCommand.test.ts
git commit -m "feat(engine): add specialist bonus, upgrade_to_specialist and fire_and_evict_worker commands"
```

---

## Task 4 — Store: new actions

**Files:**
- Modify: `src/stores/gameStore.ts`

**Interfaces:**
- Consumes: `upgrade_to_specialist` and `fire_and_evict_worker` command types
- Produces: `upgradeToSpecialist(workerId: string): void` and `fireAndEvictWorker(workerId: string): void` on the store

- [ ] **Step 1: Add to `GameActions` interface** — find the `interface GameActions` block and add two lines before the closing brace:

```ts
upgradeToSpecialist: (workerId: string) => void;
fireAndEvictWorker: (workerId: string) => void;
```

- [ ] **Step 2: Implement the two actions** — inside `create<GameStore>((set, get) => ({ ... }))`, add after the `fireWorker` action:

```ts
upgradeToSpecialist: (workerId) => {
  executeCommand(get, set, {
    id: uuid(),
    type: 'upgrade_to_specialist',
    workerId,
    timestamp: clock.now(),
  });
},

fireAndEvictWorker: (workerId) => {
  executeCommand(get, set, {
    id: uuid(),
    type: 'fire_and_evict_worker',
    workerId,
    timestamp: clock.now(),
  });
},
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat(store): add upgradeToSpecialist and fireAndEvictWorker actions"
```

---

## Task 5 — i18n strings

**Files:**
- Modify: `src/i18n/locales/en/hotel.json`
- Modify: `src/i18n/locales/en/tabs.json`

- [ ] **Step 1: Add `workersPanel` block to `hotel.json`** — add before the closing `}` of the JSON (after the `"deliverAll"` block):

```json
"workersPanel": {
  "title": "My Workers",
  "subtitle": "All employees",
  "tabs": {
    "unsatisfied": "Unsatisfied",
    "mid": "Mid",
    "happy": "Happy",
    "specialists": "Specialists"
  },
  "fireButton": "Fire",
  "trainButton": "Train · 💎10",
  "fireBlockedTitle": "Cannot Fire",
  "fireBlockedDelivering": "{{name}} is delivering, {{time}} remaining.",
  "fireBlockedSelling": "{{name}} is selling, {{time}} remaining.",
  "fireHotelFullTitle": "Hotel is full",
  "fireHotelFullMessage": "{{name}} will permanently leave the skyscraper.",
  "fireHotelFullConfirm": "Confirm",
  "fireHotelFullCancel": "Cancel",
  "workerJobCard": {
    "worksAt": "Works At",
    "dreamJob": "Dream Job",
    "skill": "Skill",
    "floor": "Floor {{id}}"
  }
}
```

- [ ] **Step 2: Add `menu.workers` to `tabs.json`** — find the `"menu"` block and add `"workers"`:

```json
"menu": {
  "heading": "Menu",
  "inventory": "Inventory",
  "warehouseTitle": "Warehouse",
  "workers": "My Workers"
}
```

- [ ] **Step 3: Run i18n key test**

```bash
cd /Users/Apple/IT/tinytower && npx jest src/i18n --no-coverage
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/en/hotel.json src/i18n/locales/en/tabs.json
git commit -m "feat(i18n): add My Workers panel strings"
```

---

## Task 6 — WorkerJobCard component

**Files:**
- Create: `src/components/WorkerJobCard.tsx`

**Interfaces:**
- Consumes: `Worker` type (with `isSpecialist`), `Floor` type, `floorType: string`, `now: number`, `gameConfig` (imported directly)
- Produces: `WorkerJobCard` component with props:
  ```ts
  interface WorkerJobCardProps {
    worker: Worker;
    floor: Floor;
    floorType: string;
    floorName: string;
    now: number;
    expanded: boolean;
    isSpecialistTab: boolean;
    onToggle: () => void;
    onFire: () => void;
    onTrain: () => void;
  }
  ```

- [ ] **Step 1: Create `src/components/WorkerJobCard.tsx`**:

```tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Polygon } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { gameConfig } from '../../shared/config/gameConfig';
import { getWorkerMood } from '../../shared/engine/workerUtils';
import type { Worker, Floor } from '../../shared/types';
import WorkerAvatar from './WorkerAvatar';
import { GemIcon } from './CurrencyIcons';

interface WorkerJobCardProps {
  worker: Worker;
  floor: Floor;
  floorType: string;
  floorName: string;
  now: number;
  expanded: boolean;
  isSpecialistTab: boolean;
  onToggle: () => void;
  onFire: () => void;
  onTrain: () => void;
}

const TIMING_CONFIG = { duration: 300, easing: Easing.bezier(0.4, 0, 0.2, 1) };

function formatTime(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const totalMin = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (totalMin < 60) return `${totalMin}m ${sec}s`;
  const hours = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  return `${hours}h ${min}m`;
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Polygon
        points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
        fill={filled ? '#F5C842' : 'none'}
        stroke={filled ? '#E0A800' : '#B0B6C2'}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function getProductionTimeRemaining(
  floor: Floor,
  slotIdx: number,
  now: number,
): { stage: 'DELIVERING' | 'SELLING'; remainingMs: number } | null {
  const production = floor.productions[slotIdx];
  if (!production || !production.typeId) return null;
  const typeConfig = gameConfig.productionTypes[production.typeId];
  if (!typeConfig) return null;

  if (production.stage === 'DELIVERING') {
    const remaining = typeConfig.deliveryDuration - (now - production.stageStartedAt);
    if (remaining > 0) return { stage: 'DELIVERING', remainingMs: remaining };
  }
  if (production.stage === 'SELLING') {
    const remaining = typeConfig.sellDuration - (now - production.stageStartedAt);
    if (remaining > 0) return { stage: 'SELLING', remainingMs: remaining };
  }
  return null;
}

export default function WorkerJobCard({
  worker,
  floor,
  floorType,
  floorName,
  now,
  expanded,
  isSpecialistTab,
  onToggle,
  onFire,
  onTrain,
}: WorkerJobCardProps) {
  const { t } = useTranslation('hotel');
  const { t: tContent } = useTranslation('gameContent');

  const ft = gameConfig.floorTypes[worker.floorType];
  const accent = ft?.accent ?? '#888';
  const production = floor.productions[worker.assignedSlotIdx!];
  const productionName = production?.typeId
    ? tContent(`productionTypes.${production.typeId}.displayName`, { defaultValue: production.typeId })
    : '—';
  const dreamJobName = tContent(`productionTypes.${worker.dreamJob}.displayName`, { defaultValue: worker.dreamJob });
  const category = tContent(`floorTypes.${worker.floorType}.category`, { defaultValue: worker.floorType });

  const expandAnim = useSharedValue(expanded ? 1 : 0);
  const chevronAnim = useSharedValue(expanded ? 1 : 0);

  React.useEffect(() => {
    expandAnim.value = withTiming(expanded ? 1 : 0, TIMING_CONFIG);
    chevronAnim.value = withTiming(expanded ? 1 : 0, TIMING_CONFIG);
  }, [expanded]);

  const expandedStyle = useAnimatedStyle(() => ({
    maxHeight: expandAnim.value * 480,
    opacity: expandAnim.value,
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronAnim.value * 90}deg` }],
  }));

  const activeProduction = getProductionTimeRemaining(floor, worker.assignedSlotIdx!, now);
  const statusLabel = activeProduction
    ? (activeProduction.stage === 'DELIVERING' ? 'Delivering' : 'Selling') + ' · ' + formatTime(activeProduction.remainingMs)
    : productionName;

  const borderColor = worker.isSpecialist ? '#F5C842' : accent;

  return (
    <View style={[styles.card, { borderColor, borderWidth: expanded ? 2 : 1 }]}>
      <Pressable onPress={onToggle} style={styles.collapsedRow}>
        <View style={styles.avatarWrap}>
          <WorkerAvatar worker={worker} size={60} />
          {isSpecialistTab && (
            <View style={styles.starBadge}>
              <StarIcon filled={worker.isSpecialist} />
            </View>
          )}
        </View>

        <View style={styles.infoColumn}>
          <Text style={styles.nameText} numberOfLines={1}>{worker.name}</Text>
          <Text style={[styles.floorText, { color: accent }]} numberOfLines={1}>
            {floorName}
          </Text>
          <Text style={styles.statusText} numberOfLines={1}>{statusLabel}</Text>
        </View>

        <View style={styles.levelBlock}>
          <View style={[styles.levelInner, worker.isSpecialist && styles.levelInnerGold]}>
            <Text style={[styles.levelLabel, worker.isSpecialist && styles.levelLabelGold]}>
              {t('workerCard.level')}
            </Text>
            <Text style={[styles.levelNumber, { color: worker.isSpecialist ? '#fff' : accent }]}>
              {worker.level}
            </Text>
          </View>
          <Animated.View style={chevronStyle}>
            <Svg width={9} height={14} viewBox="0 0 9 14" fill="none">
              <Path d="M2 2l5 5-5 5" stroke="#C2C8D2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Animated.View>
        </View>
      </Pressable>

      <Animated.View style={[styles.expandedSection, expandedStyle]}>
        <View style={styles.expandedContent}>
          <View style={styles.infoRows}>
            <InfoRow label={t('workersPanel.workerJobCard.skill')} value={`${category} · ${worker.level}`} />
            <InfoRow label={t('workersPanel.workerJobCard.dreamJob')} value={dreamJobName} />
            <InfoRow label={t('workersPanel.workerJobCard.worksAt')} value={`${floorName} · ${productionName}`} />
          </View>

          {isSpecialistTab && !worker.isSpecialist && (
            <Pressable
              onPress={onTrain}
              style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
            >
              <LinearGradient colors={['#F5C842', '#D4A500']} style={styles.actionButtonGradient}>
                <GemIcon size={16} />
                <Text style={styles.actionButtonText}>{t('workersPanel.trainButton')}</Text>
              </LinearGradient>
              <View style={[styles.actionButtonShadow, { backgroundColor: '#A07800' }]} />
            </Pressable>
          )}

          <Pressable
            onPress={onFire}
            style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
          >
            <LinearGradient colors={['#E2685A', '#CC4A3C']} style={styles.actionButtonGradient}>
              <Text style={styles.actionButtonText}>{t('workersPanel.fireButton')}</Text>
            </LinearGradient>
            <View style={[styles.actionButtonShadow, { backgroundColor: '#A8392C' }]} />
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoRowLabel}>{label}</Text>
      <Text style={styles.infoRowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
  },
  collapsedRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 11,
    paddingBottom: 11,
    paddingLeft: 11,
    paddingRight: 13,
    alignItems: 'center',
  },
  avatarWrap: {
    position: 'relative',
  },
  starBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  infoColumn: {
    flex: 1,
    gap: 3,
  },
  nameText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
    color: '#2A3344',
    textTransform: 'capitalize',
  },
  floorText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12.5,
  },
  statusText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12.5,
    color: '#9098A6',
  },
  levelBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  levelInner: {
    alignItems: 'center',
    gap: 1,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  levelInnerGold: {
    backgroundColor: '#F5C842',
  },
  levelLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 8,
    color: '#AEB4C0',
    letterSpacing: 0.5,
  },
  levelLabelGold: {
    color: '#fff',
  },
  levelNumber: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 24,
  },
  expandedSection: {
    overflow: 'hidden',
  },
  expandedContent: {
    paddingHorizontal: 14,
    paddingBottom: 16,
    gap: 12,
  },
  infoRows: {
    gap: 8,
    backgroundColor: '#F4F5F8',
    borderRadius: 12,
    padding: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoRowLabel: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 13,
    color: '#8A90A0',
  },
  infoRowValue: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    color: '#3A4250',
    textTransform: 'capitalize',
  },
  actionButton: {
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  actionButtonPressed: {
    opacity: 0.85,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    zIndex: 1,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 14,
  },
  actionButtonText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  actionButtonShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
});
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | grep "WorkerJobCard" | head -10
```

Expected: no errors mentioning WorkerJobCard.

- [ ] **Step 3: Commit**

```bash
git add src/components/WorkerJobCard.tsx
git commit -m "feat(ui): add WorkerJobCard component for assigned workers"
```

---

## Task 7 — WorkersPanel component

**Files:**
- Create: `src/components/WorkersPanel.tsx`

**Interfaces:**
- Consumes: `WorkerJobCard`, `WorkerCard`, `JobPickerSheet`, `useGameStore`, `getWorkerMood`, `getFloorSpecialistBonus`, `gameConfig`, `clock`
- Produces: `WorkersPanel` component with props `{ visible: boolean; onClose: () => void }`

- [ ] **Step 1: Create `src/components/WorkersPanel.tsx`**:

```tsx
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, Pressable, FlatList, Alert, Modal,
  StyleSheet, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useAnimatedStyle, useSharedValue, withTiming, withSpring, runOnJS, Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';
import { gameConfig } from '../../shared/config/gameConfig';
import { getWorkerMood } from '../../shared/engine/workerUtils';
import { clock } from '../services/clock';
import WorkerCard from './WorkerCard';
import WorkerJobCard, { getProductionTimeRemaining } from './WorkerJobCard';
import JobPickerSheet from './JobPickerSheet';
import InsufficientResourcesModal from './InsufficientResourcesModal';
import type { Worker, Floor } from '../../shared/types';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = SCREEN_HEIGHT - 56;
const DISMISS_THRESHOLD = 120;
const SHEET_TIMING = { duration: 420, easing: Easing.bezier(0.4, 0, 0.2, 1) };
const SCRIM_TIMING = { duration: 400, easing: Easing.linear };

type Tab = 'unsatisfied' | 'mid' | 'happy' | 'specialists';
const TABS: Tab[] = ['unsatisfied', 'mid', 'happy', 'specialists'];

interface WorkersPanelProps {
  visible: boolean;
  onClose: () => void;
}

interface CategorizedWorkers {
  unsatisfied: Worker[];
  mid: Worker[];
  happy: Worker[];
  specialists: Worker[];
}

function resolveFloorType(openedFloorTypes: Record<string, string>, floorId: number): string {
  const staticConfig = gameConfig.floors.find((f) => f.id === floorId);
  if (staticConfig) return staticConfig.floorType;
  return openedFloorTypes[String(floorId)] ?? '';
}

function resolveFloorName(
  openedFloorTypes: Record<string, string>,
  floors: Floor[],
  floorId: number,
  t: (key: string, opts?: Record<string, unknown>) => string,
  tContent: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const floorType = resolveFloorType(openedFloorTypes, floorId);
  const floor = floors.find((f) => f.id === floorId);
  const availableTypes = floor?.productions.map((p) => p.typeId).filter((id): id is string => id !== null) ?? [];
  const business = gameConfig.floorTypes[floorType]?.businesses.find((b) => b.dreamJobs.includes(availableTypes[0]));
  return business?.name ?? tContent(`floors.${floorId}.name`, { defaultValue: `Floor ${floorId}` });
}

function categorizeWorkers(
  workers: Worker[],
  floors: Floor[],
  openedFloorTypes: Record<string, string>,
): CategorizedWorkers {
  const result: CategorizedWorkers = { unsatisfied: [], mid: [], happy: [], specialists: [] };

  for (const worker of workers) {
    if (worker.assignedFloorId === null) {
      result.unsatisfied.push(worker);
      continue;
    }
    const floorType = resolveFloorType(openedFloorTypes, worker.assignedFloorId);
    const floor = floors.find((f) => f.id === worker.assignedFloorId);
    const production = floor?.productions[worker.assignedSlotIdx!];
    const mood = getWorkerMood(worker, floorType, production?.typeId ?? null);

    if (mood === 'good' && worker.level === 9) {
      result.specialists.push(worker);
    } else if (mood === 'good') {
      result.happy.push(worker);
    } else {
      result.mid.push(worker);
    }
  }

  return result;
}

function formatTimeShort(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const totalMin = Math.floor(totalSec / 60);
  if (totalMin < 60) return `${totalMin}m`;
  const hours = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  return `${hours}h ${min}m`;
}

export default function WorkersPanel({ visible, onClose }: WorkersPanelProps) {
  const { t } = useTranslation('hotel');
  const { t: tContent } = useTranslation('gameContent');
  const [activeTab, setActiveTab] = useState<Tab>('unsatisfied');
  const [expandedWorkerId, setExpandedWorkerId] = useState<string | null>(null);
  const [pickerWorker, setPickerWorker] = useState<Worker | null>(null);

  const scrimOpacity = useSharedValue(0);
  const translateY = useSharedValue(SHEET_HEIGHT);

  const workers = useGameStore((s) => s.workers);
  const floors = useGameStore((s) => s.floors);
  const openedFloorTypes = useGameStore((s) => s.openedFloorTypes ?? {});
  const hotelCapacity = useGameStore((s) => s.hotelCapacity);
  const gems = useGameStore((s) => s.gems);
  const fireWorker = useGameStore((s) => s.fireWorker);
  const fireAndEvictWorker = useGameStore((s) => s.fireAndEvictWorker);
  const upgradeToSpecialist = useGameStore((s) => s.upgradeToSpecialist);
  const showInsufficientResources = useGameStore((s) => s.showInsufficientResources);
  const clearInsufficientResources = useGameStore((s) => s.clearInsufficientResources);

  useEffect(() => {
    setExpandedWorkerId(null);
    if (!visible) clearInsufficientResources();
  }, [visible, clearInsufficientResources]);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, SHEET_TIMING);
      scrimOpacity.value = withTiming(1, SCRIM_TIMING);
    } else {
      translateY.value = withTiming(SHEET_HEIGHT, SHEET_TIMING);
      scrimOpacity.value = withTiming(0, SCRIM_TIMING);
    }
  }, [visible]);

  const panGesture = Gesture.Pan()
    .enabled(visible)
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
        scrimOpacity.value = 1 - (e.translationY / SHEET_HEIGHT);
      }
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_THRESHOLD || e.velocityY > 500) {
        translateY.value = withTiming(SHEET_HEIGHT, { duration: 300 });
        scrimOpacity.value = withTiming(0, { duration: 300 });
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
        scrimOpacity.value = withTiming(1, { duration: 200 });
      }
    });

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrimOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  const categorized = React.useMemo(
    () => categorizeWorkers(workers, floors, openedFloorTypes),
    [workers, floors, openedFloorTypes],
  );

  const handleFireFromJob = useCallback(
    (worker: Worker) => {
      const floor = floors.find((f) => f.id === worker.assignedFloorId);
      if (!floor) return;
      const now = clock.now();
      const active = getProductionTimeRemaining(floor, worker.assignedSlotIdx!, now);

      if (active) {
        const stageLabel = active.stage === 'DELIVERING'
          ? t('workersPanel.fireBlockedDelivering', { name: worker.name, time: formatTimeShort(active.remainingMs) })
          : t('workersPanel.fireBlockedSelling', { name: worker.name, time: formatTimeShort(active.remainingMs) });
        Alert.alert(t('workersPanel.fireBlockedTitle'), stageLabel, [{ text: 'OK' }]);
        return;
      }

      const hotelOccupied = workers.filter((w) => w.assignedFloorId === null).length;
      if (hotelOccupied < hotelCapacity) {
        fireWorker(worker.id);
      } else {
        Alert.alert(
          t('workersPanel.fireHotelFullTitle'),
          t('workersPanel.fireHotelFullMessage', { name: worker.name }),
          [
            { text: t('workersPanel.fireHotelFullCancel'), style: 'cancel' },
            {
              text: t('workersPanel.fireHotelFullConfirm'),
              style: 'destructive',
              onPress: () => fireAndEvictWorker(worker.id),
            },
          ],
        );
      }
    },
    [floors, workers, hotelCapacity, fireWorker, fireAndEvictWorker, t],
  );

  const handleTrain = useCallback(
    (worker: Worker) => {
      if (gems < 10) {
        showInsufficientResources({ currency: 'gems', need: 10, have: gems });
        return;
      }
      upgradeToSpecialist(worker.id);
    },
    [gems, upgradeToSpecialist, showInsufficientResources],
  );

  const currentWorkers = categorized[activeTab];

  const renderItem = useCallback(
    ({ item: worker }: { item: Worker }) => {
      if (activeTab === 'unsatisfied') {
        return (
          <WorkerCard
            worker={worker}
            expanded={expandedWorkerId === worker.id}
            onToggle={() => setExpandedWorkerId((p) => (p === worker.id ? null : worker.id))}
            onFindJob={() => setPickerWorker(worker)}
            onEvict={() => {
              Alert.alert(
                t('hotelPanel.evictConfirm.title'),
                t('hotelPanel.evictConfirm.message', { name: worker.name }),
                [
                  { text: t('hotelPanel.evictConfirm.cancel'), style: 'cancel' },
                  { text: t('hotelPanel.evictConfirm.confirm'), style: 'destructive',
                    onPress: () => useGameStore.getState().evictWorker(worker.id) },
                ],
              );
            }}
          />
        );
      }

      const floor = floors.find((f) => f.id === worker.assignedFloorId);
      if (!floor) return null;
      const floorType = resolveFloorType(openedFloorTypes, worker.assignedFloorId!);
      const floorName = resolveFloorName(openedFloorTypes, floors, worker.assignedFloorId!, t, tContent);
      const now = clock.now();

      return (
        <WorkerJobCard
          worker={worker}
          floor={floor}
          floorType={floorType}
          floorName={floorName}
          now={now}
          expanded={expandedWorkerId === worker.id}
          isSpecialistTab={activeTab === 'specialists'}
          onToggle={() => setExpandedWorkerId((p) => (p === worker.id ? null : worker.id))}
          onFire={() => handleFireFromJob(worker)}
          onTrain={() => handleTrain(worker)}
        />
      );
    },
    [activeTab, expandedWorkerId, floors, openedFloorTypes, handleFireFromJob, handleTrain, t, tContent],
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.overlay}>
        <Animated.View style={[styles.scrim, scrimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View style={[styles.sheet, sheetStyle]}>
          <GestureDetector gesture={panGesture}>
            <Animated.View>
              <LinearGradient colors={['#5B8DD9', '#3A6BBF']} style={styles.header}>
                <View style={styles.handleRow}>
                  <View style={styles.handle} />
                </View>
                <View style={styles.titleRow}>
                  <View style={styles.titleLeft}>
                    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      <Path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      <Path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <View>
                      <Text style={styles.titleText}>{t('workersPanel.title')}</Text>
                      <Text style={styles.subtitleText}>{t('workersPanel.subtitle')}</Text>
                    </View>
                  </View>
                  <Pressable onPress={onClose} style={styles.closeButton}>
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                      <Path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </Pressable>
                </View>

                <View style={styles.tabBar}>
                  {TABS.map((tab) => (
                    <Pressable
                      key={tab}
                      onPress={() => { setActiveTab(tab); setExpandedWorkerId(null); }}
                      style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
                    >
                      <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
                        {t(`workersPanel.tabs.${tab}`)}
                      </Text>
                      <View style={[styles.tabCount, activeTab === tab && styles.tabCountActive]}>
                        <Text style={[styles.tabCountText, activeTab === tab && styles.tabCountTextActive]}>
                          {categorized[tab].length}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </LinearGradient>
            </Animated.View>
          </GestureDetector>

          <FlatList
            data={currentWorkers}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            style={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>—</Text>
              </View>
            }
          />

          <JobPickerSheet
            visible={!!pickerWorker}
            worker={pickerWorker}
            onClose={() => setPickerWorker(null)}
          />
        </Animated.View>

        <InsufficientResourcesModal asOverlay />
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18,26,44,0.5)',
  },
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0, top: 56,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: '#EEF2F8',
    overflow: 'hidden',
  },
  header: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingBottom: 0,
  },
  handleRow: { alignItems: 'center', paddingTop: 10, paddingBottom: 8 },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.55)' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  titleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleText: { fontFamily: 'Fredoka_700Bold', fontSize: 17, color: '#fff', letterSpacing: 0.5 },
  subtitleText: { fontFamily: 'Fredoka_500Medium', fontSize: 11.5, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  closeButton: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 0,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  tabButtonActive: {
    backgroundColor: '#EEF2F8',
  },
  tabLabel: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 10,
    color: 'rgba(255,255,255,0.75)',
  },
  tabLabelActive: {
    color: '#3A6BBF',
    fontFamily: 'Fredoka_600SemiBold',
  },
  tabCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabCountActive: {
    backgroundColor: '#3A6BBF',
  },
  tabCountText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
  },
  tabCountTextActive: {
    color: '#fff',
  },
  list: { flex: 1 },
  listContent: { padding: 14, gap: 10, paddingBottom: 40 },
  emptyWrap: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontFamily: 'Fredoka_500Medium', fontSize: 16, color: '#B0B6C2' },
});
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | grep "WorkersPanel" | head -10
```

Expected: no errors mentioning WorkersPanel.

- [ ] **Step 3: Commit**

```bash
git add src/components/WorkersPanel.tsx
git commit -m "feat(ui): add WorkersPanel with 4-tab worker categorization"
```

---

## Task 8 — Menu integration

**Files:**
- Modify: `app/(tabs)/menu.tsx`

- [ ] **Step 1: Update `app/(tabs)/menu.tsx`**:

```tsx
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ImageBackground } from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import WarehouseSheet from '../../src/components/WarehouseSheet';
import WorkersPanel from '../../src/components/WorkersPanel';

export default function MenuScreen() {
  const { t } = useTranslation('tabs');
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [workersOpen, setWorkersOpen] = useState(false);

  return (
    <ImageBackground
      source={require('../../assets/welcome-bg.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.content}>
        <Text style={styles.heading}>{t('menu.heading')}</Text>

        <Pressable style={styles.menuItem} onPress={() => setInventoryOpen(true)}>
          <Image
            source={require('../../assets/img/menu/werehouse.png')}
            style={{ width: 56, height: 56 }}
            contentFit="contain"
          />
          <Text style={styles.menuLabel}>{t('menu.inventory')}</Text>
        </Pressable>

        <Pressable style={styles.menuItem} onPress={() => setWorkersOpen(true)}>
          <Image
            source={require('../../assets/img/menu/workers.png')}
            style={{ width: 56, height: 56 }}
            contentFit="contain"
          />
          <Text style={styles.menuLabel}>{t('menu.workers')}</Text>
        </Pressable>
      </View>

      <WarehouseSheet visible={inventoryOpen} onClose={() => setInventoryOpen(false)} />
      <WorkersPanel visible={workersOpen} onClose={() => setWorkersOpen(false)} />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    paddingTop: 72,
    paddingHorizontal: 20,
    gap: 12,
  },
  heading: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 26,
    color: '#2A3344',
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  menuLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
    color: '#2A3344',
  },
});
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -10
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/menu.tsx
git commit -m "feat(menu): add My Workers menu item"
```

---

## Task 9 — ProductionCard: gold border for specialists

**Files:**
- Modify: `src/components/ProductionCard.tsx`

The `ProductionCard` receives a `worker?: Worker` prop. When `worker.isSpecialist === true`, the card's border and level badge use gold.

- [ ] **Step 1: Find the card border style** in `ProductionCard.tsx`. Search for where `shirtColor` or the worker's color is applied to the card border. The card wrapper currently uses the worker's shirt color for its border when occupied. Replace the border logic so that if `worker?.isSpecialist` is true, use gold `#F5C842` instead.

Find the style object for the production card container that applies `worker`-based border color and add:

```ts
const cardBorderColor = worker?.isSpecialist ? '#F5C842' : (worker ? shirtColor : 'transparent');
```

Then apply `cardBorderColor` to the border color style of the card container.

- [ ] **Step 2: Find the level badge** in `ProductionCard.tsx`. The level badge shows the worker's level number with a colored background derived from the floor accent. When `worker?.isSpecialist` is true, set the badge background to `#F5C842` and text to `#fff`.

Add conditional style:
```ts
const levelBadgeBg = worker?.isSpecialist ? '#F5C842' : accentColor;
const levelBadgeTextColor = worker?.isSpecialist ? '#fff' : '#fff';
```

Apply these to the level badge `View` background and `Text` color.

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -10
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ProductionCard.tsx
git commit -m "feat(ui): gold border and level badge for specialist workers on production card"
```

---

## Task 10 — FloorCard: specialist bonus pill in header

**Files:**
- Modify: `src/components/FloorCard.tsx`

- [ ] **Step 1: Import `getFloorSpecialistBonus`** — add to the import line at the top of `FloorCard.tsx`:

```ts
import { getWorkerForSlot, getFloorDiscount, getFloorSpecialistBonus } from '../../shared/engine/workerUtils';
```

- [ ] **Step 2: Compute specialist bonus** — in `FloorCardInner`, after the line `const discount = getFloorDiscount(workers, floorId);`, add:

```ts
const specialistBonus = getFloorSpecialistBonus(workers, floorId);
```

- [ ] **Step 3: Add bonus pill to the header** — in the JSX, find the `headerRight` view (which already contains the discount badge and Stars). Add the specialist bonus pill after the discount badge and before Stars:

```tsx
{specialistBonus > 0 && (
  <View style={styles.specialistBonusBadge}>
    <Text style={styles.specialistBonusBadgeText}>
      +{Math.round(specialistBonus * 100)}%
    </Text>
  </View>
)}
```

- [ ] **Step 4: Add styles** — in the `StyleSheet.create` at the bottom of `FloorCard.tsx`, add:

```ts
specialistBonusBadge: {
  backgroundColor: '#F5C842',
  borderRadius: 6,
  paddingHorizontal: 6,
  paddingVertical: 2,
},
specialistBonusBadgeText: {
  fontFamily: 'Fredoka_700Bold',
  fontSize: 11,
  color: '#fff',
},
```

- [ ] **Step 5: TypeScript check + run tests**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit && npx jest --no-coverage
```

Expected: no errors, all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/FloorCard.tsx
git commit -m "feat(ui): show specialist revenue bonus pill in floor header"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|------------------|-----------|
| isSpecialist field | Task 1 |
| upgrade_to_specialist command (10 gems) | Tasks 2, 3 |
| fire_and_evict_worker command | Tasks 2, 3 |
| getFloorSpecialistBonus (+9% per specialist) | Task 3 |
| Specialist bonus applied at collect | Task 3 |
| Store actions | Task 4 |
| i18n strings | Task 5 |
| WorkerJobCard (tabs 2–4) with star icon | Task 6 |
| WorkersPanel 4 tabs with categorization | Task 7 |
| Fire-blocked popup (delivering/selling + time) | Task 7 |
| Fire to hotel vs fire-and-evict logic | Task 7 |
| Hotel-full confirmation dialog | Task 7 |
| My Workers menu item + workers.png icon | Task 8 |
| Gold border on ProductionCard for specialists | Task 9 |
| Specialist bonus pill in floor header | Task 10 |
| Tab 1 shows hotel workers (reuses WorkerCard) | Task 7 |
| Tab 4 shows gray/yellow star | Task 6 |
| Train button only for non-specialist tab-4 workers | Task 6 |

All spec requirements are covered. No placeholders found.
