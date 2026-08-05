# Speed Up Production Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let players spend gems to instantly complete a production delivery (1 gem per remaining hour, min 1), via a ⚡ pill in the sub-text area of the ProductionCard while DELIVERING.

**Architecture:** New `speed_up_delivery` command handled by `handleSpeedUpDelivery` in the engine (mirrors `handleSpeedUpConstruction`). `FloorCard` passes `gems` down to `ProductionCard`, which renders a tappable ⚡ pill in the sub-text area replacing the "delivering" status text. Single tap executes immediately — no confirmation.

**Tech Stack:** TypeScript, React Native, Zod, Jest

## Global Constraints

- Cost formula: `Math.max(1, Math.ceil(timeLeft / MS_PER_HOUR))` — identical to construction speed-up
- `MS_PER_HOUR = 3_600_000` — already defined in `shared/engine/processCommand.ts`, reuse it
- Engine sets `stageStartedAt = now - typeConfig.deliveryDuration` (timer → 0, `getProductionStatus` returns `READY_TO_LIST`)
- Error strings (exact): `'Not delivering'`, `'Delivery already complete'`, `'Insufficient gems'`
- No confirmation step — single tap dispatches immediately
- No new dependencies

## Files Changed

| File | Change |
|------|--------|
| `shared/schemas/command.ts` | Add `SpeedUpDeliveryCommandSchema`, add to union |
| `shared/types/index.ts` | Export `SpeedUpDeliveryCommand` type |
| `shared/engine/processCommand.ts` | Add `handleSpeedUpDelivery`, register in switch |
| `shared/engine/__tests__/processCommand.test.ts` | Add `describe('speed_up_delivery command')` |
| `src/stores/gameStore.ts` | Add `speedUpDelivery` to interface + implementation |
| `src/components/FloorCard.tsx` | Subscribe to `gems`, pass to `ProductionCard` |
| `src/components/ProductionCard.tsx` | Add `gems` prop, `handleSpeedUp`, ⚡ pill in sub-text |

---

### Task 1: Engine — `speed_up_delivery` command + tests

**Files:**
- Modify: `shared/schemas/command.ts`
- Modify: `shared/types/index.ts`
- Modify: `shared/engine/processCommand.ts`
- Test: `shared/engine/__tests__/processCommand.test.ts`

**Interfaces:**
- Produces: `handleSpeedUpDelivery` registered as `case 'speed_up_delivery'` in `processCommand`; on success sets `stageStartedAt = now - typeConfig.deliveryDuration` and deducts gems

- [ ] **Step 1: Write failing tests**

Add a `speedUpDeliveryCmd` helper and a new `describe` block in `shared/engine/__tests__/processCommand.test.ts` after the existing `describe` blocks:

```typescript
function speedUpDeliveryCmd(
  overrides?: Partial<Extract<Command, { type: 'speed_up_delivery' }>>,
): Command {
  return {
    id: 'cmd-sud',
    type: 'speed_up_delivery',
    floorId: 1,
    slotIdx: 0,
    timestamp: 3000,
    ...overrides,
  } as Command;
}

// Local config with a 2-hour delivery duration for cost formula tests
const longDeliveryConfig: GameConfig = {
  ...testConfig,
  productionTypes: {
    ...testConfig.productionTypes,
    coffee_shop: { ...testConfig.productionTypes.coffee_shop, deliveryDuration: 7_200_000 },
  },
};

describe('speed_up_delivery command', () => {
  it('succeeds, deducts gems, and sets stageStartedAt to now - deliveryDuration', () => {
    const state = { ...stateWithWorker(), gems: 5 };
    state.floors[0].productions[0] = {
      typeId: 'coffee_shop',
      stage: 'DELIVERING',
      stageStartedAt: 1000,
    };
    // coffee_shop deliveryDuration=5000, now=3000, timeLeft=5000-(3000-1000)=3000ms (<1h) → cost=1
    const result = processCommand(state, speedUpDeliveryCmd(), testConfig, 3000);
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(4);
    expect(result.state.floors[0].productions[0].stageStartedAt).toBe(3000 - 5000); // -2000
  });

  it('fails when slot is not DELIVERING', () => {
    const state = { ...stateWithWorker(), gems: 5 };
    // slot is IDLE by default from createInitialState
    const result = processCommand(state, speedUpDeliveryCmd(), testConfig, 3000);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not delivering');
  });

  it('fails when delivery timer has already expired', () => {
    const state = { ...stateWithWorker(), gems: 5 };
    state.floors[0].productions[0] = {
      typeId: 'coffee_shop',
      stage: 'DELIVERING',
      stageStartedAt: 1000,
    };
    // coffee_shop deliveryDuration=5000, now=7000, timeLeft=5000-(7000-1000)=-1000 ≤ 0
    const result = processCommand(
      state,
      speedUpDeliveryCmd({ timestamp: 7000 }),
      testConfig,
      7000,
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('Delivery already complete');
  });

  it('fails with insufficient gems', () => {
    const state = { ...stateWithWorker(), gems: 0 };
    state.floors[0].productions[0] = {
      typeId: 'coffee_shop',
      stage: 'DELIVERING',
      stageStartedAt: 1000,
    };
    const result = processCommand(state, speedUpDeliveryCmd(), testConfig, 3000);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient gems');
  });

  it('costs 1 gem when less than 1 hour remains (30 min)', () => {
    const state = { ...stateWithWorker(), gems: 5 };
    const now = 10_000_000;
    // deliveryDuration=7_200_000, elapsed=5_400_000, timeLeft=1_800_000 (30min) → ceil(0.5)=1
    state.floors[0].productions[0] = {
      typeId: 'coffee_shop',
      stage: 'DELIVERING',
      stageStartedAt: now - 5_400_000,
    };
    const result = processCommand(
      state,
      speedUpDeliveryCmd({ timestamp: now }),
      longDeliveryConfig,
      now,
    );
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(4); // 5 - 1
  });

  it('costs 2 gems when just over 1 hour remains (61 min)', () => {
    const state = { ...stateWithWorker(), gems: 5 };
    const now = 10_000_000;
    // deliveryDuration=7_200_000, elapsed=3_540_000, timeLeft=3_660_000 (61min) → ceil(1.0167)=2
    state.floors[0].productions[0] = {
      typeId: 'coffee_shop',
      stage: 'DELIVERING',
      stageStartedAt: now - 3_540_000,
    };
    const result = processCommand(
      state,
      speedUpDeliveryCmd({ timestamp: now }),
      longDeliveryConfig,
      now,
    );
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(3); // 5 - 2
  });

  it('costs 1 gem when exactly 1 hour remains', () => {
    const state = { ...stateWithWorker(), gems: 5 };
    const now = 10_000_000;
    // deliveryDuration=7_200_000, elapsed=3_600_000, timeLeft=3_600_000 (60min exactly) → ceil(1.0)=1
    state.floors[0].productions[0] = {
      typeId: 'coffee_shop',
      stage: 'DELIVERING',
      stageStartedAt: now - 3_600_000,
    };
    const result = processCommand(
      state,
      speedUpDeliveryCmd({ timestamp: now }),
      longDeliveryConfig,
      now,
    );
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(4); // 5 - 1
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest shared/engine/__tests__/processCommand.test.ts --testNamePattern="speed_up_delivery"
```

Expected: 7 failures — `'speed_up_delivery'` is not in the command union yet.

- [ ] **Step 3: Add `SpeedUpDeliveryCommandSchema` to `shared/schemas/command.ts`**

After `SpeedUpConstructionCommandSchema` (line ~134), add:

```typescript
export const SpeedUpDeliveryCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('speed_up_delivery'),
  floorId: z.number().int(),
  slotIdx: z.number().int().nonnegative(),
});
```

Then add it to the `CommandSchema` discriminated union (after `SpeedUpConstructionCommandSchema`):

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
  FillLobbyCommandSchema,
  BuyFloorCommandSchema,
  OpenFloorCommandSchema,
  ExchangeGemsCommandSchema,
  SpeedUpConstructionCommandSchema,
  SpeedUpDeliveryCommandSchema,   // NEW
]);
```

- [ ] **Step 4: Export `SpeedUpDeliveryCommand` type from `shared/types/index.ts`**

Add to the import line at the top:

```typescript
import { CommandSchema, BuyCommandSchema, ListCommandSchema, CollectCommandSchema,
  AssignWorkerCommandSchema, FireWorkerCommandSchema, EvictWorkerCommandSchema,
  SpawnVisitorCommandSchema, LiftVisitorCommandSchema, CollectTipCommandSchema,
  DeliverAllCommandSchema, UpgradeElevatorCommandSchema, UpgradeLobbyCommandSchema,
  ClaimDailyRewardCommandSchema, ExpandHotelCommandSchema, BuyFloorCommandSchema,
  OpenFloorCommandSchema, SpeedUpDeliveryCommandSchema               // ← add this
} from '../schemas/command';
```

Add the type export (after `BuyFloorCommand`):

```typescript
export type SpeedUpDeliveryCommand = z.infer<typeof SpeedUpDeliveryCommandSchema>;
```

- [ ] **Step 5: Add `handleSpeedUpDelivery` to `shared/engine/processCommand.ts`**

In the main switch (after `case 'speed_up_construction':`):

```typescript
case 'speed_up_delivery':
  return handleSpeedUpDelivery(state, command, config, now);
```

Add the handler function after `handleSpeedUpConstruction` (~line 93):

```typescript
function handleSpeedUpDelivery(
  state: GameState,
  command: Extract<Command, { type: 'speed_up_delivery' }>,
  config: GameConfig,
  now: number,
): ProcessResult {
  const floorIdx = state.floors.findIndex((f) => f.id === command.floorId);
  if (floorIdx === -1) return { success: false, state, error: 'Floor not found' };

  const production = state.floors[floorIdx].productions[command.slotIdx];
  if (!production) return { success: false, state, error: 'Slot not found' };
  if (production.stage !== 'DELIVERING') return { success: false, state, error: 'Not delivering' };
  if (!production.typeId) return { success: false, state, error: 'No type assigned' };

  const typeConfig = config.productionTypes[production.typeId];
  if (!typeConfig) return { success: false, state, error: 'Unknown production type' };

  const timeLeft = typeConfig.deliveryDuration - (now - production.stageStartedAt);
  if (timeLeft <= 0) return { success: false, state, error: 'Delivery already complete' };

  const cost = Math.max(1, Math.ceil(timeLeft / MS_PER_HOUR));
  if (state.gems < cost) return { success: false, state, error: 'Insufficient gems' };

  return {
    success: true,
    state: {
      ...state,
      gems: state.gems - cost,
      floors: updateProduction(state.floors, floorIdx, command.slotIdx, {
        ...production,
        stageStartedAt: now - typeConfig.deliveryDuration,
      }),
    },
  };
}
```

- [ ] **Step 6: Run tests to confirm all pass**

```bash
npx jest shared/engine/__tests__/processCommand.test.ts
```

Expected: all tests pass (including the 7 new `speed_up_delivery` tests).

- [ ] **Step 7: Commit**

```bash
git add shared/schemas/command.ts shared/types/index.ts shared/engine/processCommand.ts shared/engine/__tests__/processCommand.test.ts
git commit -m "feat(engine): add speed_up_delivery command"
```

---

### Task 2: Store + UI — ⚡ pill in ProductionCard sub-text

**Files:**
- Modify: `src/stores/gameStore.ts`
- Modify: `src/components/FloorCard.tsx`
- Modify: `src/components/ProductionCard.tsx`

**Interfaces:**
- Consumes from Task 1: `type: 'speed_up_delivery'`, `{ floorId: number, slotIdx: number, timestamp: number }` command shape
- Produces: `store.speedUpDelivery(floorId, slotIdx)` dispatches the command; ProductionCard shows `⚡ N 💎` pill when `effectiveStage === 'DELIVERING'` and `!isDeliveryLocked`

- [ ] **Step 1: Add `speedUpDelivery` to `GameActions` interface in `src/stores/gameStore.ts`**

After `speedUpConstruction: (floorId: number) => void;` (line ~77):

```typescript
speedUpDelivery: (floorId: number, slotIdx: number) => void;
```

- [ ] **Step 2: Add `speedUpDelivery` implementation in `src/stores/gameStore.ts`**

After the `speedUpConstruction` implementation (~line 178):

```typescript
speedUpDelivery: (floorId, slotIdx) => {
  executeCommand(get, set, {
    id: uuid(),
    type: 'speed_up_delivery',
    floorId,
    slotIdx,
    timestamp: clock.now(),
  });
},
```

- [ ] **Step 3: Pass `gems` from store through `FloorCard` to `ProductionCard`**

In `src/components/FloorCard.tsx`, inside `FloorCardInner`, add a gems selector after the existing selectors:

```typescript
const gems = useGameStore((s) => s.gems);
```

Then add `gems={gems}` to each `ProductionCard` in the `.map()`:

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
  gems={gems}
/>
```

- [ ] **Step 4: Add `gems` prop and speed-up logic to `ProductionCard`**

In `src/components/ProductionCard.tsx`:

**4a.** Add `GemIcon` to the import from `CurrencyIcons`:

```typescript
import { CoinIcon, GemIcon } from './CurrencyIcons';
```

**4b.** Add `gems` to `ProductionCardProps` interface (after `deliveryLockMs?`):

```typescript
gems: number;
```

**4c.** Add the `MS_PER_HOUR` constant and `speedUpCost` after `const isDeliveryLocked = ...`:

```typescript
const MS_PER_HOUR = 3_600_000;
const speedUpCost = effectiveStage === 'DELIVERING'
  ? Math.max(1, Math.ceil(timeRemaining / MS_PER_HOUR))
  : 0;
```

**4d.** Add `handleSpeedUp` callback after `handleAction`:

```typescript
const handleSpeedUp = useCallback(() => {
  const store = useGameStore.getState();
  if (gems < speedUpCost) {
    store.showInsufficientResources({ currency: 'gems', need: speedUpCost, have: gems });
    return;
  }
  store.speedUpDelivery(floorId, slotIdx);
}, [gems, speedUpCost, floorId, slotIdx]);
```

- [ ] **Step 5: Update the sub-text section in `ProductionCard`**

Replace the existing `<View style={styles.subContainer}>` block with this version (adds the `effectiveStage === 'DELIVERING'` branch between `isDeliveryLocked` and `effectiveStage === 'READY_TO_LIST'`):

```tsx
<View style={styles.subContainer}>
  {isDeliveryLocked ? (
    <View style={styles.statusPill}>
      <Text style={styles.statusText}>{formatTime(deliveryLockMs ?? 0)}</Text>
    </View>
  ) : effectiveStage === 'DELIVERING' ? (
    <Pressable
      onPress={handleSpeedUp}
      style={({ pressed }) => [styles.speedUpPill, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.speedUpPillText}>⚡ {speedUpCost}</Text>
      <GemIcon size={12} />
    </Pressable>
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

- [ ] **Step 6: Add `speedUpPill` and `speedUpPillText` styles**

Add at the end of the `StyleSheet.create({...})` block in `ProductionCard`:

```typescript
speedUpPill: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 3,
  paddingVertical: 2,
  paddingHorizontal: 8,
  borderRadius: 10,
  backgroundColor: 'rgba(103, 78, 167, 0.13)',
  borderWidth: 1,
  borderColor: 'rgba(103, 78, 167, 0.25)',
},
speedUpPillText: {
  fontFamily: 'Fredoka_600SemiBold',
  fontSize: 10.5,
  color: '#6B4EA7',
},
```

- [ ] **Step 7: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero type errors (only pre-existing `baseUrl` deprecation warning is acceptable).

- [ ] **Step 8: Commit**

```bash
git add src/stores/gameStore.ts src/components/FloorCard.tsx src/components/ProductionCard.tsx
git commit -m "feat(ui): add speed up delivery pill to production card"
```
