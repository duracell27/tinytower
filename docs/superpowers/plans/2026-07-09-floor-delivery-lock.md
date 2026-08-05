# Floor Delivery Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce that only one production slot per floor can be in the DELIVERING stage at a time, with a matching UI lock (dimmed button + lock icon + countdown timer).

**Architecture:** Engine guard in `handleBuy` is the authoritative enforcement point; `FloorCard` computes `deliveryLockMs` and passes it down to each `ProductionCard`, which renders the locked state visually.

**Tech Stack:** TypeScript, React Native, Zod, Jest

## Global Constraints

- Command-sourcing pattern: all state mutations go through `processCommand` / `executeCommand`. No direct `set()` outside of a command result.
- Test runner: `npm test` (Jest via `ts-jest`). Run individual files with `npx jest path/to/test.ts`.
- No new dependencies.

---

### Task 1: Engine guard — block second buy while delivery active

**Files:**
- Modify: `shared/engine/processCommand.ts` (~line 315, `handleBuy`)
- Modify: `shared/engine/__tests__/processCommand.test.ts` (inside `describe('buy command')`)

**Interfaces:**
- Produces: `handleBuy` returns `{ success: false, error: 'Another delivery in progress on this floor' }` when any other slot on the same floor has `stage === 'DELIVERING'` and `(now - stageStartedAt) < deliveryDuration`.

- [ ] **Step 1: Write failing tests**

Add a helper and three tests inside `describe('buy command')` in `shared/engine/__tests__/processCommand.test.ts`, after the existing tests.

Helper (add after the `buyCmd` function at the top of the file):

```typescript
function stateWithTwoWorkers(): GameState {
  return makeState({
    workers: [
      makeWorker({ id: 'w1', assignedFloorId: 1, assignedSlotIdx: 0 }),
      makeWorker({ id: 'w2', assignedFloorId: 1, assignedSlotIdx: 1 }),
    ],
  });
}
```

Tests:

```typescript
it('fails when another slot on the same floor has an active delivery', () => {
  const state = stateWithTwoWorkers();
  // slot 1: bookstore deliveryDuration=15000, started=1000, now=5000 → remaining=11000
  state.floors[0].productions[1] = { typeId: 'bookstore', stage: 'DELIVERING', stageStartedAt: 1000 };
  const result = processCommand(state, buyCmd({ slotIdx: 0 }), testConfig, 5000);
  expect(result.success).toBe(false);
  expect(result.error).toBe('Another delivery in progress on this floor');
});

it('succeeds when another slot delivery timer has expired', () => {
  const state = stateWithTwoWorkers();
  // slot 1: bookstore deliveryDuration=15000, started=1000, now=20000 → remaining=-4000 (expired)
  state.floors[0].productions[1] = { typeId: 'bookstore', stage: 'DELIVERING', stageStartedAt: 1000 };
  const result = processCommand(state, buyCmd({ slotIdx: 0 }), testConfig, 20000);
  expect(result.success).toBe(true);
  expect(result.state.floors[0].productions[0].stage).toBe('DELIVERING');
});

it('blocks buy on slot 1 when slot 0 is actively delivering', () => {
  const state = stateWithTwoWorkers();
  // slot 0: coffee_shop deliveryDuration=5000, started=1000, now=4000 → remaining=2000
  state.floors[0].productions[0] = { typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 1000 };
  const result = processCommand(
    state,
    buyCmd({ slotIdx: 1, typeId: 'bookstore' }),
    testConfig,
    4000,
  );
  expect(result.success).toBe(false);
  expect(result.error).toBe('Another delivery in progress on this floor');
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest shared/engine/__tests__/processCommand.test.ts --testNamePattern="delivery" -t "delivery"
```

Expected: 3 failures — "Another delivery in progress on this floor" does not exist yet.

- [ ] **Step 3: Add the delivery lock check to `handleBuy`**

In `shared/engine/processCommand.ts`, inside `handleBuy`, add after the `production.stage !== 'IDLE'` check (after line ~317) and before the `typeId` validation:

```typescript
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

  // NEW: block buy if another slot on this floor has an active delivery
  const hasActiveDelivery = state.floors[floorIdx].productions.some((p, i) => {
    if (i === slotIdx) return false;
    if (p.stage !== 'DELIVERING' || !p.typeId) return false;
    const tc = config.productionTypes[p.typeId];
    return tc ? (now - p.stageStartedAt) < tc.deliveryDuration : false;
  });
  if (hasActiveDelivery) {
    return { success: false, state, error: 'Another delivery in progress on this floor' };
  }

  // ... rest of existing handleBuy unchanged ...
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest shared/engine/__tests__/processCommand.test.ts
```

Expected: all tests pass, including the 3 new ones.

- [ ] **Step 5: Commit**

```bash
git add shared/engine/processCommand.ts shared/engine/__tests__/processCommand.test.ts
git commit -m "feat(engine): block second buy while floor delivery is active"
```

---

### Task 2: UI — lock icon + countdown timer on blocked slots

**Files:**
- Modify: `src/components/FloorCard.tsx` (inside `FloorCardInner`, before the productions `.map()`)
- Modify: `src/components/ProductionCard.tsx` (interface, render logic, sub-text)

**Interfaces:**
- Consumes: `deliveryLockMs: number` — milliseconds until the active delivery completes; `0` means no lock.
- Produces: `ProductionCard` renders a lock icon and countdown timer when `deliveryLockMs > 0` and `effectiveStage` is `IDLE` or `EMPTY`.

- [ ] **Step 1: Compute `deliveryLockMs` in FloorCard and pass it to ProductionCard**

In `src/components/FloorCard.tsx`, inside `FloorCardInner` add the computation after `const discount = ...` line:

```typescript
const deliveryLockMs = (() => {
  const dp = floor.productions.find((p) => p.stage === 'DELIVERING' && p.typeId);
  if (!dp) return 0;
  const tc = gameConfig.productionTypes[dp.typeId!];
  if (!tc) return 0;
  return Math.max(0, tc.deliveryDuration - (now - dp.stageStartedAt));
})();
```

Then in the `.map()` call, pass it to each `ProductionCard`:

```tsx
<ProductionCard
  key={idx}
  production={production}
  balance={balance}
  now={now}
  floorId={floorId}
  floorType={floorType}
  slotIdx={idx}
  floorAvailableTypes={availableTypes}
  cardBg={scheme.cardBg}
  nameColor={scheme.nameColor}
  productTitle={tContent(`productionTypes.${availableTypes[idx]}.displayName`, {
    defaultValue: availableTypes[idx] ?? t('floorCard.productFallback', { index: idx + 1 }),
  })}
  productImage={PRODUCT_IMAGES[availableTypes[idx]] ?? PRODUCT_IMAGES[availableTypes[0]]}
  worker={slotWorker}
  floorDiscount={discount}
  accentColor={scheme.color}
  onHire={onHireSlot}
  deliveryLockMs={deliveryLockMs}
/>
```

- [ ] **Step 2: Add `deliveryLockMs` prop and `isDeliveryLocked` to ProductionCard**

In `src/components/ProductionCard.tsx`, extend `ProductionCardProps`:

```typescript
interface ProductionCardProps {
  production: Production;
  balance: number;
  now: number;
  floorId: number;
  floorType: string | null;
  slotIdx: number;
  floorAvailableTypes: string[];
  cardBg: string;
  nameColor: string;
  productTitle: string;
  productImage: ImageSource;
  worker?: Worker;
  floorDiscount?: number;
  accentColor: string;
  onHire?: (floorId: number, slotIdx: number) => void;
  deliveryLockMs?: number;   // NEW
}
```

In the component body, after `const { effectiveStage, timeRemaining, canAct } = status;`, add:

```typescript
const isDeliveryLocked =
  (effectiveStage === 'IDLE' || effectiveStage === 'EMPTY') &&
  (deliveryLockMs ?? 0) > 0;
```

- [ ] **Step 3: Add lock icon SVG**

Add a `LockIcon` component near the top of the file, after `StageIcon`:

```tsx
function LockIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={13} height={13}>
      <Rect x={5} y={11} width={14} height={10} rx={2} fill="#fff" />
      <Path
        d="M8 11V7a4 4 0 0 1 8 0v4"
        stroke="#fff"
        strokeWidth={2.5}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
```

- [ ] **Step 4: Update button rendering to show lock state**

In the main return (the non-isLocked path), find the `<Pressable>` for the action button and update it:

```tsx
<Pressable
  onPress={isDeliveryLocked ? undefined : (canAct ? handleAction : undefined)}
  style={({ pressed }) => [
    styles.actionButton,
    { backgroundColor: resolvedBtnConfig.color, shadowColor: resolvedBtnConfig.shadowColor },
    ((!canAct && !isTimer) || isDeliveryLocked) && styles.actionButtonDisabled,
    pressed && canAct && !isDeliveryLocked && styles.actionButtonPressed,
  ]}
>
  {isDeliveryLocked ? <LockIcon /> : <StageIcon stage={effectiveStage} />}
  <Text style={styles.actionLabel}>{labelText}</Text>
</Pressable>
```

- [ ] **Step 5: Update sub-text area to show countdown when locked**

Find the sub-text section (the `<View style={styles.subContainer}>` block) and prepend the locked case:

```tsx
<View style={styles.subContainer}>
  {isDeliveryLocked ? (
    <View style={styles.statusPill}>
      <Text style={styles.statusText}>{formatTime(deliveryLockMs ?? 0)}</Text>
    </View>
  ) : effectiveStage === 'READY_TO_LIST' && subText ? (
    <View style={styles.statusPill}>
      <Svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="#8A8475" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M3 4h2.2l2.4 10.5h9.1l1.9-7H6.3" />
        <Circle cx={9} cy={19} r={1.2} fill="#8A8475" stroke="none" />
        <Circle cx={17} cy={19} r={1.2} fill="#8A8475" stroke="none" />
      </Svg>
      <Text style={styles.statusText}>{subText}</Text>
    </View>
  ) : isTimer ? (
    <View style={styles.statusPill}>
      <Text style={styles.statusText}>{subText}</Text>
    </View>
  ) : subText ? (
    <View style={styles.pricePill}>
      <CoinIcon size={13} />
      <Text style={styles.priceText}>{subText}</Text>
    </View>
  ) : null}
</View>
```

- [ ] **Step 6: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/FloorCard.tsx src/components/ProductionCard.tsx
git commit -m "feat(ui): show delivery lock on blocked production slots"
```
