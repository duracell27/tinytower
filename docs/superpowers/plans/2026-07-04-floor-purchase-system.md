# Floor Purchase & Construction System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full floor purchase flow — buy floor → construction timer → choose business type → spend tools → new floor appears.

**Architecture:** New `buy_floor` and `open_floor` commands go through the existing `processCommand` engine. `ToolInventory` moves from Zustand store into `GameState` so it syncs to the server. Two new components (`UnderConstructionBanner`, `BusinessTypePickerSheet`) handle the UI. `game.tsx` renders a dynamic floor list that swaps the buy banner for the construction banner while a floor is being built.

**Tech Stack:** React Native (Expo), Zustand, Zod schemas, Jest

## Global Constraints

- All state mutations go through `processCommand` — never mutate store state directly
- Zod schemas must use `.default()` for new optional fields so existing server states parse without errors
- `ToolKey` is the union `'briks' | 'glass' | 'nails' | 'screw'` — reuse the existing type
- Font family is `Fredoka_700Bold` / `Fredoka_600SemiBold` / `Fredoka_500Medium` — no other fonts
- Color for builder/construction theme: `#E67E22` (orange), shadow `#A04000`
- Run tests with `npx jest --testPathPattern=<file> --no-coverage`
- Only one floor under construction at a time

---

### Task 1: Schema & Types Foundation

**Files:**
- Modify: `shared/schemas/gameState.ts`
- Modify: `shared/schemas/gameConfig.ts`
- Modify: `shared/schemas/command.ts`
- Modify: `shared/types/index.ts`
- Modify: `shared/schemas/__tests__/schemas.test.ts`

**Interfaces:**
- Produces: `UnderConstructionState`, `ToolsState`, `BuyFloorCommand`, `OpenFloorCommand`, `FloorUnlockConfig` types consumed by Tasks 2, 3, 4

---

- [ ] **Step 1: Add `tools`, `underConstruction`, `openedFloorTypes` to GameStateSchema**

In `shared/schemas/gameState.ts`, replace the entire file content:

```typescript
import { z } from 'zod';
import { ProductionSchema } from './production';
import { CommandSchema } from './command';
import { WorkerSchema } from './worker';
import { VisitorSchema } from './visitor';

export const ToolsSchema = z.object({
  briks: z.number().int().nonnegative(),
  glass: z.number().int().nonnegative(),
  nails: z.number().int().nonnegative(),
  screw: z.number().int().nonnegative(),
});

export const UnderConstructionSchema = z.object({
  floorId: z.number().int(),
  startedAt: z.number(),
  durationMs: z.number(),
  requiredTool: z.enum(['briks', 'glass', 'nails', 'screw']),
  requiredCount: z.number().int().positive(),
});

export const FloorStateSchema = z.object({
  id: z.number().int(),
  productions: z.array(ProductionSchema).min(1).max(3),
});

export const GameStateSchema = z.object({
  balance: z.number().nonnegative(),
  gems: z.number().int().nonnegative(),
  floors: z.array(FloorStateSchema).min(1),
  commandQueue: z.array(CommandSchema),
  workers: z.array(WorkerSchema),
  hotelCapacity: z.number().int().positive(),
  lobbyVisitors: z.array(VisitorSchema),
  lobbyCapacity: z.number().int().positive(),
  elevatorLevel: z.number().int().positive(),
  elevatorFloor: z.number().int().nonnegative(),
  dailyTips: z.number().nonnegative(),
  dailyGemsCollected: z.number().int().nonnegative(),
  dailyTipsRewardClaimed: z.boolean(),
  lastDailyReset: z.number().nonnegative(),
  nextVisitorAt: z.number().nonnegative(),
  tools: ToolsSchema.default({ briks: 0, glass: 0, nails: 0, screw: 0 }),
  underConstruction: UnderConstructionSchema.nullable().default(null),
  openedFloorTypes: z.record(z.string(), z.string()).default({}),
});
```

- [ ] **Step 2: Add `FloorUnlockConfigSchema` to gameConfig schema**

In `shared/schemas/gameConfig.ts`, replace entire file:

```typescript
import { z } from 'zod';

export const ProductionTypeConfigSchema = z.object({
  buyCost: z.number().positive(),
  deliveryDuration: z.number().positive(),
  sellDuration: z.number().positive(),
  batchValue: z.number().positive(),
});

export const FloorTypeConfigSchema = z.object({
  shirtColor: z.string(),
  accent: z.string(),
  dreamJobs: z.array(z.string()).min(1),
});

export const FloorConfigSchema = z.object({
  id: z.number().int(),
  slots: z.number().int().min(1).max(3),
  floorType: z.string(),
  availableTypes: z.array(z.string()).min(1),
});

export const FloorUnlockConfigSchema = z.object({
  floorId: z.number().int(),
  price: z.number().int().positive(),
  currency: z.enum(['coins', 'gems']),
  constructionDurationMs: z.number().positive(),
  requiredToolCount: z.number().int().positive(),
});

export const LobbyConfigSchema = z.object({
  visitorSpawnInterval: z.number().positive(),
  dailyTipsTarget: z.number().positive(),
  dailyTipsReward: z.number().int().positive(),
  dailyGemLimitBase: z.number().int().positive(),
  guestTipBase: z.number().positive(),
  businessmanFallbackBase: z.number().positive(),
  deliverySpeedBonus: z.number().min(0).max(1),
  sellSpeedBonus: z.number().min(0).max(1),
  elevatorUpgradeBaseCost: z.number().int().positive(),
  lobbyUpgradeBaseCost: z.number().int().positive(),
  lobbyUpgradeSeats: z.number().int().positive(),
  defaultLobbyCapacity: z.number().int().positive(),
});

export const GameConfigSchema = z.object({
  floors: z.array(FloorConfigSchema).min(1),
  productionTypes: z.record(z.string(), ProductionTypeConfigSchema),
  floorTypes: z.record(z.string(), FloorTypeConfigSchema),
  startingBalance: z.number().nonnegative(),
  hotelCapacity: z.number().int().positive(),
  lobbyConfig: LobbyConfigSchema,
  floorUnlocks: z.array(FloorUnlockConfigSchema).default([]),
});
```

- [ ] **Step 3: Add `buy_floor` and `open_floor` to command schema**

In `shared/schemas/command.ts`, add before the `CommandSchema` union (after `ExpandHotelCommandSchema`):

```typescript
export const BuyFloorCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('buy_floor'),
  floorId: z.number().int(),
  requiredTool: z.enum(['briks', 'glass', 'nails', 'screw']),
});

export const OpenFloorCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('open_floor'),
  floorId: z.number().int(),
  floorType: z.string(),
});
```

Then add both to the `CommandSchema` discriminated union:

```typescript
export const CommandSchema = z.discriminatedUnion('type', [
  BuyCommandSchema,
  ListCommandSchema,
  CollectCommandSchema,
  AssignWorkerCommandSchema,
  FireWorkerCommandSchema,
  EvictWorkerCommandSchema,
  SpawnVisitorCommandSchema,
  LiftVisitorCommandSchema,
  CollectTipCommandSchema,
  DeliverAllCommandSchema,
  UpgradeElevatorCommandSchema,
  UpgradeLobbyCommandSchema,
  ClaimDailyRewardCommandSchema,
  ExpandHotelCommandSchema,
  BuyFloorCommandSchema,
  OpenFloorCommandSchema,
]);
```

- [ ] **Step 4: Export new types from `shared/types/index.ts`**

Add to the imports at the top:

```typescript
import { BuyFloorCommandSchema, OpenFloorCommandSchema } from '../schemas/command';
import { FloorUnlockConfigSchema } from '../schemas/gameConfig';
import { UnderConstructionSchema, ToolsSchema } from '../schemas/gameState';
```

Add to the exports:

```typescript
export type BuyFloorCommand = z.infer<typeof BuyFloorCommandSchema>;
export type OpenFloorCommand = z.infer<typeof OpenFloorCommandSchema>;
export type FloorUnlockConfig = z.infer<typeof FloorUnlockConfigSchema>;
export type UnderConstructionState = z.infer<typeof UnderConstructionSchema>;
export type ToolsState = z.infer<typeof ToolsSchema>;
```

- [ ] **Step 5: Write schema tests for new types**

In `shared/schemas/__tests__/schemas.test.ts`, add at the end:

```typescript
describe('New command schemas', () => {
  it('validates buy_floor command', () => {
    const cmd = CommandSchema.parse({
      id: 'c1', type: 'buy_floor', timestamp: 1000,
      floorId: 5, requiredTool: 'briks',
    });
    expect(cmd.type).toBe('buy_floor');
  });

  it('validates open_floor command', () => {
    const cmd = CommandSchema.parse({
      id: 'c2', type: 'open_floor', timestamp: 2000,
      floorId: 5, floorType: 'violet',
    });
    expect(cmd.type).toBe('open_floor');
  });

  it('rejects buy_floor with unknown tool', () => {
    expect(CommandSchema.safeParse({
      id: 'c3', type: 'buy_floor', timestamp: 1000,
      floorId: 5, requiredTool: 'hammer',
    }).success).toBe(false);
  });
});

describe('GameStateSchema with new fields', () => {
  const minimalState = {
    balance: 100, gems: 20,
    floors: [{ id: 1, productions: [{ typeId: null, stage: 'IDLE', stageStartedAt: 0 }] }],
    commandQueue: [], workers: [], hotelCapacity: 10,
    lobbyVisitors: [], lobbyCapacity: 10, elevatorLevel: 1, elevatorFloor: 0,
    dailyTips: 0, dailyGemsCollected: 0, dailyTipsRewardClaimed: false,
    lastDailyReset: 0, nextVisitorAt: 0,
  };

  it('defaults tools to zero when not provided', () => {
    const result = GameStateSchema.parse(minimalState);
    expect(result.tools).toEqual({ briks: 0, glass: 0, nails: 0, screw: 0 });
  });

  it('defaults underConstruction to null when not provided', () => {
    const result = GameStateSchema.parse(minimalState);
    expect(result.underConstruction).toBeNull();
  });

  it('defaults openedFloorTypes to empty object when not provided', () => {
    const result = GameStateSchema.parse(minimalState);
    expect(result.openedFloorTypes).toEqual({});
  });

  it('accepts underConstruction when provided', () => {
    const result = GameStateSchema.parse({
      ...minimalState,
      underConstruction: {
        floorId: 5, startedAt: 1000, durationMs: 1200000,
        requiredTool: 'glass', requiredCount: 1,
      },
    });
    expect(result.underConstruction?.floorId).toBe(5);
  });
});
```

- [ ] **Step 6: Run tests and verify they pass**

```bash
npx jest --testPathPattern=schemas.test --no-coverage
```

Expected: all tests pass including the 6 new ones.

- [ ] **Step 7: Commit**

```bash
git add shared/schemas/gameState.ts shared/schemas/gameConfig.ts shared/schemas/command.ts shared/types/index.ts shared/schemas/__tests__/schemas.test.ts
git commit -m "feat: add floor purchase schemas — underConstruction, tools, buy_floor/open_floor commands"
```

---

### Task 2: Game Config Data

**Files:**
- Modify: `shared/config/gameConfig.ts`

**Interfaces:**
- Consumes: `FloorUnlockConfig`, `GameConfig`, `GameState` (from Task 1)
- Produces: `gameConfig` with `floorUnlocks` and violet/red production types; updated `createInitialState` that includes `tools`, `underConstruction`, `openedFloorTypes`

---

- [ ] **Step 1: Add violet/red production types, floorUnlocks, update createInitialState**

Replace `shared/config/gameConfig.ts` entirely:

```typescript
import { GameConfigSchema } from '../schemas/gameConfig';
import type { GameConfig, GameState, Floor } from '../types';

const rawConfig = {
  floorTypes: {
    green:  { shirtColor: '#49AA38', accent: '#20810F', dreamJobs: ['bulky', 'cupcake', 'cake'] },
    blue:   { shirtColor: '#3376E5', accent: '#0A4DBC', dreamJobs: ['wash', 'dry', 'bleach'] },
    yellow: { shirtColor: '#E5A72E', accent: '#BC7E05', dreamJobs: ['coffee', 'pancake', 'dessert'] },
    violet: { shirtColor: '#9A6FD0', accent: '#7B52BC', dreamJobs: ['aroma', 'soap', 'candle'] },
    red:    { shirtColor: '#4C9BDD', accent: '#2E78B5', dreamJobs: ['icecream', 'shake', 'sorbet'] },
  },
  floors: [
    { id: 2, slots: 3, floorType: 'green', availableTypes: ['bulky', 'cupcake', 'cake'] },
    { id: 3, slots: 3, floorType: 'blue',  availableTypes: ['wash', 'dry', 'bleach'] },
    { id: 4, slots: 3, floorType: 'yellow', availableTypes: ['coffee', 'pancake', 'dessert'] },
  ],
  productionTypes: {
    bulky:    { buyCost: 10,  deliveryDuration: 5000,  sellDuration: 10000, batchValue: 20 },
    cupcake:  { buyCost: 15,  deliveryDuration: 8000,  sellDuration: 12000, batchValue: 28 },
    cake:     { buyCost: 25,  deliveryDuration: 12000, sellDuration: 15000, batchValue: 48 },
    wash:     { buyCost: 30,  deliveryDuration: 10000, sellDuration: 15000, batchValue: 55 },
    dry:      { buyCost: 40,  deliveryDuration: 15000, sellDuration: 20000, batchValue: 72 },
    bleach:   { buyCost: 50,  deliveryDuration: 20000, sellDuration: 25000, batchValue: 95 },
    coffee:   { buyCost: 20,  deliveryDuration: 8000,  sellDuration: 12000, batchValue: 40 },
    pancake:  { buyCost: 35,  deliveryDuration: 12000, sellDuration: 18000, batchValue: 64 },
    dessert:  { buyCost: 45,  deliveryDuration: 18000, sellDuration: 22000, batchValue: 88 },
    aroma:    { buyCost: 30,  deliveryDuration: 10000, sellDuration: 14000, batchValue: 58 },
    soap:     { buyCost: 45,  deliveryDuration: 14000, sellDuration: 20000, batchValue: 82 },
    candle:   { buyCost: 60,  deliveryDuration: 20000, sellDuration: 26000, batchValue: 110 },
    icecream: { buyCost: 25,  deliveryDuration: 9000,  sellDuration: 13000, batchValue: 50 },
    shake:    { buyCost: 40,  deliveryDuration: 13000, sellDuration: 19000, batchValue: 74 },
    sorbet:   { buyCost: 55,  deliveryDuration: 18000, sellDuration: 24000, batchValue: 98 },
  },
  startingBalance: 1000,
  hotelCapacity: 10,
  lobbyConfig: {
    visitorSpawnInterval: 120_000,
    dailyTipsTarget: 10_000,
    dailyTipsReward: 5,
    dailyGemLimitBase: 10,
    guestTipBase: 10,
    businessmanFallbackBase: 100,
    deliverySpeedBonus: 0.05,
    sellSpeedBonus: 0.05,
    elevatorUpgradeBaseCost: 3,
    lobbyUpgradeBaseCost: 5,
    lobbyUpgradeSeats: 3,
    defaultLobbyCapacity: 10,
  },
  floorUnlocks: [
    {
      floorId: 5,
      price: 250,
      currency: 'gems' as const,
      constructionDurationMs: 20 * 60 * 1000,
      requiredToolCount: 1,
    },
  ],
} satisfies GameConfig;

export const gameConfig: GameConfig = GameConfigSchema.parse(rawConfig);

export function createInitialState(config: GameConfig): GameState {
  return {
    balance: config.startingBalance,
    gems: 20,
    floors: config.floors.map((floorConfig): Floor => ({
      id: floorConfig.id,
      productions: floorConfig.availableTypes.map((typeId) => ({
        typeId,
        stage: 'IDLE' as const,
        stageStartedAt: 0,
      })),
    })),
    commandQueue: [],
    workers: [],
    hotelCapacity: config.hotelCapacity,
    lobbyVisitors: [],
    lobbyCapacity: config.lobbyConfig.defaultLobbyCapacity,
    elevatorLevel: 1,
    elevatorFloor: 0,
    dailyTips: 0,
    dailyGemsCollected: 0,
    dailyTipsRewardClaimed: false,
    lastDailyReset: 0,
    nextVisitorAt: 0,
    tools: { briks: 1, glass: 1, nails: 1, screw: 1 },
    underConstruction: null,
    openedFloorTypes: {},
  };
}
```

- [ ] **Step 2: Verify gameConfig tests still pass**

```bash
npx jest --testPathPattern=gameConfig --no-coverage
```

Expected: all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add shared/config/gameConfig.ts
git commit -m "feat: add violet/red production types, floorUnlocks config, tools in initial state"
```

---

### Task 3: Engine — processCommand

**Files:**
- Modify: `shared/engine/processCommand.ts`
- Modify: `shared/engine/__tests__/processCommand.test.ts`

**Interfaces:**
- Consumes: `BuyFloorCommand`, `OpenFloorCommand`, `UnderConstructionState`, `ToolsState` (Task 1); `gameConfig.floorUnlocks` (Task 2)
- Produces: `processCommand` handles `buy_floor` and `open_floor`; `handleBuy` and `handleCollect` support dynamic floors via `state.openedFloorTypes`

---

- [ ] **Step 1: Add `buy_floor` and `open_floor` cases to the switch and fix dynamic floor support**

Replace `shared/engine/processCommand.ts` entirely:

```typescript
import type { GameState, Command, GameConfig, Worker } from '../types';
import { getWorkerForSlot, getFloorDiscount, getRevenueMultiplier } from './workerUtils';
import { processLobbyCommand } from './lobbyCommands';

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
  playerLevel: number = 1,
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
    case 'buy_floor':
      return handleBuyFloor(state, command, config);
    case 'open_floor':
      return handleOpenFloor(state, command, config);
    case 'spawn_visitor':
    case 'lift_visitor':
    case 'collect_tip':
    case 'deliver_all':
    case 'upgrade_elevator':
    case 'upgrade_lobby':
    case 'claim_daily_reward':
    case 'expand_hotel':
      return processLobbyCommand(state, command, config, playerLevel);
  }
}

function handleBuyFloor(
  state: GameState,
  command: Extract<Command, { type: 'buy_floor' }>,
  config: GameConfig,
): ProcessResult {
  const unlockConfig = config.floorUnlocks?.find((f) => f.floorId === command.floorId);
  if (!unlockConfig) return { success: false, state, error: 'Floor not available for purchase' };
  if (state.underConstruction !== null) return { success: false, state, error: 'Already under construction' };
  if (state.floors.some((f) => f.id === command.floorId)) return { success: false, state, error: 'Floor already exists' };

  if (unlockConfig.currency === 'gems') {
    if (state.gems < unlockConfig.price) return { success: false, state, error: 'Insufficient gems' };
    return {
      success: true,
      state: {
        ...state,
        gems: state.gems - unlockConfig.price,
        underConstruction: {
          floorId: command.floorId,
          startedAt: command.timestamp,
          durationMs: unlockConfig.constructionDurationMs,
          requiredTool: command.requiredTool,
          requiredCount: unlockConfig.requiredToolCount,
        },
      },
    };
  }
  if (state.balance < unlockConfig.price) return { success: false, state, error: 'Insufficient balance' };
  return {
    success: true,
    state: {
      ...state,
      balance: state.balance - unlockConfig.price,
      underConstruction: {
        floorId: command.floorId,
        startedAt: command.timestamp,
        durationMs: unlockConfig.constructionDurationMs,
        requiredTool: command.requiredTool,
        requiredCount: unlockConfig.requiredToolCount,
      },
    },
  };
}

function handleOpenFloor(
  state: GameState,
  command: Extract<Command, { type: 'open_floor' }>,
  config: GameConfig,
): ProcessResult {
  const uc = state.underConstruction;
  if (!uc || uc.floorId !== command.floorId) return { success: false, state, error: 'Floor not under construction' };
  if (command.timestamp - uc.startedAt < uc.durationMs) return { success: false, state, error: 'Construction not complete' };

  const currentTools = state.tools ?? { briks: 0, glass: 0, nails: 0, screw: 0 };
  if ((currentTools[uc.requiredTool] ?? 0) < uc.requiredCount) return { success: false, state, error: 'Insufficient tools' };

  const floorTypeConfig = config.floorTypes[command.floorType];
  if (!floorTypeConfig) return { success: false, state, error: 'Unknown floor type' };

  const newFloor = {
    id: command.floorId,
    productions: floorTypeConfig.dreamJobs.map((typeId) => ({
      typeId,
      stage: 'IDLE' as const,
      stageStartedAt: 0,
    })),
  };

  return {
    success: true,
    state: {
      ...state,
      tools: {
        ...currentTools,
        [uc.requiredTool]: currentTools[uc.requiredTool] - uc.requiredCount,
      },
      floors: [...state.floors, newFloor],
      openedFloorTypes: {
        ...(state.openedFloorTypes ?? {}),
        [String(command.floorId)]: command.floorType,
      },
      underConstruction: null,
    },
  };
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

function resolveFloorType(state: GameState, config: GameConfig, floorId: number): string {
  const staticConfig = config.floors.find((f) => f.id === floorId);
  if (staticConfig) return staticConfig.floorType;
  return state.openedFloorTypes?.[String(floorId)] ?? '';
}

function resolveAvailableTypes(state: GameState, config: GameConfig, floorId: number): string[] {
  const staticConfig = config.floors.find((f) => f.id === floorId);
  if (staticConfig) return staticConfig.availableTypes;
  const floorType = state.openedFloorTypes?.[String(floorId)];
  return floorType ? (config.floorTypes[floorType]?.dreamJobs ?? []) : [];
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

  const availableTypes = resolveAvailableTypes(state, config, state.floors[floorIdx].id);
  if (!availableTypes.includes(command.typeId)) {
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

  const floorId = state.floors[floorIdx].id;
  const floorType = resolveFloorType(state, config, floorId);
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

- [ ] **Step 2: Add `floorUnlocks` to the testConfig in processCommand tests**

In `shared/engine/__tests__/processCommand.test.ts`, update `testConfig` (add after `lobbyConfig`):

```typescript
  floorUnlocks: [
    {
      floorId: 5,
      price: 10,
      currency: 'gems' as const,
      constructionDurationMs: 60000,
      requiredToolCount: 1,
    },
  ],
```

- [ ] **Step 3: Write buy_floor and open_floor engine tests**

Add at the end of `shared/engine/__tests__/processCommand.test.ts`:

```typescript
describe('buy_floor command', () => {
  function buyFloorCmd(overrides?: Partial<Extract<Command, { type: 'buy_floor' }>>): Command {
    return {
      id: 'bf-1', type: 'buy_floor', timestamp: 1000,
      floorId: 5, requiredTool: 'briks',
      ...overrides,
    } as Command;
  }

  it('deducts gems and sets underConstruction', () => {
    const state = makeState({ gems: 20 });
    const result = processCommand(state, buyFloorCmd(), testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(10);
    expect(result.state.underConstruction).toMatchObject({
      floorId: 5, requiredTool: 'briks', requiredCount: 1, durationMs: 60000,
    });
  });

  it('fails when gems are insufficient', () => {
    const state = makeState({ gems: 5 });
    const result = processCommand(state, buyFloorCmd(), testConfig, 1000);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient gems');
  });

  it('fails when already under construction', () => {
    const state = makeState({
      gems: 20,
      underConstruction: {
        floorId: 5, startedAt: 0, durationMs: 60000,
        requiredTool: 'briks', requiredCount: 1,
      },
    });
    const result = processCommand(state, buyFloorCmd(), testConfig, 1000);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Already under construction');
  });

  it('fails for unknown floor id', () => {
    const state = makeState({ gems: 20 });
    const result = processCommand(state, buyFloorCmd({ floorId: 99 }), testConfig, 1000);
    expect(result.success).toBe(false);
  });
});

describe('open_floor command', () => {
  function openFloorCmd(overrides?: Partial<Extract<Command, { type: 'open_floor' }>>): Command {
    return {
      id: 'of-1', type: 'open_floor', timestamp: 62000,
      floorId: 5, floorType: 'green',
      ...overrides,
    } as Command;
  }

  const stateUnderConstruction: Partial<GameState> = {
    gems: 10,
    tools: { briks: 2, glass: 0, nails: 0, screw: 0 },
    underConstruction: {
      floorId: 5, startedAt: 1000, durationMs: 60000,
      requiredTool: 'briks', requiredCount: 1,
    },
  };

  it('adds new floor, deducts tool, clears underConstruction', () => {
    const state = makeState(stateUnderConstruction);
    const result = processCommand(state, openFloorCmd(), testConfig, 62000);
    expect(result.success).toBe(true);
    expect(result.state.floors).toHaveLength(2);
    expect(result.state.floors[1].id).toBe(5);
    expect(result.state.tools.briks).toBe(1);
    expect(result.state.underConstruction).toBeNull();
    expect(result.state.openedFloorTypes['5']).toBe('green');
  });

  it('new floor has 3 productions matching dreamJobs', () => {
    const state = makeState(stateUnderConstruction);
    const result = processCommand(state, openFloorCmd(), testConfig, 62000);
    const newFloor = result.state.floors.find((f) => f.id === 5)!;
    expect(newFloor.productions.map((p) => p.typeId)).toEqual(['coffee_shop', 'bookstore']);
  });

  it('fails when timer not complete', () => {
    const state = makeState(stateUnderConstruction);
    const result = processCommand(state, openFloorCmd({ timestamp: 30000 }), testConfig, 30000);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Construction not complete');
  });

  it('fails when tools insufficient', () => {
    const state = makeState({
      ...stateUnderConstruction,
      tools: { briks: 0, glass: 0, nails: 0, screw: 0 },
    });
    const result = processCommand(state, openFloorCmd(), testConfig, 62000);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient tools');
  });

  it('fails when no floor under construction', () => {
    const state = makeState({ underConstruction: null });
    const result = processCommand(state, openFloorCmd(), testConfig, 62000);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Floor not under construction');
  });
});
```

- [ ] **Step 4: Run all engine tests**

```bash
npx jest --testPathPattern=processCommand.test --no-coverage
```

Expected: all existing tests pass + 9 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add shared/engine/processCommand.ts shared/engine/__tests__/processCommand.test.ts
git commit -m "feat: add buy_floor and open_floor command handlers, fix dynamic floor support"
```

---

### Task 4: Store Migration — tools → GameState, new actions

**Files:**
- Modify: `src/stores/gameStore.ts`

**Interfaces:**
- Consumes: `ToolsState`, `UnderConstructionState`, `BuyFloorCommand`, `OpenFloorCommand` (Task 1); `processCommand` (Task 3)
- Produces: `useGameStore` with `buyFloor(floorId)`, `openFloor(floorId, floorType)` actions; `tools` accessible as `state.tools`

---

- [ ] **Step 1: Remove ToolInventory from store, add buyFloor/openFloor actions**

In `src/stores/gameStore.ts`, make these changes:

**a)** Remove `interface ToolInventory { briks...; glass...; nails...; screw...; }` (lines 26–31).

**b)** Remove `setToolInventory: (tools: ToolInventory) => void;` from `GameActions`.

**c)** Add to `GameActions`:

```typescript
  buyFloor: (floorId: number) => void;
  openFloor: (floorId: number, floorType: string) => void;
```

**d)** Change `type GameStore = GameState & PlayerStats & SyncState & ToolInventory & UIState & GameActions;`  
→ `type GameStore = GameState & PlayerStats & SyncState & UIState & GameActions;`

**e)** In `executeCommand`, update the gameState extraction to include the three new GameState fields. Replace the destructuring block (lines 91–99):

```typescript
  const { balance, gems, floors, commandQueue, workers, hotelCapacity,
    lobbyVisitors, lobbyCapacity, elevatorLevel, elevatorFloor,
    dailyTips, dailyGemsCollected, dailyTipsRewardClaimed, lastDailyReset, nextVisitorAt,
    tools, underConstruction, openedFloorTypes,
  } = store;
  const gameState: GameState = {
    balance, gems, floors, commandQueue, workers, hotelCapacity,
    lobbyVisitors, lobbyCapacity, elevatorLevel, elevatorFloor,
    dailyTips, dailyGemsCollected, dailyTipsRewardClaimed, lastDailyReset, nextVisitorAt,
    tools, underConstruction, openedFloorTypes,
  };
```

**f)** In the `set({...})` after processCommand, add the three new fields:

```typescript
    tools: result.state.tools,
    underConstruction: result.state.underConstruction,
    openedFloorTypes: result.state.openedFloorTypes,
```

**g)** Remove the initial store values `briks: 1, glass: 1, nails: 1, screw: 1` (lines 144–147). The initial values now come from `createInitialState`.

**h)** In the builder tool drop code (inside `collectTip` handler, around line 301–304), replace:

```typescript
      const tool = TOOLS[Math.floor(Math.random() * TOOLS.length)];
      set({ [tool]: get()[tool] + 1, builderToolDrop: tool });
```
with:

```typescript
      const tool = TOOLS[Math.floor(Math.random() * TOOLS.length)];
      const curTools = get().tools ?? { briks: 0, glass: 0, nails: 0, screw: 0 };
      set({ tools: { ...curTools, [tool]: curTools[tool] + 1 }, builderToolDrop: tool });
```

**i)** In the `deliverAll` builder tool drop code (around lines 316–327), replace:

```typescript
      for (let i = 0; i < builders.length; i++) {
        delta[TOOLS[Math.floor(Math.random() * TOOLS.length)]]++;
      }
      set((cur) => ({
        briks: cur.briks + delta.briks,
        glass: cur.glass + delta.glass,
        nails: cur.nails + delta.nails,
        screw: cur.screw + delta.screw,
      }));
```
with:

```typescript
      for (let i = 0; i < builders.length; i++) {
        delta[TOOLS[Math.floor(Math.random() * TOOLS.length)]]++;
      }
      set((cur) => ({
        tools: {
          briks: (cur.tools?.briks ?? 0) + delta.briks,
          glass: (cur.tools?.glass ?? 0) + delta.glass,
          nails: (cur.tools?.nails ?? 0) + delta.nails,
          screw: (cur.tools?.screw ?? 0) + delta.screw,
        },
      }));
```

**j)** Replace `setToolInventory: (tools) => set(tools),` with:

```typescript
  setToolInventory: (tools) => set((cur) => ({ tools: { ...cur.tools, ...tools } })),
```

**k)** In `hydrate`, add the three new fields:

```typescript
    tools: state.tools ?? { briks: 1, glass: 1, nails: 1, screw: 1 },
    underConstruction: state.underConstruction ?? null,
    openedFloorTypes: state.openedFloorTypes ?? {},
```

**l)** In `reconcile`, add:

```typescript
    tools: serverState.tools ?? { briks: 0, glass: 0, nails: 0, screw: 0 },
    underConstruction: serverState.underConstruction ?? null,
    openedFloorTypes: serverState.openedFloorTypes ?? {},
```

**m)** Add the two new actions at the end of the store, before the closing `}));`:

```typescript
  buyFloor: (floorId) => {
    const TOOLS: ToolKey[] = ['briks', 'glass', 'nails', 'screw'];
    const requiredTool = TOOLS[Math.floor(Math.random() * TOOLS.length)];
    executeCommand(get, set, {
      id: uuid(),
      type: 'buy_floor',
      floorId,
      requiredTool,
      timestamp: clock.now(),
    });
  },

  openFloor: (floorId, floorType) => {
    executeCommand(get, set, {
      id: uuid(),
      type: 'open_floor',
      floorId,
      floorType,
      timestamp: clock.now(),
    });
  },
```

**n)** Update `InsufficientResourcesPayload` to use `tools` path for checking in UI — it already supports `missingTools` array, no change needed.

- [ ] **Step 2: Update WarehouseSheet to read tools from `state.tools`**

Find any component reading `state.briks` / `state.glass` / `state.nails` / `state.screw` directly from the store:

```bash
grep -rn "\.briks\|\.glass\|\.nails\|\.screw\|s\.briks\|s\.glass\|s\.nails\|s\.screw" src/ --include="*.tsx" --include="*.ts"
```

For each hit, change `s.briks` → `s.tools?.briks ?? 0` (and same for the other three).

- [ ] **Step 3: Check TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat: migrate tools into GameState, add buyFloor/openFloor store actions"
```

---

### Task 5: UnderConstructionBanner Component

**Files:**
- Create: `src/components/UnderConstructionBanner.tsx`

**Interfaces:**
- Consumes: `useGameClock` (existing hook), builder image at `assets/img/workers/builder.png`
- Produces: `UnderConstructionBanner` component used by Task 7

---

- [ ] **Step 1: Create the component**

Create `src/components/UnderConstructionBanner.tsx`:

```typescript
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { shadeColor } from '../utils/color';

const BANNER_COLOR = '#E67E22';
const BANNER_BG = shadeColor(BANNER_COLOR, 45);

interface UnderConstructionBannerProps {
  floorId: number;
  endsAt: number;
  now: number;
  onOpenFloor: () => void;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function UnderConstructionBanner({
  floorId,
  endsAt,
  now,
  onOpenFloor,
}: UnderConstructionBannerProps) {
  const timeLeft = Math.max(0, endsAt - now);
  const isReady = timeLeft === 0;

  return (
    <View style={[styles.ribbon, { borderColor: BANNER_COLOR, backgroundColor: BANNER_BG }]}>
      <View style={styles.ribbonLeft}>
        <Image
          source={require('../../assets/img/workers/builder.png')}
          style={{ width: 28, height: 28 }}
          contentFit="contain"
        />
        <Text style={[styles.ribbonTitle, { color: BANNER_COLOR }]} numberOfLines={1}>
          {`Будується ${floorId} пов��рх`}
        </Text>
      </View>

      {isReady ? (
        <Pressable
          onPress={onOpenFloor}
          style={({ pressed }) => [styles.openBtn, pressed && { opacity: 0.85 }]}
        >
          <LinearGradient colors={['#E67E22', '#C96A14']} style={styles.openBtnGradient}>
            <Text style={styles.openBtnText}>Відкрити поверх</Text>
          </LinearGradient>
          <View style={styles.openBtnShadow} />
        </Pressable>
      ) : (
        <View style={styles.timerPill}>
          <Text style={[styles.timerText, { color: BANNER_COLOR }]}>
            {formatCountdown(timeLeft)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 3,
  },
  ribbonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  ribbonTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    flexShrink: 1,
  },
  timerPill: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 11,
  },
  timerText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  openBtn: {
    borderRadius: 11,
    overflow: 'hidden',
    position: 'relative',
  },
  openBtnGradient: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 11,
    zIndex: 1,
  },
  openBtnText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 13,
    color: '#fff',
  },
  openBtnShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#A04000',
    borderBottomLeftRadius: 11,
    borderBottomRightRadius: 11,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/UnderConstructionBanner.tsx
git commit -m "feat: add UnderConstructionBanner component with countdown and open button"
```

---

### Task 6: BusinessTypePickerSheet Component

**Files:**
- Create: `src/components/BusinessTypePickerSheet.tsx`

**Interfaces:**
- Consumes: `gameConfig.floorTypes`, `gameConfig.floorUnlocks`, `useGameStore` (tools), `ToolKey` type, tool images from `assets/img/tools/`
- Produces: `BusinessTypePickerSheet` used by Task 7

---

- [ ] **Step 1: Create the component**

Create `src/components/BusinessTypePickerSheet.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import {
  View, Text, Pressable, Modal, ScrollView, StyleSheet, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing,
} from 'react-native-reanimated';
import { useGameStore } from '../stores/gameStore';
import { gameConfig } from '../../shared/config/gameConfig';
import type { UnderConstructionState } from '../../shared/types';

type ToolKey = 'briks' | 'glass' | 'nails' | 'screw';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.7;
const SHEET_TIMING = { duration: 380, easing: Easing.bezier(0.4, 0, 0.2, 1) };

const TOOL_IMAGES: Record<ToolKey, ReturnType<typeof require>> = {
  briks: require('../../assets/img/tools/briks.png'),
  glass: require('../../assets/img/tools/glass.png'),
  nails: require('../../assets/img/tools/nails.png'),
  screw: require('../../assets/img/tools/screw.png'),
};

const TOOL_NAMES: Record<ToolKey, string> = {
  briks: 'Цегла',
  glass: 'Скло',
  nails: 'Цвяхи',
  screw: 'Гвинти',
};

const FLOOR_TYPE_NAMES: Record<string, string> = {
  green:  'Пекарня',
  blue:   'Пральня',
  yellow: 'Кафе',
  violet: 'Ательє',
  red:    'Морозиво',
};

const FLOOR_TYPE_COLORS: Record<string, [string, string]> = {
  green:  ['#5E8F42', '#3E6F22'],
  blue:   ['#2E6EC9', '#0E4EA9'],
  yellow: ['#E7A52B', '#C7850B'],
  violet: ['#9A6FD0', '#7A4FB0'],
  red:    ['#4C9BDD', '#2C7BBD'],
};

interface BusinessTypePickerSheetProps {
  visible: boolean;
  underConstruction: UnderConstructionState;
  onClose: () => void;
  onOpen: (floorType: string) => void;
}

export default function BusinessTypePickerSheet({
  visible,
  underConstruction,
  onClose,
  onOpen,
}: BusinessTypePickerSheetProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const tools = useGameStore((s) => s.tools);
  const translateY = useSharedValue(SHEET_HEIGHT);

  useEffect(() => {
    if (visible) {
      setSelectedType(null);
      translateY.value = withTiming(0, SHEET_TIMING);
    } else {
      translateY.value = withTiming(SHEET_HEIGHT, SHEET_TIMING);
    }
  }, [visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const floorTypes = Object.keys(gameConfig.floorTypes);
  const requiredTool = underConstruction.requiredTool as ToolKey;
  const requiredCount = underConstruction.requiredCount;
  const available = (tools?.[requiredTool] ?? 0) >= requiredCount;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <Animated.View style={[styles.sheet, sheetStyle]}>
        {/* Handle */}
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>

        <Text style={styles.title}>Вибери тип бізнесу</Text>
        <Text style={styles.subtitle}>Поверх {underConstruction.floorId}</Text>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {floorTypes.map((ft) => {
            const colors = FLOOR_TYPE_COLORS[ft] ?? ['#888', '#666'];
            const isSelected = selectedType === ft;
            return (
              <Pressable
                key={ft}
                onPress={() => setSelectedType(isSelected ? null : ft)}
                style={({ pressed }) => [
                  styles.typeRow,
                  isSelected && styles.typeRowSelected,
                  pressed && { opacity: 0.85 },
                ]}
              >
                {/* Color swatch */}
                <LinearGradient
                  colors={colors as [string, string]}
                  style={styles.colorSwatch}
                />
                <Text style={styles.typeName}>{FLOOR_TYPE_NAMES[ft] ?? ft}</Text>
                {isSelected && (
                  <View style={styles.checkDot} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Tool requirement row — shows only when a type is selected */}
        {selectedType && (
          <View style={styles.requirementCard}>
            <Image
              source={TOOL_IMAGES[requiredTool]}
              style={{ width: 32, height: 32 }}
              contentFit="contain"
            />
            <View style={styles.requirementInfo}>
              <Text style={styles.requirementLabel}>Потрібно:</Text>
              <Text style={[
                styles.requirementValue,
                { color: available ? '#49AA38' : '#E05050' },
              ]}>
                {`${requiredCount} ${TOOL_NAMES[requiredTool]}`}
              </Text>
              <Text style={styles.requirementHave}>
                {`На складі: ${tools?.[requiredTool] ?? 0}`}
              </Text>
            </View>

            <Pressable
              onPress={() => available && onOpen(selectedType)}
              style={({ pressed }) => [
                styles.openBizBtn,
                !available && styles.openBizBtnDisabled,
                pressed && available && { opacity: 0.85 },
              ]}
            >
              <LinearGradient
                colors={available ? ['#72C24F', '#5BA63C'] : ['#B7BDC8', '#A2A9B6']}
                style={styles.openBizGradient}
              >
                <Text style={styles.openBizText}>Відкрити бізнес</Text>
              </LinearGradient>
              {available && <View style={styles.openBizShadow} />}
            </Pressable>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18,26,44,0.5)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F4ECEF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: SHEET_HEIGHT,
    paddingBottom: 30,
    shadowColor: 'rgba(20,30,50,1)',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.28,
    shadowRadius: 30,
    elevation: 10,
  },
  handleRow: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle: { width: 38, height: 4, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.18)' },
  title: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 20,
    color: '#2A3344',
    textAlign: 'center',
    marginTop: 4,
  },
  subtitle: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 13,
    color: '#9BA3B0',
    textAlign: 'center',
    marginBottom: 12,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, gap: 10, paddingBottom: 16 },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: 'rgba(40,60,90,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  typeRowSelected: {
    borderColor: '#E67E22',
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  typeName: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
    color: '#2A3344',
    flex: 1,
  },
  checkDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E67E22',
  },
  requirementCard: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: 'rgba(40,60,90,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.13,
    shadowRadius: 6,
    elevation: 3,
  },
  requirementInfo: { flex: 1 },
  requirementLabel: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12,
    color: '#9BA3B0',
  },
  requirementValue: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 15,
  },
  requirementHave: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12,
    color: '#9BA3B0',
  },
  openBizBtn: {
    borderRadius: 13,
    overflow: 'hidden',
    position: 'relative',
  },
  openBizBtnDisabled: {
    opacity: 0.7,
  },
  openBizGradient: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 13,
    zIndex: 1,
  },
  openBizText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 14,
    color: '#fff',
  },
  openBizShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#4A8A2E',
    borderBottomLeftRadius: 13,
    borderBottomRightRadius: 13,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/BusinessTypePickerSheet.tsx
git commit -m "feat: add BusinessTypePickerSheet component for business type selection"
```

---

### Task 7: FloorCard — Dynamic Floor Support

**Files:**
- Modify: `src/components/FloorCard.tsx`

**Interfaces:**
- Consumes: `openedFloorTypes` from `useGameStore`, `gameConfig.floorTypes`
- Produces: `FloorCard` that renders correctly for floor 5 with any chosen floor type

---

- [ ] **Step 1: Add violet/red color schemes and dynamic floor support**

In `src/components/FloorCard.tsx`:

**a)** Extend `FLOOR_SCHEMES` with type-based entries. Add after the existing floor ID entries:

```typescript
// Dynamic floor type color schemes (for floors not in gameConfig.floors)
const FLOOR_TYPE_SCHEMES: Record<string, FloorColorScheme> = {
  green:  FLOOR_SCHEMES[2],
  blue:   FLOOR_SCHEMES[3],
  yellow: FLOOR_SCHEMES[4],
  violet: {
    color: '#9A6FD0',
    headerShadowColor: 'rgba(85,40,170,0.4)',
    bodyColor: '#E8DEFE',
    cardBg: '#F2ECFF',
    nameColor: '#6A40A0',
    stars: 0,
  },
  red: {
    color: '#4C9BDD',
    headerShadowColor: 'rgba(0,76,142,0.4)',
    bodyColor: '#C9E5F8',
    cardBg: '#E4F1FB',
    nameColor: '#006DAB',
    stars: 0,
  },
};
```

**b)** In `FloorCardInner`, add `openedFloorTypes` from the store:

```typescript
  const openedFloorTypes = useGameStore((s) => s.openedFloorTypes);
```

**c)** Update the scheme and config resolution:

```typescript
  const dynamicFloorType = openedFloorTypes?.[String(floorId)];
  const scheme = FLOOR_SCHEMES[floorId] ?? (dynamicFloorType ? FLOOR_TYPE_SCHEMES[dynamicFloorType] : undefined) ?? FLOOR_SCHEMES[2];
  const floorConfig = gameConfig.floors.find((f) => f.id === floorId);
  const availableTypes = floorConfig?.availableTypes
    ?? (dynamicFloorType ? (gameConfig.floorTypes[dynamicFloorType]?.dreamJobs ?? []) : []);
  // Product images: use floor-2 images as placeholder for unknown floors
  const products = PRODUCT_IMAGES[floorId] ?? PRODUCT_IMAGES[2];
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/FloorCard.tsx
git commit -m "feat: FloorCard supports dynamic floor type schemes for floor 5+"
```

---

### Task 8: game.tsx Integration

**Files:**
- Modify: `app/(tabs)/game.tsx`

**Interfaces:**
- Consumes: `UnderConstructionBanner` (Task 5), `BusinessTypePickerSheet` (Task 6); `useGameStore` `buyFloor`, `openFloor`, `underConstruction`; `now` from `useGameClock`

---

- [ ] **Step 1: Update imports and store selectors**

In `app/(tabs)/game.tsx`:

**a)** Add imports:

```typescript
import UnderConstructionBanner from '../../src/components/UnderConstructionBanner';
import BusinessTypePickerSheet from '../../src/components/BusinessTypePickerSheet';
import type { UnderConstructionState } from '../../shared/types';
```

**b)** Add store selectors in `GameScreen`:

```typescript
  const underConstruction = useGameStore((s) => s.underConstruction);
  const buyFloor = useGameStore((s) => s.buyFloor);
  const openFloor = useGameStore((s) => s.openFloor);
  const [pickerOpen, setPickerOpen] = useState(false);
```

- [ ] **Step 2: Make FLOOR_LIST dynamic**

Remove the static `FLOOR_LIST` constant and `NEXT_FLOOR_NUMBER` constant. Replace with a computed value inside the component:

```typescript
  // Compute next floor id: one above the highest opened or pre-configured floor
  const allFloorIds = useGameStore((s) => s.floors.map((f) => f.id));
  const highestFloorId = Math.max(...allFloorIds, ...gameConfig.floors.map((f) => f.id));
  const nextFloorId = highestFloorId + 1;
  const nextFloorUnlock = gameConfig.floorUnlocks.find((f) => f.floorId === nextFloorId);

  const floorList: FloorItem[] = React.useMemo(() => {
    const items: FloorItem[] = [];
    // Top: either construction banner or buy banner (if next floor has unlock config)
    if (underConstruction) {
      items.push({ type: 'underConstruction' });
    } else if (nextFloorUnlock) {
      items.push({ type: 'buyFloor' });
    }
    // Production floors in reverse order (highest first)
    const sortedFloorIds = [...allFloorIds].sort((a, b) => b - a);
    for (const id of sortedFloorIds) {
      items.push({ type: 'production', id });
    }
    items.push({ type: 'hotel' });
    items.push({ type: 'lobby' });
    return items;
  }, [underConstruction, nextFloorUnlock, allFloorIds]);
```

- [ ] **Step 3: Update FloorItem type and renderItem**

Update `FloorItem` type:

```typescript
type FloorItem =
  | { type: 'production'; id: number }
  | { type: 'hotel' }
  | { type: 'lobby' }
  | { type: 'buyFloor' }
  | { type: 'underConstruction' };
```

Update `keyExtractor`:

```typescript
function keyExtractor(item: FloorItem): string {
  if (item.type === 'production') return `prod-${item.id}`;
  return item.type;
}
```

In `renderItem`, add the `underConstruction` case before the `buyFloor` case:

```typescript
    if (item.type === 'underConstruction' && underConstruction) {
      return (
        <View style={styles.floorWrapper}>
          <UnderConstructionBanner
            floorId={underConstruction.floorId}
            endsAt={underConstruction.startedAt + underConstruction.durationMs}
            now={now}
            onOpenFloor={() => setPickerOpen(true)}
          />
        </View>
      );
    }
```

Update the `buyFloor` case:

```typescript
    if (item.type === 'buyFloor' && nextFloorUnlock) {
      return (
        <View style={styles.floorWrapper}>
          <BuyFloorBanner
            nextFloorNumber={nextFloorId}
            price={nextFloorUnlock.price}
            currency={nextFloorUnlock.currency}
            onPress={() => {
              const currentAmount = nextFloorUnlock.currency === 'gems' ? gems : balance;
              if (currentAmount < nextFloorUnlock.price) {
                showInsufficientResources({
                  currency: nextFloorUnlock.currency,
                  need: nextFloorUnlock.price,
                  have: currentAmount,
                });
                return;
              }
              buyFloor(nextFloorId);
            }}
          />
        </View>
      );
    }
```

- [ ] **Step 4: Add BusinessTypePickerSheet to the return**

In the `return` JSX, add before `<LevelUpModal .../>`:

```typescript
      {underConstruction && (
        <BusinessTypePickerSheet
          visible={pickerOpen}
          underConstruction={underConstruction}
          onClose={() => setPickerOpen(false)}
          onOpen={(floorType) => {
            openFloor(underConstruction.floorId, floorType);
            setPickerOpen(false);
          }}
        />
      )}
```

- [ ] **Step 5: Update `renderItem` dependency array**

Add `underConstruction`, `buyFloor`, `openFloor`, `nextFloorId`, `nextFloorUnlock` to the `useCallback` deps:

```typescript
  }, [balance, now, hotelOccupied, hotelTotal, lobbyVisitors.length, nextVisitorAt,
      underConstruction, buyFloor, openFloor, nextFloorId, nextFloorUnlock, gems, showInsufficientResources]);
```

- [ ] **Step 6: Remove old static constants**

Delete the lines:
```typescript
const NEXT_FLOOR_NUMBER = gameConfig.floors[gameConfig.floors.length - 1].id + 1;
const FLOOR_BUY_PRICE = 250;
const FLOOR_BUY_CURRENCY: 'coins' | 'gems' = 'gems';
const FLOOR_LIST: FloorItem[] = [...]
```

- [ ] **Step 7: Check TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add app/(tabs)/game.tsx
git commit -m "feat: wire up floor purchase flow in game.tsx — dynamic floor list, construction banner, business picker"
```

---

## Self-Review Checklist

| Spec Requirement | Task |
|---|---|
| Buying floor deducts gems, starts construction timer | Task 3 (`buy_floor` handler) + Task 4 (store action) + Task 8 (banner press) |
| Timer persists across app restarts | Task 1 (`underConstruction` in GameState) + Task 4 (hydrate/reconcile) |
| UnderConstructionBanner shows countdown | Task 5 |
| "Відкрити поверх" button when timer = 0 | Task 5 |
| BusinessTypePickerSheet shows 5 types | Task 6 |
| Shows required tool + count per type | Task 6 |
| "Відкрити бізнес" enabled only if tools sufficient | Task 6 |
| `open_floor` consumes tools, adds floor | Task 3 (`open_floor` handler) |
| New floor appears in tower with IDLE productions | Task 3 + Task 8 |
| FloorCard renders correctly for floor 5 | Task 7 |
| Tools move to GameState (synced to server) | Task 1 + Task 4 |
| `requiredTool` random at purchase time, embedded in command | Task 4 (`buyFloor` action) |
| Only one construction at a time | Task 3 (guard check) |
| Violet/red production types defined | Task 2 |
