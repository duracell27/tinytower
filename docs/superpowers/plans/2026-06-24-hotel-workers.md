# Hotel & Workers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a worker system where production slots require assigned workers to operate, with revenue multipliers and buy cost discounts based on worker-floor matching.

**Architecture:** Workers are part of GameState, processed through the same shared engine and command log sync pipeline. Three new commands (assign_worker, fire_worker, evict_worker) plus modifications to buy/list/collect. Hotel panel UI as a bottom sheet overlay on the game screen.

**Tech Stack:** Zod schemas, Zustand store, React Native + Reanimated, NestJS + Prisma, existing sync pipeline.

## Global Constraints

- All game logic lives in `shared/` — pure TS, no React/RN imports
- Zod schemas are the single source of truth for types
- Commands go through `processCommand` in the shared engine — both client and server use the same function
- Ukrainian UI text throughout
- Fredoka font family (already loaded)
- Design fidelity: pixel-accurate to `assets/hotel design/Hotel Panel.dc.html`
- Workers of all 5 floor types exist from game start; only 3 floors are built

---

## File Structure

### New files
- `shared/schemas/worker.ts` — Worker Zod schema
- `shared/engine/workerUtils.ts` — pure helper functions (mood, multiplier, discount, lookup)
- `shared/engine/__tests__/workerUtils.test.ts`
- `shared/config/workerNames.ts` — name pool + hair colors + generateRandomWorkers
- `src/components/HotelPanel.tsx` — bottom sheet overlay
- `src/components/WorkerCard.tsx` — collapsed/expanded resident card
- `src/components/WorkerAvatar.tsx` — parametric SVG avatar
- `src/components/JobPickerSheet.tsx` — slot picker for assigning workers

### Modified files
- `shared/schemas/command.ts` — add 3 worker command schemas
- `shared/schemas/gameState.ts` — add workers + hotelCapacity
- `shared/schemas/gameConfig.ts` — add FloorTypeConfigSchema, floorType on floors, hotelCapacity
- `shared/schemas/production.ts` — no change
- `shared/types/index.ts` — export new types
- `shared/config/gameConfig.ts` — expand productionTypes, add floorTypes map, pre-assign slot typeIds
- `shared/engine/processCommand.ts` — 3 new handlers + worker checks on buy/list/collect
- `shared/engine/__tests__/processCommand.test.ts` — update test config, add worker tests
- `shared/schemas/__tests__/schemas.test.ts` — add worker schema tests
- `src/stores/gameStore.ts` — worker actions, updated hydrate/reconcile
- `src/services/persistence.ts` — persist workers + hotelCapacity
- `src/components/TechnicalFloor.tsx` — add onPress to HotelFloor
- `src/components/FloorCard.tsx` — pass worker info to ProductionCard
- `src/components/ProductionCard.tsx` — locked state, worker indicator, discount/multiplier display
- `app/game.tsx` — hotel panel overlay, open/close state
- `server/prisma/schema.prisma` — Worker model, CommandLog optional fields
- `server/src/player/player.service.ts` — generate workers at registration
- `server/src/sync/sync.service.ts` — include workers in state reconstruction + persistence

---

### Task 1: Shared schemas, types & config expansion

**Files:**
- Modify: `shared/schemas/gameConfig.ts`
- Modify: `shared/schemas/command.ts`
- Modify: `shared/schemas/gameState.ts`
- Create: `shared/schemas/worker.ts`
- Modify: `shared/types/index.ts`
- Modify: `shared/config/gameConfig.ts`
- Create: `shared/config/workerNames.ts`
- Modify: `shared/schemas/__tests__/schemas.test.ts`
- Modify: `shared/config/__tests__/gameConfig.test.ts`

**Interfaces:**
- Consumes: existing Zod schemas
- Produces: `WorkerSchema`, `Worker` type, `FloorTypeConfig` type, updated `GameState` (with `workers: Worker[]`, `hotelCapacity: number`), updated `Command` union (with `assign_worker`, `fire_worker`, `evict_worker`), updated `GameConfig` (with `floorTypes`, `hotelCapacity`), `generateRandomWorkers(count, config): Worker[]`, updated `createInitialState(config): GameState`

- [ ] **Step 1: Create worker schema**

Create `shared/schemas/worker.ts`:

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
});
```

- [ ] **Step 2: Update gameConfig schema**

In `shared/schemas/gameConfig.ts`, add `FloorTypeConfigSchema`, add `floorType` to `FloorConfigSchema`, add `floorTypes` and `hotelCapacity` to `GameConfigSchema`:

```ts
import { z } from 'zod';

export const ProductionTypeConfigSchema = z.object({
  buyCost: z.number().positive(),
  deliveryDuration: z.number().positive(),
  sellDuration: z.number().positive(),
  batchValue: z.number().positive(),
  displayName: z.string(),
});

export const FloorTypeConfigSchema = z.object({
  category: z.string(),
  shirtColor: z.string(),
  accent: z.string(),
  dreamJobs: z.array(z.string()).min(1),
});

export const FloorConfigSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  slots: z.number().int().min(1).max(3),
  floorType: z.string(),
  availableTypes: z.array(z.string()).min(1),
});

export const GameConfigSchema = z.object({
  floors: z.array(FloorConfigSchema).min(1),
  productionTypes: z.record(z.string(), ProductionTypeConfigSchema),
  floorTypes: z.record(z.string(), FloorTypeConfigSchema),
  startingBalance: z.number().nonnegative(),
  hotelCapacity: z.number().int().positive(),
});
```

- [ ] **Step 3: Update command schema**

Replace `shared/schemas/command.ts` — split into production base and worker base, add 3 new command types:

```ts
import { z } from 'zod';

const ProductionBaseSchema = z.object({
  id: z.string(),
  floorId: z.number().int(),
  slotIdx: z.number().int(),
  timestamp: z.number(),
});

export const BuyCommandSchema = ProductionBaseSchema.extend({
  type: z.literal('buy'),
  typeId: z.string(),
});

export const ListCommandSchema = ProductionBaseSchema.extend({
  type: z.literal('list'),
});

export const CollectCommandSchema = ProductionBaseSchema.extend({
  type: z.literal('collect'),
});

export const AssignWorkerCommandSchema = z.object({
  id: z.string(),
  type: z.literal('assign_worker'),
  workerId: z.string(),
  floorId: z.number().int(),
  slotIdx: z.number().int(),
  timestamp: z.number(),
});

export const FireWorkerCommandSchema = z.object({
  id: z.string(),
  type: z.literal('fire_worker'),
  workerId: z.string(),
  timestamp: z.number(),
});

export const EvictWorkerCommandSchema = z.object({
  id: z.string(),
  type: z.literal('evict_worker'),
  workerId: z.string(),
  timestamp: z.number(),
});

export const CommandSchema = z.discriminatedUnion('type', [
  BuyCommandSchema,
  ListCommandSchema,
  CollectCommandSchema,
  AssignWorkerCommandSchema,
  FireWorkerCommandSchema,
  EvictWorkerCommandSchema,
]);
```

- [ ] **Step 4: Update GameState schema**

In `shared/schemas/gameState.ts`, add workers and hotelCapacity:

```ts
import { z } from 'zod';
import { ProductionSchema } from './production';
import { CommandSchema } from './command';
import { WorkerSchema } from './worker';

export const FloorStateSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  productions: z.array(ProductionSchema).min(1).max(3),
});

export const GameStateSchema = z.object({
  balance: z.number().nonnegative(),
  floors: z.array(FloorStateSchema).min(1),
  commandQueue: z.array(CommandSchema),
  workers: z.array(WorkerSchema),
  hotelCapacity: z.number().int().positive(),
});
```

- [ ] **Step 5: Update types/index.ts**

Add new type exports:

```ts
import { z } from 'zod';
import { ProductionStageSchema, ProductionSchema } from '../schemas/production';
import { CommandSchema, BuyCommandSchema, ListCommandSchema, CollectCommandSchema, AssignWorkerCommandSchema, FireWorkerCommandSchema, EvictWorkerCommandSchema } from '../schemas/command';
import { GameConfigSchema, FloorConfigSchema, ProductionTypeConfigSchema, FloorTypeConfigSchema } from '../schemas/gameConfig';
import { GameStateSchema } from '../schemas/gameState';
import { WorkerSchema } from '../schemas/worker';

export type ProductionStage = z.infer<typeof ProductionStageSchema>;
export type Production = z.infer<typeof ProductionSchema>;
export type Command = z.infer<typeof CommandSchema>;
export type BuyCommand = z.infer<typeof BuyCommandSchema>;
export type ListCommand = z.infer<typeof ListCommandSchema>;
export type CollectCommand = z.infer<typeof CollectCommandSchema>;
export type AssignWorkerCommand = z.infer<typeof AssignWorkerCommandSchema>;
export type FireWorkerCommand = z.infer<typeof FireWorkerCommandSchema>;
export type EvictWorkerCommand = z.infer<typeof EvictWorkerCommandSchema>;
export type GameConfig = z.infer<typeof GameConfigSchema>;
export type FloorConfig = z.infer<typeof FloorConfigSchema>;
export type ProductionTypeConfig = z.infer<typeof ProductionTypeConfigSchema>;
export type FloorTypeConfig = z.infer<typeof FloorTypeConfigSchema>;
export type GameState = z.infer<typeof GameStateSchema>;
export type Worker = z.infer<typeof WorkerSchema>;

export interface Floor {
  id: number;
  name: string;
  productions: Production[];
}

export type EffectiveStage = ProductionStage | 'EMPTY';

export interface DerivedStatus {
  effectiveStage: EffectiveStage;
  timeRemaining: number;
  canAct: boolean;
  actionLabel: string | null;
}
```

- [ ] **Step 6: Create worker name pool and generator**

Create `shared/config/workerNames.ts`:

```ts
import type { GameConfig, Worker } from '../types';

export const WORKER_NAMES = {
  male: [
    'Коля Некрасов', 'Дима Громов', 'Миша Шевчук', 'Андрій Семенов',
    'Ваня Вайнер', 'Олег Кравченко', 'Тарас Мельник', 'Богдан Ткаченко',
    'Роман Бондаренко', 'Ігор Шевченко',
  ],
  female: [
    'Надя Бєлкіна', 'Саша Яшина', 'Маша Громова', 'Ірина Коваль',
    'Оля Петренко', 'Юля Сидоренко', 'Аня Лисенко', 'Катя Бойко',
    'Даша Коваленко', 'Віка Мороз',
  ],
};

export const HAIR_COLORS = [
  '#5C3A22', '#E0A93C', '#C9923A', '#4A3322',
  '#6B4A2E', '#7A5430', '#D8A24A', '#B5763A',
];

export function generateRandomWorkers(count: number, config: GameConfig): Worker[] {
  const floorTypeKeys = Object.keys(config.floorTypes);
  const workers: Worker[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < count; i++) {
    const female = Math.random() < 0.5;
    const namePool = female ? WORKER_NAMES.female : WORKER_NAMES.male;
    let name: string;
    do {
      name = namePool[Math.floor(Math.random() * namePool.length)];
    } while (usedNames.has(name));
    usedNames.add(name);

    const floorType = floorTypeKeys[Math.floor(Math.random() * floorTypeKeys.length)];
    const ftConfig = config.floorTypes[floorType];
    const dreamJob = ftConfig.dreamJobs[Math.floor(Math.random() * ftConfig.dreamJobs.length)];

    workers.push({
      id: crypto.randomUUID(),
      name,
      female,
      floorType,
      dreamJob,
      level: 1 + Math.floor(Math.random() * 9),
      hairColor: HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)],
      assignedFloorId: null,
      assignedSlotIdx: null,
    });
  }

  return workers;
}
```

- [ ] **Step 7: Update gameConfig.ts**

Replace `shared/config/gameConfig.ts` with expanded config — 9 production types (3 per built floor), 5 floor types, pre-assigned slot typeIds, hotelCapacity. `createInitialState` returns empty workers (server generates them at registration):

```ts
import { GameConfigSchema } from '../schemas/gameConfig';
import type { GameConfig, GameState, Floor } from '../types';

const rawConfig = {
  floorTypes: {
    green:  { category: 'Кондитерська', shirtColor: '#62B23F', accent: '#4E9A2E', dreamJobs: ['bulky', 'cupcake', 'cake'] },
    teal:   { category: 'Пральня',     shirtColor: '#36AE9C', accent: '#1F8979', dreamJobs: ['wash', 'dry', 'bleach'] },
    amber:  { category: "Кав'ярня",    shirtColor: '#E7A21E', accent: '#B07F12', dreamJobs: ['coffee', 'pancake', 'dessert'] },
    purple: { category: 'Парфумерія',  shirtColor: '#9A6FD0', accent: '#7B52BC', dreamJobs: ['aroma', 'soap', 'candle'] },
    blue:   { category: 'Морозиво',    shirtColor: '#4C9BDD', accent: '#2E78B5', dreamJobs: ['icecream', 'shake', 'sorbet'] },
  },
  floors: [
    { id: 2, name: 'Кондитерська', slots: 3, floorType: 'green', availableTypes: ['bulky', 'cupcake', 'cake'] },
    { id: 3, name: 'Пральня',     slots: 3, floorType: 'teal',  availableTypes: ['wash', 'dry', 'bleach'] },
    { id: 4, name: "Кав'ярня",    slots: 3, floorType: 'amber', availableTypes: ['coffee', 'pancake', 'dessert'] },
  ],
  productionTypes: {
    bulky:    { buyCost: 10,  deliveryDuration: 5000,  sellDuration: 10000, batchValue: 25,  displayName: 'Булки' },
    cupcake:  { buyCost: 15,  deliveryDuration: 8000,  sellDuration: 12000, batchValue: 35,  displayName: 'Пирожені' },
    cake:     { buyCost: 25,  deliveryDuration: 12000, sellDuration: 15000, batchValue: 60,  displayName: 'Торти' },
    wash:     { buyCost: 30,  deliveryDuration: 10000, sellDuration: 15000, batchValue: 70,  displayName: 'Прання' },
    dry:      { buyCost: 40,  deliveryDuration: 15000, sellDuration: 20000, batchValue: 90,  displayName: 'Сушка' },
    bleach:   { buyCost: 50,  deliveryDuration: 20000, sellDuration: 25000, batchValue: 120, displayName: 'Відбілювання' },
    coffee:   { buyCost: 20,  deliveryDuration: 8000,  sellDuration: 12000, batchValue: 50,  displayName: 'Кава' },
    pancake:  { buyCost: 35,  deliveryDuration: 12000, sellDuration: 18000, batchValue: 80,  displayName: 'Млинці' },
    dessert:  { buyCost: 45,  deliveryDuration: 18000, sellDuration: 22000, batchValue: 110, displayName: 'Десерти' },
  },
  startingBalance: 1000,
  hotelCapacity: 10,
} satisfies GameConfig;

export const gameConfig: GameConfig = GameConfigSchema.parse(rawConfig);

export function createInitialState(config: GameConfig): GameState {
  return {
    balance: config.startingBalance,
    floors: config.floors.map((floorConfig): Floor => ({
      id: floorConfig.id,
      name: floorConfig.name,
      productions: floorConfig.availableTypes.map((typeId) => ({
        typeId,
        stage: 'IDLE' as const,
        stageStartedAt: 0,
      })),
    })),
    commandQueue: [],
    workers: [],
    hotelCapacity: config.hotelCapacity,
  };
}
```

- [ ] **Step 8: Update existing schema tests**

Update `shared/schemas/__tests__/schemas.test.ts` — add test config fields (`floorTypes`, `hotelCapacity`, `floorType` on floors, `displayName` on production types), add worker schema tests. Update `shared/config/__tests__/gameConfig.test.ts` to match new config shape and verify `createInitialState` returns pre-assigned typeIds and empty workers.

- [ ] **Step 9: Run tests**

Run: `npm test -- --testPathPattern='shared/' --verbose`

Expected: all schema and config tests pass. Some `processCommand` tests may need `workers: []` and `hotelCapacity: 10` added to their test configs — fix any failures by updating the test config to include the new required fields.

- [ ] **Step 10: Commit**

```bash
git add shared/schemas/worker.ts shared/config/workerNames.ts shared/schemas/command.ts shared/schemas/gameConfig.ts shared/schemas/gameState.ts shared/types/index.ts shared/config/gameConfig.ts shared/schemas/__tests__/schemas.test.ts shared/config/__tests__/gameConfig.test.ts
git commit -m "feat: worker schema, floor types config, expanded production types"
```

---

### Task 2: Worker utility functions

**Files:**
- Create: `shared/engine/workerUtils.ts`
- Create: `shared/engine/__tests__/workerUtils.test.ts`

**Interfaces:**
- Consumes: `Worker`, `GameConfig` types from Task 1
- Produces: `getWorkerForSlot(workers, floorId, slotIdx): Worker | undefined`, `getFloorDiscount(workers, floorId): number`, `getRevenueMultiplier(worker, floorType, slotTypeId): number`, `getWorkerMood(worker, floorType, slotTypeId): 'good' | 'mid' | 'bad'`

- [ ] **Step 1: Write failing tests**

Create `shared/engine/__tests__/workerUtils.test.ts`:

```ts
import { getWorkerForSlot, getFloorDiscount, getRevenueMultiplier, getWorkerMood } from '../workerUtils';
import type { Worker } from '../../types';

function makeWorker(overrides?: Partial<Worker>): Worker {
  return {
    id: 'w1', name: 'Test', female: false, floorType: 'green',
    dreamJob: 'bulky', level: 5, hairColor: '#5C3A22',
    assignedFloorId: null, assignedSlotIdx: null,
    ...overrides,
  };
}

describe('getWorkerMood', () => {
  it('returns bad for unemployed worker', () => {
    expect(getWorkerMood(makeWorker(), null, null)).toBe('bad');
  });

  it('returns bad for worker on wrong floor type', () => {
    const w = makeWorker({ floorType: 'green', assignedFloorId: 1, assignedSlotIdx: 0 });
    expect(getWorkerMood(w, 'teal', 'wash')).toBe('bad');
  });

  it('returns mid for worker on matching floor type but wrong product', () => {
    const w = makeWorker({ floorType: 'green', dreamJob: 'bulky', assignedFloorId: 1, assignedSlotIdx: 0 });
    expect(getWorkerMood(w, 'green', 'cake')).toBe('mid');
  });

  it('returns good for worker on dream job', () => {
    const w = makeWorker({ floorType: 'green', dreamJob: 'bulky', assignedFloorId: 1, assignedSlotIdx: 0 });
    expect(getWorkerMood(w, 'green', 'bulky')).toBe('good');
  });
});

describe('getRevenueMultiplier', () => {
  it('returns 1.0 for wrong floor type', () => {
    const w = makeWorker({ floorType: 'green' });
    expect(getRevenueMultiplier(w, 'teal', 'wash')).toBe(1.0);
  });

  it('returns 1.3 for matching floor, wrong product', () => {
    const w = makeWorker({ floorType: 'green', dreamJob: 'bulky' });
    expect(getRevenueMultiplier(w, 'green', 'cake')).toBe(1.3);
  });

  it('returns 2.0 for dream job match', () => {
    const w = makeWorker({ floorType: 'green', dreamJob: 'bulky' });
    expect(getRevenueMultiplier(w, 'green', 'bulky')).toBe(2.0);
  });
});

describe('getFloorDiscount', () => {
  it('returns 0 for floor with no workers', () => {
    expect(getFloorDiscount([], 1)).toBe(0);
  });

  it('sums levels of all workers on floor', () => {
    const workers = [
      makeWorker({ id: 'w1', level: 3, assignedFloorId: 1, assignedSlotIdx: 0 }),
      makeWorker({ id: 'w2', level: 5, assignedFloorId: 1, assignedSlotIdx: 1 }),
      makeWorker({ id: 'w3', level: 7, assignedFloorId: 1, assignedSlotIdx: 2 }),
    ];
    expect(getFloorDiscount(workers, 1)).toBeCloseTo(0.15);
  });

  it('ignores workers on other floors', () => {
    const workers = [
      makeWorker({ id: 'w1', level: 9, assignedFloorId: 2, assignedSlotIdx: 0 }),
    ];
    expect(getFloorDiscount(workers, 1)).toBe(0);
  });
});

describe('getWorkerForSlot', () => {
  it('finds worker assigned to specific slot', () => {
    const w = makeWorker({ assignedFloorId: 1, assignedSlotIdx: 0 });
    expect(getWorkerForSlot([w], 1, 0)).toBe(w);
  });

  it('returns undefined for empty slot', () => {
    expect(getWorkerForSlot([], 1, 0)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern='workerUtils' --verbose`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement workerUtils.ts**

Create `shared/engine/workerUtils.ts`:

```ts
import type { Worker } from '../types';

export type WorkerMood = 'good' | 'mid' | 'bad';

export function getWorkerMood(
  worker: Worker,
  floorType: string | null,
  slotTypeId: string | null,
): WorkerMood {
  if (worker.assignedFloorId === null) return 'bad';
  if (floorType !== worker.floorType) return 'bad';
  if (slotTypeId === worker.dreamJob) return 'good';
  return 'mid';
}

export function getRevenueMultiplier(
  worker: Worker,
  floorType: string,
  slotTypeId: string | null,
): number {
  const mood = getWorkerMood(worker, floorType, slotTypeId);
  switch (mood) {
    case 'good': return 2.0;
    case 'mid': return 1.3;
    case 'bad': return 1.0;
  }
}

export function getFloorDiscount(workers: Worker[], floorId: number): number {
  let totalLevel = 0;
  for (const w of workers) {
    if (w.assignedFloorId === floorId) totalLevel += w.level;
  }
  return totalLevel * 0.01;
}

export function getWorkerForSlot(
  workers: Worker[],
  floorId: number,
  slotIdx: number,
): Worker | undefined {
  return workers.find(
    (w) => w.assignedFloorId === floorId && w.assignedSlotIdx === slotIdx,
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --testPathPattern='workerUtils' --verbose`

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/engine/workerUtils.ts shared/engine/__tests__/workerUtils.test.ts
git commit -m "feat: worker utility functions (mood, multiplier, discount, lookup)"
```

---

### Task 3: processCommand — worker commands + production worker checks

**Files:**
- Modify: `shared/engine/processCommand.ts`
- Modify: `shared/engine/__tests__/processCommand.test.ts`

**Interfaces:**
- Consumes: `getWorkerForSlot`, `getFloorDiscount`, `getRevenueMultiplier` from Task 2; `Worker`, `Command`, `GameState`, `GameConfig` types from Task 1
- Produces: updated `processCommand(state, command, config, now): ProcessResult` handling all 6 command types

- [ ] **Step 1: Update test config and helpers**

Update `shared/engine/__tests__/processCommand.test.ts` — add `floorTypes`, `hotelCapacity`, `floorType`, `displayName` to test config. Update `makeState` to include `workers: []` and `hotelCapacity: 10`. Add worker helper:

```ts
import type { GameState, GameConfig, Command, Worker } from '../../types';

const testConfig: GameConfig = {
  floorTypes: {
    green: { category: 'Test', shirtColor: '#62B23F', accent: '#4E9A2E', dreamJobs: ['coffee_shop', 'bookstore'] },
  },
  floors: [
    { id: 1, name: 'Floor 1', slots: 2, floorType: 'green', availableTypes: ['coffee_shop', 'bookstore'] },
  ],
  productionTypes: {
    coffee_shop: { buyCost: 10, deliveryDuration: 5000, sellDuration: 10000, batchValue: 25, displayName: 'Coffee' },
    bookstore: { buyCost: 50, deliveryDuration: 15000, sellDuration: 30000, batchValue: 120, displayName: 'Books' },
  },
  startingBalance: 100,
  hotelCapacity: 10,
};

function makeWorker(overrides?: Partial<Worker>): Worker {
  return {
    id: 'w1', name: 'Test', female: false, floorType: 'green',
    dreamJob: 'coffee_shop', level: 5, hairColor: '#5C3A22',
    assignedFloorId: null, assignedSlotIdx: null,
    ...overrides,
  };
}

function makeState(overrides?: Partial<GameState>): GameState {
  return { ...createInitialState(testConfig), ...overrides };
}

function stateWithWorker(slotIdx = 0): GameState {
  return makeState({
    workers: [makeWorker({ assignedFloorId: 1, assignedSlotIdx: slotIdx })],
  });
}
```

- [ ] **Step 2: Write failing tests for new worker commands**

Add to the test file:

```ts
function assignCmd(overrides?: Record<string, unknown>): Command {
  return { id: 'cmd-a', type: 'assign_worker', workerId: 'w1', floorId: 1, slotIdx: 0, timestamp: 1000, ...overrides } as Command;
}

function fireCmd(overrides?: Record<string, unknown>): Command {
  return { id: 'cmd-f', type: 'fire_worker', workerId: 'w1', timestamp: 1000, ...overrides } as Command;
}

function evictCmd(overrides?: Record<string, unknown>): Command {
  return { id: 'cmd-e', type: 'evict_worker', workerId: 'w1', timestamp: 1000, ...overrides } as Command;
}

describe('assign_worker command', () => {
  it('assigns unemployed worker to empty slot', () => {
    const state = makeState({ workers: [makeWorker()] });
    const result = processCommand(state, assignCmd(), testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.workers[0].assignedFloorId).toBe(1);
    expect(result.state.workers[0].assignedSlotIdx).toBe(0);
  });

  it('fails if worker is already assigned', () => {
    const state = makeState({
      workers: [makeWorker({ assignedFloorId: 1, assignedSlotIdx: 1 })],
    });
    const result = processCommand(state, assignCmd(), testConfig, 1000);
    expect(result.success).toBe(false);
  });

  it('fails if slot already has a worker', () => {
    const state = makeState({
      workers: [
        makeWorker({ id: 'w1' }),
        makeWorker({ id: 'w2', assignedFloorId: 1, assignedSlotIdx: 0 }),
      ],
    });
    const result = processCommand(state, assignCmd(), testConfig, 1000);
    expect(result.success).toBe(false);
  });

  it('fails if worker does not exist', () => {
    const state = makeState({ workers: [] });
    const result = processCommand(state, assignCmd(), testConfig, 1000);
    expect(result.success).toBe(false);
  });
});

describe('fire_worker command', () => {
  it('returns assigned worker to hotel when slot is IDLE', () => {
    const state = makeState({
      workers: [makeWorker({ assignedFloorId: 1, assignedSlotIdx: 0 })],
    });
    const result = processCommand(state, fireCmd(), testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.workers[0].assignedFloorId).toBeNull();
    expect(result.state.workers[0].assignedSlotIdx).toBeNull();
  });

  it('fails if slot is DELIVERING', () => {
    const state = makeState({
      workers: [makeWorker({ assignedFloorId: 1, assignedSlotIdx: 0 })],
    });
    state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 500 };
    const result = processCommand(state, fireCmd(), testConfig, 1000);
    expect(result.success).toBe(false);
  });

  it('fails if slot is SELLING', () => {
    const state = makeState({
      workers: [makeWorker({ assignedFloorId: 1, assignedSlotIdx: 0 })],
    });
    state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 500 };
    const result = processCommand(state, fireCmd(), testConfig, 1000);
    expect(result.success).toBe(false);
  });

  it('fails if worker is not assigned', () => {
    const state = makeState({ workers: [makeWorker()] });
    const result = processCommand(state, fireCmd(), testConfig, 1000);
    expect(result.success).toBe(false);
  });
});

describe('evict_worker command', () => {
  it('removes unemployed worker from state', () => {
    const state = makeState({ workers: [makeWorker()] });
    const result = processCommand(state, evictCmd(), testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.workers).toHaveLength(0);
  });

  it('fails if worker is assigned', () => {
    const state = makeState({
      workers: [makeWorker({ assignedFloorId: 1, assignedSlotIdx: 0 })],
    });
    const result = processCommand(state, evictCmd(), testConfig, 1000);
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 3: Write failing tests for worker checks on buy/list/collect**

Add to the test file:

```ts
describe('buy with worker checks', () => {
  it('fails if no worker on slot', () => {
    const state = makeState({ workers: [] });
    const result = processCommand(state, buyCmd(), testConfig, 1000);
    expect(result.success).toBe(false);
    expect(result.error).toBe('No worker assigned to slot');
  });

  it('applies floor discount from worker levels', () => {
    const state = makeState({
      workers: [
        makeWorker({ id: 'w1', level: 5, assignedFloorId: 1, assignedSlotIdx: 0 }),
        makeWorker({ id: 'w2', level: 5, assignedFloorId: 1, assignedSlotIdx: 1 }),
      ],
    });
    // buyCost=10, discount=(5+5)*1%=10%, effective=9
    const result = processCommand(state, buyCmd(), testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.balance).toBe(91); // 100 - 9
  });
});

describe('collect with worker multiplier', () => {
  it('applies 2x multiplier for dream job match', () => {
    const state = makeState({
      workers: [makeWorker({ floorType: 'green', dreamJob: 'coffee_shop', assignedFloorId: 1, assignedSlotIdx: 0 })],
    });
    state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 1000 };
    const result = processCommand(state, collectCmd({ timestamp: 12000 }), testConfig, 12000);
    expect(result.success).toBe(true);
    expect(result.state.balance).toBe(150); // 100 + 25*2
  });

  it('applies 1.3x multiplier for matching floor type', () => {
    const state = makeState({
      workers: [makeWorker({ floorType: 'green', dreamJob: 'bookstore', assignedFloorId: 1, assignedSlotIdx: 0 })],
    });
    state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 1000 };
    const result = processCommand(state, collectCmd({ timestamp: 12000 }), testConfig, 12000);
    expect(result.success).toBe(true);
    expect(result.state.balance).toBe(132); // 100 + floor(25*1.3) = 100 + 32
  });

  it('applies 1x multiplier for wrong floor type', () => {
    const state = makeState({
      workers: [makeWorker({ floorType: 'teal', assignedFloorId: 1, assignedSlotIdx: 0 })],
    });
    state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 1000 };
    const result = processCommand(state, collectCmd({ timestamp: 12000 }), testConfig, 12000);
    expect(result.success).toBe(true);
    expect(result.state.balance).toBe(125); // 100 + 25*1
  });

  it('fails if no worker on slot', () => {
    const state = makeState({ workers: [] });
    state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 1000 };
    const result = processCommand(state, collectCmd({ timestamp: 12000 }), testConfig, 12000);
    expect(result.success).toBe(false);
  });
});

describe('list with worker checks', () => {
  it('fails if no worker on slot', () => {
    const state = makeState({ workers: [] });
    state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 1000 };
    const result = processCommand(state, listCmd({ timestamp: 7000 }), testConfig, 7000);
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npm test -- --testPathPattern='processCommand' --verbose`

Expected: new tests FAIL (handlers not implemented yet).

- [ ] **Step 5: Implement processCommand changes**

Rewrite `shared/engine/processCommand.ts`:

```ts
import type { GameState, Command, GameConfig, Worker } from '../types';
import { getWorkerForSlot, getFloorDiscount, getRevenueMultiplier } from './workerUtils';

export interface ProcessResult {
  success: boolean;
  state: GameState;
  error?: string;
}

export function processCommand(
  state: GameState,
  command: Command,
  config: GameConfig,
  now: number,
): ProcessResult {
  switch (command.type) {
    case 'assign_worker':
      return handleAssignWorker(state, command);
    case 'fire_worker':
      return handleFireWorker(state, command);
    case 'evict_worker':
      return handleEvictWorker(state, command);
    case 'buy':
    case 'list':
    case 'collect':
      return processProductionCommand(state, command, config, now);
  }
}

function handleAssignWorker(
  state: GameState,
  command: Extract<Command, { type: 'assign_worker' }>,
): ProcessResult {
  const worker = state.workers.find((w) => w.id === command.workerId);
  if (!worker) return { success: false, state, error: 'Worker not found' };
  if (worker.assignedFloorId !== null) return { success: false, state, error: 'Worker already assigned' };

  const floorIdx = state.floors.findIndex((f) => f.id === command.floorId);
  if (floorIdx === -1) return { success: false, state, error: 'Floor not found' };
  if (!state.floors[floorIdx].productions[command.slotIdx]) return { success: false, state, error: 'Slot not found' };

  const existing = getWorkerForSlot(state.workers, command.floorId, command.slotIdx);
  if (existing) return { success: false, state, error: 'Slot already has a worker' };

  return {
    success: true,
    state: {
      ...state,
      workers: state.workers.map((w) =>
        w.id === command.workerId
          ? { ...w, assignedFloorId: command.floorId, assignedSlotIdx: command.slotIdx }
          : w,
      ),
    },
  };
}

function handleFireWorker(
  state: GameState,
  command: Extract<Command, { type: 'fire_worker' }>,
): ProcessResult {
  const worker = state.workers.find((w) => w.id === command.workerId);
  if (!worker) return { success: false, state, error: 'Worker not found' };
  if (worker.assignedFloorId === null) return { success: false, state, error: 'Worker is not assigned' };

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
      workers: state.workers.map((w) =>
        w.id === command.workerId
          ? { ...w, assignedFloorId: null, assignedSlotIdx: null }
          : w,
      ),
    },
  };
}

function handleEvictWorker(
  state: GameState,
  command: Extract<Command, { type: 'evict_worker' }>,
): ProcessResult {
  const worker = state.workers.find((w) => w.id === command.workerId);
  if (!worker) return { success: false, state, error: 'Worker not found' };
  if (worker.assignedFloorId !== null) return { success: false, state, error: 'Cannot evict assigned worker' };

  return {
    success: true,
    state: {
      ...state,
      workers: state.workers.filter((w) => w.id !== command.workerId),
    },
  };
}

function processProductionCommand(
  state: GameState,
  command: Extract<Command, { type: 'buy' | 'list' | 'collect' }>,
  config: GameConfig,
  now: number,
): ProcessResult {
  const floorIdx = state.floors.findIndex((f) => f.id === command.floorId);
  if (floorIdx === -1) return { success: false, state, error: 'Floor not found' };

  const floor = state.floors[floorIdx];
  const production = floor.productions[command.slotIdx];
  if (!production) return { success: false, state, error: 'Slot not found' };

  const worker = getWorkerForSlot(state.workers, command.floorId, command.slotIdx);
  if (!worker) return { success: false, state, error: 'No worker assigned to slot' };

  switch (command.type) {
    case 'buy':
      return handleBuy(state, command, config, now, floorIdx, command.slotIdx, production, worker);
    case 'list':
      return handleList(state, config, now, floorIdx, command.slotIdx, production);
    case 'collect':
      return handleCollect(state, config, now, floorIdx, command.slotIdx, production, worker);
  }
}

function handleBuy(
  state: GameState,
  command: Extract<Command, { type: 'buy' }>,
  config: GameConfig,
  now: number,
  floorIdx: number,
  slotIdx: number,
  production: GameState['floors'][0]['productions'][0],
  worker: Worker,
): ProcessResult {
  if (production.stage !== 'IDLE') {
    return { success: false, state, error: 'Production not idle' };
  }

  if (production.typeId !== null && production.typeId !== command.typeId) {
    return { success: false, state, error: 'Cannot change production type' };
  }

  const typeConfig = config.productionTypes[command.typeId];
  if (!typeConfig) return { success: false, state, error: 'Unknown production type' };

  const floorConfig = config.floors.find((f) => f.id === state.floors[floorIdx].id);
  if (!floorConfig || !floorConfig.availableTypes.includes(command.typeId)) {
    return { success: false, state, error: 'Type not available on this floor' };
  }

  const discount = getFloorDiscount(state.workers, command.floorId);
  const effectiveCost = Math.floor(typeConfig.buyCost * (1 - discount));

  if (state.balance < effectiveCost) {
    return { success: false, state, error: 'Insufficient balance' };
  }

  return {
    success: true,
    state: {
      ...state,
      balance: state.balance - effectiveCost,
      floors: updateProduction(state.floors, floorIdx, slotIdx, {
        typeId: command.typeId,
        stage: 'DELIVERING',
        stageStartedAt: now,
      }),
    },
  };
}

function handleList(
  state: GameState,
  config: GameConfig,
  now: number,
  floorIdx: number,
  slotIdx: number,
  production: GameState['floors'][0]['productions'][0],
): ProcessResult {
  if (production.stage !== 'DELIVERING') {
    return { success: false, state, error: 'Production not delivering' };
  }

  if (!production.typeId) return { success: false, state, error: 'No type assigned' };

  const typeConfig = config.productionTypes[production.typeId];
  if (!typeConfig) return { success: false, state, error: 'Unknown production type' };

  if (now - production.stageStartedAt < typeConfig.deliveryDuration) {
    return { success: false, state, error: 'Delivery not complete' };
  }

  return {
    success: true,
    state: {
      ...state,
      floors: updateProduction(state.floors, floorIdx, slotIdx, {
        ...production,
        stage: 'SELLING',
        stageStartedAt: now,
      }),
    },
  };
}

function handleCollect(
  state: GameState,
  config: GameConfig,
  now: number,
  floorIdx: number,
  slotIdx: number,
  production: GameState['floors'][0]['productions'][0],
  worker: Worker,
): ProcessResult {
  if (production.stage !== 'SELLING') {
    return { success: false, state, error: 'Production not selling' };
  }

  if (!production.typeId) return { success: false, state, error: 'No type assigned' };

  const typeConfig = config.productionTypes[production.typeId];
  if (!typeConfig) return { success: false, state, error: 'Unknown production type' };

  if (now - production.stageStartedAt < typeConfig.sellDuration) {
    return { success: false, state, error: 'Sale not complete' };
  }

  const floorConfig = config.floors.find((f) => f.id === state.floors[floorIdx].id);
  const floorType = floorConfig?.floorType ?? '';
  const multiplier = getRevenueMultiplier(worker, floorType, production.typeId);
  const revenue = Math.floor(typeConfig.batchValue * multiplier);

  return {
    success: true,
    state: {
      ...state,
      balance: state.balance + revenue,
      floors: updateProduction(state.floors, floorIdx, slotIdx, {
        typeId: production.typeId,
        stage: 'IDLE',
        stageStartedAt: 0,
      }),
    },
  };
}

function updateProduction(
  floors: GameState['floors'],
  floorIdx: number,
  slotIdx: number,
  newProduction: GameState['floors'][0]['productions'][0],
): GameState['floors'] {
  return floors.map((floor, fi) => {
    if (fi !== floorIdx) return floor;
    return {
      ...floor,
      productions: floor.productions.map((prod, si) => {
        if (si !== slotIdx) return prod;
        return newProduction;
      }),
    };
  });
}
```

- [ ] **Step 6: Fix existing buy/list/collect tests**

Existing tests that test buy/list/collect need workers assigned to the slot. Update `makeState` calls in existing tests to use `stateWithWorker()` or add workers to overrides. Example — update the first buy test:

```ts
it('succeeds on IDLE slot with sufficient balance', () => {
  const state = stateWithWorker();
  const result = processCommand(state, buyCmd(), testConfig, 1000);
  expect(result.success).toBe(true);
  expect(result.state.floors[0].productions[0].stage).toBe('DELIVERING');
});
```

Apply the same pattern to all existing buy/list/collect tests — they need a worker on the slot they're operating on.

- [ ] **Step 7: Run all tests**

Run: `npm test -- --testPathPattern='shared/' --verbose`

Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add shared/engine/processCommand.ts shared/engine/__tests__/processCommand.test.ts
git commit -m "feat: worker commands + worker checks on buy/list/collect"
```

---

### Task 4: Client store + persistence

**Files:**
- Modify: `src/stores/gameStore.ts`
- Modify: `src/services/persistence.ts`

**Interfaces:**
- Consumes: `Worker`, `Command`, `GameState` types, `processCommand` from Task 3
- Produces: `assignWorker(workerId, floorId, slotIdx)`, `fireWorker(workerId)`, `evictWorker(workerId)` store actions; persistence includes workers + hotelCapacity

- [ ] **Step 1: Update gameStore.ts**

Add worker actions and update hydrate/reconcile to include workers + hotelCapacity:

```ts
// Add to GameActions interface:
assignWorker: (workerId: string, floorId: number, slotIdx: number) => void;
fireWorker: (workerId: string) => void;
evictWorker: (workerId: string) => void;

// Add to store initial state (after existing fields):
workers: [],
hotelCapacity: 10,

// Add action implementations:
assignWorker: (workerId, floorId, slotIdx) => {
  executeCommand(get, set, {
    id: crypto.randomUUID(),
    type: 'assign_worker',
    workerId,
    floorId,
    slotIdx,
    timestamp: clock.now(),
  });
},

fireWorker: (workerId) => {
  executeCommand(get, set, {
    id: crypto.randomUUID(),
    type: 'fire_worker',
    workerId,
    timestamp: clock.now(),
  });
},

evictWorker: (workerId) => {
  executeCommand(get, set, {
    id: crypto.randomUUID(),
    type: 'evict_worker',
    workerId,
    timestamp: clock.now(),
  });
},
```

Update `hydrate` to include workers and hotelCapacity:

```ts
hydrate: (state) => set({
  balance: state.balance,
  floors: state.floors,
  commandQueue: state.commandQueue,
  workers: state.workers ?? [],
  hotelCapacity: state.hotelCapacity ?? 10,
  lastAckCursor: state.lastAckCursor ?? 0,
  stateVersion: state.stateVersion ?? 0,
}),
```

Update `reconcile`:

```ts
reconcile: (serverState, newVersion, ackCursor) => set({
  balance: serverState.balance,
  floors: serverState.floors,
  workers: serverState.workers,
  hotelCapacity: serverState.hotelCapacity,
  stateVersion: newVersion,
  lastAckCursor: ackCursor,
  commandQueue: [],
}),
```

Update the `GameStore` type to include `workers: Worker[]` and `hotelCapacity: number`.

Update `executeCommand` — for worker commands, the state update includes `workers`:

```ts
function executeCommand(
  get: () => GameStore,
  set: (partial: Partial<GameStore>) => void,
  command: Command,
) {
  const { balance, floors, commandQueue, workers, hotelCapacity } = get();
  const result = processCommand({ balance, floors, commandQueue, workers, hotelCapacity }, command, gameConfig, command.timestamp);
  if (!result.success) return;

  let newQueue = [...result.state.commandQueue, command];
  if (newQueue.length > COMMAND_QUEUE_CAP) {
    newQueue = newQueue.slice(newQueue.length - COMMAND_QUEUE_CAP);
  }

  set({
    balance: result.state.balance,
    floors: result.state.floors,
    workers: result.state.workers,
    hotelCapacity: result.state.hotelCapacity,
    commandQueue: newQueue,
  });
}
```

- [ ] **Step 2: Update persistence.ts**

In `saveGameState`, add workers and hotelCapacity:

```ts
export function saveGameState(state: PersistedGameState): void {
  getStorage().set(GAME_STATE_KEY, JSON.stringify({
    balance: state.balance,
    floors: state.floors,
    commandQueue: state.commandQueue,
    workers: state.workers ?? [],
    hotelCapacity: state.hotelCapacity ?? 10,
    lastAckCursor: state.lastAckCursor ?? 0,
    stateVersion: state.stateVersion ?? 0,
  }));
}
```

Update `PersistedGameState` and `loadGameState` to include workers + hotelCapacity, with fallback defaults for backward compat.

- [ ] **Step 3: Run tests**

Run: `npm test --verbose`

Expected: all PASS. The store tests should still pass with the added fields.

- [ ] **Step 4: Commit**

```bash
git add src/stores/gameStore.ts src/services/persistence.ts
git commit -m "feat: worker actions in game store + persistence"
```

---

### Task 5: Server — Prisma, player service, sync service

**Files:**
- Modify: `server/prisma/schema.prisma`
- Modify: `server/src/player/player.service.ts`
- Modify: `server/src/sync/sync.service.ts`

**Interfaces:**
- Consumes: `generateRandomWorkers` from Task 1, `gameConfig` with new shape, `GameState` with workers
- Produces: Worker rows created at registration, workers included in sync state, worker commands logged

- [ ] **Step 1: Update Prisma schema**

Add Worker model and update CommandLog:

```prisma
model Player {
  id            String    @id @default(uuid())
  email         String    @unique
  passwordHash  String
  playerName    String
  balance       Int       @default(100)
  stateVersion  Int       @default(0)
  lastSeenAt    DateTime  @default(now())
  createdAt     DateTime  @default(now())
  floors        Floor[]
  workers       Worker[]
}

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

model CommandLog {
  id          String   @id
  playerId    String
  type        String
  floorId     Int?
  slotIdx     Int?
  typeId      String?
  workerId    String?
  timestamp   BigInt
  serverTime  BigInt
  cursor      Int      @default(autoincrement())
  processedAt DateTime @default(now())

  @@index([playerId, cursor])
}
```

Note: `floorId` and `slotIdx` on CommandLog changed from `Int` to `Int?` for worker commands that don't have them.

- [ ] **Step 2: Run migration**

```bash
cd server && npx prisma migrate dev --name add-workers
```

- [ ] **Step 3: Update PlayerService**

In `server/src/player/player.service.ts`, import `generateRandomWorkers` and create workers at registration:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { gameConfig } from '@shared/config/gameConfig';
import { generateRandomWorkers } from '@shared/config/workerNames';

@Injectable()
export class PlayerService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.player.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.prisma.player.findUnique({ where: { id } });
  }

  async createWithInitialState(email: string, passwordHash: string, playerName: string) {
    const workers = generateRandomWorkers(5, gameConfig);

    return this.prisma.$transaction(async (tx) => {
      const player = await tx.player.create({
        data: {
          email,
          passwordHash,
          playerName,
          balance: gameConfig.startingBalance,
        },
      });

      for (const floorConfig of gameConfig.floors) {
        const floor = await tx.floor.create({
          data: { playerId: player.id, floorId: floorConfig.id },
        });

        const productions = floorConfig.availableTypes.map((typeId, i) => ({
          floorDbId: floor.id,
          slotIdx: i,
          typeId,
          stage: 'IDLE',
          stageStartedAt: BigInt(0),
        }));

        await tx.production.createMany({ data: productions });
      }

      for (const w of workers) {
        await tx.worker.create({
          data: {
            id: w.id,
            playerId: player.id,
            name: w.name,
            female: w.female,
            floorType: w.floorType,
            dreamJob: w.dreamJob,
            level: w.level,
            hairColor: w.hairColor,
            assignedFloorId: w.assignedFloorId,
            assignedSlotIdx: w.assignedSlotIdx,
          },
        });
      }

      return player;
    });
  }
}
```

- [ ] **Step 4: Update SyncService**

Update `dbToGameState` to include workers. Update the persist transaction to save worker state changes. Update CommandLog creation to handle worker commands (optional floorId/slotIdx, workerId):

In `dbToGameState`, add workers query and mapping:

```ts
private dbToGameState(player: any): GameState {
  const floors: Floor[] = player.floors.map((f: any) => ({
    id: f.floorId,
    name: gameConfig.floors.find((gc) => gc.id === f.floorId)?.name ?? `Floor ${f.floorId}`,
    productions: f.productions.map((p: any): Production => ({
      typeId: p.typeId,
      stage: p.stage as any,
      stageStartedAt: Number(p.stageStartedAt),
    })),
  }));

  const workers: Worker[] = (player.workers || []).map((w: any): Worker => ({
    id: w.id,
    name: w.name,
    female: w.female,
    floorType: w.floorType,
    dreamJob: w.dreamJob,
    level: w.level,
    hairColor: w.hairColor,
    assignedFloorId: w.assignedFloorId,
    assignedSlotIdx: w.assignedSlotIdx,
  }));

  return {
    balance: player.balance,
    floors,
    commandQueue: [],
    workers,
    hotelCapacity: gameConfig.hotelCapacity,
  };
}
```

Update the player query in `processSync` to include workers:

```ts
const player = await this.prisma.player.findUnique({
  where: { id: playerId },
  include: {
    floors: {
      include: { productions: { orderBy: { slotIdx: 'asc' } } },
      orderBy: { floorId: 'asc' },
    },
    workers: true,
  },
});
```

In the persist transaction, add worker state updates after production updates:

```ts
// Persist worker state
for (const w of gameState.workers) {
  await tx.worker.upsert({
    where: { id: w.id },
    update: {
      assignedFloorId: w.assignedFloorId,
      assignedSlotIdx: w.assignedSlotIdx,
    },
    create: {
      id: w.id,
      playerId,
      name: w.name,
      female: w.female,
      floorType: w.floorType,
      dreamJob: w.dreamJob,
      level: w.level,
      hairColor: w.hairColor,
      assignedFloorId: w.assignedFloorId,
      assignedSlotIdx: w.assignedSlotIdx,
    },
  });
}

// Delete evicted workers
const currentWorkerIds = gameState.workers.map((w) => w.id);
const dbWorkerIds = player.workers.map((w: any) => w.id);
const evictedIds = dbWorkerIds.filter((id: string) => !currentWorkerIds.includes(id));
if (evictedIds.length > 0) {
  await tx.worker.deleteMany({ where: { id: { in: evictedIds } } });
}
```

Update CommandLog creation for worker commands:

```ts
for (const cmd of acceptedCommands) {
  const logEntry = await tx.commandLog.create({
    data: {
      id: cmd.id,
      playerId,
      type: cmd.type,
      floorId: 'floorId' in cmd ? cmd.floorId : null,
      slotIdx: 'slotIdx' in cmd ? cmd.slotIdx : null,
      typeId: cmd.type === 'buy' ? (cmd as any).typeId : null,
      workerId: 'workerId' in cmd ? (cmd as any).workerId : null,
      timestamp: BigInt(cmd.timestamp),
      serverTime: BigInt(serverNow),
    },
  });
  ackCursor = logEntry.cursor;
}
```

- [ ] **Step 5: Build and verify**

```bash
cd server && npm run build
```

Expected: compiles without errors.

- [ ] **Step 6: Commit**

```bash
git add server/prisma/schema.prisma server/src/player/player.service.ts server/src/sync/sync.service.ts
git commit -m "feat: server worker model, registration, sync"
```

---

### Task 6: UI — WorkerAvatar + Hotel Panel + WorkerCard

**Files:**
- Create: `src/components/WorkerAvatar.tsx`
- Create: `src/components/WorkerCard.tsx`
- Create: `src/components/HotelPanel.tsx`
- Modify: `src/components/TechnicalFloor.tsx`
- Modify: `app/game.tsx`

**Interfaces:**
- Consumes: `Worker` type, `gameConfig.floorTypes`, `getWorkerMood` from workerUtils, `evictWorker` store action
- Produces: `<HotelPanel visible={boolean} onClose={fn} />` component, `<WorkerAvatar worker={Worker} size={number} />` component

- [ ] **Step 1: Create WorkerAvatar component**

Create `src/components/WorkerAvatar.tsx` — a parametric SVG avatar. Props: `worker: Worker`, `size: number` (default 60). Uses `react-native-svg`. Shirt color from `gameConfig.floorTypes[worker.floorType].shirtColor`. Side hair only when `worker.female`. Skin `#F0C49C`. ViewBox 64×64 matching the design spec exactly (see section "Avatar tile" in `assets/hotel design/README.md`).

- [ ] **Step 2: Create WorkerCard component**

Create `src/components/WorkerCard.tsx` — collapsed/expanded resident card. Props: `worker: Worker`, `expanded: boolean`, `onToggle: fn`, `onFindJob: fn`, `onEvict: fn`. Uses Reanimated for accordion animation (maxHeight + opacity). Layout matches the design pixel-accurately:
- Collapsed: avatar + name/mood dot + dream job text + status + level/chevron
- Expanded: info rows (Навичка, Робота мрії, Працює, Проживає) + "Знайти роботу" button (green gradient) + "Виселити" button (red gradient) + hint text
- Mood dot color computed via `getWorkerMood(worker, floorType, slotTypeId)` where floorType/slotTypeId come from the worker's current assignment (or null if unemployed)
- Dream job display name from `gameConfig.productionTypes[worker.dreamJob].displayName`
- Category name from `gameConfig.floorTypes[worker.floorType].category`
- Status text: unemployed → "Безробітний"/"Безробітна" based on `worker.female`

- [ ] **Step 3: Create HotelPanel component**

Create `src/components/HotelPanel.tsx` — bottom sheet overlay. Props: `visible: boolean`, `onClose: fn`. Uses Reanimated for slide-up animation (translateY). Layout matches design:
- Scrim: `rgba(18,26,44,0.5)`, tap to close
- Sheet: slides from bottom, rounded top corners 26px, bg `#EAEDF2`
- Header: gradient `#6C7C92 → #56657C`, drag handle, title "ГОТЕЛЬ", subtitle, close button, stats pills (Місць/Вільно)
- List: `FlatList` of unemployed workers (`worker.assignedFloorId === null`), each rendered as `<WorkerCard>`
- Accordion state: `expandedWorkerId: string | null` (only one open at a time)
- "Виселити" shows `Alert.alert` confirmation before calling `evictWorker`
- "Знайти роботу" opens the Job Picker (Task 7) — for now pass a placeholder `onFindJob` prop

- [ ] **Step 4: Make HotelFloor tappable**

In `src/components/TechnicalFloor.tsx`, add `onPress` prop to `HotelFloor`. Wrap the hotel card body in a `Pressable`:

```tsx
interface HotelFloorProps {
  hotelOccupied: number;
  hotelTotal: number;
  onPress?: () => void;
}

export function HotelFloor({ hotelOccupied, hotelTotal, onPress }: HotelFloorProps) {
  return (
    <Pressable onPress={onPress}>
      {/* existing hotel floor content */}
    </Pressable>
  );
}
```

- [ ] **Step 5: Integrate HotelPanel in game screen**

In `app/game.tsx`:
- Add `hotelOpen` state: `const [hotelOpen, setHotelOpen] = useState(false)`
- Pass `onPress={() => setHotelOpen(true)}` to `HotelFloor`
- Render `<HotelPanel visible={hotelOpen} onClose={() => setHotelOpen(false)} />` as an overlay after the main content
- Update `hotelOccupied` and `hotelTotal` — derive from store: `hotelTotal = gameConfig.hotelCapacity`, `hotelOccupied = workers.filter(w => w.assignedFloorId === null).length`

- [ ] **Step 6: Test on device/simulator**

Run: `npm start` → open on iOS simulator or device.

Verify:
- Tapping hotel floor opens the panel with slide-up animation
- Scrim is visible, tapping it closes the panel
- Worker cards show with correct avatars, names, mood dots, levels
- Tapping a card expands it (accordion)
- "Виселити" shows confirmation dialog, removes worker on confirm
- Stats pills show correct counts

- [ ] **Step 7: Commit**

```bash
git add src/components/WorkerAvatar.tsx src/components/WorkerCard.tsx src/components/HotelPanel.tsx src/components/TechnicalFloor.tsx app/game.tsx
git commit -m "feat: hotel panel UI with worker cards and eviction"
```

---

### Task 7: UI — Job Picker Sheet

**Files:**
- Create: `src/components/JobPickerSheet.tsx`
- Modify: `src/components/HotelPanel.tsx`

**Interfaces:**
- Consumes: `Worker` type, `gameConfig`, `getWorkerMood`, `assignWorker` store action
- Produces: `<JobPickerSheet visible={boolean} worker={Worker | null} onClose={fn} />` component

- [ ] **Step 1: Create JobPickerSheet component**

Create `src/components/JobPickerSheet.tsx`. Props: `visible: boolean`, `worker: Worker | null`, `onClose: fn`. Second bottom sheet that slides over the hotel panel.

Layout:
- Header: worker mini-info (small avatar + name + floor type badge as colored pill) + close button
- Body: `SectionList` grouped by floor. Each section = one built floor (from `gameConfig.floors`). Each item = one slot without a worker.
- Section header: floor number chip + floor name + floor header color
- Slot row: product image + display name (from `gameConfig.productionTypes[typeId].displayName`) + match indicator badge + "Призначити" button

Match indicator logic:
```ts
const floorConfig = gameConfig.floors.find(f => f.id === floorId);
const floorType = floorConfig?.floorType;
if (floorType === worker.floorType && typeId === worker.dreamJob) → green badge "Робота мрії · 2x"
else if (floorType === worker.floorType) → yellow badge "Підходящий тип · 1.3x"
else → gray badge "Інший тип · 1x"
```

Sorting: floors with matching floorType first. Within each floor, dream job slot first.

Tapping "Призначити" calls `useGameStore.getState().assignWorker(worker.id, floorId, slotIdx)` → close picker → hotel panel auto-updates (worker disappears from list).

Empty state: "Всі місця зайняті" if no empty slots anywhere.

- [ ] **Step 2: Wire up to HotelPanel**

In `HotelPanel.tsx`, add state for job picker:

```ts
const [pickerWorker, setPickerWorker] = useState<Worker | null>(null);
```

Pass `onFindJob={() => setPickerWorker(worker)}` to each WorkerCard.

Render `<JobPickerSheet visible={!!pickerWorker} worker={pickerWorker} onClose={() => setPickerWorker(null)} />` inside the HotelPanel.

- [ ] **Step 3: Test on device/simulator**

Verify:
- Tapping "Знайти роботу" on an expanded worker card opens the picker
- Picker shows floors grouped by name, only empty slots
- Match indicator badges show correct colors
- Tapping "Призначити" assigns worker and closes picker
- Worker disappears from hotel list after assignment
- Empty state shows when no slots available

- [ ] **Step 4: Commit**

```bash
git add src/components/JobPickerSheet.tsx src/components/HotelPanel.tsx
git commit -m "feat: job picker sheet for worker assignment"
```

---

### Task 8: UI — Production card worker integration

**Files:**
- Modify: `src/components/ProductionCard.tsx`
- Modify: `src/components/FloorCard.tsx`
- Modify: `app/game.tsx`

**Interfaces:**
- Consumes: `Worker` type, `getWorkerForSlot`, `getFloorDiscount`, `getRevenueMultiplier`, `getWorkerMood`, `fireWorker` store action
- Produces: locked slot state, worker indicator on cards, fire popover, discount/multiplier badges

- [ ] **Step 1: Update FloorCard to pass worker data**

In `src/components/FloorCard.tsx`, read workers from store and pass the relevant worker for each slot to `ProductionCard`:

```ts
const workers = useGameStore((s) => s.workers);
```

Add new prop to ProductionCard: `worker: Worker | undefined`. Find worker per slot:

```ts
import { getWorkerForSlot } from '../../shared/engine/workerUtils';

// In the render:
const slotWorker = getWorkerForSlot(workers, floorId, idx);
// Pass to ProductionCard:
<ProductionCard ... worker={slotWorker} />
```

Also compute and pass `floorDiscount`:

```ts
import { getFloorDiscount } from '../../shared/engine/workerUtils';
const discount = getFloorDiscount(workers, floorId);
// Pass to each ProductionCard:
<ProductionCard ... floorDiscount={discount} />
```

- [ ] **Step 2: Add locked state to ProductionCard**

In `src/components/ProductionCard.tsx`, add `worker?: Worker` and `floorDiscount?: number` props. When `!worker`:
- Show a locked overlay: dimmed card with lock icon (SVG) and text "Потрібен працівник"
- All action buttons disabled
- Don't show price/status sub-block

- [ ] **Step 3: Add worker mini-indicator**

When a worker IS assigned, show a small `<WorkerAvatar>` (24×24) positioned at the top-right corner of the product image container. Tapping it opens a mini-popover (or a small expandable detail) showing:
- Worker name, level, mood dot
- "Звільнити" button (disabled with hint if slot is DELIVERING or SELLING)

Fire flow:
- If slot is IDLE/READY_TO_LIST/READY_TO_COLLECT: check hotel capacity
  - Hotel has space → `fireWorker(worker.id)`
  - Hotel full → `Alert.alert` with "Виселити назовсім" (fire + evict) or "Скасувати"
- If DELIVERING/SELLING → show "Очікуйте завершення" hint, button disabled

- [ ] **Step 4: Show discount on buy price**

When `floorDiscount > 0` and the slot shows a buy price, compute and display the discounted price. Show the effective price in the price pill. Optionally show a small discount badge (e.g., "−15%") next to the price.

```ts
const effectiveCost = typeConfig
  ? Math.floor(typeConfig.buyCost * (1 - (floorDiscount ?? 0)))
  : 0;
```

Use `effectiveCost` instead of `typeConfig.buyCost` in the buy label/sub text.

- [ ] **Step 5: Show multiplier on collect**

When collecting, show the effective revenue with multiplier. Compute from worker mood:

```ts
import { getRevenueMultiplier } from '../../shared/engine/workerUtils';

const floorConfig = gameConfig.floors.find(f => f.id === floorId);
const multiplier = worker && floorConfig
  ? getRevenueMultiplier(worker, floorConfig.floorType, production.typeId)
  : 1;
const effectiveRevenue = typeConfig ? Math.floor(typeConfig.batchValue * multiplier) : 0;
```

Show `effectiveRevenue` in the collect/sell sub text. If multiplier > 1, show a small badge like "×2" or "×1.3".

- [ ] **Step 6: Test on device/simulator**

Verify:
- Slots without workers show locked state with "Потрібен працівник"
- After assigning a worker (via hotel panel), the slot unlocks and shows the worker avatar
- Buy price reflects floor discount
- Collect revenue reflects mood multiplier
- Tapping worker avatar shows details + fire button
- Fire flow works correctly (including hotel-full dialog)
- Full production cycle works: assign worker → buy → wait → list → wait → collect (revenue multiplied)

- [ ] **Step 7: Commit**

```bash
git add src/components/ProductionCard.tsx src/components/FloorCard.tsx app/game.tsx
git commit -m "feat: production card worker integration (locked state, fire, bonuses)"
```

---

## Self-Review Checklist

1. **Spec coverage**: All 10 spec sections have corresponding tasks. Floor types (§2) → Task 1. Data model (§3) → Tasks 1-2. Commands (§4) → Task 3. Initial state (§5) → Task 1+5. Hotel panel (§6) → Task 6. Job picker (§7) → Task 7. Production card (§8) → Task 8. Engine/sync (§9) → Tasks 3+5. Testing (§10) → Tests in Tasks 1-3.

2. **Placeholder scan**: No TBDs/TODOs. All code blocks are complete. All test cases have assertions.

3. **Type consistency**: `Worker` type defined in Task 1, used consistently. `getWorkerForSlot`, `getFloorDiscount`, `getRevenueMultiplier`, `getWorkerMood` — same names across Tasks 2, 3, 6, 7, 8. Store actions `assignWorker`, `fireWorker`, `evictWorker` — consistent across Tasks 4, 6, 7, 8.
