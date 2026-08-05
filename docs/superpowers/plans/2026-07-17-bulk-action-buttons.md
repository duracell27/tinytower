# Bulk Action Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a context-sensitive "bulk action" button to QuickActionBar (Collect all / Deliver all / Buy all) that performs an action on all eligible floors for 1 gem.

**Architecture:** Three new command types (`collect_all`, `list_all`, `buy_all`) are added to the shared engine. Each deducts 1 gem atomically and iterates all eligible floor slots using the existing single-slot helpers (`handleCollect`, `handleList`, `handleBuy`). The QuickActionBar gains an `onBulkAll` prop and renders a pill button between the close button and the main action button; the label is derived from the current `mode` prop.

**Tech Stack:** React Native (Expo), Zod (schema validation), Zustand (store), Jest + ts-jest

## Global Constraints

- All command types must be added to `CommandSchema` (zod discriminated union) in `shared/schemas/command.ts` and re-exported as types from `shared/types/index.ts`.
- All state mutations go through `executeCommand` — never direct `set()`.
- Insufficient gems → call `showInsufficientResources({ currency: 'gems', need: 1, have: gems })` before returning; never throw.
- Font family: `Fredoka_600SemiBold` for new text in `QuickActionBar`.
- Test runner: `jest` (`npm test` or `npx jest <path>`).
- No new i18n keys — button labels are hardcoded strings (same as existing labels in QuickActionBar).

---

## File Map

| File | Change |
|------|--------|
| `shared/schemas/command.ts` | Add 3 new schemas + add to `CommandSchema` union |
| `shared/types/index.ts` | Import new schemas + export 3 new types |
| `shared/engine/processCommand.ts` | Add 3 case handlers + 3 bulk handler functions |
| `shared/engine/__tests__/processCommand.test.ts` | Add tests for the 3 new commands |
| `src/stores/gameStore.ts` | Add `collectAll`, `listAll`, `buyAll` to `GameActions` interface + implementations |
| `src/components/QuickActionBar.tsx` | Add `onBulkAll?` prop + bulk button UI + styles |
| `app/(tabs)/game.tsx` | Bind store actions + pass `onBulkAll` to `<QuickActionBar>` |

---

### Task 1: Command schemas and type exports

**Files:**
- Modify: `shared/schemas/command.ts`
- Modify: `shared/types/index.ts`

**Interfaces:**
- Produces: `CollectAllCommandSchema`, `ListAllCommandSchema`, `BuyAllCommandSchema` (Zod schemas); `CollectAllCommand`, `ListAllCommand`, `BuyAllCommand` (TypeScript types); union updated so `Command` includes all three.

- [ ] **Step 1: Add the three schemas to `shared/schemas/command.ts`**

  After the `EvictLowLevelWorkersCommandSchema` block (line ~165), add:

  ```ts
  export const CollectAllCommandSchema = TimestampedBaseSchema.extend({
    type: z.literal('collect_all'),
  });

  export const ListAllCommandSchema = TimestampedBaseSchema.extend({
    type: z.literal('list_all'),
  });

  export const BuyAllCommandSchema = TimestampedBaseSchema.extend({
    type: z.literal('buy_all'),
  });
  ```

- [ ] **Step 2: Add the three schemas to the `CommandSchema` discriminated union**

  In the same file, append to the array in `z.discriminatedUnion('type', [...])`:

  ```ts
  // after EvictLowLevelWorkersCommandSchema,
  CollectAllCommandSchema,
  ListAllCommandSchema,
  BuyAllCommandSchema,
  ```

- [ ] **Step 3: Export types from `shared/types/index.ts`**

  In the import at line 3, add `CollectAllCommandSchema, ListAllCommandSchema, BuyAllCommandSchema` to the destructured import from `'../schemas/command'`.

  After the existing type exports (around line 31), add:

  ```ts
  export type CollectAllCommand = z.infer<typeof CollectAllCommandSchema>;
  export type ListAllCommand = z.infer<typeof ListAllCommandSchema>;
  export type BuyAllCommand = z.infer<typeof BuyAllCommandSchema>;
  ```

- [ ] **Step 4: Verify types compile**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors (or only pre-existing unrelated errors).

- [ ] **Step 5: Run existing schema tests to confirm union still validates**

  ```bash
  npx jest shared/schemas --testPathPattern="schemas"
  ```

  Expected: all pass.

- [ ] **Step 6: Commit**

  ```bash
  git add shared/schemas/command.ts shared/types/index.ts
  git commit -m "feat(commands): add collect_all, list_all, buy_all command schemas"
  ```

---

### Task 2: Engine bulk handlers + tests

**Files:**
- Modify: `shared/engine/processCommand.ts`
- Modify: `shared/engine/__tests__/processCommand.test.ts`

**Interfaces:**
- Consumes: `CollectAllCommand`, `ListAllCommand`, `BuyAllCommand` (from Task 1); existing private helpers `handleCollect`, `handleList`, `handleBuy`, `updateProduction`, `getWorkerForSlot`.
- Produces: cases `'collect_all' | 'list_all' | 'buy_all'` handled in `processCommand` switch.

- [ ] **Step 1: Write failing tests**

  At the bottom of `shared/engine/__tests__/processCommand.test.ts`, add:

  ```ts
  // ── Bulk action helpers ──────────────────────────────────────────────────────

  const twoFloorConfig: GameConfig = {
    ...testConfig,
    floors: [
      { id: 1, slots: 1, floorType: 'green', availableTypes: ['coffee_shop'] },
      { id: 2, slots: 1, floorType: 'green', availableTypes: ['coffee_shop'] },
    ],
  };

  function twoFloorState(overrides?: Partial<GameState>): GameState {
    return {
      ...createInitialState(twoFloorConfig),
      floors: [
        { id: 1, productions: [{ typeId: 'coffee_shop', stage: 'IDLE', stageStartedAt: 0 }] },
        { id: 2, productions: [{ typeId: 'coffee_shop', stage: 'IDLE', stageStartedAt: 0 }] },
      ],
      workers: [
        makeWorker({ id: 'w1', assignedFloorId: 1, assignedSlotIdx: 0 }),
        makeWorker({ id: 'w2', assignedFloorId: 2, assignedSlotIdx: 0 }),
      ],
      gems: 5,
      balance: 500,
      ...overrides,
    };
  }

  describe('collect_all command', () => {
    it('collects from all ready floors and deducts 1 gem', () => {
      const state = twoFloorState({
        floors: [
          { id: 1, productions: [{ typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 0 }] },
          { id: 2, productions: [{ typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 0 }] },
        ],
        gems: 3,
      });
      const now = 20000; // > sellDuration (10000)
      const result = processCommand(
        state,
        { id: 'x', type: 'collect_all', timestamp: now },
        twoFloorConfig,
        now,
      );
      expect(result.success).toBe(true);
      expect(result.state.gems).toBe(2);
      expect(result.state.floors[0].productions[0].stage).toBe('IDLE');
      expect(result.state.floors[1].productions[0].stage).toBe('IDLE');
      expect(result.state.balance).toBeGreaterThan(state.balance);
    });

    it('returns error when gems < 1', () => {
      const state = twoFloorState({ gems: 0 });
      const result = processCommand(
        state,
        { id: 'x', type: 'collect_all', timestamp: 20000 },
        twoFloorConfig,
        20000,
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient gems');
    });

    it('skips slots that are not yet ready to collect', () => {
      const state = twoFloorState({
        floors: [
          { id: 1, productions: [{ typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 0 }] },
          { id: 2, productions: [{ typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 0 }] },
        ],
        gems: 3,
      });
      const now = 20000;
      const result = processCommand(
        state,
        { id: 'x', type: 'collect_all', timestamp: now },
        twoFloorConfig,
        now,
      );
      expect(result.success).toBe(true);
      expect(result.state.gems).toBe(2);
      expect(result.state.floors[0].productions[0].stage).toBe('IDLE');
      expect(result.state.floors[1].productions[0].stage).toBe('DELIVERING');
    });
  });

  describe('list_all command', () => {
    it('lists all ready-to-list floors and deducts 1 gem', () => {
      const state = twoFloorState({
        floors: [
          { id: 1, productions: [{ typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 0 }] },
          { id: 2, productions: [{ typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 0 }] },
        ],
        gems: 3,
      });
      const now = 6000; // > deliveryDuration (5000)
      const result = processCommand(
        state,
        { id: 'x', type: 'list_all', timestamp: now },
        twoFloorConfig,
        now,
      );
      expect(result.success).toBe(true);
      expect(result.state.gems).toBe(2);
      expect(result.state.floors[0].productions[0].stage).toBe('SELLING');
      expect(result.state.floors[1].productions[0].stage).toBe('SELLING');
    });

    it('returns error when gems < 1', () => {
      const state = twoFloorState({ gems: 0 });
      const result = processCommand(
        state,
        { id: 'x', type: 'list_all', timestamp: 6000 },
        twoFloorConfig,
        6000,
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient gems');
    });

    it('skips floors whose delivery is not yet complete', () => {
      const state = twoFloorState({
        floors: [
          { id: 1, productions: [{ typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 0 }] },
          { id: 2, productions: [{ typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 4000 }] },
        ],
        gems: 3,
      });
      const now = 6000; // floor 1: 6000-0=6000 > 5000 ✓; floor 2: 6000-4000=2000 < 5000 ✗
      const result = processCommand(
        state,
        { id: 'x', type: 'list_all', timestamp: now },
        twoFloorConfig,
        now,
      );
      expect(result.success).toBe(true);
      expect(result.state.floors[0].productions[0].stage).toBe('SELLING');
      expect(result.state.floors[1].productions[0].stage).toBe('DELIVERING');
    });
  });

  describe('buy_all command', () => {
    it('buys all eligible idle slots and deducts 1 gem', () => {
      const state = twoFloorState({ balance: 1000, gems: 3 });
      const now = 1000;
      const result = processCommand(
        state,
        { id: 'x', type: 'buy_all', timestamp: now },
        twoFloorConfig,
        now,
      );
      expect(result.success).toBe(true);
      expect(result.state.gems).toBe(2);
      expect(result.state.floors[0].productions[0].stage).toBe('DELIVERING');
      expect(result.state.floors[1].productions[0].stage).toBe('DELIVERING');
      expect(result.state.balance).toBe(1000 - 10 * 2); // 2 × buyCost 10
    });

    it('returns error when gems < 1', () => {
      const state = twoFloorState({ gems: 0, balance: 1000 });
      const result = processCommand(
        state,
        { id: 'x', type: 'buy_all', timestamp: 1000 },
        twoFloorConfig,
        1000,
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient gems');
    });

    it('skips floor that has an active delivery on another slot', () => {
      const state = twoFloorState({
        floors: [
          // floor 1: already delivering (active), so buy is blocked
          { id: 1, productions: [{ typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 0 }] },
          // floor 2: idle, eligible
          { id: 2, productions: [{ typeId: 'coffee_shop', stage: 'IDLE', stageStartedAt: 0 }] },
        ],
        balance: 1000,
        gems: 3,
      });
      const now = 1000; // 1000 - 0 = 1000 < deliveryDuration 5000 → active delivery on floor 1
      const result = processCommand(
        state,
        { id: 'x', type: 'buy_all', timestamp: now },
        twoFloorConfig,
        now,
      );
      expect(result.success).toBe(true);
      expect(result.state.gems).toBe(2);
      expect(result.state.floors[0].productions[0].stage).toBe('DELIVERING'); // unchanged
      expect(result.state.floors[1].productions[0].stage).toBe('DELIVERING'); // bought
    });
  });
  ```

- [ ] **Step 2: Run tests — confirm they fail**

  ```bash
  npx jest shared/engine/__tests__/processCommand.test.ts -t "collect_all|list_all|buy_all"
  ```

  Expected: FAIL — `collect_all` / `list_all` / `buy_all` cases not in switch.

- [ ] **Step 3: Add the three handler functions to `shared/engine/processCommand.ts`**

  After `handleCollect` (around line 503, before `handleUpgradeToSpecialist`), insert:

  ```ts
  function handleCollectAll(
    state: GameState,
    config: GameConfig,
    now: number,
    bonuses: { coinPercent: number; xpPercent: number },
  ): ProcessResult {
    if (state.gems < 1) return { success: false, state, error: 'Insufficient gems' };
    let current: GameState = { ...state, gems: state.gems - 1 };
    let totalXp = 0;
    for (let fi = 0; fi < current.floors.length; fi++) {
      for (let si = 0; si < current.floors[fi].productions.length; si++) {
        const prod = current.floors[fi].productions[si];
        const worker = getWorkerForSlot(current.workers, current.floors[fi].id, si);
        if (!worker) continue;
        const result = handleCollect(current, config, now, fi, si, prod, worker, bonuses);
        if (result.success) {
          totalXp += result.xpGained ?? 0;
          current = result.state;
        }
      }
    }
    return { success: true, state: current, xpGained: totalXp };
  }

  function handleListAll(
    state: GameState,
    config: GameConfig,
    now: number,
  ): ProcessResult {
    if (state.gems < 1) return { success: false, state, error: 'Insufficient gems' };
    let current: GameState = { ...state, gems: state.gems - 1 };
    for (let fi = 0; fi < current.floors.length; fi++) {
      for (let si = 0; si < current.floors[fi].productions.length; si++) {
        const prod = current.floors[fi].productions[si];
        const result = handleList(current, config, now, fi, si, prod);
        if (result.success) {
          current = result.state;
        }
      }
    }
    return { success: true, state: current };
  }

  function handleBuyAll(
    state: GameState,
    config: GameConfig,
    now: number,
  ): ProcessResult {
    if (state.gems < 1) return { success: false, state, error: 'Insufficient gems' };
    let current: GameState = { ...state, gems: state.gems - 1 };
    for (let fi = 0; fi < current.floors.length; fi++) {
      for (let si = 0; si < current.floors[fi].productions.length; si++) {
        const floor = current.floors[fi];
        const prod = floor.productions[si];
        if (prod.stage !== 'IDLE' || !prod.typeId) continue;
        const worker = getWorkerForSlot(current.workers, floor.id, si);
        if (!worker) continue;
        const fakeCmd: Extract<Command, { type: 'buy' }> = {
          id: '', type: 'buy', floorId: floor.id, slotIdx: si, typeId: prod.typeId, timestamp: now,
        };
        const result = handleBuy(current, fakeCmd, config, now, fi, si, prod, worker);
        if (result.success) {
          current = result.state;
        }
      }
    }
    return { success: true, state: current };
  }
  ```

- [ ] **Step 4: Wire up the three cases in the `processCommand` switch**

  In the `switch (command.type)` block (around line 31), add before the closing brace:

  ```ts
  case 'collect_all':
    return handleCollectAll(state, config, now, bonuses);
  case 'list_all':
    return handleListAll(state, config, now);
  case 'buy_all':
    return handleBuyAll(state, config, now);
  ```

- [ ] **Step 5: Run the new tests — confirm they pass**

  ```bash
  npx jest shared/engine/__tests__/processCommand.test.ts -t "collect_all|list_all|buy_all"
  ```

  Expected: 9 tests pass.

- [ ] **Step 6: Run all engine tests to check for regressions**

  ```bash
  npx jest shared/engine/__tests__/processCommand.test.ts
  ```

  Expected: all pass.

- [ ] **Step 7: Commit**

  ```bash
  git add shared/engine/processCommand.ts shared/engine/__tests__/processCommand.test.ts
  git commit -m "feat(engine): add collect_all, list_all, buy_all bulk command handlers"
  ```

---

### Task 3: Store actions

**Files:**
- Modify: `src/stores/gameStore.ts`

**Interfaces:**
- Consumes: `collect_all` / `list_all` / `buy_all` command types (Task 1), `executeCommand`, `uuid`, `clock`, `showInsufficientResources`.
- Produces: `collectAll: () => void`, `listAll: () => void`, `buyAll: () => void` on the store.

- [ ] **Step 1: Add three entries to the `GameActions` interface**

  In `src/stores/gameStore.ts`, find the `interface GameActions` block. After the `deliverAll: () => void;` line (around line 83), add:

  ```ts
  collectAll: () => void;
  listAll: () => void;
  buyAll: () => void;
  ```

- [ ] **Step 2: Implement the three actions in the store object**

  After the `deliverAll` implementation (around line 550), add:

  ```ts
  collectAll: () => {
    const state = get();
    if (state.gems < 1) {
      state.showInsufficientResources({ currency: 'gems', need: 1, have: state.gems });
      return;
    }
    executeCommand(get, set, { id: uuid(), type: 'collect_all', timestamp: clock.now() });
  },

  listAll: () => {
    const state = get();
    if (state.gems < 1) {
      state.showInsufficientResources({ currency: 'gems', need: 1, have: state.gems });
      return;
    }
    executeCommand(get, set, { id: uuid(), type: 'list_all', timestamp: clock.now() });
  },

  buyAll: () => {
    const state = get();
    if (state.gems < 1) {
      state.showInsufficientResources({ currency: 'gems', need: 1, have: state.gems });
      return;
    }
    executeCommand(get, set, { id: uuid(), type: 'buy_all', timestamp: clock.now() });
  },
  ```

- [ ] **Step 3: Type-check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no new errors.

- [ ] **Step 4: Run existing store tests**

  ```bash
  npx jest src/stores/__tests__/gameStore.test.ts
  ```

  Expected: all pass.

- [ ] **Step 5: Commit**

  ```bash
  git add src/stores/gameStore.ts
  git commit -m "feat(store): add collectAll, listAll, buyAll actions"
  ```

---

### Task 4: QuickActionBar bulk button UI

**Files:**
- Modify: `src/components/QuickActionBar.tsx`

**Interfaces:**
- Consumes: `GemIcon` from `'../components/CurrencyIcons'`; existing `QuickActionMode` type; existing `styles` object.
- Produces: `onBulkAll?: () => void` prop; rendered pill button when `mode !== 'hire'` and `onBulkAll` is provided.

- [ ] **Step 1: Add `GemIcon` to the import**

  In `src/components/QuickActionBar.tsx`, update the import at the top to include `CurrencyIcons`:

  ```ts
  import { GemIcon } from './CurrencyIcons';
  ```

- [ ] **Step 2: Add `onBulkAll` to the `Props` interface**

  Change:

  ```ts
  interface Props {
    mode: QuickActionMode;
    info: FloorActionInfo | null;
    visible: boolean;
    onHidden: () => void;
    onPress: () => void;
    onExit: () => void;
  }
  ```

  To:

  ```ts
  interface Props {
    mode: QuickActionMode;
    info: FloorActionInfo | null;
    visible: boolean;
    onHidden: () => void;
    onPress: () => void;
    onExit: () => void;
    onBulkAll?: () => void;
  }
  ```

- [ ] **Step 3: Add the bulk label map and update the component signature**

  Just before the `return (` inside `QuickActionBar`, add:

  ```ts
  const BULK_LABEL: Partial<Record<QuickActionMode, string>> = {
    collect: 'Collect all',
    list: 'Deliver all',
    buy: 'Buy all',
  };
  const bulkLabel = BULK_LABEL[mode];
  ```

  Update the function signature destructuring to include `onBulkAll`:

  ```ts
  export default function QuickActionBar({ mode, info, visible, onHidden, onPress, onExit, onBulkAll }: Props) {
  ```

- [ ] **Step 4: Insert the bulk button between the close button and the action button**

  In the `return (...)`, after the `<Pressable onPress={onExit} ...>` block and before the main `<Pressable onPress={onPress} ...>` block, add:

  ```tsx
  {onBulkAll && bulkLabel && (
    <Pressable
      onPress={onBulkAll}
      style={({ pressed }) => [styles.bulkBtn, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.bulkContent}>
        <GemIcon size={11} />
        <Text style={styles.bulkCostText}>1</Text>
        <Text style={styles.bulkLabelText}>{bulkLabel}</Text>
      </View>
    </Pressable>
  )}
  ```

- [ ] **Step 5: Add styles**

  In the `StyleSheet.create({...})` block, add after `coinCircle`:

  ```ts
  bulkBtn: {
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  bulkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bulkCostText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    color: '#2592AB',
  },
  bulkLabelText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    color: '#4A5568',
  },
  ```

- [ ] **Step 6: Type-check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no new errors.

- [ ] **Step 7: Commit**

  ```bash
  git add src/components/QuickActionBar.tsx
  git commit -m "feat(ui): add bulk action button to QuickActionBar"
  ```

---

### Task 5: Wire up in game.tsx

**Files:**
- Modify: `app/(tabs)/game.tsx`

**Interfaces:**
- Consumes: `collectAll`, `listAll`, `buyAll` from `useGameStore` (Task 3); `onBulkAll` prop on `<QuickActionBar>` (Task 4).
- Produces: `handleBulkAll` callback; `<QuickActionBar onBulkAll={handleBulkAll} />`.

- [ ] **Step 1: Bind the three store actions**

  In `app/(tabs)/game.tsx`, after the existing store bindings around line 69–71:

  ```ts
  const storeCollect = useGameStore((s) => s.collect);
  const storeList = useGameStore((s) => s.list);
  const storeBuy = useGameStore((s) => s.buy);
  ```

  Add:

  ```ts
  const collectAll = useGameStore((s) => s.collectAll);
  const listAll = useGameStore((s) => s.listAll);
  const buyAll = useGameStore((s) => s.buyAll);
  ```

- [ ] **Step 2: Add the `handleBulkAll` callback**

  After `handleQaHidden` (around line 363–365), add:

  ```ts
  const handleBulkAll = useCallback(() => {
    if (!quickActionMode) return;
    switch (quickActionMode) {
      case 'collect': collectAll(); break;
      case 'list':    listAll();    break;
      case 'buy':     buyAll();     break;
    }
  }, [quickActionMode, collectAll, listAll, buyAll]);
  ```

- [ ] **Step 3: Pass `onBulkAll` to `<QuickActionBar>`**

  Find the `<QuickActionBar` JSX (around line 587–594). Add the new prop:

  ```tsx
  <QuickActionBar
    mode={quickActionMode ?? 'collect'}
    info={bottomFloorInfo}
    visible={qaBarVisible}
    onHidden={handleQaHidden}
    onPress={handleQuickAction}
    onExit={handleQaExit}
    onBulkAll={handleBulkAll}
  />
  ```

- [ ] **Step 4: Type-check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no new errors.

- [ ] **Step 5: Run all tests**

  ```bash
  npm test
  ```

  Expected: all pass.

- [ ] **Step 6: Commit**

  ```bash
  git add "app/(tabs)/game.tsx"
  git commit -m "feat: wire bulk action buttons into game screen"
  ```

---

## Self-Review

**Spec coverage:**
- ✅ Button appears next to close button, right of it — Task 4 inserts it between close and main action.
- ✅ Context-sensitive per mode (collect/list/buy only, not hire) — `BULK_LABEL` map omits `hire`.
- ✅ Costs 1 gem — deducted atomically in engine handlers.
- ✅ Insufficient gems → `showInsufficientResources` in store action AND enforced in engine.
- ✅ `collect_all` collects all READY_TO_COLLECT slots across all floors — `handleCollectAll` iterates floors, delegates to `handleCollect` which checks `stage === 'SELLING'` and time elapsed.
- ✅ `list_all` lists all READY_TO_LIST slots — `handleListAll` iterates, delegates to `handleList` which checks `stage === 'DELIVERING'` and time elapsed.
- ✅ `buy_all` buys all IDLE slots with workers, respects active-delivery-per-floor rule — `handleBuyAll` delegates to `handleBuy` which re-applies the delivery check.
- ✅ No confirmation dialog — matches `fillLobby` pattern.
- ✅ No hire bulk action — `BULK_LABEL` omits `hire`, button not rendered.

**Placeholder scan:** None found.

**Type consistency:** `handleBulkAll` in Task 5 matches `collectAll/listAll/buyAll` defined in Task 3. `onBulkAll` prop name consistent between Task 4 (defined) and Task 5 (consumed). `BULK_LABEL` keys are `'collect' | 'list' | 'buy'` which match `QuickActionMode`. `fakeCmd` in `handleBuyAll` uses `Extract<Command, { type: 'buy' }>` — `Command` is already imported in `processCommand.ts`.
