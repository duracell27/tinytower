# Speed Up Construction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a speed-up button to the construction timer banner that lets players pay 1 gem/hour to instantly complete a floor build, with inline confirmation before deducting gems.

**Architecture:** New `speed_up_construction` command in the shared engine sets `startedAt = timestamp - durationMs`, making the construction appear complete. The store action does a client-side gem check first and shows `InsufficientResourcesModal` if needed. The banner UI adds a local `confirming` state that replaces the timer row with a confirm/cancel row.

**Tech Stack:** TypeScript, Zod, React Native, Zustand. Tests with Jest (`npm test`).

## Global Constraints

- Cost formula: `Math.max(1, Math.ceil(timeLeftMs / 3_600_000))` — minimum 1 gem
- `speed_up_construction` yields 0 XP (same exclusion pattern as `buy_floor` and `exchange_gems`)
- Banner confirm state is local `useState<boolean>` — resets when `floorId` prop changes
- Insufficient gems → `showInsufficientResources({ currency: 'gems', need: cost, have: state.gems })`
- All files are TypeScript; no `any` in new code

---

### Task 1: Command Schema

**Files:**
- Modify: `shared/schemas/command.ts`

**Interfaces:**
- Produces: `SpeedUpConstructionCommandSchema` — `{ type: 'speed_up_construction', id: string, timestamp: number, floorId: number }`; added to `CommandSchema` discriminated union so `Command` type includes it

- [ ] **Step 1: Add schema and register it**

In `shared/schemas/command.ts`, after `ExchangeGemsCommandSchema` (line ~129) and before the `CommandSchema` union, add:

```ts
export const SpeedUpConstructionCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('speed_up_construction'),
  floorId: z.number().int(),
});
```

Then add `SpeedUpConstructionCommandSchema` to the `CommandSchema` discriminated union array (after `ExchangeGemsCommandSchema`):

```ts
export const CommandSchema = z.discriminatedUnion('type', [
  // ...existing entries...
  ExchangeGemsCommandSchema,
  SpeedUpConstructionCommandSchema,   // ← add this
]);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower
npx tsc --noEmit -p shared/tsconfig.json 2>&1 | head -20
```

Expected: no errors (or same errors as before — don't introduce new ones).

- [ ] **Step 3: Commit**

```bash
git add shared/schemas/command.ts
git commit -m "feat(construction): add speed_up_construction command schema"
```

---

### Task 2: Command Handler + XP Exclusion

**Files:**
- Modify: `shared/engine/processCommand.ts`
- Modify: `shared/engine/xp.ts`
- Modify: `shared/engine/__tests__/processCommand.test.ts`
- Modify: `shared/engine/__tests__/xp.test.ts`

**Interfaces:**
- Consumes: `SpeedUpConstructionCommandSchema` from Task 1 — `{ type: 'speed_up_construction', id, timestamp, floorId }`
- Produces: `handleSpeedUpConstruction` routed via the `switch` in `processCommand`; on success returns state with `gems` decremented and the matching `underConstruction` entry's `startedAt` set to `timestamp - durationMs`

- [ ] **Step 1: Write failing tests**

In `shared/engine/__tests__/processCommand.test.ts`, append after the `exchange gems` describe block (line 643):

```ts
describe('speed_up_construction', () => {
  const ucEntry = {
    floorId: 5,
    startedAt: 0,
    durationMs: 3_600_000,        // 1 hour
    requiredTools: [{ tool: 'briks', count: 1 }],
    selectedFloorType: null,
  };

  function speedUpCmd(overrides?: Partial<Extract<Command, { type: 'speed_up_construction' }>>): Command {
    return { id: 'su-1', type: 'speed_up_construction', timestamp: 1_800_000, floorId: 5, ...overrides } as Command;
  }

  it('deducts 1 gem per hour remaining and marks construction complete', () => {
    // 1 hour total, 30 min elapsed → 30 min left → ceil(0.5h) = 1 gem
    const state = makeState({ gems: 5, underConstruction: [ucEntry] });
    const result = processCommand(state, speedUpCmd({ timestamp: 1_800_000 }), testConfig, 1_800_000);
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(4);
    // construction entry startedAt set so timestamp - startedAt >= durationMs
    const uc = result.state.underConstruction.find((u) => u.floorId === 5)!;
    expect(uc.startedAt + uc.durationMs).toBeLessThanOrEqual(1_800_000);
  });

  it('charges 2 gems when more than 1 hour remains', () => {
    // 0 elapsed of 3h → ceil(3) = 3; or 0 elapsed of 2h → 2 gems
    const twoHourUc = { ...ucEntry, durationMs: 2 * 3_600_000 };
    const state = makeState({ gems: 10, underConstruction: [twoHourUc] });
    const result = processCommand(state, speedUpCmd({ timestamp: 0 }), testConfig, 0);
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(8);
  });

  it('charges minimum 1 gem when less than 1 minute remains', () => {
    const almostDoneUc = { ...ucEntry, startedAt: 0, durationMs: 30_000 }; // 30 seconds
    const state = makeState({ gems: 3, underConstruction: [almostDoneUc] });
    const result = processCommand(state, speedUpCmd({ timestamp: 0 }), testConfig, 0);
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(2);
  });

  it('fails when floor is not under construction', () => {
    const state = makeState({ gems: 5, underConstruction: [] });
    const result = processCommand(state, speedUpCmd(), testConfig, 1_800_000);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Floor not under construction');
  });

  it('fails when construction already complete', () => {
    // timestamp >= startedAt + durationMs → already done
    const state = makeState({ gems: 5, underConstruction: [ucEntry] });
    const result = processCommand(state, speedUpCmd({ timestamp: 4_000_000 }), testConfig, 4_000_000);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Construction already complete');
  });

  it('fails when insufficient gems', () => {
    const state = makeState({ gems: 0, underConstruction: [ucEntry] });
    const result = processCommand(state, speedUpCmd({ timestamp: 1_800_000 }), testConfig, 1_800_000);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient gems');
    expect(result.state.gems).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
cd /Users/Apple/IT/tinytower
npx jest shared/engine/__tests__/processCommand.test.ts --testNamePattern="speed_up_construction" 2>&1 | tail -20
```

Expected: all 6 fail with something like `"speed_up_construction" is not a valid command type` or similar.

- [ ] **Step 3: Add handler to processCommand.ts**

In `shared/engine/processCommand.ts`:

**a)** Add `'speed_up_construction'` case to the switch in `processCommand`:

```ts
case 'speed_up_construction':
  return handleSpeedUpConstruction(state, command);
```

Place it after `case 'exchange_gems': return handleExchangeGems(state, command);`

**b)** Add the handler function after `handleExchangeGems`:

```ts
const MS_PER_HOUR = 3_600_000;

function handleSpeedUpConstruction(
  state: GameState,
  command: Extract<Command, { type: 'speed_up_construction' }>,
): ProcessResult {
  const uc = state.underConstruction.find((u) => u.floorId === command.floorId);
  if (!uc) return { success: false, state, error: 'Floor not under construction' };

  const timeLeft = uc.startedAt + uc.durationMs - command.timestamp;
  if (timeLeft <= 0) return { success: false, state, error: 'Construction already complete' };

  const cost = Math.max(1, Math.ceil(timeLeft / MS_PER_HOUR));
  if (state.gems < cost) return { success: false, state, error: 'Insufficient gems' };

  const updatedUc = { ...uc, startedAt: command.timestamp - uc.durationMs };
  return {
    success: true,
    state: {
      ...state,
      gems: state.gems - cost,
      underConstruction: state.underConstruction.map((u) =>
        u.floorId === command.floorId ? updatedUc : u,
      ),
    },
  };
}
```

- [ ] **Step 4: Add XP exclusion to xp.ts**

In `shared/engine/xp.ts`, the exclusion line currently reads:

```ts
if (cmdType === 'buy_floor' || cmdType === 'exchange_gems') return 0;
```

Add `speed_up_construction`:

```ts
if (cmdType === 'buy_floor' || cmdType === 'exchange_gems' || cmdType === 'speed_up_construction') return 0;
```

- [ ] **Step 5: Add XP test**

In `shared/engine/__tests__/xp.test.ts`, inside the `xpForCommand` describe block, after the `exchange_gems` test:

```ts
it('speed_up_construction always gives 0 XP', () => {
  expect(xpForCommand('speed_up_construction', 500, 500)).toBe(0);
  expect(xpForCommand('speed_up_construction', 500, 200)).toBe(0);
});
```

- [ ] **Step 6: Run all engine tests and verify they pass**

```bash
cd /Users/Apple/IT/tinytower
npx jest shared/engine/__tests__/ 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add shared/engine/processCommand.ts shared/engine/xp.ts \
        shared/engine/__tests__/processCommand.test.ts \
        shared/engine/__tests__/xp.test.ts
git commit -m "feat(construction): handle speed_up_construction command, 0 XP"
```

---

### Task 3: Store Action

**Files:**
- Modify: `src/stores/gameStore.ts`

**Interfaces:**
- Consumes: `speed_up_construction` command from Task 1; `showInsufficientResources` already on store
- Produces: `speedUpConstruction(floorId: number): void` on `GameActions` — dispatches command or opens insufficient-gems modal

- [ ] **Step 1: Add action signature to GameActions interface**

In `src/stores/gameStore.ts`, in the `GameActions` interface (around line 82), add after `exchangeGemsForCoins`:

```ts
speedUpConstruction: (floorId: number) => void;
```

- [ ] **Step 2: Implement the action**

In the store implementation, after the `exchangeGemsForCoins` action (around line 157), add:

```ts
speedUpConstruction: (floorId) => {
  const state = get();
  const now = clock.now();
  const uc = state.underConstruction.find((u) => u.floorId === floorId);
  if (!uc) return;
  const timeLeft = uc.startedAt + uc.durationMs - now;
  if (timeLeft <= 0) return;
  const cost = Math.max(1, Math.ceil(timeLeft / 3_600_000));
  if (state.gems < cost) {
    state.showInsufficientResources({ currency: 'gems', need: cost, have: state.gems });
    return;
  }
  executeCommand(get, set, {
    id: uuid(),
    type: 'speed_up_construction',
    timestamp: now,
    floorId,
  });
},
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat(construction): add speedUpConstruction store action"
```

---

### Task 4: Banner UI

**Files:**
- Modify: `src/components/UnderConstructionBanner.tsx`

**Interfaces:**
- Consumes: `speedUpConstruction(floorId)` from Task 3 via `useGameStore`
- Consumes: `gems` from `useGameStore` to display cost
- New prop: none — `floorId` already a prop

- [ ] **Step 1: Add imports and hook reads**

At the top of `UnderConstructionBanner.tsx`, the store import already exists:
```ts
import { useGameStore } from '../stores/gameStore';
```

Add `useState` to the React import if not already there:
```ts
import React, { useState, useEffect } from 'react';
```

Inside the component, after the existing `const tools = useGameStore(...)` line, add:
```ts
const gems = useGameStore((s) => s.gems);
const speedUpConstruction = useGameStore((s) => s.speedUpConstruction);
const [confirming, setConfirming] = useState(false);

useEffect(() => { setConfirming(false); }, [floorId]);
```

Also add the cost calculation near the `timeLeft` line:
```ts
const MS_PER_HOUR = 3_600_000;
const speedUpCost = Math.max(1, Math.ceil(timeLeft / MS_PER_HOUR));
```

- [ ] **Step 2: Replace the ribbon's ribbonRight timer section**

The current `ribbonRight` for the building state (inside the final `return`, around line 178) looks like:

```tsx
<View style={styles.ribbonRight}>
  {!isReady ? (
    <View style={styles.timerPill}>
      <Text style={[styles.timerText, { color: BANNER_COLOR }]}>
        {formatCountdown(timeLeft)}
      </Text>
    </View>
  ) : (
    // ...choose business button
  )}
</View>
```

Replace the `!isReady` branch with:

```tsx
<View style={styles.ribbonRight}>
  {!isReady ? (
    confirming ? (
      <View style={styles.confirmRow}>
        <Text style={styles.confirmLabel}>⚡ {speedUpCost}💎?</Text>
        <Pressable
          onPress={() => { speedUpConstruction(floorId); setConfirming(false); }}
          style={styles.confirmBtn}
          hitSlop={8}
        >
          <Text style={styles.confirmBtnText}>✓</Text>
        </Pressable>
        <Pressable onPress={() => setConfirming(false)} style={styles.cancelBtn} hitSlop={8}>
          <Text style={styles.cancelBtnText}>✗</Text>
        </Pressable>
      </View>
    ) : (
      <View style={styles.timerRow}>
        <View style={styles.timerPill}>
          <Text style={[styles.timerText, { color: BANNER_COLOR }]}>
            {formatCountdown(timeLeft)}
          </Text>
        </View>
        <Pressable
          onPress={() => setConfirming(true)}
          style={styles.speedUpBtn}
          hitSlop={6}
        >
          <Text style={styles.speedUpIcon}>⚡</Text>
          <Image
            source={require('../../assets/img/diamond.png')}
            style={{ width: 13, height: 13 }}
            contentFit="contain"
          />
          <Text style={styles.speedUpCost}>{speedUpCost}</Text>
        </Pressable>
      </View>
    )
  ) : (
    <>
      <Pressable
        onPress={onOpenPicker}
        style={({ pressed }) => [styles.openBtn, pressed && { opacity: 0.85 }]}
      >
        <LinearGradient colors={['#E67E22', '#C96A14']} style={styles.openBtnGradient}>
          <Text style={styles.openBtnText}>Choose business</Text>
        </LinearGradient>
        <View style={styles.openBtnShadow} />
      </Pressable>
      <Pressable onPress={toggleCollapse} hitSlop={8}>
        <View style={[styles.chevronCircle, { backgroundColor: BANNER_COLOR }]}>
          <View style={[styles.chevronShape, collapsed ? styles.chevronDown : styles.chevronUp]} />
        </View>
      </Pressable>
    </>
  )}
</View>
```

- [ ] **Step 3: Add new styles**

In the `StyleSheet.create` block, add after `timerText`:

```ts
timerRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
},
speedUpBtn: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 3,
  backgroundColor: 'rgba(37,146,171,0.15)',
  paddingVertical: 4,
  paddingHorizontal: 8,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: 'rgba(37,146,171,0.35)',
},
speedUpIcon: {
  fontSize: 13,
},
speedUpCost: {
  fontFamily: 'Fredoka_700Bold',
  fontSize: 13,
  color: '#2592AB',
},
confirmRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
},
confirmLabel: {
  fontFamily: 'Fredoka_700Bold',
  fontSize: 13,
  color: BANNER_COLOR,
},
confirmBtn: {
  backgroundColor: '#49AA38',
  borderRadius: 8,
  paddingHorizontal: 8,
  paddingVertical: 4,
},
confirmBtnText: {
  fontFamily: 'Fredoka_700Bold',
  fontSize: 13,
  color: '#fff',
},
cancelBtn: {
  backgroundColor: '#D9534F',
  borderRadius: 8,
  paddingHorizontal: 8,
  paddingVertical: 4,
},
cancelBtnText: {
  fontFamily: 'Fredoka_700Bold',
  fontSize: 13,
  color: '#fff',
},
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/UnderConstructionBanner.tsx
git commit -m "feat(construction): add speed-up button with inline confirmation to banner"
```
