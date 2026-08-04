# Floor Upgrade System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-floor 5-star upgrade system that multiplies revenue (×8), sell time (×4), and buy cost (×4) at max stars, paid with gems + floor-type tokens.

**Architecture:** New `floorStars: Record<string, number>` field in GameState. Config table drives costs and multipliers. Engine applies multipliers at buy/collect time. Modal opened by tapping the stars row in FloorCard header, rendered via GlobalOverlay.

**Tech Stack:** TypeScript, Zod schemas, Zustand (gameStore), React Native, react-i18next.

## Global Constraints

- `floorStars` keys are `floorId.toString()` (string), values are `0..5` int — same convention as `openedFloorTypes`
- Multipliers from `FLOOR_STAR_MULTIPLIERS[stars]`; index 0 = base (no upgrade)
- Cost from `FLOOR_UPGRADE_COSTS[stars]` where `stars` is the current count (0→buys star 1)
- All new modals go through `GlobalOverlay` — never render locally in tabs/screens
- Test runner: `npx jest` (or `npx jest <path>` for a single file)
- Commit after every task

---

## File Map

| File | Action |
|------|--------|
| `shared/config/floorUpgradeConfig.ts` | **Create** — cost + multiplier tables |
| `shared/schemas/gameState.ts` | **Modify** — add `floorStars` field |
| `shared/schemas/command.ts` | **Modify** — add `UpgradeFloorCommandSchema`, register in union |
| `shared/types/index.ts` | **Modify** — export `UpgradeFloorCommand` type |
| `shared/config/gameConfig.ts` | **Modify** — add `floorStars: {}` to `createInitialState` |
| `shared/engine/processCommand.ts` | **Modify** — `getFloorStarMultiplier` helper; apply in `handleBuy`, `handleCollect`; new `handleUpgradeFloor` |
| `shared/engine/productionStatus.ts` | **Modify** — add optional `sellDurationOverride` param |
| `src/stores/gameStore.ts` | **Modify** — `floorStars` in UIState/hydrate/reconcile; `upgradeFloor` action; modal state + actions |
| `src/components/ProductionCard.tsx` | **Modify** — apply star multipliers to UI cost/revenue/timer display |
| `src/components/FloorCard.tsx` | **Modify** — connect `Stars` to store; tap → `openFloorUpgradeModal` |
| `src/components/FloorUpgradeModal.tsx` | **Create** — upgrade modal UI |
| `src/components/GlobalOverlay.tsx` | **Modify** — register `FloorUpgradeModal` |
| `src/i18n/locales/en/hotel.json` | **Modify** — add `floorUpgrade` strings |
| `shared/engine/__tests__/processCommand.test.ts` | **Modify** — tests for multipliers + upgrade_floor handler |
| `shared/engine/__tests__/productionStatus.test.ts` | **Create** (if missing) / **Modify** — test sellDurationOverride |

---

## Task 1: Config + Schema

**Files:**
- Create: `shared/config/floorUpgradeConfig.ts`
- Modify: `shared/schemas/gameState.ts`
- Modify: `shared/schemas/command.ts`
- Modify: `shared/types/index.ts`
- Modify: `shared/config/gameConfig.ts`

**Interfaces:**
- Produces: `FLOOR_UPGRADE_COSTS`, `FLOOR_STAR_MULTIPLIERS`, `FloorStarMultiplier` type, `UpgradeFloorCommand` type, `floorStars` field on `GameState`

- [ ] **Step 1: Create `shared/config/floorUpgradeConfig.ts`**

```ts
export interface FloorStarMultiplier {
  value: number;
  time:  number;
  cost:  number;
}

// Index = star count. Index 0 = no upgrade (base values).
export const FLOOR_STAR_MULTIPLIERS: FloorStarMultiplier[] = [
  { value: 1,   time: 1,   cost: 1   }, // 0★
  { value: 2,   time: 1.5, cost: 1.5 }, // 1★
  { value: 3,   time: 2,   cost: 2   }, // 2★
  { value: 4,   time: 2.5, cost: 2.5 }, // 3★
  { value: 6,   time: 3,   cost: 3   }, // 4★
  { value: 8,   time: 4,   cost: 4   }, // 5★
];

// Index = current star count (0 → buys 1st star, 4 → buys 5th star).
export const FLOOR_UPGRADE_COSTS = [
  { gems: 10, tokens: 1 }, // 0★ → 1★
  { gems: 20, tokens: 2 }, // 1★ → 2★
  { gems: 30, tokens: 3 }, // 2★ → 3★
  { gems: 50, tokens: 4 }, // 3★ → 4★
  { gems: 80, tokens: 5 }, // 4★ → 5★
];
```

- [ ] **Step 2: Add `floorStars` to `shared/schemas/gameState.ts`**

In `GameStateSchema`, add after `businessUpgrades`:

```ts
floorStars: z.record(z.string(), z.number().int().min(0).max(5)).default({}),
```

- [ ] **Step 3: Add `UpgradeFloorCommandSchema` to `shared/schemas/command.ts`**

Add after `UpgradeBusinessCategoryCommandSchema`:

```ts
export const UpgradeFloorCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('upgrade_floor'),
  floorId: z.number().int().positive(),
});
```

Register in the `CommandSchema` discriminated union — add `UpgradeFloorCommandSchema` to the array alongside the other schemas.

- [ ] **Step 4: Export new type in `shared/types/index.ts`**

Add with the other command type exports:

```ts
import { ..., UpgradeFloorCommandSchema } from '../schemas/command';
export type UpgradeFloorCommand = z.infer<typeof UpgradeFloorCommandSchema>;
```

- [ ] **Step 5: Add `floorStars` to `createInitialState` in `shared/config/gameConfig.ts`**

In the returned object, add after `businessUpgrades`:

```ts
floorStars: {},
```

- [ ] **Step 6: Verify schema test still passes**

```bash
npx jest shared/schemas/__tests__/schemas.test.ts --no-coverage
```

Expected: all existing schema tests pass, no new type errors.

- [ ] **Step 7: Commit**

```bash
git add shared/config/floorUpgradeConfig.ts shared/schemas/gameState.ts shared/schemas/command.ts shared/types/index.ts shared/config/gameConfig.ts
git commit -m "feat(floor-upgrade): add config, GameState.floorStars field, and UpgradeFloorCommand schema"
```

---

## Task 2: Engine — Multipliers in `handleBuy` and `handleCollect`

**Files:**
- Modify: `shared/engine/processCommand.ts` (lines ~449–617)
- Modify: `shared/engine/__tests__/processCommand.test.ts`

**Interfaces:**
- Consumes: `FLOOR_STAR_MULTIPLIERS` from `floorUpgradeConfig.ts`
- Produces: `getFloorStarMultiplier(state, floorId)` private helper; updated buy cost, revenue, and sell-time check

- [ ] **Step 1: Write failing tests**

Append to `shared/engine/__tests__/processCommand.test.ts`:

```ts
describe('floor star multipliers', () => {
  describe('buy command with stars', () => {
    it('multiplies buyCost by star cost multiplier (3★ = ×2.5)', () => {
      // coffee_shop buyCost=10, star-3 cost multiplier=2.5 → effectiveCost=25
      const state = makeState({ balance: 100, floorStars: { '1': 3 } });
      const worker = makeWorker({ assignedFloorId: 1, assignedSlotIdx: 0 });
      const s = { ...state, workers: [worker] };
      const result = processCommand(s, buyCmd({ typeId: 'coffee_shop' }), testConfig, 1000);
      expect(result.success).toBe(true);
      expect(result.state.balance).toBe(75); // 100 - floor(10 * 2.5)
    });

    it('no multiplier when floorStars not set (0★)', () => {
      const state = makeState({ balance: 100 });
      const worker = makeWorker({ assignedFloorId: 1, assignedSlotIdx: 0 });
      const s = { ...state, workers: [worker] };
      const result = processCommand(s, buyCmd({ typeId: 'coffee_shop' }), testConfig, 1000);
      expect(result.success).toBe(true);
      expect(result.state.balance).toBe(90); // 100 - 10
    });
  });

  describe('collect command with stars', () => {
    it('multiplies batchValue by star value multiplier (2★ = ×3)', () => {
      // coffee_shop batchValue=25, star-2 value=3 → revenue=75
      const state = makeState({ floorStars: { '1': 2 } });
      const worker = makeWorker({ assignedFloorId: 1, assignedSlotIdx: 0 });
      const s = {
        ...state,
        workers: [worker],
        floors: [{
          id: 1,
          productions: [{
            typeId: 'coffee_shop',
            stage: 'SELLING' as const,
            stageStartedAt: 0,
          }, state.floors[0].productions[1]],
        }],
      };
      const result = processCommand(
        s,
        { id: 'c1', type: 'collect', floorId: 1, slotIdx: 0, timestamp: 100_000 },
        testConfig, 100_000,
      );
      expect(result.success).toBe(true);
      expect(result.state.balance).toBe(s.balance + 75);
    });

    it('respects extended sellDuration (1★ = ×1.5 → 15000ms)', () => {
      // coffee_shop sellDuration=10000, star-1 time=1.5 → effectiveSellDuration=15000
      // at t=12000 (elapsed 12000ms) — not done yet
      const state = makeState({ floorStars: { '1': 1 } });
      const worker = makeWorker({ assignedFloorId: 1, assignedSlotIdx: 0 });
      const s = {
        ...state,
        workers: [worker],
        floors: [{
          id: 1,
          productions: [{
            typeId: 'coffee_shop',
            stage: 'SELLING' as const,
            stageStartedAt: 0,
          }, state.floors[0].productions[1]],
        }],
      };
      const result = processCommand(
        s,
        { id: 'c2', type: 'collect', floorId: 1, slotIdx: 0, timestamp: 12_000 },
        testConfig, 12_000,
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe('Sale not complete');
    });

    it('collect succeeds after extended sellDuration elapsed', () => {
      const state = makeState({ floorStars: { '1': 1 } });
      const worker = makeWorker({ assignedFloorId: 1, assignedSlotIdx: 0 });
      const s = {
        ...state,
        workers: [worker],
        floors: [{
          id: 1,
          productions: [{
            typeId: 'coffee_shop',
            stage: 'SELLING' as const,
            stageStartedAt: 0,
          }, state.floors[0].productions[1]],
        }],
      };
      const result = processCommand(
        s,
        { id: 'c3', type: 'collect', floorId: 1, slotIdx: 0, timestamp: 15_001 },
        testConfig, 15_001,
      );
      expect(result.success).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx jest shared/engine/__tests__/processCommand.test.ts --no-coverage -t "floor star multipliers"
```

Expected: tests fail because multiplier logic doesn't exist yet.

- [ ] **Step 3: Add `getFloorStarMultiplier` helper and import to `shared/engine/processCommand.ts`**

Add import at the top of the file (with other imports):

```ts
import { FLOOR_STAR_MULTIPLIERS } from '../config/floorUpgradeConfig';
```

Add helper function near the other private helpers (after `resolveFloorType`):

```ts
function getFloorStarMultiplier(state: GameState, floorId: number) {
  const stars = state.floorStars?.[String(floorId)] ?? 0;
  return FLOOR_STAR_MULTIPLIERS[stars] ?? FLOOR_STAR_MULTIPLIERS[0];
}
```

- [ ] **Step 4: Apply cost multiplier in `handleBuy`**

Find the two lines around line 499–500:

```ts
const discount = getFloorDiscount(state.workers, command.floorId);
const effectiveCost = Math.floor(typeConfig.buyCost * (1 - discount));
```

Replace with:

```ts
const discount = getFloorDiscount(state.workers, command.floorId);
const starMult = getFloorStarMultiplier(state, command.floorId);
const effectiveCost = Math.floor(typeConfig.buyCost * starMult.cost * (1 - discount));
```

- [ ] **Step 5: Apply value + time multipliers in `handleCollect`**

Find around line 583–597 in `handleCollect`:

```ts
if (now - production.stageStartedAt < typeConfig.sellDuration) {
  return { success: false, state, error: 'Sale not complete' };
}
...
const revenue = Math.floor(typeConfig.batchValue * coinMultiplier * workerMultiplier);
const xpGained = Math.floor(typeConfig.batchValue * xpMultiplier * workerMultiplier);
```

Replace with:

```ts
const floorId = state.floors[floorIdx].id;
const starMult = getFloorStarMultiplier(state, floorId);
const effectiveSellDuration = typeConfig.sellDuration * starMult.time;
if (now - production.stageStartedAt < effectiveSellDuration) {
  return { success: false, state, error: 'Sale not complete' };
}
...
const revenue  = Math.floor(typeConfig.batchValue * starMult.value * coinMultiplier * workerMultiplier);
const xpGained = Math.floor(typeConfig.batchValue * starMult.value * xpMultiplier  * workerMultiplier);
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
npx jest shared/engine/__tests__/processCommand.test.ts --no-coverage
```

Expected: all tests pass including new ones.

- [ ] **Step 7: Commit**

```bash
git add shared/engine/processCommand.ts shared/engine/__tests__/processCommand.test.ts
git commit -m "feat(floor-upgrade): apply star multipliers in handleBuy and handleCollect"
```

---

## Task 3: Engine — `upgrade_floor` Command Handler

**Files:**
- Modify: `shared/engine/processCommand.ts`
- Modify: `shared/engine/__tests__/processCommand.test.ts`

**Interfaces:**
- Consumes: `FLOOR_UPGRADE_COSTS` from `floorUpgradeConfig.ts`; `resolveFloorType` private helper; `UpgradeFloorCommand` type
- Produces: `handleUpgradeFloor` registered in the main `processCommand` switch

- [ ] **Step 1: Write failing tests**

Append to `shared/engine/__tests__/processCommand.test.ts`:

```ts
describe('upgrade_floor', () => {
  function upgradeCmd(floorId = 1): Command {
    return { id: 'uf1', type: 'upgrade_floor', floorId, timestamp: 1000 };
  }

  it('upgrades 0★ → 1★, deducts gems and tokens', () => {
    const state = makeState({
      gems: 50,
      tokens: { green: 5, blue: 0, yellow: 0, purple: 0, red: 0 },
    });
    const result = processCommand(state, upgradeCmd(), testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(40);              // 50 - 10
    expect(result.state.tokens.green).toBe(4);       // 5 - 1
    expect(result.state.floorStars?.['1']).toBe(1);
  });

  it('upgrades 1★ → 2★ using second cost entry', () => {
    const state = makeState({
      gems: 50,
      tokens: { green: 5, blue: 0, yellow: 0, purple: 0, red: 0 },
      floorStars: { '1': 1 },
    });
    const result = processCommand(state, upgradeCmd(), testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(30);              // 50 - 20
    expect(result.state.tokens.green).toBe(3);       // 5 - 2
    expect(result.state.floorStars?.['1']).toBe(2);
  });

  it('fails when gems insufficient', () => {
    const state = makeState({
      gems: 5,
      tokens: { green: 5, blue: 0, yellow: 0, purple: 0, red: 0 },
    });
    const result = processCommand(state, upgradeCmd(), testConfig, 1000);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient gems');
  });

  it('fails when tokens insufficient', () => {
    const state = makeState({
      gems: 50,
      tokens: { green: 0, blue: 0, yellow: 0, purple: 0, red: 0 },
    });
    const result = processCommand(state, upgradeCmd(), testConfig, 1000);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient tokens');
  });

  it('fails when already at 5★', () => {
    const state = makeState({
      gems: 200,
      tokens: { green: 10, blue: 0, yellow: 0, purple: 0, red: 0 },
      floorStars: { '1': 5 },
    });
    const result = processCommand(state, upgradeCmd(), testConfig, 1000);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Floor already at max stars');
  });

  it('fails when floor does not exist', () => {
    const state = makeState({ gems: 50, tokens: { green: 5, blue: 0, yellow: 0, purple: 0, red: 0 } });
    const result = processCommand(state, upgradeCmd(99), testConfig, 1000);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Floor not found');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx jest shared/engine/__tests__/processCommand.test.ts --no-coverage -t "upgrade_floor"
```

Expected: fail — handler not registered.

- [ ] **Step 3: Add import and implement `handleUpgradeFloor`**

Add `FLOOR_UPGRADE_COSTS` to the existing import from `floorUpgradeConfig`:

```ts
import { FLOOR_STAR_MULTIPLIERS, FLOOR_UPGRADE_COSTS } from '../config/floorUpgradeConfig';
```

Add the new handler function (place it near `handleUpgradeBusinessCategory`):

```ts
function handleUpgradeFloor(
  state: GameState,
  command: Extract<Command, { type: 'upgrade_floor' }>,
  config: GameConfig,
): ProcessResult {
  const { floorId } = command;
  const floorExists = state.floors.some((f) => f.id === floorId);
  if (!floorExists) return { success: false, state, error: 'Floor not found' };

  const floorType = resolveFloorType(state, config, floorId);
  if (!floorType) return { success: false, state, error: 'Floor not open' };

  const currentStars = state.floorStars?.[String(floorId)] ?? 0;
  if (currentStars >= 5) return { success: false, state, error: 'Floor already at max stars' };

  const cost = FLOOR_UPGRADE_COSTS[currentStars];

  if (state.gems < cost.gems) return { success: false, state, error: 'Insufficient gems' };

  const tokenKey = floorType as keyof typeof state.tokens;
  const tokenBalance = state.tokens?.[tokenKey] ?? 0;
  if (tokenBalance < cost.tokens) return { success: false, state, error: 'Insufficient tokens' };

  return {
    success: true,
    state: {
      ...state,
      gems: state.gems - cost.gems,
      tokens: { ...state.tokens, [tokenKey]: tokenBalance - cost.tokens },
      floorStars: { ...state.floorStars, [String(floorId)]: currentStars + 1 },
    },
  };
}
```

- [ ] **Step 4: Register in the `processCommand` switch**

In the main `processCommand` function, find the switch/if-chain that dispatches to handlers. Add alongside `upgrade_business_category`:

```ts
case 'upgrade_floor':
  return handleUpgradeFloor(state, command, config);
```

- [ ] **Step 5: Run all processCommand tests — expect PASS**

```bash
npx jest shared/engine/__tests__/processCommand.test.ts --no-coverage
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add shared/engine/processCommand.ts shared/engine/__tests__/processCommand.test.ts
git commit -m "feat(floor-upgrade): add upgrade_floor command handler"
```

---

## Task 4: `productionStatus.ts` — sellDuration Override

**Files:**
- Modify: `shared/engine/productionStatus.ts`
- Test: `shared/engine/__tests__/productionStatus.test.ts` (create if absent)

**Interfaces:**
- Consumes: existing `getProductionStatus` signature
- Produces: updated signature `getProductionStatus(production, typeConfig, now, balance, sellDurationOverride?: number)`

- [ ] **Step 1: Write failing test**

Create or append to `shared/engine/__tests__/productionStatus.test.ts`:

```ts
import { getProductionStatus } from '../productionStatus';
import type { Production, ProductionTypeConfig } from '../../types';

const typeConfig: ProductionTypeConfig = {
  buyCost: 10,
  deliveryDuration: 5000,
  sellDuration: 10_000,
  batchValue: 25,
};

const sellingProd: Production = {
  typeId: 'coffee_shop',
  stage: 'SELLING',
  stageStartedAt: 0,
};

describe('getProductionStatus', () => {
  it('SELLING: uses sellDurationOverride instead of typeConfig.sellDuration', () => {
    // At t=12000, default sellDuration=10000 would be done, but override=15000 means still selling
    const status = getProductionStatus(sellingProd, typeConfig, 12_000, 0, 15_000);
    expect(status.effectiveStage).toBe('SELLING');
    expect(status.timeRemaining).toBeGreaterThan(0);
  });

  it('SELLING: completes when override duration has elapsed', () => {
    const status = getProductionStatus(sellingProd, typeConfig, 15_001, 0, 15_000);
    expect(status.effectiveStage).toBe('READY_TO_COLLECT');
  });

  it('SELLING: default behavior unchanged when no override given', () => {
    const status = getProductionStatus(sellingProd, typeConfig, 10_001, 0);
    expect(status.effectiveStage).toBe('READY_TO_COLLECT');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx jest shared/engine/__tests__/productionStatus.test.ts --no-coverage
```

Expected: tests fail — parameter doesn't exist yet.

- [ ] **Step 3: Update `getProductionStatus` signature and SELLING case**

In `shared/engine/productionStatus.ts`, change the function signature and SELLING case:

```ts
export function getProductionStatus(
  production: Production,
  typeConfig: ProductionTypeConfig | null,
  now: number,
  balance: number,
  sellDurationOverride?: number,
): DerivedStatus {
  // ... existing EMPTY/IDLE/DELIVERING/READY_TO_LIST cases unchanged ...

  case 'SELLING': {
    const sellDuration = sellDurationOverride ?? typeConfig.sellDuration;
    const remaining = Math.max(0, sellDuration - (now - production.stageStartedAt));
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
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx jest shared/engine/__tests__/productionStatus.test.ts --no-coverage
```

- [ ] **Step 5: Run full suite — no regressions**

```bash
npx jest --no-coverage
```

- [ ] **Step 6: Commit**

```bash
git add shared/engine/productionStatus.ts shared/engine/__tests__/productionStatus.test.ts
git commit -m "feat(floor-upgrade): add sellDurationOverride to getProductionStatus"
```

---

## Task 5: Store Wiring

**Files:**
- Modify: `src/stores/gameStore.ts`

**Interfaces:**
- Consumes: `FLOOR_UPGRADE_COSTS`, `FLOOR_STAR_MULTIPLIERS` from `floorUpgradeConfig.ts`
- Produces: `floorStars` in store state; `upgradeFloor(floorId)` action; `floorUpgradeModal` state; `openFloorUpgradeModal(floorId)` / `closeFloorUpgradeModal()` actions

- [ ] **Step 1: Add `floorUpgradeModal` to `UIState` interface**

Find the `interface UIState {` block (around line 153). Add:

```ts
floorUpgradeModal: { floorId: number } | null;
```

- [ ] **Step 2: Add `upgradeFloor`, `openFloorUpgradeModal`, `closeFloorUpgradeModal` to `GameActions` interface**

Find `interface GameActions {` (around line 176). Add:

```ts
upgradeFloor: (floorId: number) => void;
openFloorUpgradeModal: (floorId: number) => void;
closeFloorUpgradeModal: () => void;
```

- [ ] **Step 3: Add import for upgrade config**

Near the top of the file, add:

```ts
import { FLOOR_UPGRADE_COSTS } from '../config/floorUpgradeConfig';
```

Wait — the config lives in `shared/`, so path from `src/stores/`:

```ts
import { FLOOR_UPGRADE_COSTS } from '../../shared/config/floorUpgradeConfig';
```

- [ ] **Step 4: Initialize `floorUpgradeModal: null` in the store initial state**

Find the `create<...>()(...)` call where UIState fields are initialized (around line 398–421 area). Add:

```ts
floorUpgradeModal: null,
```

- [ ] **Step 5: Add `floorStars` to `hydrate`**

Find the `hydrate: (state) => set((cur) => ({` block (around line 1032). Add after `businessUpgrades`:

```ts
floorStars: state.floorStars ?? {},
```

- [ ] **Step 6: Add `floorStars` to `reconcile`**

Find the `reconcile: (serverState, ...) => set((cur) => ({` block (around line 1041). Add after the `businessUpgrades` line (line ~1150):

```ts
floorStars: serverState.floorStars ?? cur.floorStars ?? {},
```

- [ ] **Step 7: Implement `upgradeFloor` action**

Add alongside `upgradeBusinessCategory` (around line 428):

```ts
upgradeFloor: (floorId) => {
  const state = get();
  const stars = state.floorStars?.[String(floorId)] ?? 0;
  if (stars >= 5) return;

  const cost = FLOOR_UPGRADE_COSTS[stars];
  const floorConfig = gameConfig.floors.find((f) => f.id === floorId);
  const floorType = (floorConfig?.floorType ?? state.openedFloorTypes?.[String(floorId)]) as
    'green' | 'blue' | 'yellow' | 'purple' | 'red' | undefined;
  if (!floorType) return;

  if (state.gems < cost.gems) {
    state.showInsufficientResources({ currency: 'gems', need: cost.gems, have: state.gems });
    return;
  }
  const tokenBalance = state.tokens[floorType] ?? 0;
  if (tokenBalance < cost.tokens) {
    state.showTokenInsufficient({ floorType, have: tokenBalance, need: cost.tokens });
    return;
  }

  executeCommand(get, set, {
    id: uuid(),
    type: 'upgrade_floor',
    floorId,
    timestamp: clock.now(),
  });
},
```

- [ ] **Step 8: Implement modal actions**

```ts
openFloorUpgradeModal: (floorId) => set({ floorUpgradeModal: { floorId } }),
closeFloorUpgradeModal: () => set({ floorUpgradeModal: null }),
```

- [ ] **Step 9: Add `floorUpgradeModal: null` to `reset()`**

In the `reset: () => set({...})` call (around line 559), add:

```ts
floorUpgradeModal: null,
```

- [ ] **Step 10: Run full test suite — no regressions**

```bash
npx jest --no-coverage
```

- [ ] **Step 11: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat(floor-upgrade): wire floorStars and upgradeFloor into gameStore"
```

---

## Task 6: `ProductionCard` — Apply Star Multipliers to UI Display

**Files:**
- Modify: `src/components/ProductionCard.tsx`

**Interfaces:**
- Consumes: `floorStars` from `useGameStore`; `FLOOR_STAR_MULTIPLIERS` from config; updated `getProductionStatus` signature (Task 4)

- [ ] **Step 1: Add import for multiplier config**

At the top of `ProductionCard.tsx`, add:

```ts
import { FLOOR_STAR_MULTIPLIERS } from '../../shared/config/floorUpgradeConfig';
```

- [ ] **Step 2: Read `floorStars` from store and compute `starMult`**

After the existing `const typeConfig = ...` line (around line 207), add:

```ts
const floorStars = useGameStore((s) => s.floorStars);
const stars = floorStars?.[String(floorId)] ?? 0;
const starMult = FLOOR_STAR_MULTIPLIERS[stars] ?? FLOOR_STAR_MULTIPLIERS[0];
const effectiveSellDuration = typeConfig ? typeConfig.sellDuration * starMult.time : 0;
```

- [ ] **Step 3: Pass `effectiveSellDuration` to `getProductionStatus`**

Find line 220:

```ts
const status = getProductionStatus(production, typeConfig, now, balance);
```

Change to:

```ts
const status = getProductionStatus(production, typeConfig, now, balance, effectiveSellDuration || undefined);
```

- [ ] **Step 4: Apply `starMult.cost` to `effectiveCost`**

Find around line 246–247:

```ts
const effectiveCost = typeConfig
  ? Math.floor(typeConfig.buyCost * (1 - (floorDiscount ?? 0)))
```

Change to:

```ts
const effectiveCost = typeConfig
  ? Math.floor(typeConfig.buyCost * starMult.cost * (1 - (floorDiscount ?? 0)))
```

- [ ] **Step 5: Apply `starMult.value` to `effectiveRevenue`**

Find around line 260–261:

```ts
const effectiveRevenue = typeConfig
  ? Math.floor(typeConfig.batchValue * (1 + (coinBonusPercent + specialistBonusPercent + categoryBonus) / 100) * multiplier)
```

Change to:

```ts
const effectiveRevenue = typeConfig
  ? Math.floor(typeConfig.batchValue * starMult.value * (1 + (coinBonusPercent + specialistBonusPercent + categoryBonus) / 100) * multiplier)
```

- [ ] **Step 6: Apply `effectiveSellDuration` to progress timer `totalDur`**

Find around line 266–267:

```ts
const totalDur = isProgressTimer && typeConfig
  ? (effectiveStage === 'DELIVERING' ? typeConfig.deliveryDuration : typeConfig.sellDuration)
```

Change to:

```ts
const totalDur = isProgressTimer && typeConfig
  ? (effectiveStage === 'DELIVERING' ? typeConfig.deliveryDuration : effectiveSellDuration)
```

- [ ] **Step 7: Apply `effectiveSellDuration` to `subText` for SELLING state**

Find around line 364:

```ts
subText = typeConfig ? formatDuration(typeConfig.sellDuration) : '';
```

Change to:

```ts
subText = typeConfig ? formatDuration(effectiveSellDuration) : '';
```

- [ ] **Step 8: Run full test suite**

```bash
npx jest --no-coverage
```

- [ ] **Step 9: Commit**

```bash
git add src/components/ProductionCard.tsx
git commit -m "feat(floor-upgrade): apply star multipliers to ProductionCard UI display"
```

---

## Task 7: `FloorCard` — Connect Stars to Store + Tap Handler

**Files:**
- Modify: `src/components/FloorCard.tsx`

**Interfaces:**
- Consumes: `floorStars` from `useGameStore`; `openFloorUpgradeModal` action
- Produces: tappable stars row that opens the upgrade modal

- [ ] **Step 1: Add `TouchableOpacity` import**

Find the existing imports at the top of `FloorCard.tsx`:

```ts
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
```

Add `TouchableOpacity`:

```ts
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
```

- [ ] **Step 2: Read `floorStars` and `openFloorUpgradeModal` from store**

Inside `FloorCardInner`, after the existing `useGameStore` calls (around line 299), add:

```ts
const floorStars = useGameStore((s) => s.floorStars);
const openFloorUpgradeModal = useGameStore((s) => s.openFloorUpgradeModal);
const starCount = floorStars?.[String(floorId)] ?? 0;
```

- [ ] **Step 3: Replace hardcoded `scheme.stars` with `starCount` and wrap in `TouchableOpacity`**

Find the `<Stars count={scheme.stars} />` line (around line 347). Replace with:

```tsx
<TouchableOpacity
  onPress={() => openFloorUpgradeModal(floorId)}
  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
  activeOpacity={0.7}
>
  <Stars count={starCount} />
</TouchableOpacity>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/FloorCard.tsx
git commit -m "feat(floor-upgrade): connect FloorCard stars to store and add tap handler"
```

---

## Task 8: `FloorUpgradeModal` + `GlobalOverlay` + i18n

**Files:**
- Create: `src/components/FloorUpgradeModal.tsx`
- Modify: `src/components/GlobalOverlay.tsx`
- Modify: `src/i18n/locales/en/hotel.json`

**Interfaces:**
- Consumes: `floorUpgradeModal` state; `closeFloorUpgradeModal`, `upgradeFloor` actions; `floorStars`, `gems`, `tokens` from store; `FLOOR_UPGRADE_COSTS`, `FLOOR_STAR_MULTIPLIERS`

- [ ] **Step 1: Add i18n strings to `src/i18n/locales/en/hotel.json`**

Add a new `floorUpgrade` key at the top level:

```json
"floorUpgrade": {
  "title": "Upgrade Floor",
  "currentStars": "Current level",
  "nextUpgrade": "Next upgrade",
  "cost": "Cost",
  "gems": "gems",
  "tokens": "tokens",
  "upgradeBtn": "Upgrade",
  "maxLevel": "Max Level Reached",
  "close": "Close"
}
```

- [ ] **Step 2: Run i18n key test — expect PASS**

```bash
npx jest src/i18n/__tests__/keysExist.test.ts --no-coverage
```

- [ ] **Step 3: Create `src/components/FloorUpgradeModal.tsx`**

```tsx
import React from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, useColorScheme,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';
import { FLOOR_UPGRADE_COSTS, FLOOR_STAR_MULTIPLIERS } from '../../shared/config/floorUpgradeConfig';
import { gameConfig } from '../../shared/config/gameConfig';
import { GemIcon } from './CurrencyIcons';

const TOKEN_LABEL: Record<string, string> = {
  green: '🟢', blue: '🔵', yellow: '🟡', purple: '🟣', red: '🔴',
};

export default function FloorUpgradeModal() {
  const { t } = useTranslation('hotel');
  const isDark = useColorScheme() === 'dark';
  const modal = useGameStore((s) => s.floorUpgradeModal);
  const close = useGameStore((s) => s.closeFloorUpgradeModal);
  const upgradeFloor = useGameStore((s) => s.upgradeFloor);
  const floorStars = useGameStore((s) => s.floorStars);
  const gems = useGameStore((s) => s.gems);
  const tokens = useGameStore((s) => s.tokens);

  if (!modal) return null;

  const { floorId } = modal;
  const stars = floorStars?.[String(floorId)] ?? 0;
  const isMax = stars >= 5;

  const floorConfig = gameConfig.floors.find((f) => f.id === floorId);
  const floorType = (floorConfig?.floorType ?? '') as keyof typeof tokens;
  const floorName = floorConfig ? `Floor ${floorId}` : `Floor ${floorId}`;

  const cost = isMax ? null : FLOOR_UPGRADE_COSTS[stars];
  const canAfford = cost
    ? gems >= cost.gems && (tokens[floorType] ?? 0) >= cost.tokens
    : false;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={[styles.card, isDark && styles.cardDark]}>
          <Text style={[styles.title, isDark && styles.textDark]}>
            {t('floorUpgrade.title')} — {floorName}
          </Text>

          {/* Stars row */}
          <View style={styles.starsRow}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Text key={i} style={[styles.star, { color: i < stars ? '#FFD23E' : 'rgba(0,0,0,0.18)' }]}>
                {'★'}
              </Text>
            ))}
          </View>

          {isMax ? (
            <Text style={[styles.maxText, isDark && styles.textDark]}>
              {t('floorUpgrade.maxLevel')}
            </Text>
          ) : (
            <>
              <View style={styles.costRow}>
                <GemIcon size={16} />
                <Text style={[styles.costText, isDark && styles.textDark]}>
                  {cost!.gems} {t('floorUpgrade.gems')}
                </Text>
                <Text style={[styles.costText, isDark && styles.textDark]}>
                  {'  '}
                  {TOKEN_LABEL[floorType] ?? ''} {cost!.tokens} {t('floorUpgrade.tokens')}
                </Text>
              </View>
              <Text style={[styles.balanceHint, isDark && styles.textMuted]}>
                {gems} / {tokens[floorType] ?? 0}
              </Text>
              <TouchableOpacity
                style={[styles.upgradeBtn, !canAfford && styles.upgradeBtnDisabled]}
                disabled={!canAfford}
                onPress={() => { upgradeFloor(floorId); close(); }}
              >
                <Text style={styles.upgradeBtnText}>{t('floorUpgrade.upgradeBtn')}</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={close}>
            <Text style={[styles.closeBtnText, isDark && styles.textMuted]}>
              {t('floorUpgrade.close')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: 300,
    alignItems: 'center',
    gap: 12,
  },
  cardDark: {
    backgroundColor: '#1e1e1e',
  },
  title: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 18,
    color: '#222',
    textAlign: 'center',
  },
  textDark: {
    color: '#f0f0f0',
  },
  textMuted: {
    color: '#888',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  star: {
    fontSize: 28,
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  costText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    color: '#333',
  },
  balanceHint: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 12,
    color: '#888',
  },
  maxText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
    color: '#FFD23E',
  },
  upgradeBtn: {
    backgroundColor: '#5E8F42',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 10,
    marginTop: 4,
  },
  upgradeBtnDisabled: {
    backgroundColor: '#bbb',
  },
  upgradeBtnText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
    color: '#fff',
  },
  closeBtn: {
    marginTop: 4,
    padding: 6,
  },
  closeBtnText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#888',
  },
});
```

- [ ] **Step 4: Register in `GlobalOverlay.tsx`**

Add import:

```ts
import FloorUpgradeModal from './FloorUpgradeModal';
```

Add inside the returned `<View>`:

```tsx
<FloorUpgradeModal />
```

- [ ] **Step 5: Run i18n key test**

```bash
npx jest src/i18n/__tests__/keysExist.test.ts --no-coverage
```

Expected: PASS.

- [ ] **Step 6: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/FloorUpgradeModal.tsx src/components/GlobalOverlay.tsx src/i18n/locales/en/hotel.json
git commit -m "feat(floor-upgrade): add FloorUpgradeModal, register in GlobalOverlay, add i18n strings"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Config table ✓ | GameState.floorStars ✓ | UpgradeFloorCommand ✓ | handleUpgradeFloor (gems+tokens validation) ✓ | handleBuy multiplier ✓ | handleCollect multiplier+time ✓ | getProductionStatus override ✓ | store action + modal state ✓ | FloorCard tap ✓ | ProductionCard UI ✓ | FloorUpgradeModal ✓ | GlobalOverlay ✓ | i18n ✓
- [x] **No placeholders:** All code blocks are complete.
- [x] **Type consistency:** `FLOOR_STAR_MULTIPLIERS`, `FLOOR_UPGRADE_COSTS` named identically across Tasks 1–8. `floorUpgradeModal` named consistently across UIState, store actions, and modal component. `getFloorStarMultiplier` is a private helper (Tasks 2–3 only). `sellDurationOverride` named identically in productionStatus signature and ProductionCard callsite.
