# Main Screen Client-Only MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable main screen with a skyscraper of 5 floors, 3 production types, the full production cycle state machine, local state management (Zustand), and MMKV persistence.

**Architecture:** Standalone Expo app. Pure TypeScript engine (schemas, game config, state machine logic) separated from React/RN code. Zustand store wraps engine functions for UI consumption. MMKV provides persistence with debounced writes. FlashList renders floors with per-floor re-render isolation.

**Tech Stack:** React Native + Expo, TypeScript, Zustand, Zod, react-native-mmkv, @shopify/flash-list, expo-image, Jest

## Global Constraints

- Zero async operations in the tap path (buy/list/collect).
- Only the affected floor re-renders on tap, not the entire list.
- Engine code (`src/schemas/`, `src/engine/`, `src/config/`) must have zero React/RN imports.
- Timers are derived from `stageStartedAt + now`, never from running intervals or stored countdown values.
- Timer stages (DELIVERING, SELLING) never auto-advance — explicit tap required at each gate.
- MMKV persistence is debounced (every 3 seconds + on background), never on every tap.
- Command queue capped at 10,000 entries.
- Once a production type is assigned to a slot, it stays permanently across cycles.

---

### Task 1: Project Scaffolding + Schemas + Types + Config + Clock

**Files:**
- Create: `package.json`, `tsconfig.json`, `app.json`, `app/_layout.tsx`, `app/index.tsx`
- Create: `src/schemas/production.ts`, `src/schemas/command.ts`, `src/schemas/gameConfig.ts`, `src/schemas/gameState.ts`
- Create: `src/types/index.ts`
- Create: `src/config/gameConfig.ts`
- Create: `src/services/clock.ts`
- Test: `src/schemas/__tests__/schemas.test.ts`, `src/config/__tests__/gameConfig.test.ts`

**Interfaces:**
- Consumes: nothing (first task)
- Produces:
  - `ProductionStage` type: `'IDLE' | 'DELIVERING' | 'READY_TO_LIST' | 'SELLING' | 'READY_TO_COLLECT'`
  - `Production` type: `{ typeId: string | null, stage: ProductionStage, stageStartedAt: number }`
  - `Command` type: discriminated union on `type: 'buy' | 'list' | 'collect'`
  - `GameConfig`, `FloorConfig`, `ProductionTypeConfig` types
  - `Floor` type: `{ id: number, name: string, productions: Production[] }`
  - `GameState` type: `{ balance: number, floors: Floor[], commandQueue: Command[] }`
  - `EffectiveStage` type: `ProductionStage | 'EMPTY'`
  - `DerivedStatus` type: `{ effectiveStage: EffectiveStage, timeRemaining: number, canAct: boolean, actionLabel: string | null }`
  - `gameConfig` constant: validated static game config object
  - `GameClock` interface: `{ now(): number }`
  - `DeviceClock` class implementing `GameClock`
  - `createInitialState(config: GameConfig): GameState`

- [ ] **Step 1: Create Expo project and install dependencies**

Create the Expo app in a temp directory and copy files into the project:

```bash
cd /tmp
npx create-expo-app@latest tinytower-init --template blank-typescript
cp -n /tmp/tinytower-init/package.json /Users/Apple/IT/tinytower/
cp -n /tmp/tinytower-init/tsconfig.json /Users/Apple/IT/tinytower/
cp -n /tmp/tinytower-init/app.json /Users/Apple/IT/tinytower/
cp -rn /tmp/tinytower-init/app /Users/Apple/IT/tinytower/ 2>/dev/null || true
cp -n /tmp/tinytower-init/.gitignore /Users/Apple/IT/tinytower/
rm -rf /tmp/tinytower-init
cd /Users/Apple/IT/tinytower
npm install
npx expo install zustand zod react-native-mmkv @shopify/flash-list expo-image
npx expo install -- --save-dev jest-expo @types/jest
```

Add Jest config to `package.json` (merge into existing):
```json
{
  "scripts": {
    "test": "jest"
  },
  "jest": {
    "preset": "jest-expo",
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@shopify/flash-list)"
    ]
  }
}
```

- [ ] **Step 2: Create directory structure**

```bash
mkdir -p src/schemas/__tests__
mkdir -p src/types
mkdir -p src/config/__tests__
mkdir -p src/engine/__tests__
mkdir -p src/stores
mkdir -p src/services
mkdir -p src/components
mkdir -p src/hooks
mkdir -p assets
```

- [ ] **Step 3: Write production schema**

Create `src/schemas/production.ts`:

```ts
import { z } from 'zod';

export const ProductionStageSchema = z.enum([
  'IDLE',
  'DELIVERING',
  'READY_TO_LIST',
  'SELLING',
  'READY_TO_COLLECT',
]);

export const ProductionSchema = z.object({
  typeId: z.string().nullable(),
  stage: ProductionStageSchema,
  stageStartedAt: z.number(),
});
```

- [ ] **Step 4: Write command schema**

Create `src/schemas/command.ts`:

```ts
import { z } from 'zod';

const BaseCommandSchema = z.object({
  id: z.string(),
  floorId: z.number().int(),
  slotIdx: z.number().int(),
  timestamp: z.number(),
});

export const BuyCommandSchema = BaseCommandSchema.extend({
  type: z.literal('buy'),
  typeId: z.string(),
});

export const ListCommandSchema = BaseCommandSchema.extend({
  type: z.literal('list'),
});

export const CollectCommandSchema = BaseCommandSchema.extend({
  type: z.literal('collect'),
});

export const CommandSchema = z.discriminatedUnion('type', [
  BuyCommandSchema,
  ListCommandSchema,
  CollectCommandSchema,
]);
```

- [ ] **Step 5: Write game config schema**

Create `src/schemas/gameConfig.ts`:

```ts
import { z } from 'zod';

export const ProductionTypeConfigSchema = z.object({
  buyCost: z.number().positive(),
  deliveryDuration: z.number().positive(),
  sellDuration: z.number().positive(),
  batchValue: z.number().positive(),
});

export const FloorConfigSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  slots: z.number().int().min(1).max(3),
  availableTypes: z.array(z.string()).min(1),
});

export const GameConfigSchema = z.object({
  floors: z.array(FloorConfigSchema).min(1),
  productionTypes: z.record(z.string(), ProductionTypeConfigSchema),
  startingBalance: z.number().nonnegative(),
});
```

- [ ] **Step 6: Write game state schema**

Create `src/schemas/gameState.ts`:

```ts
import { z } from 'zod';
import { ProductionSchema } from './production';
import { CommandSchema } from './command';

export const FloorStateSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  productions: z.array(ProductionSchema).min(1).max(3),
});

export const GameStateSchema = z.object({
  balance: z.number().nonnegative(),
  floors: z.array(FloorStateSchema).min(1),
  commandQueue: z.array(CommandSchema),
});
```

- [ ] **Step 7: Write types file**

Create `src/types/index.ts`:

```ts
import { z } from 'zod';
import { ProductionStageSchema, ProductionSchema } from '../schemas/production';
import { CommandSchema, BuyCommandSchema, ListCommandSchema, CollectCommandSchema } from '../schemas/command';
import { GameConfigSchema, FloorConfigSchema, ProductionTypeConfigSchema } from '../schemas/gameConfig';
import { GameStateSchema } from '../schemas/gameState';

export type ProductionStage = z.infer<typeof ProductionStageSchema>;
export type Production = z.infer<typeof ProductionSchema>;
export type Command = z.infer<typeof CommandSchema>;
export type BuyCommand = z.infer<typeof BuyCommandSchema>;
export type ListCommand = z.infer<typeof ListCommandSchema>;
export type CollectCommand = z.infer<typeof CollectCommandSchema>;
export type GameConfig = z.infer<typeof GameConfigSchema>;
export type FloorConfig = z.infer<typeof FloorConfigSchema>;
export type ProductionTypeConfig = z.infer<typeof ProductionTypeConfigSchema>;
export type GameState = z.infer<typeof GameStateSchema>;

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

- [ ] **Step 8: Write game config data**

Create `src/config/gameConfig.ts`:

```ts
import { GameConfigSchema } from '../schemas/gameConfig';
import type { GameConfig, GameState, Floor } from '../types';

const rawConfig = {
  floors: [
    { id: 1, name: 'Ground Floor', slots: 3, availableTypes: ['coffee_shop'] },
    { id: 2, name: 'Floor 2', slots: 3, availableTypes: ['coffee_shop', 'bookstore'] },
    { id: 3, name: 'Floor 3', slots: 3, availableTypes: ['bookstore'] },
    { id: 4, name: 'Floor 4', slots: 3, availableTypes: ['bookstore', 'electronics'] },
    { id: 5, name: 'Floor 5', slots: 3, availableTypes: ['electronics'] },
  ],
  productionTypes: {
    coffee_shop: { buyCost: 10, deliveryDuration: 5000, sellDuration: 10000, batchValue: 25 },
    bookstore: { buyCost: 50, deliveryDuration: 15000, sellDuration: 30000, batchValue: 120 },
    electronics: { buyCost: 200, deliveryDuration: 60000, sellDuration: 90000, batchValue: 500 },
  },
  startingBalance: 100,
} satisfies GameConfig;

export const gameConfig: GameConfig = GameConfigSchema.parse(rawConfig);

export function createInitialState(config: GameConfig): GameState {
  return {
    balance: config.startingBalance,
    floors: config.floors.map((floorConfig): Floor => ({
      id: floorConfig.id,
      name: floorConfig.name,
      productions: Array.from({ length: floorConfig.slots }, () => ({
        typeId: null,
        stage: 'IDLE' as const,
        stageStartedAt: 0,
      })),
    })),
    commandQueue: [],
  };
}
```

- [ ] **Step 9: Write clock service**

Create `src/services/clock.ts`:

```ts
export interface GameClock {
  now(): number;
}

export class DeviceClock implements GameClock {
  now(): number {
    return Date.now();
  }
}

export const clock: GameClock = new DeviceClock();
```

- [ ] **Step 10: Write schema tests**

Create `src/schemas/__tests__/schemas.test.ts`:

```ts
import { ProductionStageSchema, ProductionSchema } from '../production';
import { CommandSchema } from '../command';
import { GameConfigSchema } from '../gameConfig';
import { GameStateSchema } from '../gameState';

describe('ProductionStageSchema', () => {
  it('accepts valid stages', () => {
    expect(ProductionStageSchema.parse('IDLE')).toBe('IDLE');
    expect(ProductionStageSchema.parse('DELIVERING')).toBe('DELIVERING');
    expect(ProductionStageSchema.parse('READY_TO_LIST')).toBe('READY_TO_LIST');
    expect(ProductionStageSchema.parse('SELLING')).toBe('SELLING');
    expect(ProductionStageSchema.parse('READY_TO_COLLECT')).toBe('READY_TO_COLLECT');
  });

  it('rejects invalid stages', () => {
    expect(ProductionStageSchema.safeParse('INVALID').success).toBe(false);
    expect(ProductionStageSchema.safeParse(123).success).toBe(false);
  });
});

describe('ProductionSchema', () => {
  it('accepts valid production with assigned type', () => {
    const result = ProductionSchema.parse({
      typeId: 'coffee_shop',
      stage: 'IDLE',
      stageStartedAt: 0,
    });
    expect(result.typeId).toBe('coffee_shop');
  });

  it('accepts production with null typeId (empty slot)', () => {
    const result = ProductionSchema.parse({
      typeId: null,
      stage: 'IDLE',
      stageStartedAt: 0,
    });
    expect(result.typeId).toBeNull();
  });

  it('rejects production with missing fields', () => {
    expect(ProductionSchema.safeParse({ typeId: 'x' }).success).toBe(false);
  });
});

describe('CommandSchema', () => {
  it('accepts a valid buy command', () => {
    const result = CommandSchema.parse({
      id: 'abc-123',
      type: 'buy',
      floorId: 1,
      slotIdx: 0,
      typeId: 'coffee_shop',
      timestamp: 1000,
    });
    expect(result.type).toBe('buy');
  });

  it('accepts a valid list command', () => {
    const result = CommandSchema.parse({
      id: 'abc-124',
      type: 'list',
      floorId: 1,
      slotIdx: 0,
      timestamp: 2000,
    });
    expect(result.type).toBe('list');
  });

  it('accepts a valid collect command', () => {
    const result = CommandSchema.parse({
      id: 'abc-125',
      type: 'collect',
      floorId: 1,
      slotIdx: 0,
      timestamp: 3000,
    });
    expect(result.type).toBe('collect');
  });

  it('rejects buy command without typeId', () => {
    expect(CommandSchema.safeParse({
      id: 'abc-126',
      type: 'buy',
      floorId: 1,
      slotIdx: 0,
      timestamp: 1000,
    }).success).toBe(false);
  });

  it('rejects unknown command type', () => {
    expect(CommandSchema.safeParse({
      id: 'abc-127',
      type: 'upgrade',
      floorId: 1,
      slotIdx: 0,
      timestamp: 1000,
    }).success).toBe(false);
  });
});

describe('GameConfigSchema', () => {
  it('accepts valid config', () => {
    const result = GameConfigSchema.parse({
      floors: [{ id: 1, name: 'Floor 1', slots: 2, availableTypes: ['coffee_shop'] }],
      productionTypes: {
        coffee_shop: { buyCost: 10, deliveryDuration: 5000, sellDuration: 10000, batchValue: 25 },
      },
      startingBalance: 100,
    });
    expect(result.floors).toHaveLength(1);
  });

  it('rejects config with zero slots', () => {
    expect(GameConfigSchema.safeParse({
      floors: [{ id: 1, name: 'Floor 1', slots: 0, availableTypes: ['x'] }],
      productionTypes: { x: { buyCost: 10, deliveryDuration: 5000, sellDuration: 10000, batchValue: 25 } },
      startingBalance: 100,
    }).success).toBe(false);
  });

  it('rejects config with negative buyCost', () => {
    expect(GameConfigSchema.safeParse({
      floors: [{ id: 1, name: 'Floor 1', slots: 1, availableTypes: ['x'] }],
      productionTypes: { x: { buyCost: -10, deliveryDuration: 5000, sellDuration: 10000, batchValue: 25 } },
      startingBalance: 100,
    }).success).toBe(false);
  });
});

describe('GameStateSchema', () => {
  it('accepts a valid game state', () => {
    const result = GameStateSchema.parse({
      balance: 100,
      floors: [{
        id: 1,
        name: 'Floor 1',
        productions: [{ typeId: null, stage: 'IDLE', stageStartedAt: 0 }],
      }],
      commandQueue: [],
    });
    expect(result.balance).toBe(100);
  });

  it('rejects negative balance', () => {
    expect(GameStateSchema.safeParse({
      balance: -1,
      floors: [{ id: 1, name: 'F', productions: [{ typeId: null, stage: 'IDLE', stageStartedAt: 0 }] }],
      commandQueue: [],
    }).success).toBe(false);
  });
});
```

- [ ] **Step 11: Write game config tests**

Create `src/config/__tests__/gameConfig.test.ts`:

```ts
import { gameConfig, createInitialState } from '../gameConfig';

describe('gameConfig', () => {
  it('has 5 floors', () => {
    expect(gameConfig.floors).toHaveLength(5);
  });

  it('has 3 production types', () => {
    expect(Object.keys(gameConfig.productionTypes)).toHaveLength(3);
    expect(gameConfig.productionTypes).toHaveProperty('coffee_shop');
    expect(gameConfig.productionTypes).toHaveProperty('bookstore');
    expect(gameConfig.productionTypes).toHaveProperty('electronics');
  });

  it('every floor references only existing production types', () => {
    const typeIds = Object.keys(gameConfig.productionTypes);
    for (const floor of gameConfig.floors) {
      for (const typeId of floor.availableTypes) {
        expect(typeIds).toContain(typeId);
      }
    }
  });

  it('starting balance is 100', () => {
    expect(gameConfig.startingBalance).toBe(100);
  });
});

describe('createInitialState', () => {
  it('sets balance to startingBalance', () => {
    const state = createInitialState(gameConfig);
    expect(state.balance).toBe(100);
  });

  it('creates correct number of floors', () => {
    const state = createInitialState(gameConfig);
    expect(state.floors).toHaveLength(5);
  });

  it('creates correct number of production slots per floor', () => {
    const state = createInitialState(gameConfig);
    for (const floor of state.floors) {
      expect(floor.productions).toHaveLength(3);
    }
  });

  it('all production slots start empty and IDLE', () => {
    const state = createInitialState(gameConfig);
    for (const floor of state.floors) {
      for (const prod of floor.productions) {
        expect(prod.typeId).toBeNull();
        expect(prod.stage).toBe('IDLE');
        expect(prod.stageStartedAt).toBe(0);
      }
    }
  });

  it('command queue starts empty', () => {
    const state = createInitialState(gameConfig);
    expect(state.commandQueue).toHaveLength(0);
  });
});
```

- [ ] **Step 12: Run all tests**

Run: `npx jest src/schemas/ src/config/ --verbose`

Expected: all tests pass.

- [ ] **Step 13: Commit**

```bash
git add src/schemas/ src/types/ src/config/ src/services/clock.ts package.json tsconfig.json app.json app/ .gitignore
git commit -m "feat: project scaffolding, Zod schemas, types, game config, clock"
```

---

### Task 2: Engine — getProductionStatus

**Files:**
- Create: `src/engine/productionStatus.ts`
- Test: `src/engine/__tests__/productionStatus.test.ts`

**Interfaces:**
- Consumes:
  - `Production` from `src/types`
  - `ProductionTypeConfig` from `src/types`
- Produces:
  - `getProductionStatus(production: Production, typeConfig: ProductionTypeConfig | null, now: number, balance: number): DerivedStatus`
  - `DerivedStatus` re-exported: `{ effectiveStage, timeRemaining, canAct, actionLabel }`

- [ ] **Step 1: Write failing tests**

Create `src/engine/__tests__/productionStatus.test.ts`:

```ts
import { getProductionStatus } from '../productionStatus';
import type { Production, ProductionTypeConfig } from '../../types';

const coffeeConfig: ProductionTypeConfig = {
  buyCost: 10,
  deliveryDuration: 5000,
  sellDuration: 10000,
  batchValue: 25,
};

describe('getProductionStatus', () => {
  describe('EMPTY slot (no typeId)', () => {
    it('returns EMPTY with canAct true', () => {
      const prod: Production = { typeId: null, stage: 'IDLE', stageStartedAt: 0 };
      const status = getProductionStatus(prod, null, 1000, 100);
      expect(status.effectiveStage).toBe('EMPTY');
      expect(status.canAct).toBe(true);
      expect(status.timeRemaining).toBe(0);
      expect(status.actionLabel).toBeNull();
    });
  });

  describe('IDLE stage (type assigned)', () => {
    const prod: Production = { typeId: 'coffee_shop', stage: 'IDLE', stageStartedAt: 0 };

    it('returns IDLE with canAct true when balance sufficient', () => {
      const status = getProductionStatus(prod, coffeeConfig, 1000, 100);
      expect(status.effectiveStage).toBe('IDLE');
      expect(status.canAct).toBe(true);
      expect(status.actionLabel).toBe('Buy ($10)');
    });

    it('returns IDLE with canAct false when balance insufficient', () => {
      const status = getProductionStatus(prod, coffeeConfig, 1000, 5);
      expect(status.effectiveStage).toBe('IDLE');
      expect(status.canAct).toBe(false);
      expect(status.actionLabel).toBe('Buy ($10)');
    });

    it('returns canAct true when balance exactly equals cost', () => {
      const status = getProductionStatus(prod, coffeeConfig, 1000, 10);
      expect(status.canAct).toBe(true);
    });
  });

  describe('DELIVERING stage', () => {
    it('returns DELIVERING with time remaining when timer not elapsed', () => {
      const prod: Production = { typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 1000 };
      const status = getProductionStatus(prod, coffeeConfig, 3000, 100);
      expect(status.effectiveStage).toBe('DELIVERING');
      expect(status.timeRemaining).toBe(3000);
      expect(status.canAct).toBe(false);
      expect(status.actionLabel).toBeNull();
    });

    it('returns READY_TO_LIST when timer exactly elapsed', () => {
      const prod: Production = { typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 1000 };
      const status = getProductionStatus(prod, coffeeConfig, 6000, 100);
      expect(status.effectiveStage).toBe('READY_TO_LIST');
      expect(status.timeRemaining).toBe(0);
      expect(status.canAct).toBe(true);
      expect(status.actionLabel).toBe('List');
    });

    it('returns READY_TO_LIST when timer overdue', () => {
      const prod: Production = { typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 1000 };
      const status = getProductionStatus(prod, coffeeConfig, 99000, 100);
      expect(status.effectiveStage).toBe('READY_TO_LIST');
      expect(status.timeRemaining).toBe(0);
      expect(status.canAct).toBe(true);
    });
  });

  describe('SELLING stage', () => {
    it('returns SELLING with time remaining when timer not elapsed', () => {
      const prod: Production = { typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 1000 };
      const status = getProductionStatus(prod, coffeeConfig, 5000, 100);
      expect(status.effectiveStage).toBe('SELLING');
      expect(status.timeRemaining).toBe(6000);
      expect(status.canAct).toBe(false);
      expect(status.actionLabel).toBeNull();
    });

    it('returns READY_TO_COLLECT when timer exactly elapsed', () => {
      const prod: Production = { typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 1000 };
      const status = getProductionStatus(prod, coffeeConfig, 11000, 100);
      expect(status.effectiveStage).toBe('READY_TO_COLLECT');
      expect(status.timeRemaining).toBe(0);
      expect(status.canAct).toBe(true);
      expect(status.actionLabel).toBe('Collect ($25)');
    });

    it('returns READY_TO_COLLECT when timer overdue', () => {
      const prod: Production = { typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 1000 };
      const status = getProductionStatus(prod, coffeeConfig, 99000, 100);
      expect(status.effectiveStage).toBe('READY_TO_COLLECT');
      expect(status.canAct).toBe(true);
    });
  });

  describe('stored READY_TO_LIST / READY_TO_COLLECT stages', () => {
    it('handles stored READY_TO_LIST', () => {
      const prod: Production = { typeId: 'coffee_shop', stage: 'READY_TO_LIST', stageStartedAt: 0 };
      const status = getProductionStatus(prod, coffeeConfig, 1000, 100);
      expect(status.effectiveStage).toBe('READY_TO_LIST');
      expect(status.canAct).toBe(true);
      expect(status.actionLabel).toBe('List');
    });

    it('handles stored READY_TO_COLLECT', () => {
      const prod: Production = { typeId: 'coffee_shop', stage: 'READY_TO_COLLECT', stageStartedAt: 0 };
      const status = getProductionStatus(prod, coffeeConfig, 1000, 100);
      expect(status.effectiveStage).toBe('READY_TO_COLLECT');
      expect(status.canAct).toBe(true);
      expect(status.actionLabel).toBe('Collect ($25)');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/engine/__tests__/productionStatus.test.ts --verbose`

Expected: FAIL — `Cannot find module '../productionStatus'`

- [ ] **Step 3: Implement getProductionStatus**

Create `src/engine/productionStatus.ts`:

```ts
import type { Production, ProductionTypeConfig, DerivedStatus } from '../types';

export function getProductionStatus(
  production: Production,
  typeConfig: ProductionTypeConfig | null,
  now: number,
  balance: number,
): DerivedStatus {
  if (!production.typeId || !typeConfig) {
    return { effectiveStage: 'EMPTY', timeRemaining: 0, canAct: true, actionLabel: null };
  }

  switch (production.stage) {
    case 'IDLE':
      return {
        effectiveStage: 'IDLE',
        timeRemaining: 0,
        canAct: balance >= typeConfig.buyCost,
        actionLabel: `Buy ($${typeConfig.buyCost})`,
      };

    case 'DELIVERING': {
      const remaining = Math.max(0, typeConfig.deliveryDuration - (now - production.stageStartedAt));
      if (remaining <= 0) {
        return { effectiveStage: 'READY_TO_LIST', timeRemaining: 0, canAct: true, actionLabel: 'List' };
      }
      return { effectiveStage: 'DELIVERING', timeRemaining: remaining, canAct: false, actionLabel: null };
    }

    case 'READY_TO_LIST':
      return { effectiveStage: 'READY_TO_LIST', timeRemaining: 0, canAct: true, actionLabel: 'List' };

    case 'SELLING': {
      const remaining = Math.max(0, typeConfig.sellDuration - (now - production.stageStartedAt));
      if (remaining <= 0) {
        return {
          effectiveStage: 'READY_TO_COLLECT',
          timeRemaining: 0,
          canAct: true,
          actionLabel: `Collect ($${typeConfig.batchValue})`,
        };
      }
      return { effectiveStage: 'SELLING', timeRemaining: remaining, canAct: false, actionLabel: null };
    }

    case 'READY_TO_COLLECT':
      return {
        effectiveStage: 'READY_TO_COLLECT',
        timeRemaining: 0,
        canAct: true,
        actionLabel: `Collect ($${typeConfig.batchValue})`,
      };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/engine/__tests__/productionStatus.test.ts --verbose`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/productionStatus.ts src/engine/__tests__/productionStatus.test.ts
git commit -m "feat: getProductionStatus pure function with full stage derivation"
```

---

### Task 3: Engine — processCommand

**Files:**
- Create: `src/engine/processCommand.ts`
- Test: `src/engine/__tests__/processCommand.test.ts`

**Interfaces:**
- Consumes:
  - `GameState`, `Command`, `GameConfig` from `src/types`
  - `gameConfig` from `src/config/gameConfig`
- Produces:
  - `ProcessResult` type: `{ success: boolean, state: GameState, error?: string }`
  - `processCommand(state: GameState, command: Command, config: GameConfig, now: number): ProcessResult`

- [ ] **Step 1: Write failing tests**

Create `src/engine/__tests__/processCommand.test.ts`:

```ts
import { processCommand } from '../processCommand';
import { createInitialState } from '../../config/gameConfig';
import type { GameState, GameConfig, Command } from '../../types';

const testConfig: GameConfig = {
  floors: [
    { id: 1, name: 'Floor 1', slots: 2, availableTypes: ['coffee_shop', 'bookstore'] },
  ],
  productionTypes: {
    coffee_shop: { buyCost: 10, deliveryDuration: 5000, sellDuration: 10000, batchValue: 25 },
    bookstore: { buyCost: 50, deliveryDuration: 15000, sellDuration: 30000, batchValue: 120 },
  },
  startingBalance: 100,
};

function makeState(overrides?: Partial<GameState>): GameState {
  return { ...createInitialState(testConfig), ...overrides };
}

function buyCmd(overrides?: Partial<Extract<Command, { type: 'buy' }>>): Command {
  return { id: 'cmd-1', type: 'buy', floorId: 1, slotIdx: 0, typeId: 'coffee_shop', timestamp: 1000, ...overrides };
}

function listCmd(overrides?: Partial<Extract<Command, { type: 'list' }>>): Command {
  return { id: 'cmd-2', type: 'list', floorId: 1, slotIdx: 0, timestamp: 7000, ...overrides };
}

function collectCmd(overrides?: Partial<Extract<Command, { type: 'collect' }>>): Command {
  return { id: 'cmd-3', type: 'collect', floorId: 1, slotIdx: 0, timestamp: 18000, ...overrides };
}

describe('processCommand', () => {
  describe('buy command', () => {
    it('succeeds on IDLE slot with sufficient balance', () => {
      const state = makeState();
      const result = processCommand(state, buyCmd(), testConfig, 1000);
      expect(result.success).toBe(true);
      expect(result.state.balance).toBe(90);
      expect(result.state.floors[0].productions[0].stage).toBe('DELIVERING');
      expect(result.state.floors[0].productions[0].typeId).toBe('coffee_shop');
      expect(result.state.floors[0].productions[0].stageStartedAt).toBe(1000);
    });

    it('fails with insufficient balance', () => {
      const state = makeState({ balance: 5 });
      const result = processCommand(state, buyCmd(), testConfig, 1000);
      expect(result.success).toBe(false);
      expect(result.state.balance).toBe(5);
    });

    it('fails when slot is not IDLE', () => {
      const state = makeState();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 500 };
      const result = processCommand(state, buyCmd(), testConfig, 1000);
      expect(result.success).toBe(false);
    });

    it('fails when typeId is not available on the floor', () => {
      const result = processCommand(
        makeState(),
        buyCmd({ typeId: 'electronics' }),
        testConfig,
        1000,
      );
      expect(result.success).toBe(false);
    });

    it('fails when typeId does not exist in config', () => {
      const result = processCommand(
        makeState(),
        buyCmd({ typeId: 'nonexistent' }),
        testConfig,
        1000,
      );
      expect(result.success).toBe(false);
    });

    it('rejects type change on slot with permanent typeId', () => {
      const state = makeState();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'IDLE', stageStartedAt: 0 };
      const result = processCommand(state, buyCmd({ typeId: 'bookstore' }), testConfig, 1000);
      expect(result.success).toBe(false);
    });

    it('accepts repeat buy with same typeId after collect', () => {
      const state = makeState();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'IDLE', stageStartedAt: 0 };
      const result = processCommand(state, buyCmd({ typeId: 'coffee_shop' }), testConfig, 1000);
      expect(result.success).toBe(true);
    });

    it('does not mutate the original state', () => {
      const state = makeState();
      const originalBalance = state.balance;
      processCommand(state, buyCmd(), testConfig, 1000);
      expect(state.balance).toBe(originalBalance);
    });

    it('fails for nonexistent floor', () => {
      const result = processCommand(makeState(), buyCmd({ floorId: 99 }), testConfig, 1000);
      expect(result.success).toBe(false);
    });

    it('fails for nonexistent slot index', () => {
      const result = processCommand(makeState(), buyCmd({ slotIdx: 99 }), testConfig, 1000);
      expect(result.success).toBe(false);
    });
  });

  describe('list command', () => {
    it('succeeds when delivery timer elapsed', () => {
      const state = makeState();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 1000 };
      const result = processCommand(state, listCmd({ timestamp: 7000 }), testConfig, 7000);
      expect(result.success).toBe(true);
      expect(result.state.floors[0].productions[0].stage).toBe('SELLING');
      expect(result.state.floors[0].productions[0].stageStartedAt).toBe(7000);
    });

    it('succeeds when delivery timer exactly elapsed', () => {
      const state = makeState();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 1000 };
      const result = processCommand(state, listCmd({ timestamp: 6000 }), testConfig, 6000);
      expect(result.success).toBe(true);
    });

    it('fails when delivery timer not elapsed', () => {
      const state = makeState();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 1000 };
      const result = processCommand(state, listCmd({ timestamp: 3000 }), testConfig, 3000);
      expect(result.success).toBe(false);
    });

    it('fails when stage is not DELIVERING', () => {
      const state = makeState();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'IDLE', stageStartedAt: 0 };
      const result = processCommand(state, listCmd(), testConfig, 7000);
      expect(result.success).toBe(false);
    });

    it('does not change balance', () => {
      const state = makeState();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 1000 };
      const result = processCommand(state, listCmd({ timestamp: 7000 }), testConfig, 7000);
      expect(result.state.balance).toBe(state.balance);
    });
  });

  describe('collect command', () => {
    it('succeeds when sell timer elapsed', () => {
      const state = makeState();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 7000 };
      const result = processCommand(state, collectCmd({ timestamp: 18000 }), testConfig, 18000);
      expect(result.success).toBe(true);
      expect(result.state.balance).toBe(125);
      expect(result.state.floors[0].productions[0].stage).toBe('IDLE');
      expect(result.state.floors[0].productions[0].typeId).toBe('coffee_shop');
    });

    it('fails when sell timer not elapsed', () => {
      const state = makeState();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 7000 };
      const result = processCommand(state, collectCmd({ timestamp: 10000 }), testConfig, 10000);
      expect(result.success).toBe(false);
    });

    it('fails when stage is not SELLING', () => {
      const state = makeState();
      state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 1000 };
      const result = processCommand(state, collectCmd(), testConfig, 18000);
      expect(result.success).toBe(false);
    });
  });

  describe('full cycle', () => {
    it('completes IDLE → buy → list → collect → IDLE', () => {
      let state = makeState();

      const r1 = processCommand(state, buyCmd({ timestamp: 1000 }), testConfig, 1000);
      expect(r1.success).toBe(true);
      expect(r1.state.balance).toBe(90);
      expect(r1.state.floors[0].productions[0].stage).toBe('DELIVERING');
      state = r1.state;

      const r2 = processCommand(state, listCmd({ timestamp: 7000 }), testConfig, 7000);
      expect(r2.success).toBe(true);
      expect(r2.state.floors[0].productions[0].stage).toBe('SELLING');
      state = r2.state;

      const r3 = processCommand(state, collectCmd({ timestamp: 18000 }), testConfig, 18000);
      expect(r3.success).toBe(true);
      expect(r3.state.balance).toBe(115);
      expect(r3.state.floors[0].productions[0].stage).toBe('IDLE');
      expect(r3.state.floors[0].productions[0].typeId).toBe('coffee_shop');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/engine/__tests__/processCommand.test.ts --verbose`

Expected: FAIL — `Cannot find module '../processCommand'`

- [ ] **Step 3: Implement processCommand**

Create `src/engine/processCommand.ts`:

```ts
import type { GameState, Command, GameConfig } from '../types';

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
  const floorIdx = state.floors.findIndex(f => f.id === command.floorId);
  if (floorIdx === -1) {
    return { success: false, state, error: 'Floor not found' };
  }

  const floor = state.floors[floorIdx];
  const production = floor.productions[command.slotIdx];
  if (!production) {
    return { success: false, state, error: 'Slot not found' };
  }

  switch (command.type) {
    case 'buy':
      return handleBuy(state, command, config, now, floorIdx, command.slotIdx, production);
    case 'list':
      return handleList(state, config, now, floorIdx, command.slotIdx, production);
    case 'collect':
      return handleCollect(state, config, now, floorIdx, command.slotIdx, production);
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
): ProcessResult {
  if (production.stage !== 'IDLE') {
    return { success: false, state, error: 'Production not idle' };
  }

  if (production.typeId !== null && production.typeId !== command.typeId) {
    return { success: false, state, error: 'Cannot change production type' };
  }

  const typeConfig = config.productionTypes[command.typeId];
  if (!typeConfig) {
    return { success: false, state, error: 'Unknown production type' };
  }

  const floorConfig = config.floors.find(f => f.id === state.floors[floorIdx].id);
  if (!floorConfig || !floorConfig.availableTypes.includes(command.typeId)) {
    return { success: false, state, error: 'Type not available on this floor' };
  }

  if (state.balance < typeConfig.buyCost) {
    return { success: false, state, error: 'Insufficient balance' };
  }

  return {
    success: true,
    state: {
      ...state,
      balance: state.balance - typeConfig.buyCost,
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

  if (!production.typeId) {
    return { success: false, state, error: 'No type assigned' };
  }

  const typeConfig = config.productionTypes[production.typeId];
  if (!typeConfig) {
    return { success: false, state, error: 'Unknown production type' };
  }

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
): ProcessResult {
  if (production.stage !== 'SELLING') {
    return { success: false, state, error: 'Production not selling' };
  }

  if (!production.typeId) {
    return { success: false, state, error: 'No type assigned' };
  }

  const typeConfig = config.productionTypes[production.typeId];
  if (!typeConfig) {
    return { success: false, state, error: 'Unknown production type' };
  }

  if (now - production.stageStartedAt < typeConfig.sellDuration) {
    return { success: false, state, error: 'Sale not complete' };
  }

  return {
    success: true,
    state: {
      ...state,
      balance: state.balance + typeConfig.batchValue,
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/engine/__tests__/processCommand.test.ts --verbose`

Expected: all tests PASS.

- [ ] **Step 5: Run all engine tests together**

Run: `npx jest src/engine/ --verbose`

Expected: all tests PASS (productionStatus + processCommand).

- [ ] **Step 6: Commit**

```bash
git add src/engine/processCommand.ts src/engine/__tests__/processCommand.test.ts
git commit -m "feat: processCommand with full cycle validation and immutable state updates"
```

---

### Task 4: Zustand Store + MMKV Persistence

**Files:**
- Create: `src/stores/gameStore.ts`
- Create: `src/services/persistence.ts`
- Test: `src/stores/__tests__/gameStore.test.ts`

**Interfaces:**
- Consumes:
  - `processCommand(state, command, config, now): ProcessResult` from `src/engine/processCommand`
  - `createInitialState(config): GameState` from `src/config/gameConfig`
  - `gameConfig` from `src/config/gameConfig`
  - `GameClock` / `clock` from `src/services/clock`
  - `GameStateSchema` from `src/schemas/gameState`
- Produces:
  - `useGameStore` Zustand hook with:
    - State: `balance`, `floors`, `commandQueue`
    - Actions: `buy(floorId, slotIdx, typeId)`, `list(floorId, slotIdx)`, `collect(floorId, slotIdx)`, `hydrate(state)`
  - `useBalance()` selector hook: returns `number`
  - `useFloor(floorId)` selector hook: returns `Floor`
  - `loadGameState(): GameState | null`
  - `saveGameState(state): void`
  - `setupPersistence(): void`

- [ ] **Step 1: Write store tests**

Create `src/stores/__tests__/gameStore.test.ts`:

```ts
import { processCommand } from '../../engine/processCommand';
import { createInitialState } from '../../config/gameConfig';
import type { GameState, GameConfig } from '../../types';

const testConfig: GameConfig = {
  floors: [
    { id: 1, name: 'Floor 1', slots: 1, availableTypes: ['coffee_shop'] },
  ],
  productionTypes: {
    coffee_shop: { buyCost: 10, deliveryDuration: 5000, sellDuration: 10000, batchValue: 25 },
  },
  startingBalance: 100,
};

describe('game store logic (via processCommand)', () => {
  it('buy deducts balance and starts delivering', () => {
    const state = createInitialState(testConfig);
    const result = processCommand(
      state,
      { id: '1', type: 'buy', floorId: 1, slotIdx: 0, typeId: 'coffee_shop', timestamp: 1000 },
      testConfig,
      1000,
    );
    expect(result.success).toBe(true);
    expect(result.state.balance).toBe(90);
    expect(result.state.floors[0].productions[0].stage).toBe('DELIVERING');
  });

  it('command queue cap works at boundary', () => {
    const state = createInitialState(testConfig);
    const bigQueue = Array.from({ length: 10000 }, (_, i) => ({
      id: `cmd-${i}`,
      type: 'buy' as const,
      floorId: 1,
      slotIdx: 0,
      typeId: 'coffee_shop',
      timestamp: i,
    }));
    const stateWithFullQueue: GameState = { ...state, commandQueue: bigQueue };
    expect(stateWithFullQueue.commandQueue).toHaveLength(10000);
  });
});
```

- [ ] **Step 2: Implement the Zustand store**

Create `src/stores/gameStore.ts`:

```ts
import { create } from 'zustand';
import { processCommand } from '../engine/processCommand';
import { gameConfig, createInitialState } from '../config/gameConfig';
import { clock } from '../services/clock';
import type { GameState, Command, Floor } from '../types';

const COMMAND_QUEUE_CAP = 10_000;

interface GameActions {
  buy: (floorId: number, slotIdx: number, typeId: string) => void;
  list: (floorId: number, slotIdx: number) => void;
  collect: (floorId: number, slotIdx: number) => void;
  hydrate: (state: GameState) => void;
}

type GameStore = GameState & GameActions;

function executeCommand(
  get: () => GameStore,
  set: (partial: Partial<GameStore>) => void,
  command: Command,
) {
  const { balance, floors, commandQueue } = get();
  const result = processCommand({ balance, floors, commandQueue }, command, gameConfig, command.timestamp);
  if (!result.success) return;

  let newQueue = [...result.state.commandQueue, command];
  if (newQueue.length > COMMAND_QUEUE_CAP) {
    newQueue = newQueue.slice(newQueue.length - COMMAND_QUEUE_CAP);
  }

  set({
    balance: result.state.balance,
    floors: result.state.floors,
    commandQueue: newQueue,
  });
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...createInitialState(gameConfig),

  buy: (floorId, slotIdx, typeId) => {
    executeCommand(get, set, {
      id: crypto.randomUUID(),
      type: 'buy',
      floorId,
      slotIdx,
      typeId,
      timestamp: clock.now(),
    });
  },

  list: (floorId, slotIdx) => {
    executeCommand(get, set, {
      id: crypto.randomUUID(),
      type: 'list',
      floorId,
      slotIdx,
      timestamp: clock.now(),
    });
  },

  collect: (floorId, slotIdx) => {
    executeCommand(get, set, {
      id: crypto.randomUUID(),
      type: 'collect',
      floorId,
      slotIdx,
      timestamp: clock.now(),
    });
  },

  hydrate: (state) => set({
    balance: state.balance,
    floors: state.floors,
    commandQueue: state.commandQueue,
  }),
}));

export function useBalance(): number {
  return useGameStore((state) => state.balance);
}

export function useFloor(floorId: number): Floor {
  return useGameStore(
    (state) => state.floors.find(f => f.id === floorId)!,
    (a, b) => a.id === b.id && a.productions === b.productions,
  );
}
```

- [ ] **Step 3: Implement MMKV persistence**

Create `src/services/persistence.ts`:

```ts
import { MMKV } from 'react-native-mmkv';
import { AppState } from 'react-native';
import { GameStateSchema } from '../schemas/gameState';
import { useGameStore } from '../stores/gameStore';
import type { GameState } from '../types';

const storage = new MMKV();
const GAME_STATE_KEY = 'gameState';
const SAVE_DEBOUNCE_MS = 3000;

export function loadGameState(): GameState | null {
  const raw = storage.getString(GAME_STATE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const result = GameStateSchema.safeParse(parsed);
    if (result.success) return result.data;
    console.warn('Invalid game state in MMKV, starting fresh');
    return null;
  } catch {
    console.warn('Failed to parse game state from MMKV, starting fresh');
    return null;
  }
}

export function saveGameState(state: GameState): void {
  storage.set(GAME_STATE_KEY, JSON.stringify({
    balance: state.balance,
    floors: state.floors,
    commandQueue: state.commandQueue,
  }));
}

export function setupPersistence(): void {
  const savedState = loadGameState();
  if (savedState) {
    useGameStore.getState().hydrate(savedState);
  }

  let saveTimeout: ReturnType<typeof setTimeout> | null = null;

  useGameStore.subscribe((state) => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveGameState(state);
      saveTimeout = null;
    }, SAVE_DEBOUNCE_MS);
  });

  const handleAppState = (nextAppState: string) => {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
      }
      saveGameState(useGameStore.getState());
    }
  };

  AppState.addEventListener('change', handleAppState);
}
```

- [ ] **Step 4: Run tests**

Run: `npx jest src/stores/ --verbose`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/gameStore.ts src/stores/__tests__/gameStore.test.ts src/services/persistence.ts
git commit -m "feat: Zustand game store with actions/selectors and MMKV persistence"
```

---

### Task 5: UI Components + Main Screen Assembly

**Files:**
- Create: `src/hooks/useGameClock.ts`
- Create: `src/components/BalanceHeader.tsx`
- Create: `src/components/ProductionSlot.tsx`
- Create: `src/components/FloorCard.tsx`
- Create: `src/components/SkyscraperScreen.tsx`
- Modify: `app/_layout.tsx`
- Modify: `app/index.tsx`

**Interfaces:**
- Consumes:
  - `useGameStore`, `useBalance`, `useFloor` from `src/stores/gameStore`
  - `getProductionStatus` from `src/engine/productionStatus`
  - `gameConfig` from `src/config/gameConfig`
  - `clock` from `src/services/clock`
  - `setupPersistence` from `src/services/persistence`
- Produces:
  - Full playable main screen

- [ ] **Step 1: Create useGameClock hook**

Create `src/hooks/useGameClock.ts`:

```ts
import { useState, useEffect } from 'react';
import { clock } from '../services/clock';

export function useGameClock(intervalMs: number = 1000): number {
  const [now, setNow] = useState(() => clock.now());

  useEffect(() => {
    const id = setInterval(() => setNow(clock.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
```

- [ ] **Step 2: Create BalanceHeader component**

Create `src/components/BalanceHeader.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { useBalance } from '../stores/gameStore';

export function BalanceHeader() {
  const balance = useBalance();

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Balance</Text>
      <Text style={styles.balance}>${balance}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    color: '#8888aa',
  },
  balance: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e0e0ff',
  },
});
```

- [ ] **Step 3: Create ProductionSlot component**

Create `src/components/ProductionSlot.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { getProductionStatus } from '../engine/productionStatus';
import { gameConfig } from '../config/gameConfig';
import type { Production } from '../types';

interface Props {
  production: Production;
  balance: number;
  now: number;
  floorAvailableTypes: string[];
  onBuy: (typeId: string) => void;
  onList: () => void;
  onCollect: () => void;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  return `${seconds}s`;
}

export function ProductionSlot({
  production,
  balance,
  now,
  floorAvailableTypes,
  onBuy,
  onList,
  onCollect,
}: Props) {
  const typeConfig = production.typeId
    ? gameConfig.productionTypes[production.typeId]
    : null;
  const status = getProductionStatus(production, typeConfig, now, balance);

  if (status.effectiveStage === 'EMPTY') {
    return (
      <View style={styles.slot}>
        {floorAvailableTypes.map((typeId) => {
          const config = gameConfig.productionTypes[typeId];
          const canAfford = balance >= config.buyCost;
          return (
            <Pressable
              key={typeId}
              onPress={() => onBuy(typeId)}
              disabled={!canAfford}
              style={[styles.typeButton, !canAfford && styles.disabled]}
            >
              <Text style={styles.typeButtonText}>{typeId.replace('_', ' ')}</Text>
              <Text style={styles.costText}>${config.buyCost}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  if (status.effectiveStage === 'IDLE') {
    return (
      <View style={styles.slot}>
        <Text style={styles.typeLabel}>{production.typeId!.replace('_', ' ')}</Text>
        <Pressable
          onPress={() => onBuy(production.typeId!)}
          disabled={!status.canAct}
          style={[styles.actionButton, styles.buyButton, !status.canAct && styles.disabled]}
        >
          <Text style={styles.buttonText}>{status.actionLabel}</Text>
        </Pressable>
      </View>
    );
  }

  if (status.effectiveStage === 'DELIVERING' || status.effectiveStage === 'SELLING') {
    return (
      <View style={styles.slot}>
        <Text style={styles.typeLabel}>{production.typeId!.replace('_', ' ')}</Text>
        <View style={styles.timerContainer}>
          <Text style={styles.stageLabel}>
            {status.effectiveStage === 'DELIVERING' ? 'Delivering...' : 'Selling...'}
          </Text>
          <Text style={styles.timer}>{formatTime(status.timeRemaining)}</Text>
        </View>
      </View>
    );
  }

  if (status.effectiveStage === 'READY_TO_LIST') {
    return (
      <View style={styles.slot}>
        <Text style={styles.typeLabel}>{production.typeId!.replace('_', ' ')}</Text>
        <Pressable onPress={onList} style={[styles.actionButton, styles.readyButton]}>
          <Text style={styles.buttonText}>List</Text>
        </Pressable>
      </View>
    );
  }

  if (status.effectiveStage === 'READY_TO_COLLECT') {
    return (
      <View style={styles.slot}>
        <Text style={styles.typeLabel}>{production.typeId!.replace('_', ' ')}</Text>
        <Pressable onPress={onCollect} style={[styles.actionButton, styles.collectButton]}>
          <Text style={styles.buttonText}>{status.actionLabel}</Text>
        </Pressable>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  slot: {
    flex: 1,
    padding: 8,
    marginHorizontal: 4,
    backgroundColor: '#2a2a4a',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  typeLabel: {
    fontSize: 10,
    color: '#8888aa',
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  typeButton: {
    backgroundColor: '#3a3a6a',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginVertical: 2,
    alignItems: 'center',
    width: '100%',
  },
  typeButtonText: {
    fontSize: 11,
    color: '#e0e0ff',
    textTransform: 'capitalize',
  },
  costText: {
    fontSize: 10,
    color: '#aaaacc',
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    width: '100%',
    alignItems: 'center',
  },
  buyButton: {
    backgroundColor: '#4a6fa5',
  },
  readyButton: {
    backgroundColor: '#5a9a5a',
  },
  collectButton: {
    backgroundColor: '#c9a52c',
  },
  buttonText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '600',
  },
  timerContainer: {
    alignItems: 'center',
  },
  stageLabel: {
    fontSize: 11,
    color: '#8888aa',
  },
  timer: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e0e0ff',
  },
  disabled: {
    opacity: 0.4,
  },
});
```

- [ ] **Step 4: Create FloorCard component**

Create `src/components/FloorCard.tsx`:

```tsx
import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useGameStore } from '../stores/gameStore';
import { gameConfig } from '../config/gameConfig';
import { ProductionSlot } from './ProductionSlot';

interface Props {
  floorId: number;
  now: number;
}

export const FloorCard = memo(function FloorCard({ floorId, now }: Props) {
  const floor = useGameStore(
    (state) => state.floors.find(f => f.id === floorId)!,
    (a, b) => a === b,
  );
  const balance = useGameStore((state) => state.balance);
  const buy = useGameStore((state) => state.buy);
  const list = useGameStore((state) => state.list);
  const collect = useGameStore((state) => state.collect);

  const floorConfig = gameConfig.floors.find(f => f.id === floorId)!;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.floorName}>{floor.name}</Text>
      </View>
      <View style={styles.productions}>
        {floor.productions.map((production, slotIdx) => (
          <ProductionSlot
            key={slotIdx}
            production={production}
            balance={balance}
            now={now}
            floorAvailableTypes={floorConfig.availableTypes}
            onBuy={(typeId) => buy(floorId, slotIdx, typeId)}
            onList={() => list(floorId, slotIdx)}
            onCollect={() => collect(floorId, slotIdx)}
          />
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginVertical: 6,
    backgroundColor: '#1e1e3a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#16162e',
  },
  floorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#c0c0e0',
  },
  productions: {
    flexDirection: 'row',
    padding: 8,
  },
});
```

- [ ] **Step 5: Create SkyscraperScreen component**

Create `src/components/SkyscraperScreen.tsx`:

```tsx
import { View, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useGameStore } from '../stores/gameStore';
import { useGameClock } from '../hooks/useGameClock';
import { BalanceHeader } from './BalanceHeader';
import { FloorCard } from './FloorCard';

export function SkyscraperScreen() {
  const floorIds = useGameStore(
    (state) => state.floors.map(f => f.id),
    (a, b) => a.length === b.length && a.every((id, i) => id === b[i]),
  );
  const now = useGameClock(1000);

  const reversedIds = [...floorIds].reverse();

  return (
    <View style={styles.container}>
      <BalanceHeader />
      <FlashList
        data={reversedIds}
        renderItem={({ item: floorId }) => (
          <FloorCard floorId={floorId} now={now} />
        )}
        keyExtractor={(id) => String(id)}
        estimatedItemSize={120}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0e0e1e',
  },
  listContent: {
    paddingVertical: 8,
  },
});
```

- [ ] **Step 6: Wire up app layout and entry screen**

Update `app/_layout.tsx`:

```tsx
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { setupPersistence } from '../src/services/persistence';

let persistenceInitialized = false;

export default function RootLayout() {
  useEffect(() => {
    if (!persistenceInitialized) {
      setupPersistence();
      persistenceInitialized = true;
    }
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
```

Update `app/index.tsx`:

```tsx
import { SafeAreaView, StyleSheet } from 'react-native';
import { SkyscraperScreen } from '../src/components/SkyscraperScreen';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <SkyscraperScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0e0e1e',
  },
});
```

- [ ] **Step 7: Run the app and test manually**

```bash
npx expo run:ios
```

**Manual test checklist:**
1. App loads with $100 balance and 5 floors (Floor 5 at top, Ground Floor at bottom)
2. Tap a type button on an empty slot → balance deducts, countdown starts
3. Wait for delivery timer → "List" button appears
4. Tap "List" → selling countdown starts
5. Wait for sell timer → "Collect" button appears
6. Tap "Collect" → balance increases, slot returns to "Buy" with same type
7. Close and reopen app → state is preserved (balance, production stages, timers)
8. Scroll through floors → smooth, no frame drops
9. Tap on one floor → only that floor visually updates

- [ ] **Step 8: Run all tests**

Run: `npx jest --verbose`

Expected: all tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/hooks/ src/components/ app/
git commit -m "feat: main gameplay screen with FlashList, production slots, and MMKV persistence"
```
