# Lobby & Elevator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lobby floor (floor 0) with an elevator mini-game, 4 visitor roles, tip economy, daily tips plan, elevator/lobby upgrades, and full command-log sync.

**Architecture:** All lobby actions go through the shared command-log engine (`processCommand`). New `Visitor` type added to `GameState`. Gems move from client-only store into shared `GameState` for server-validated spending. A new `LobbyPanel` bottom-sheet component (same pattern as `HotelPanel`) handles the UI.

**Tech Stack:** TypeScript, Zod schemas, Zustand store, React Native, Reanimated, expo-linear-gradient, react-native-gesture-handler.

## Global Constraints

- All UI text is Ukrainian.
- Font family: Fredoka (weights 400/500/600/700).
- All currency operations go through the command log (no direct balance mutations).
- Tests run with `npm test` (Jest + ts-jest, `testEnvironment: node`).
- Existing tests must keep passing.

---

### Task 1: Schemas, Types & Config

**Files:**
- Create: `shared/schemas/visitor.ts`
- Modify: `shared/schemas/command.ts`
- Modify: `shared/schemas/gameState.ts`
- Modify: `shared/schemas/gameConfig.ts`
- Modify: `shared/types/index.ts`
- Modify: `shared/config/gameConfig.ts`
- Test: `shared/schemas/__tests__/schemas.test.ts`
- Test: `shared/config/__tests__/gameConfig.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces:
  - `VisitorSchema` / `Visitor` type with fields `{ id, role, targetFloor, hairColor, female }`
  - `VisitorRoleSchema` — `z.enum(['guest', 'businessman', 'deliverer', 'seller'])`
  - 7 new command schemas: `SpawnVisitorCommandSchema`, `LiftVisitorCommandSchema`, `CollectTipCommandSchema`, `DeliverAllCommandSchema`, `UpgradeElevatorCommandSchema`, `UpgradeLobbyCommandSchema`, `ClaimDailyRewardCommandSchema`
  - Extended `GameStateSchema` with lobby fields + `gems`
  - Extended `GameConfigSchema` with `lobbyConfig` object
  - Updated `createInitialState` returning lobby defaults
  - All new types exported from `shared/types/index.ts`

- [ ] **Step 1: Create `shared/schemas/visitor.ts`**

```typescript
import { z } from 'zod';

export const VisitorRoleSchema = z.enum(['guest', 'businessman', 'deliverer', 'seller']);

export const VisitorSchema = z.object({
  id: z.string(),
  role: VisitorRoleSchema,
  targetFloor: z.number().int().positive(),
  hairColor: z.string(),
  female: z.boolean(),
});
```

- [ ] **Step 2: Add 7 lobby command schemas to `shared/schemas/command.ts`**

Add after the `EvictWorkerCommandSchema`:

```typescript
import { VisitorRoleSchema } from './visitor';

const TimestampedBaseSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
});

export const SpawnVisitorCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('spawn_visitor'),
  visitorId: z.string(),
  role: VisitorRoleSchema,
  targetFloor: z.number().int().positive(),
  hairColor: z.string(),
  female: z.boolean(),
});

export const LiftVisitorCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('lift_visitor'),
});

export const CollectTipCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('collect_tip'),
});

export const DeliverAllCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('deliver_all'),
});

export const UpgradeElevatorCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('upgrade_elevator'),
});

export const UpgradeLobbyCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('upgrade_lobby'),
});

export const ClaimDailyRewardCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('claim_daily_reward'),
});
```

Update the `CommandSchema` discriminated union to include all 7:

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
]);
```

- [ ] **Step 3: Add lobby config schema to `shared/schemas/gameConfig.ts`**

Add after `FloorConfigSchema`:

```typescript
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
```

Update `GameConfigSchema`:

```typescript
export const GameConfigSchema = z.object({
  floors: z.array(FloorConfigSchema).min(1),
  productionTypes: z.record(z.string(), ProductionTypeConfigSchema),
  floorTypes: z.record(z.string(), FloorTypeConfigSchema),
  startingBalance: z.number().nonnegative(),
  hotelCapacity: z.number().int().positive(),
  lobbyConfig: LobbyConfigSchema,
});
```

- [ ] **Step 4: Extend `GameStateSchema` in `shared/schemas/gameState.ts`**

```typescript
import { VisitorSchema } from './visitor';

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
});
```

- [ ] **Step 5: Export new types from `shared/types/index.ts`**

Add to existing imports and exports:

```typescript
import { VisitorSchema, VisitorRoleSchema } from '../schemas/visitor';
import {
  SpawnVisitorCommandSchema, LiftVisitorCommandSchema, CollectTipCommandSchema,
  DeliverAllCommandSchema, UpgradeElevatorCommandSchema, UpgradeLobbyCommandSchema,
  ClaimDailyRewardCommandSchema,
} from '../schemas/command';
import { LobbyConfigSchema } from '../schemas/gameConfig';

export type Visitor = z.infer<typeof VisitorSchema>;
export type VisitorRole = z.infer<typeof VisitorRoleSchema>;
export type SpawnVisitorCommand = z.infer<typeof SpawnVisitorCommandSchema>;
export type LiftVisitorCommand = z.infer<typeof LiftVisitorCommandSchema>;
export type CollectTipCommand = z.infer<typeof CollectTipCommandSchema>;
export type DeliverAllCommand = z.infer<typeof DeliverAllCommandSchema>;
export type UpgradeElevatorCommand = z.infer<typeof UpgradeElevatorCommandSchema>;
export type UpgradeLobbyCommand = z.infer<typeof UpgradeLobbyCommandSchema>;
export type ClaimDailyRewardCommand = z.infer<typeof ClaimDailyRewardCommandSchema>;
export type LobbyConfig = z.infer<typeof LobbyConfigSchema>;
```

- [ ] **Step 6: Add lobby config values and update `createInitialState` in `shared/config/gameConfig.ts`**

Add `lobbyConfig` to `rawConfig`:

```typescript
lobbyConfig: {
  visitorSpawnInterval: 120_000,
  dailyTipsTarget: 10_000,
  dailyTipsReward: 5,
  dailyGemLimitBase: 15,
  guestTipBase: 10,
  businessmanFallbackBase: 100,
  deliverySpeedBonus: 0.05,
  sellSpeedBonus: 0.05,
  elevatorUpgradeBaseCost: 3,
  lobbyUpgradeBaseCost: 5,
  lobbyUpgradeSeats: 3,
  defaultLobbyCapacity: 10,
},
```

Update `createInitialState`:

```typescript
export function createInitialState(config: GameConfig): GameState {
  return {
    balance: config.startingBalance,
    gems: 20,
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
    lobbyVisitors: [],
    lobbyCapacity: config.lobbyConfig.defaultLobbyCapacity,
    elevatorLevel: 1,
    elevatorFloor: 0,
    dailyTips: 0,
    dailyGemsCollected: 0,
    dailyTipsRewardClaimed: false,
    lastDailyReset: 0,
    nextVisitorAt: 0,
  };
}
```

- [ ] **Step 7: Write schema validation tests**

Add to `shared/schemas/__tests__/schemas.test.ts`:

```typescript
import { VisitorSchema, VisitorRoleSchema } from '../visitor';
import { SpawnVisitorCommandSchema, LiftVisitorCommandSchema, CollectTipCommandSchema, DeliverAllCommandSchema, UpgradeElevatorCommandSchema, UpgradeLobbyCommandSchema, ClaimDailyRewardCommandSchema, CommandSchema } from '../command';

describe('VisitorSchema', () => {
  it('validates a valid visitor', () => {
    const visitor = { id: 'v1', role: 'guest', targetFloor: 3, hairColor: '#5C3A22', female: false };
    expect(VisitorSchema.parse(visitor)).toEqual(visitor);
  });

  it('rejects invalid role', () => {
    expect(() => VisitorSchema.parse({ id: 'v1', role: 'vip', targetFloor: 3, hairColor: '#000', female: true })).toThrow();
  });
});

describe('Lobby command schemas', () => {
  it('validates spawn_visitor command', () => {
    const cmd = { id: 'c1', type: 'spawn_visitor', timestamp: 1000, visitorId: 'v1', role: 'guest', targetFloor: 3, hairColor: '#5C3A22', female: false };
    expect(CommandSchema.parse(cmd).type).toBe('spawn_visitor');
  });

  it('validates lift_visitor command', () => {
    const cmd = { id: 'c1', type: 'lift_visitor', timestamp: 1000 };
    expect(CommandSchema.parse(cmd).type).toBe('lift_visitor');
  });

  it('validates collect_tip command', () => {
    const cmd = { id: 'c1', type: 'collect_tip', timestamp: 1000 };
    expect(CommandSchema.parse(cmd).type).toBe('collect_tip');
  });

  it('validates deliver_all command', () => {
    const cmd = { id: 'c1', type: 'deliver_all', timestamp: 1000 };
    expect(CommandSchema.parse(cmd).type).toBe('deliver_all');
  });

  it('validates upgrade_elevator command', () => {
    const cmd = { id: 'c1', type: 'upgrade_elevator', timestamp: 1000 };
    expect(CommandSchema.parse(cmd).type).toBe('upgrade_elevator');
  });

  it('validates upgrade_lobby command', () => {
    const cmd = { id: 'c1', type: 'upgrade_lobby', timestamp: 1000 };
    expect(CommandSchema.parse(cmd).type).toBe('upgrade_lobby');
  });

  it('validates claim_daily_reward command', () => {
    const cmd = { id: 'c1', type: 'claim_daily_reward', timestamp: 1000 };
    expect(CommandSchema.parse(cmd).type).toBe('claim_daily_reward');
  });
});
```

- [ ] **Step 8: Run all tests**

Run: `npm test`
Expected: ALL PASS (existing + new schema tests).

- [ ] **Step 9: Commit**

```bash
git add shared/schemas/visitor.ts shared/schemas/command.ts shared/schemas/gameState.ts shared/schemas/gameConfig.ts shared/types/index.ts shared/config/gameConfig.ts shared/schemas/__tests__/schemas.test.ts shared/config/__tests__/gameConfig.test.ts
git commit -m "feat(lobby): add visitor/command schemas, lobby config, gameState extensions"
```

---

### Task 2: Lobby Utility Functions

**Files:**
- Create: `shared/engine/lobbyUtils.ts`
- Create: `shared/engine/__tests__/lobbyUtils.test.ts`

**Interfaces:**
- Consumes: `Visitor`, `VisitorRole`, `GameState`, `GameConfig`, `Floor`, `Worker` from `shared/types`; `HAIR_COLORS` from `shared/config/workerNames`
- Produces:
  - `calculateTip(role: VisitorRole, targetFloor: number, elevatorLevel: number, config: GameConfig): number`
  - `calculateElevatorUpgradeCost(currentLevel: number, config: GameConfig): number`
  - `calculateLobbyUpgradeCost(currentCapacity: number, config: GameConfig): number`
  - `getMaxElevatorLevel(config: GameConfig): number`
  - `getMaxLobbyCapacity(playerLevel: number, config: GameConfig): number`
  - `checkDailyReset(state: GameState, commandTimestamp: number): GameState`
  - `generateRandomVisitor(state: GameState, config: GameConfig): Visitor`

- [ ] **Step 1: Write failing tests in `shared/engine/__tests__/lobbyUtils.test.ts`**

```typescript
import {
  calculateTip,
  calculateElevatorUpgradeCost,
  calculateLobbyUpgradeCost,
  getMaxElevatorLevel,
  getMaxLobbyCapacity,
  checkDailyReset,
  generateRandomVisitor,
} from '../lobbyUtils';
import { createInitialState } from '../../config/gameConfig';
import type { GameConfig, GameState } from '../../types';

const testConfig: GameConfig = {
  floorTypes: {
    green: { category: 'Test', shirtColor: '#62B23F', accent: '#4E9A2E', dreamJobs: ['coffee'] },
  },
  floors: [
    { id: 2, name: 'Floor 2', slots: 3, floorType: 'green', availableTypes: ['coffee'] },
    { id: 3, name: 'Floor 3', slots: 3, floorType: 'green', availableTypes: ['coffee'] },
    { id: 4, name: 'Floor 4', slots: 3, floorType: 'green', availableTypes: ['coffee'] },
  ],
  productionTypes: {
    coffee: { buyCost: 10, deliveryDuration: 5000, sellDuration: 10000, batchValue: 25, displayName: 'Coffee' },
  },
  startingBalance: 1000,
  hotelCapacity: 10,
  lobbyConfig: {
    visitorSpawnInterval: 120_000,
    dailyTipsTarget: 10_000,
    dailyTipsReward: 5,
    dailyGemLimitBase: 15,
    guestTipBase: 10,
    businessmanFallbackBase: 100,
    deliverySpeedBonus: 0.05,
    sellSpeedBonus: 0.05,
    elevatorUpgradeBaseCost: 3,
    lobbyUpgradeBaseCost: 5,
    lobbyUpgradeSeats: 3,
    defaultLobbyCapacity: 10,
  },
};

function makeState(overrides?: Partial<GameState>): GameState {
  return { ...createInitialState(testConfig), ...overrides };
}

describe('calculateTip', () => {
  it('guest tip = base * level * floor', () => {
    expect(calculateTip('guest', 4, 1, testConfig)).toBe(40);
    expect(calculateTip('guest', 4, 3, testConfig)).toBe(120);
    expect(calculateTip('guest', 1, 1, testConfig)).toBe(10);
  });

  it('deliverer tip same as guest', () => {
    expect(calculateTip('deliverer', 3, 2, testConfig)).toBe(60);
  });

  it('seller tip same as guest', () => {
    expect(calculateTip('seller', 3, 2, testConfig)).toBe(60);
  });

  it('businessman fallback tip = fallbackBase * level * floor', () => {
    expect(calculateTip('businessman', 4, 1, testConfig)).toBe(400);
    expect(calculateTip('businessman', 2, 3, testConfig)).toBe(600);
  });
});

describe('calculateElevatorUpgradeCost', () => {
  it('level 1 costs 3 gems', () => {
    expect(calculateElevatorUpgradeCost(1, testConfig)).toBe(3);
  });
  it('level 2 costs 5 gems', () => {
    expect(calculateElevatorUpgradeCost(2, testConfig)).toBe(5);
  });
  it('level 3 costs 7 gems', () => {
    expect(calculateElevatorUpgradeCost(3, testConfig)).toBe(7);
  });
});

describe('calculateLobbyUpgradeCost', () => {
  it('capacity 10 costs 5 gems', () => {
    expect(calculateLobbyUpgradeCost(10, testConfig)).toBe(5);
  });
  it('capacity 13 costs 7 gems', () => {
    expect(calculateLobbyUpgradeCost(13, testConfig)).toBe(7);
  });
  it('capacity 16 costs 9 gems', () => {
    expect(calculateLobbyUpgradeCost(16, testConfig)).toBe(9);
  });
});

describe('getMaxElevatorLevel', () => {
  it('equals total floors above lobby (hotel=1 + 3 production = 4)', () => {
    expect(getMaxElevatorLevel(testConfig)).toBe(4);
  });
});

describe('getMaxLobbyCapacity', () => {
  it('returns 10 + playerLevel * 3', () => {
    expect(getMaxLobbyCapacity(1, testConfig)).toBe(13);
    expect(getMaxLobbyCapacity(5, testConfig)).toBe(25);
    expect(getMaxLobbyCapacity(10, testConfig)).toBe(40);
  });
});

describe('checkDailyReset', () => {
  it('resets counters when timestamp crosses midnight', () => {
    const midnight = new Date('2026-06-25T00:00:00').getTime();
    const state = makeState({
      dailyTips: 5000,
      dailyGemsCollected: 10,
      dailyTipsRewardClaimed: true,
      lastDailyReset: midnight,
    });
    const nextDay = midnight + 25 * 60 * 60 * 1000;
    const result = checkDailyReset(state, nextDay);
    expect(result.dailyTips).toBe(0);
    expect(result.dailyGemsCollected).toBe(0);
    expect(result.dailyTipsRewardClaimed).toBe(false);
    expect(result.lastDailyReset).toBeGreaterThan(midnight);
  });

  it('does not reset when same day', () => {
    const midnight = new Date('2026-06-25T00:00:00').getTime();
    const state = makeState({
      dailyTips: 5000,
      dailyGemsCollected: 10,
      lastDailyReset: midnight,
    });
    const sameDay = midnight + 10 * 60 * 60 * 1000;
    const result = checkDailyReset(state, sameDay);
    expect(result.dailyTips).toBe(5000);
    expect(result.dailyGemsCollected).toBe(10);
  });

  it('initializes lastDailyReset on first command when 0', () => {
    const state = makeState({ lastDailyReset: 0 });
    const now = new Date('2026-06-25T14:30:00').getTime();
    const result = checkDailyReset(state, now);
    expect(result.lastDailyReset).toBeGreaterThan(0);
  });
});

describe('generateRandomVisitor', () => {
  it('generates a visitor with valid fields', () => {
    const state = makeState();
    const visitor = generateRandomVisitor(state, testConfig);
    expect(visitor.id).toBeDefined();
    expect(['guest', 'businessman', 'deliverer', 'seller']).toContain(visitor.role);
    expect(visitor.targetFloor).toBeGreaterThanOrEqual(1);
    expect(visitor.targetFloor).toBeLessThanOrEqual(4);
    expect(visitor.hairColor).toBeDefined();
    expect(typeof visitor.female).toBe('boolean');
  });

  it('only produces guest or businessman when no deliveries/sales active', () => {
    const state = makeState();
    const roles = new Set<string>();
    for (let i = 0; i < 200; i++) {
      roles.add(generateRandomVisitor(state, testConfig).role);
    }
    expect(roles.has('deliverer')).toBe(false);
    expect(roles.has('seller')).toBe(false);
  });

  it('can produce deliverer when a slot is DELIVERING', () => {
    const state = makeState();
    state.floors[0].productions[0].stage = 'DELIVERING';
    state.floors[0].productions[0].stageStartedAt = 1000;
    const roles = new Set<string>();
    for (let i = 0; i < 500; i++) {
      roles.add(generateRandomVisitor(state, testConfig).role);
    }
    expect(roles.has('deliverer')).toBe(true);
    expect(roles.has('seller')).toBe(false);
  });

  it('businessman never targets floor 1', () => {
    const state = makeState();
    for (let i = 0; i < 500; i++) {
      const v = generateRandomVisitor(state, testConfig);
      if (v.role === 'businessman') {
        expect(v.targetFloor).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern=lobbyUtils`
Expected: FAIL — `lobbyUtils` module not found.

- [ ] **Step 3: Implement `shared/engine/lobbyUtils.ts`**

```typescript
import type { GameState, GameConfig, Visitor, VisitorRole } from '../types';
import { HAIR_COLORS } from '../config/workerNames';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function calculateTip(
  role: VisitorRole,
  targetFloor: number,
  elevatorLevel: number,
  config: GameConfig,
): number {
  if (role === 'businessman') {
    return config.lobbyConfig.businessmanFallbackBase * elevatorLevel * targetFloor;
  }
  return config.lobbyConfig.guestTipBase * elevatorLevel * targetFloor;
}

export function calculateElevatorUpgradeCost(currentLevel: number, config: GameConfig): number {
  return config.lobbyConfig.elevatorUpgradeBaseCost + (currentLevel - 1) * 2;
}

export function calculateLobbyUpgradeCost(currentCapacity: number, config: GameConfig): number {
  const tiers = (currentCapacity - config.lobbyConfig.defaultLobbyCapacity) / config.lobbyConfig.lobbyUpgradeSeats;
  return config.lobbyConfig.lobbyUpgradeBaseCost + tiers * 2;
}

export function getMaxElevatorLevel(config: GameConfig): number {
  return config.floors.length + 1;
}

export function getMaxLobbyCapacity(playerLevel: number, config: GameConfig): number {
  return config.lobbyConfig.defaultLobbyCapacity + playerLevel * config.lobbyConfig.lobbyUpgradeSeats;
}

function getMidnightBefore(timestamp: number): number {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function checkDailyReset(state: GameState, commandTimestamp: number): GameState {
  if (state.lastDailyReset === 0) {
    return { ...state, lastDailyReset: getMidnightBefore(commandTimestamp) };
  }

  const nextMidnight = state.lastDailyReset + 24 * 60 * 60 * 1000;
  if (commandTimestamp >= nextMidnight) {
    return {
      ...state,
      dailyTips: 0,
      dailyGemsCollected: 0,
      dailyTipsRewardClaimed: false,
      lastDailyReset: getMidnightBefore(commandTimestamp),
    };
  }

  return state;
}

export function generateRandomVisitor(state: GameState, config: GameConfig): Visitor {
  const totalFloors = config.floors.length + 1;

  const hasDelivering = state.floors.some((f) =>
    f.productions.some((p) => p.stage === 'DELIVERING'),
  );
  const hasSelling = state.floors.some((f) =>
    f.productions.some((p) => p.stage === 'SELLING'),
  );

  let role: VisitorRole;
  const businessmanRoll = Math.random();

  if (businessmanRoll < 0.03) {
    role = 'businessman';
  } else {
    if (hasDelivering && hasSelling) {
      const r = Math.random();
      if (r < 0.50) role = 'guest';
      else if (r < 0.75) role = 'deliverer';
      else role = 'seller';
    } else if (hasDelivering) {
      role = Math.random() < 0.75 ? 'guest' : 'deliverer';
    } else if (hasSelling) {
      role = Math.random() < 0.75 ? 'guest' : 'seller';
    } else {
      role = 'guest';
    }
  }

  let targetFloor: number;
  if (role === 'businessman') {
    targetFloor = 2 + Math.floor(Math.random() * (totalFloors - 1));
  } else if (role === 'deliverer') {
    const deliveringFloors = config.floors.filter((fc) => {
      const floor = state.floors.find((f) => f.id === fc.id);
      return floor?.productions.some((p) => p.stage === 'DELIVERING');
    });
    const picked = deliveringFloors[Math.floor(Math.random() * deliveringFloors.length)];
    targetFloor = picked.id;
  } else if (role === 'seller') {
    const sellingFloors = config.floors.filter((fc) => {
      const floor = state.floors.find((f) => f.id === fc.id);
      return floor?.productions.some((p) => p.stage === 'SELLING');
    });
    const picked = sellingFloors[Math.floor(Math.random() * sellingFloors.length)];
    targetFloor = picked.id;
  } else {
    targetFloor = 1 + Math.floor(Math.random() * totalFloors);
  }

  return {
    id: uuid(),
    role,
    targetFloor,
    hairColor: HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)],
    female: Math.random() < 0.5,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --testPathPattern=lobbyUtils`
Expected: ALL PASS.

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: ALL PASS (existing + new tests).

- [ ] **Step 6: Commit**

```bash
git add shared/engine/lobbyUtils.ts shared/engine/__tests__/lobbyUtils.test.ts
git commit -m "feat(lobby): add lobby utility functions (tips, upgrades, spawn, daily reset)"
```

---

### Task 3: Lobby Command Processing

**Files:**
- Create: `shared/engine/lobbyCommands.ts`
- Modify: `shared/engine/processCommand.ts`
- Create: `shared/engine/__tests__/lobbyCommands.test.ts`

**Interfaces:**
- Consumes: `calculateTip`, `calculateElevatorUpgradeCost`, `calculateLobbyUpgradeCost`, `getMaxElevatorLevel`, `checkDailyReset` from `shared/engine/lobbyUtils`; `generateRandomWorkers` from `shared/config/workerNames`; `ProcessResult` from `shared/engine/processCommand`
- Produces: `processLobbyCommand(state, command, config, playerLevel): ProcessResult` — handles all 7 lobby command types. Called from `processCommand` for lobby command types.

- [ ] **Step 1: Write failing tests in `shared/engine/__tests__/lobbyCommands.test.ts`**

```typescript
import { processCommand, type ProcessResult } from '../processCommand';
import { createInitialState } from '../../config/gameConfig';
import type { GameState, GameConfig, Command, Visitor } from '../../types';

const testConfig: GameConfig = {
  floorTypes: {
    green: { category: 'Test', shirtColor: '#62B23F', accent: '#4E9A2E', dreamJobs: ['coffee'] },
  },
  floors: [
    { id: 2, name: 'Floor 2', slots: 3, floorType: 'green', availableTypes: ['coffee'] },
    { id: 3, name: 'Floor 3', slots: 3, floorType: 'green', availableTypes: ['coffee'] },
  ],
  productionTypes: {
    coffee: { buyCost: 10, deliveryDuration: 5000, sellDuration: 10000, batchValue: 25, displayName: 'Coffee' },
  },
  startingBalance: 1000,
  hotelCapacity: 10,
  lobbyConfig: {
    visitorSpawnInterval: 120_000,
    dailyTipsTarget: 10_000,
    dailyTipsReward: 5,
    dailyGemLimitBase: 15,
    guestTipBase: 10,
    businessmanFallbackBase: 100,
    deliverySpeedBonus: 0.05,
    sellSpeedBonus: 0.05,
    elevatorUpgradeBaseCost: 3,
    lobbyUpgradeBaseCost: 5,
    lobbyUpgradeSeats: 3,
    defaultLobbyCapacity: 10,
  },
};

function makeVisitor(overrides?: Partial<Visitor>): Visitor {
  return { id: 'v1', role: 'guest', targetFloor: 3, hairColor: '#5C3A22', female: false, ...overrides };
}

function makeState(overrides?: Partial<GameState>): GameState {
  return { ...createInitialState(testConfig), ...overrides };
}

describe('spawn_visitor', () => {
  it('adds visitor to lobby', () => {
    const state = makeState();
    const cmd: Command = {
      id: 'c1', type: 'spawn_visitor', timestamp: 1000,
      visitorId: 'v1', role: 'guest', targetFloor: 3, hairColor: '#5C3A22', female: false,
    };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.lobbyVisitors).toHaveLength(1);
    expect(result.state.lobbyVisitors[0].id).toBe('v1');
    expect(result.state.nextVisitorAt).toBe(1000 + 120_000);
  });

  it('fails when lobby is full', () => {
    const visitors = Array.from({ length: 10 }, (_, i) => makeVisitor({ id: `v${i}` }));
    const state = makeState({ lobbyVisitors: visitors, lobbyCapacity: 10 });
    const cmd: Command = {
      id: 'c1', type: 'spawn_visitor', timestamp: 1000,
      visitorId: 'v99', role: 'guest', targetFloor: 2, hairColor: '#5C3A22', female: false,
    };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(false);
  });
});

describe('lift_visitor', () => {
  it('moves elevator up by elevatorLevel floors', () => {
    const state = makeState({ lobbyVisitors: [makeVisitor({ targetFloor: 3 })], elevatorLevel: 1 });
    const cmd: Command = { id: 'c1', type: 'lift_visitor', timestamp: 1000 };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.elevatorFloor).toBe(1);
  });

  it('clamps elevator to target floor', () => {
    const state = makeState({ lobbyVisitors: [makeVisitor({ targetFloor: 2 })], elevatorLevel: 3, elevatorFloor: 1 });
    const cmd: Command = { id: 'c1', type: 'lift_visitor', timestamp: 1000 };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.elevatorFloor).toBe(2);
  });

  it('fails when no visitors', () => {
    const state = makeState();
    const cmd: Command = { id: 'c1', type: 'lift_visitor', timestamp: 1000 };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(false);
  });
});

describe('collect_tip', () => {
  it('guest pays tip and is removed from queue', () => {
    const state = makeState({
      lobbyVisitors: [makeVisitor({ role: 'guest', targetFloor: 3 })],
      elevatorFloor: 3,
      elevatorLevel: 1,
    });
    const result = processCommand(state, { id: 'c1', type: 'collect_tip', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.balance).toBe(1000 + 30);
    expect(result.state.dailyTips).toBe(30);
    expect(result.state.lobbyVisitors).toHaveLength(0);
    expect(result.state.elevatorFloor).toBe(0);
  });

  it('guest to floor 1 creates a new worker', () => {
    const state = makeState({
      lobbyVisitors: [makeVisitor({ role: 'guest', targetFloor: 1 })],
      elevatorFloor: 1,
      elevatorLevel: 1,
    });
    const result = processCommand(state, { id: 'c1', type: 'collect_tip', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.workers).toHaveLength(1);
    expect(result.state.balance).toBe(1000 + 10);
  });

  it('businessman gives 1 gem within daily limit', () => {
    const state = makeState({
      lobbyVisitors: [makeVisitor({ role: 'businessman', targetFloor: 2 })],
      elevatorFloor: 2,
      elevatorLevel: 1,
      gems: 20,
      dailyGemsCollected: 0,
    });
    const result = processCommand(state, { id: 'c1', type: 'collect_tip', timestamp: 1000 } as Command, testConfig, 1000, 1);
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(21);
    expect(result.state.dailyGemsCollected).toBe(1);
    expect(result.state.balance).toBe(1000);
  });

  it('businessman gives fallback coins when gem limit reached', () => {
    const state = makeState({
      lobbyVisitors: [makeVisitor({ role: 'businessman', targetFloor: 2 })],
      elevatorFloor: 2,
      elevatorLevel: 1,
      gems: 20,
      dailyGemsCollected: 16,
    });
    const result = processCommand(state, { id: 'c1', type: 'collect_tip', timestamp: 1000 } as Command, testConfig, 1000, 1);
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(20);
    expect(result.state.balance).toBe(1000 + 200);
  });

  it('deliverer reduces delivery time by 5%', () => {
    const state = makeState({
      lobbyVisitors: [makeVisitor({ role: 'deliverer', targetFloor: 2 })],
      elevatorFloor: 2,
      elevatorLevel: 1,
    });
    state.floors[0].productions[0].stage = 'DELIVERING';
    state.floors[0].productions[0].stageStartedAt = 500;
    const result = processCommand(state, { id: 'c1', type: 'collect_tip', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.floors[0].productions[0].stageStartedAt).toBe(500 - 250);
    expect(result.state.balance).toBe(1000 + 20);
  });

  it('seller reduces sell time by 5%', () => {
    const state = makeState({
      lobbyVisitors: [makeVisitor({ role: 'seller', targetFloor: 2 })],
      elevatorFloor: 2,
      elevatorLevel: 1,
    });
    state.floors[0].productions[0].stage = 'SELLING';
    state.floors[0].productions[0].stageStartedAt = 500;
    const result = processCommand(state, { id: 'c1', type: 'collect_tip', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.floors[0].productions[0].stageStartedAt).toBe(500 - 500);
    expect(result.state.balance).toBe(1000 + 20);
  });

  it('fails when elevator not at target', () => {
    const state = makeState({
      lobbyVisitors: [makeVisitor({ targetFloor: 3 })],
      elevatorFloor: 1,
    });
    const result = processCommand(state, { id: 'c1', type: 'collect_tip', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(false);
  });
});

describe('deliver_all', () => {
  it('delivers all visitors for 1 gem', () => {
    const visitors = [
      makeVisitor({ id: 'v1', role: 'guest', targetFloor: 2 }),
      makeVisitor({ id: 'v2', role: 'guest', targetFloor: 3 }),
    ];
    const state = makeState({ lobbyVisitors: visitors, gems: 5, elevatorLevel: 1 });
    const result = processCommand(state, { id: 'c1', type: 'deliver_all', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(4);
    expect(result.state.lobbyVisitors).toHaveLength(0);
    expect(result.state.elevatorFloor).toBe(0);
    expect(result.state.balance).toBe(1000 + 20 + 30);
    expect(result.state.dailyTips).toBe(50);
  });

  it('fails with 0 gems', () => {
    const state = makeState({ lobbyVisitors: [makeVisitor()], gems: 0 });
    const result = processCommand(state, { id: 'c1', type: 'deliver_all', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(false);
  });

  it('fails with empty lobby', () => {
    const state = makeState({ gems: 5 });
    const result = processCommand(state, { id: 'c1', type: 'deliver_all', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(false);
  });
});

describe('upgrade_elevator', () => {
  it('increments elevator level and deducts gems', () => {
    const state = makeState({ gems: 10, elevatorLevel: 1 });
    const result = processCommand(state, { id: 'c1', type: 'upgrade_elevator', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.elevatorLevel).toBe(2);
    expect(result.state.gems).toBe(7);
  });

  it('fails at max level', () => {
    const state = makeState({ gems: 100, elevatorLevel: 3 });
    const result = processCommand(state, { id: 'c1', type: 'upgrade_elevator', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(false);
  });

  it('fails with insufficient gems', () => {
    const state = makeState({ gems: 0, elevatorLevel: 1 });
    const result = processCommand(state, { id: 'c1', type: 'upgrade_elevator', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(false);
  });
});

describe('upgrade_lobby', () => {
  it('adds seats and deducts gems', () => {
    const state = makeState({ gems: 10, lobbyCapacity: 10 });
    const result = processCommand(state, { id: 'c1', type: 'upgrade_lobby', timestamp: 1000 } as Command, testConfig, 1000, 5);
    expect(result.success).toBe(true);
    expect(result.state.lobbyCapacity).toBe(13);
    expect(result.state.gems).toBe(5);
  });

  it('fails at max capacity for player level', () => {
    const state = makeState({ gems: 100, lobbyCapacity: 13 });
    const result = processCommand(state, { id: 'c1', type: 'upgrade_lobby', timestamp: 1000 } as Command, testConfig, 1000, 1);
    expect(result.success).toBe(false);
  });
});

describe('claim_daily_reward', () => {
  it('grants gems when target met and not claimed', () => {
    const state = makeState({ dailyTips: 10_000, dailyTipsRewardClaimed: false, gems: 20 });
    const result = processCommand(state, { id: 'c1', type: 'claim_daily_reward', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(25);
    expect(result.state.dailyTipsRewardClaimed).toBe(true);
  });

  it('fails when already claimed', () => {
    const state = makeState({ dailyTips: 10_000, dailyTipsRewardClaimed: true, gems: 20 });
    const result = processCommand(state, { id: 'c1', type: 'claim_daily_reward', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(false);
  });

  it('fails when target not met', () => {
    const state = makeState({ dailyTips: 5_000, dailyTipsRewardClaimed: false });
    const result = processCommand(state, { id: 'c1', type: 'claim_daily_reward', timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern=lobbyCommands`
Expected: FAIL — lobby command types not handled in `processCommand`.

- [ ] **Step 3: Implement `shared/engine/lobbyCommands.ts`**

```typescript
import type { GameState, GameConfig, Command, Visitor } from '../types';
import type { ProcessResult } from './processCommand';
import {
  calculateTip,
  calculateElevatorUpgradeCost,
  calculateLobbyUpgradeCost,
  getMaxElevatorLevel,
  getMaxLobbyCapacity,
  checkDailyReset,
} from './lobbyUtils';
import { generateRandomWorkers } from '../config/workerNames';

type LobbyCommand = Extract<Command, { type:
  'spawn_visitor' | 'lift_visitor' | 'collect_tip' |
  'deliver_all' | 'upgrade_elevator' | 'upgrade_lobby' | 'claim_daily_reward'
}>;

export function processLobbyCommand(
  state: GameState,
  command: LobbyCommand,
  config: GameConfig,
  playerLevel: number,
): ProcessResult {
  state = checkDailyReset(state, command.timestamp);

  switch (command.type) {
    case 'spawn_visitor':
      return handleSpawnVisitor(state, command, config);
    case 'lift_visitor':
      return handleLiftVisitor(state);
    case 'collect_tip':
      return handleCollectTip(state, config, playerLevel);
    case 'deliver_all':
      return handleDeliverAll(state, config, playerLevel);
    case 'upgrade_elevator':
      return handleUpgradeElevator(state, config);
    case 'upgrade_lobby':
      return handleUpgradeLobby(state, config, playerLevel);
    case 'claim_daily_reward':
      return handleClaimDailyReward(state, config);
  }
}

function handleSpawnVisitor(
  state: GameState,
  command: Extract<Command, { type: 'spawn_visitor' }>,
  config: GameConfig,
): ProcessResult {
  if (state.lobbyVisitors.length >= state.lobbyCapacity) {
    return { success: false, state, error: 'Lobby is full' };
  }
  const visitor: Visitor = {
    id: command.visitorId,
    role: command.role,
    targetFloor: command.targetFloor,
    hairColor: command.hairColor,
    female: command.female,
  };
  return {
    success: true,
    state: {
      ...state,
      lobbyVisitors: [...state.lobbyVisitors, visitor],
      nextVisitorAt: command.timestamp + config.lobbyConfig.visitorSpawnInterval,
    },
  };
}

function handleLiftVisitor(state: GameState): ProcessResult {
  if (state.lobbyVisitors.length === 0) {
    return { success: false, state, error: 'No visitors in lobby' };
  }
  const active = state.lobbyVisitors[0];
  const move = Math.min(state.elevatorLevel, active.targetFloor - state.elevatorFloor);
  if (move <= 0) {
    return { success: false, state, error: 'Already at target floor' };
  }
  return {
    success: true,
    state: { ...state, elevatorFloor: state.elevatorFloor + move },
  };
}

function applyVisitorEffect(
  state: GameState,
  visitor: Visitor,
  config: GameConfig,
  playerLevel: number,
): GameState {
  const tip = calculateTip(visitor.role, visitor.targetFloor, state.elevatorLevel, config);
  let { balance, gems, dailyTips, dailyGemsCollected, workers, floors } = state;

  if (visitor.role === 'businessman') {
    const gemLimit = config.lobbyConfig.dailyGemLimitBase + playerLevel;
    if (dailyGemsCollected < gemLimit) {
      gems += 1;
      dailyGemsCollected += 1;
    } else {
      balance += tip;
      dailyTips += tip;
    }
  } else {
    balance += tip;
    dailyTips += tip;
  }

  if (visitor.role === 'guest' && visitor.targetFloor === 1) {
    const [newWorker] = generateRandomWorkers(1, config);
    workers = [...workers, newWorker];
  }

  if (visitor.role === 'deliverer') {
    const floorIdx = floors.findIndex((f) => f.id === visitor.targetFloor);
    if (floorIdx !== -1) {
      const slotIdx = floors[floorIdx].productions.findIndex((p) => p.stage === 'DELIVERING');
      if (slotIdx !== -1) {
        const typeId = floors[floorIdx].productions[slotIdx].typeId;
        const typeConfig = typeId ? config.productionTypes[typeId] : null;
        if (typeConfig) {
          const reduction = Math.floor(typeConfig.deliveryDuration * config.lobbyConfig.deliverySpeedBonus);
          floors = floors.map((f, fi) => {
            if (fi !== floorIdx) return f;
            return {
              ...f,
              productions: f.productions.map((p, si) => {
                if (si !== slotIdx) return p;
                return { ...p, stageStartedAt: p.stageStartedAt - reduction };
              }),
            };
          });
        }
      }
    }
  }

  if (visitor.role === 'seller') {
    const floorIdx = floors.findIndex((f) => f.id === visitor.targetFloor);
    if (floorIdx !== -1) {
      const slotIdx = floors[floorIdx].productions.findIndex((p) => p.stage === 'SELLING');
      if (slotIdx !== -1) {
        const typeId = floors[floorIdx].productions[slotIdx].typeId;
        const typeConfig = typeId ? config.productionTypes[typeId] : null;
        if (typeConfig) {
          const reduction = Math.floor(typeConfig.sellDuration * config.lobbyConfig.sellSpeedBonus);
          floors = floors.map((f, fi) => {
            if (fi !== floorIdx) return f;
            return {
              ...f,
              productions: f.productions.map((p, si) => {
                if (si !== slotIdx) return p;
                return { ...p, stageStartedAt: p.stageStartedAt - reduction };
              }),
            };
          });
        }
      }
    }
  }

  return { ...state, balance, gems, dailyTips, dailyGemsCollected, workers, floors };
}

function handleCollectTip(
  state: GameState,
  config: GameConfig,
  playerLevel: number,
): ProcessResult {
  if (state.lobbyVisitors.length === 0) {
    return { success: false, state, error: 'No visitors' };
  }
  const active = state.lobbyVisitors[0];
  if (state.elevatorFloor !== active.targetFloor) {
    return { success: false, state, error: 'Elevator not at target floor' };
  }
  let newState = applyVisitorEffect(state, active, config, playerLevel);
  newState = {
    ...newState,
    lobbyVisitors: newState.lobbyVisitors.slice(1),
    elevatorFloor: 0,
  };
  return { success: true, state: newState };
}

function handleDeliverAll(
  state: GameState,
  config: GameConfig,
  playerLevel: number,
): ProcessResult {
  if (state.gems < 1) {
    return { success: false, state, error: 'Not enough gems' };
  }
  if (state.lobbyVisitors.length === 0) {
    return { success: false, state, error: 'No visitors to deliver' };
  }
  let newState = { ...state, gems: state.gems - 1 };
  for (const visitor of state.lobbyVisitors) {
    newState = applyVisitorEffect(newState, visitor, config, playerLevel);
  }
  newState = { ...newState, lobbyVisitors: [], elevatorFloor: 0 };
  return { success: true, state: newState };
}

function handleUpgradeElevator(state: GameState, config: GameConfig): ProcessResult {
  const maxLevel = getMaxElevatorLevel(config);
  if (state.elevatorLevel >= maxLevel) {
    return { success: false, state, error: 'Elevator at max level' };
  }
  const cost = calculateElevatorUpgradeCost(state.elevatorLevel, config);
  if (state.gems < cost) {
    return { success: false, state, error: 'Not enough gems' };
  }
  return {
    success: true,
    state: { ...state, gems: state.gems - cost, elevatorLevel: state.elevatorLevel + 1 },
  };
}

function handleUpgradeLobby(
  state: GameState,
  config: GameConfig,
  playerLevel: number,
): ProcessResult {
  const maxCapacity = getMaxLobbyCapacity(playerLevel, config);
  if (state.lobbyCapacity >= maxCapacity) {
    return { success: false, state, error: 'Lobby at max capacity' };
  }
  const cost = calculateLobbyUpgradeCost(state.lobbyCapacity, config);
  if (state.gems < cost) {
    return { success: false, state, error: 'Not enough gems' };
  }
  return {
    success: true,
    state: {
      ...state,
      gems: state.gems - cost,
      lobbyCapacity: state.lobbyCapacity + config.lobbyConfig.lobbyUpgradeSeats,
    },
  };
}

function handleClaimDailyReward(state: GameState, config: GameConfig): ProcessResult {
  if (state.dailyTips < config.lobbyConfig.dailyTipsTarget) {
    return { success: false, state, error: 'Daily tips target not met' };
  }
  if (state.dailyTipsRewardClaimed) {
    return { success: false, state, error: 'Reward already claimed' };
  }
  return {
    success: true,
    state: {
      ...state,
      gems: state.gems + config.lobbyConfig.dailyTipsReward,
      dailyTipsRewardClaimed: true,
    },
  };
}
```

- [ ] **Step 4: Update `shared/engine/processCommand.ts` to route lobby commands**

Add import at the top:

```typescript
import { processLobbyCommand } from './lobbyCommands';
```

Update the `processCommand` function — add a `playerLevel` parameter (default 1) and handle lobby command types:

```typescript
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
    case 'spawn_visitor':
    case 'lift_visitor':
    case 'collect_tip':
    case 'deliver_all':
    case 'upgrade_elevator':
    case 'upgrade_lobby':
    case 'claim_daily_reward':
      return processLobbyCommand(state, command, config, playerLevel);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: ALL PASS (existing + new lobby command tests).

- [ ] **Step 6: Commit**

```bash
git add shared/engine/lobbyCommands.ts shared/engine/processCommand.ts shared/engine/__tests__/lobbyCommands.test.ts
git commit -m "feat(lobby): add lobby command processing (spawn, lift, tip, deliver-all, upgrades)"
```

---

### Task 4: GameStore Integration

**Files:**
- Modify: `src/stores/gameStore.ts`
- Modify: `src/stores/__tests__/gameStore.test.ts` (if exists and relevant)

**Interfaces:**
- Consumes: `processCommand` (updated with `playerLevel` param), `generateRandomVisitor` from `shared/engine/lobbyUtils`, `calculateTip` from `shared/engine/lobbyUtils`, all lobby types
- Produces:
  - New store fields: all lobby GameState fields are surfaced
  - `gems` moves from `PlayerStats` into `GameState` (remove from `PlayerStats`)
  - New actions: `spawnVisitor()`, `liftVisitor()` (replaces old `liftVisitor`), `collectTip()`, `deliverAll()`, `upgradeElevator()`, `upgradeLobby()`, `claimDailyReward()`
  - Updated `hydrate()` and `reconcile()` to include lobby fields
  - Updated `executeCommand()` to pass `playerLevel` to `processCommand`
  - `useVisitors()` selector hook: returns `lobbyVisitors`
  - `useLobbyState()` selector hook: returns `{ lobbyVisitors, lobbyCapacity, elevatorLevel, elevatorFloor, dailyTips, dailyGemsCollected, dailyTipsRewardClaimed, nextVisitorAt }`

- [ ] **Step 1: Migrate gems from PlayerStats to GameState**

In `src/stores/gameStore.ts`, remove `gems` from the `PlayerStats` interface (it's now part of `GameState` via `createInitialState`). The store type `GameStore = GameState & PlayerStats & ...` will now get `gems` from `GameState`.

```typescript
interface PlayerStats {
  playerLevel: number;
  playerXp: number;
  levelUpQueue: LevelUpEvent[];
}
```

Remove `gems: 20` from the initial store values (it comes from `createInitialState` now).

- [ ] **Step 2: Remove old BuildingState, replace with lobby-aware state**

Remove the `BuildingState` interface entirely. Remove `hotelOccupied`, `hotelTotal`, `visitors` from initial values (these are now derived or part of GameState).

`hotelOccupied` and `hotelTotal` are derived from `workers` and `hotelCapacity` in `GameState` — they were always derived. `visitors` was a simple counter — it's now `lobbyVisitors.length`.

- [ ] **Step 3: Add new lobby actions**

Replace the old `liftVisitor` action. Add new actions to the interface and implementation:

```typescript
interface GameActions {
  buy: (floorId: number, slotIdx: number, typeId: string) => void;
  list: (floorId: number, slotIdx: number) => void;
  collect: (floorId: number, slotIdx: number) => void;
  assignWorker: (workerId: string, floorId: number, slotIdx: number) => void;
  fireWorker: (workerId: string) => void;
  evictWorker: (workerId: string) => void;
  spawnVisitor: () => void;
  liftVisitor: () => void;
  collectTip: () => void;
  deliverAll: () => void;
  upgradeElevator: () => void;
  upgradeLobby: () => void;
  claimDailyReward: () => void;
  dismissLevelUp: () => void;
  hydrate: (state: GameState & Partial<SyncState>) => void;
  reconcile: (state: GameState, stateVersion: number, ackCursor: number) => void;
  clearAckedCommands: (ackCursor: number) => void;
}
```

Implement the actions:

```typescript
spawnVisitor: () => {
  const state = get();
  const visitor = generateRandomVisitor(
    { ...state },
    gameConfig,
  );
  executeCommand(get, set, {
    id: uuid(),
    type: 'spawn_visitor',
    visitorId: visitor.id,
    role: visitor.role,
    targetFloor: visitor.targetFloor,
    hairColor: visitor.hairColor,
    female: visitor.female,
    timestamp: clock.now(),
  });
},

liftVisitor: () => {
  executeCommand(get, set, {
    id: uuid(),
    type: 'lift_visitor',
    timestamp: clock.now(),
  });
},

collectTip: () => {
  executeCommand(get, set, {
    id: uuid(),
    type: 'collect_tip',
    timestamp: clock.now(),
  });
},

deliverAll: () => {
  executeCommand(get, set, {
    id: uuid(),
    type: 'deliver_all',
    timestamp: clock.now(),
  });
},

upgradeElevator: () => {
  executeCommand(get, set, {
    id: uuid(),
    type: 'upgrade_elevator',
    timestamp: clock.now(),
  });
},

upgradeLobby: () => {
  executeCommand(get, set, {
    id: uuid(),
    type: 'upgrade_lobby',
    timestamp: clock.now(),
  });
},

claimDailyReward: () => {
  executeCommand(get, set, {
    id: uuid(),
    type: 'claim_daily_reward',
    timestamp: clock.now(),
  });
},
```

- [ ] **Step 4: Update `executeCommand` to pass `playerLevel`**

```typescript
function executeCommand(
  get: () => GameStore,
  set: (partial: Partial<GameStore>) => void,
  command: Command,
) {
  const store = get();
  const { balance, gems, floors, commandQueue, workers, hotelCapacity,
    lobbyVisitors, lobbyCapacity, elevatorLevel, elevatorFloor,
    dailyTips, dailyGemsCollected, dailyTipsRewardClaimed, lastDailyReset, nextVisitorAt,
  } = store;
  const gameState: GameState = {
    balance, gems, floors, commandQueue, workers, hotelCapacity,
    lobbyVisitors, lobbyCapacity, elevatorLevel, elevatorFloor,
    dailyTips, dailyGemsCollected, dailyTipsRewardClaimed, lastDailyReset, nextVisitorAt,
  };
  const result = processCommand(gameState, command, gameConfig, command.timestamp, store.playerLevel);
  if (!result.success) return;

  let newQueue = [...result.state.commandQueue, command];
  if (newQueue.length > COMMAND_QUEUE_CAP) {
    newQueue = newQueue.slice(newQueue.length - COMMAND_QUEUE_CAP);
  }

  const coinDelta = Math.abs(result.state.balance - balance);
  const listBonus = command.type === 'list' ? 10 : 0;
  let { playerXp, playerLevel } = store;
  let newBalance = result.state.balance;
  let newGems = result.state.gems;
  const levelUps: LevelUpEvent[] = [];
  playerXp += coinDelta + listBonus;
  while (playerXp >= xpForLevel(playerLevel)) {
    playerXp -= xpForLevel(playerLevel);
    playerLevel++;
    const coinReward = playerLevel * 100;
    const gemReward = playerLevel * 3;
    newBalance += coinReward;
    newGems += gemReward;
    levelUps.push({ newLevel: playerLevel, coinReward, gemReward });
  }

  set({
    balance: newBalance,
    gems: newGems,
    floors: result.state.floors,
    workers: result.state.workers,
    hotelCapacity: result.state.hotelCapacity,
    commandQueue: newQueue,
    lobbyVisitors: result.state.lobbyVisitors,
    lobbyCapacity: result.state.lobbyCapacity,
    elevatorLevel: result.state.elevatorLevel,
    elevatorFloor: result.state.elevatorFloor,
    dailyTips: result.state.dailyTips,
    dailyGemsCollected: result.state.dailyGemsCollected,
    dailyTipsRewardClaimed: result.state.dailyTipsRewardClaimed,
    lastDailyReset: result.state.lastDailyReset,
    nextVisitorAt: result.state.nextVisitorAt,
    playerXp,
    playerLevel,
    levelUpQueue: [...store.levelUpQueue, ...levelUps],
  });
}
```

- [ ] **Step 5: Update `hydrate` and `reconcile`**

```typescript
hydrate: (state) => set({
  balance: state.balance,
  gems: state.gems ?? 20,
  floors: state.floors,
  commandQueue: state.commandQueue,
  workers: state.workers ?? [],
  hotelCapacity: state.hotelCapacity ?? 10,
  lobbyVisitors: state.lobbyVisitors ?? [],
  lobbyCapacity: state.lobbyCapacity ?? 10,
  elevatorLevel: state.elevatorLevel ?? 1,
  elevatorFloor: state.elevatorFloor ?? 0,
  dailyTips: state.dailyTips ?? 0,
  dailyGemsCollected: state.dailyGemsCollected ?? 0,
  dailyTipsRewardClaimed: state.dailyTipsRewardClaimed ?? false,
  lastDailyReset: state.lastDailyReset ?? 0,
  nextVisitorAt: state.nextVisitorAt ?? 0,
  lastAckCursor: state.lastAckCursor ?? 0,
  stateVersion: state.stateVersion ?? 0,
}),

reconcile: (serverState, newVersion, ackCursor) => set({
  balance: serverState.balance,
  gems: serverState.gems,
  floors: serverState.floors,
  workers: serverState.workers,
  hotelCapacity: serverState.hotelCapacity,
  lobbyVisitors: serverState.lobbyVisitors,
  lobbyCapacity: serverState.lobbyCapacity,
  elevatorLevel: serverState.elevatorLevel,
  elevatorFloor: serverState.elevatorFloor,
  dailyTips: serverState.dailyTips,
  dailyGemsCollected: serverState.dailyGemsCollected,
  dailyTipsRewardClaimed: serverState.dailyTipsRewardClaimed,
  lastDailyReset: serverState.lastDailyReset,
  nextVisitorAt: serverState.nextVisitorAt,
  stateVersion: newVersion,
  lastAckCursor: ackCursor,
  commandQueue: [],
}),
```

- [ ] **Step 6: Add selector hooks**

```typescript
export function useLobbyState() {
  return useGameStore((state) => ({
    lobbyVisitors: state.lobbyVisitors,
    lobbyCapacity: state.lobbyCapacity,
    elevatorLevel: state.elevatorLevel,
    elevatorFloor: state.elevatorFloor,
    dailyTips: state.dailyTips,
    dailyGemsCollected: state.dailyGemsCollected,
    dailyTipsRewardClaimed: state.dailyTipsRewardClaimed,
    nextVisitorAt: state.nextVisitorAt,
    gems: state.gems,
  }));
}
```

- [ ] **Step 7: Run tests**

Run: `npm test`
Expected: ALL PASS. The existing `processCommand.test.ts` tests pass because the `playerLevel` param defaults to 1. Any `gameStore.test.ts` tests may need updates if they reference `visitors` or `gems` from the old location.

- [ ] **Step 8: Commit**

```bash
git add src/stores/gameStore.ts src/stores/__tests__/gameStore.test.ts
git commit -m "feat(lobby): integrate lobby state and actions into gameStore, migrate gems to GameState"
```

---

### Task 5: LobbyFloor Card & LobbyPanel UI

**Files:**
- Modify: `src/components/TechnicalFloor.tsx` (update `LobbyFloor`)
- Create: `src/components/LobbyPanel.tsx`
- Modify: `app/game.tsx` (wire LobbyPanel, update LobbyFloor props)

**Interfaces:**
- Consumes: `useLobbyState()`, `useGameStore` actions (`liftVisitor`, `collectTip`, `deliverAll`, `spawnVisitor`, `upgradeElevator`, `upgradeLobby`, `claimDailyReward`), `useBalance()`, `useGameClock()`, `calculateTip`, `calculateElevatorUpgradeCost`, `calculateLobbyUpgradeCost`, `getMaxElevatorLevel`, `getMaxLobbyCapacity`
- Produces: Updated `LobbyFloor` component, `LobbyPanel` component

- [ ] **Step 1: Update `LobbyFloor` in `src/components/TechnicalFloor.tsx`**

Replace the `LobbyFloorProps` interface and component:

```typescript
interface LobbyFloorProps {
  visitorCount: number;
  nextVisitorAt: number;
  now: number;
  onPress: () => void;
}

export function LobbyFloor({ visitorCount, nextVisitorAt, now, onPress }: LobbyFloorProps) {
  const secondsLeft = Math.max(0, Math.ceil((nextVisitorAt - now) / 1000));
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timerText = `${minutes}:${String(seconds).padStart(2, '0')}`;

  return (
    <Pressable onPress={onPress} style={styles.container}>
      <LinearGradient colors={['#8090A6', '#5F6E84']} style={styles.header}>
        <View style={styles.numberBadge}>
          <Text style={styles.numberText}>0</Text>
        </View>
        <Text style={styles.floorName}>ВЕСТИБЮЛЬ</Text>
        <View style={styles.techTag}>
          <Text style={styles.techTagText}>ТЕХНІЧНИЙ</Text>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.techContent}>
          <Image
            source={require('../../assets/img/lobby.png')}
            style={styles.techImage}
            contentFit="contain"
          />
          <View style={styles.techInfo}>
            <View style={styles.visitorRow}>
              <Text style={styles.visitorLabel}>Очікують</Text>
              <View style={styles.visitorBadge}>
                <Text style={styles.visitorBadgeText}>{visitorCount}</Text>
              </View>
            </View>
            <View style={styles.visitorRow}>
              <Text style={styles.visitorLabel}>Новий гість</Text>
              <Text style={styles.timerText}>{timerText}</Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
```

Add new styles:

```typescript
timerText: {
  fontFamily: 'Fredoka_700Bold',
  fontSize: 14,
  color: '#5A6478',
  fontVariant: ['tabular-nums'],
},
```

Remove the old `liftButton*` styles that are no longer used.

- [ ] **Step 2: Create `src/components/LobbyPanel.tsx`**

Build the full LobbyPanel component following the HotelPanel pattern (Reanimated translateY, scrim, pan gesture, same timing constants). The component has two views (operate/upgrade) and includes:

- Header with "ВЕСТИБЮЛЬ" title, coin chip, stat tiles (waiting count, next visitor timer)
- Operate view: visitor card with avatar, speech bubble, status chip, action button, elevator shaft with animated cabin
- "Розвезти всіх за 💎1" button
- Daily tips card with progress bar
- "Покращити ліфт" button to switch to upgrade view
- Upgrade view: elevator upgrade card + lobby capacity card
- Empty state when no visitors
- Visitor spawn timer that calls `spawnVisitor()` when `nextVisitorAt` is reached

The component receives `visible` and `onClose` props. It reads state from `useLobbyState()` and calls store actions directly.

Role colors for avatar:
```typescript
const ROLE_COLORS: Record<string, string> = {
  guest: '#7B52BC',
  businessman: '#C28A22',
  deliverer: '#2E78B5',
  seller: '#4E9A2E',
};

const ROLE_LABELS: Record<string, string> = {
  guest: 'Гість',
  businessman: 'Бізнесмен',
  deliverer: 'Доставщик',
  seller: 'Продавець',
};
```

Elevator shaft cabin position calculation:
```typescript
const cabinBottom = activeVisitor
  ? 6 + (elevatorFloor / activeVisitor.targetFloor) * 102
  : 6;
```

Use Reanimated `useAnimatedStyle` for the cabin's `bottom` position with timing animation (`.5s cubic-bezier(.45,.05,.3,1)`).

Follow the exact colors, spacing, typography, and shadow values from `assets/lobby design/README.md`.

This is a large component (~600 lines) — implement it fully following the design reference screenshots and HotelPanel as a structural template.

- [ ] **Step 3: Wire LobbyPanel into `app/game.tsx`**

Add lobby state and open/close:

```typescript
const [lobbyOpen, setLobbyOpen] = useState(false);
const lobbyVisitors = useGameStore((s) => s.lobbyVisitors);
const nextVisitorAt = useGameStore((s) => s.nextVisitorAt);
```

Update `renderItem` for lobby:

```typescript
if (item.type === 'lobby') {
  return (
    <View style={styles.floorWrapper}>
      <LobbyFloor
        visitorCount={lobbyVisitors.length}
        nextVisitorAt={nextVisitorAt}
        now={now}
        onPress={() => setLobbyOpen(true)}
      />
    </View>
  );
}
```

Add `LobbyPanel` alongside `HotelPanel`:

```typescript
<LobbyPanel visible={lobbyOpen} onClose={() => setLobbyOpen(false)} />
```

Add imports:

```typescript
import LobbyPanel from '../src/components/LobbyPanel';
```

Update `renderItem` dependency array to include `lobbyVisitors.length`, `nextVisitorAt`.

- [ ] **Step 4: Add visitor spawn timer inside LobbyPanel**

Inside the LobbyPanel component, add a `useEffect` that checks `nextVisitorAt` against `now` (from `useGameClock`) and calls `spawnVisitor()` when it's time:

```typescript
const now = useGameClock(1000);
const spawnVisitor = useGameStore((s) => s.spawnVisitor);
const nextVisitorAt = useGameStore((s) => s.nextVisitorAt);
const visitorCount = useGameStore((s) => s.lobbyVisitors.length);
const lobbyCapacity = useGameStore((s) => s.lobbyCapacity);

useEffect(() => {
  if (nextVisitorAt > 0 && now >= nextVisitorAt && visitorCount < lobbyCapacity) {
    spawnVisitor();
  }
}, [now, nextVisitorAt, visitorCount, lobbyCapacity]);
```

Note: This spawning logic should also work when the panel is closed. Move the spawn effect to `app/game.tsx` so visitors arrive regardless of panel state:

```typescript
// In GameScreen component:
const spawnVisitor = useGameStore((s) => s.spawnVisitor);
const nextVisitorAt = useGameStore((s) => s.nextVisitorAt);
const lobbyVisitorCount = useGameStore((s) => s.lobbyVisitors.length);
const lobbyCapacity = useGameStore((s) => s.lobbyCapacity);

useEffect(() => {
  if (nextVisitorAt > 0 && now >= nextVisitorAt && lobbyVisitorCount < lobbyCapacity) {
    spawnVisitor();
  }
}, [now, nextVisitorAt, lobbyVisitorCount, lobbyCapacity]);
```

- [ ] **Step 5: Test in the app**

Run: `npx expo start`
Verify:
1. Lobby floor card shows visitor count and countdown timer.
2. Tapping lobby opens the LobbyPanel bottom sheet.
3. After 2 minutes a visitor spawns (counter increments, timer resets).
4. Tapping "Підняти" moves the elevator cabin up.
5. When elevator reaches target, "Отримати чайові" appears and tips are collected.
6. "Розвезти всіх" costs 1 gem and delivers everyone.
7. Daily tips card updates and reward is claimable at 10,000.
8. Upgrade view shows elevator and lobby upgrade cards with correct gem costs.
9. Swipe-to-dismiss and scrim tap close the panel.
10. Different visitor roles appear with correct colors and labels.

- [ ] **Step 6: Commit**

```bash
git add src/components/TechnicalFloor.tsx src/components/LobbyPanel.tsx app/game.tsx
git commit -m "feat(lobby): add LobbyPanel UI with elevator mini-game, upgrades, daily tips"
```

---

### Task 6: DeliverAllModal

**Files:**
- Create: `src/components/DeliverAllModal.tsx`
- Modify: `src/components/LobbyPanel.tsx` (trigger modal)
- Modify: `app/game.tsx` (render modal)

**Interfaces:**
- Consumes: `Visitor` type, `calculateTip` from `shared/engine/lobbyUtils`, `LobbyConfig` from types
- Produces: `DeliverAllModal` component with props `{ visible, summary, onDismiss }`

Summary type:
```typescript
interface DeliverAllSummary {
  guestCount: number;
  businessmanCount: number;
  delivererCount: number;
  sellerCount: number;
  totalCoins: number;
  totalGems: number;
  newWorkers: number;
}
```

- [ ] **Step 1: Create `src/components/DeliverAllModal.tsx`**

Build a modal matching the LevelUpModal style (Reanimated scale/opacity entrance, scrim, card with gradient). Content:

```
 Усіх розвезено! 🎉

 👤 Гостей: {guestCount} — earned {coins} 🪙
 💼 Бізнесменів: {businessmanCount} — earned {gems} 💎
 📦 Доставщиків: {delivererCount}
 🛒 Продавців: {sellerCount}
 🏨 Нових працівників: {newWorkers}

 ─────────────
 Всього: +{totalCoins} 🪙  +{totalGems} 💎

 [Готово] button
```

Follow LevelUpModal patterns: `Modal transparent`, animated scrim, card with `LinearGradient`, Fredoka fonts, coin/gem icons matching existing style.

```typescript
import React, { useEffect } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const { width: SCREEN_W } = Dimensions.get('window');

export interface DeliverAllSummary {
  guestCount: number;
  businessmanCount: number;
  delivererCount: number;
  sellerCount: number;
  totalCoins: number;
  totalGems: number;
  newWorkers: number;
}

interface DeliverAllModalProps {
  visible: boolean;
  summary: DeliverAllSummary | null;
  onDismiss: () => void;
}

function formatNumber(n: number): string {
  if (n >= 1000) {
    const str = String(n);
    const parts: string[] = [];
    for (let i = str.length; i > 0; i -= 3) {
      parts.unshift(str.slice(Math.max(0, i - 3), i));
    }
    return parts.join(' ');
  }
  return String(n);
}

export default function DeliverAllModal({ visible, summary, onDismiss }: DeliverAllModalProps) {
  if (!visible || !summary) return null;
  return <DeliverAllContent summary={summary} onDismiss={onDismiss} />;
}

function DeliverAllContent({ summary, onDismiss }: { summary: DeliverAllSummary; onDismiss: () => void }) {
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 200 });
    scale.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.back(1.4)) });
  }, []);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Modal transparent animationType="none" onRequestClose={onDismiss}>
      <Animated.View style={[styles.scrim, scrimStyle]}>
        <Pressable style={styles.scrimPress} onPress={onDismiss} />
        <Animated.View style={[styles.card, cardStyle]}>
          <LinearGradient colors={['#F0F4FA', '#E4EAF2']} style={styles.cardGradient}>
            <Text style={styles.title}>Усіх розвезено!</Text>

            {summary.guestCount > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Гостей: {summary.guestCount}</Text>
              </View>
            )}
            {summary.businessmanCount > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Бізнесменів: {summary.businessmanCount}</Text>
              </View>
            )}
            {summary.delivererCount > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Доставщиків: {summary.delivererCount}</Text>
              </View>
            )}
            {summary.sellerCount > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Продавців: {summary.sellerCount}</Text>
              </View>
            )}
            {summary.newWorkers > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Нових працівників: {summary.newWorkers}</Text>
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.totalRow}>
              {summary.totalCoins > 0 && (
                <View style={styles.totalChip}>
                  <View style={styles.coinDot} />
                  <Text style={styles.totalCoinsText}>+{formatNumber(summary.totalCoins)}</Text>
                </View>
              )}
              {summary.totalGems > 0 && (
                <View style={styles.totalChip}>
                  <View style={styles.gemDot} />
                  <Text style={styles.totalGemsText}>+{summary.totalGems}</Text>
                </View>
              )}
            </View>

            <Pressable onPress={onDismiss} style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}>
              <LinearGradient colors={['#6C7C92', '#56657C']} style={styles.buttonGradient}>
                <Text style={styles.buttonText}>Готово</Text>
              </LinearGradient>
              <View style={styles.buttonShadow} />
            </Pressable>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
```

Add StyleSheet with styles matching LevelUpModal patterns (scrim, card, fonts, coin/gem dots).

- [ ] **Step 2: Wire DeliverAllModal into LobbyPanel**

In `LobbyPanel`, before calling `deliverAll()`, compute the summary from `lobbyVisitors`:

```typescript
import { calculateTip } from '../../shared/engine/lobbyUtils';
import { gameConfig } from '../../shared/config/gameConfig';
import type { DeliverAllSummary } from './DeliverAllModal';

function computeDeliverAllSummary(
  visitors: Visitor[],
  elevatorLevel: number,
  dailyGemsCollected: number,
  playerLevel: number,
): DeliverAllSummary {
  let guestCount = 0, businessmanCount = 0, delivererCount = 0, sellerCount = 0;
  let totalCoins = 0, totalGems = 0, newWorkers = 0;
  let gemsCollected = dailyGemsCollected;
  const gemLimit = gameConfig.lobbyConfig.dailyGemLimitBase + playerLevel;

  for (const v of visitors) {
    switch (v.role) {
      case 'guest':
        guestCount++;
        totalCoins += calculateTip('guest', v.targetFloor, elevatorLevel, gameConfig);
        if (v.targetFloor === 1) newWorkers++;
        break;
      case 'businessman':
        businessmanCount++;
        if (gemsCollected < gemLimit) {
          totalGems++;
          gemsCollected++;
        } else {
          totalCoins += calculateTip('businessman', v.targetFloor, elevatorLevel, gameConfig);
        }
        break;
      case 'deliverer':
        delivererCount++;
        totalCoins += calculateTip('deliverer', v.targetFloor, elevatorLevel, gameConfig);
        break;
      case 'seller':
        sellerCount++;
        totalCoins += calculateTip('seller', v.targetFloor, elevatorLevel, gameConfig);
        break;
    }
  }

  return { guestCount, businessmanCount, delivererCount, sellerCount, totalCoins, totalGems, newWorkers };
}
```

Store summary in component state and show modal after `deliverAll()`:

```typescript
const [deliverSummary, setDeliverSummary] = useState<DeliverAllSummary | null>(null);

const handleDeliverAll = () => {
  const summary = computeDeliverAllSummary(lobbyVisitors, elevatorLevel, dailyGemsCollected, playerLevel);
  deliverAll();
  setDeliverSummary(summary);
};
```

- [ ] **Step 3: Render DeliverAllModal in `app/game.tsx`**

Alternative: render it inside LobbyPanel itself since the modal overlays everything:

```typescript
<DeliverAllModal
  visible={deliverSummary !== null}
  summary={deliverSummary}
  onDismiss={() => setDeliverSummary(null)}
/>
```

- [ ] **Step 4: Test in the app**

Run: `npx expo start`
Verify:
1. "Розвезти всіх за 💎1" shows the summary modal.
2. Modal displays correct counts per role.
3. Total coins and gems are correct.
4. "Готово" dismisses the modal.
5. After dismissal, lobby is empty and visitors are gone.

- [ ] **Step 5: Commit**

```bash
git add src/components/DeliverAllModal.tsx src/components/LobbyPanel.tsx app/game.tsx
git commit -m "feat(lobby): add DeliverAllModal with delivery summary stats"
```

---

### Task 7: Initialize Lobby on Game Start & Final Polish

**Files:**
- Modify: `app/game.tsx` (initialize `nextVisitorAt` if 0)
- Modify: `src/stores/gameStore.ts` (handle initial nextVisitorAt)

**Interfaces:**
- Consumes: `useGameStore`, `clock`
- Produces: Complete working lobby feature

- [ ] **Step 1: Initialize `nextVisitorAt` on game start**

In `app/game.tsx`, when the game loads and `nextVisitorAt` is 0 (fresh start), set it:

```typescript
useEffect(() => {
  const { nextVisitorAt } = useGameStore.getState();
  if (nextVisitorAt === 0) {
    useGameStore.getState().spawnVisitor();
  }
}, []);
```

Or alternatively, set `nextVisitorAt` to `clock.now() + 120_000` directly in the store if it's 0 when the game starts. This can be done in the hydrate path.

- [ ] **Step 2: Handle edge case — new worker notification**

When a guest arrives at floor 1 and creates a worker, the collect_tip action succeeds and the worker appears in the hotel. The player should be notified. Add a simple approach: check if `workers.length` increased after `collectTip()` and show an Alert:

```typescript
const handleCollectTip = () => {
  const workersBefore = useGameStore.getState().workers.length;
  collectTip();
  const workersAfter = useGameStore.getState().workers.length;
  if (workersAfter > workersBefore) {
    Alert.alert('Новий працівник!', 'У вас з\'явився новий працівник, він шукає роботу!');
  }
};
```

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: ALL PASS.

- [ ] **Step 4: Test complete flow in the app**

Run: `npx expo start`

Full test checklist:
1. Fresh game start → lobby shows 0 visitors, timer counting down from 2:00.
2. After 2 min → visitor appears, correct role shown.
3. Tap lobby → panel opens with visitor card.
4. Tap "Підняти" → elevator moves, cabin animates.
5. Reach target → "Отримати чайові" appears with correct amount.
6. Collect → coins added, visitor removed, next visitor shown.
7. Guest to floor 1 → new worker alert, worker visible in hotel.
8. Businessman → gem awarded (or fallback coins after daily limit).
9. Deliverer → delivery time reduced on target floor.
10. Seller → sell time reduced on target floor.
11. "Розвезти всіх" → summary modal with breakdown, 1 gem deducted.
12. Daily tips card updates correctly.
13. At 10,000 tips → reward button appears, grants 5 gems.
14. Upgrade elevator → level increases, more floors per tap.
15. Upgrade lobby → capacity increases.
16. Panel swipe-to-dismiss works.
17. Existing production and hotel features still work.

- [ ] **Step 5: Commit**

```bash
git add app/game.tsx src/stores/gameStore.ts src/components/LobbyPanel.tsx
git commit -m "feat(lobby): finalize lobby initialization, new worker notification, polish"
```
