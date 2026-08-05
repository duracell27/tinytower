# Two-Stage Daily Tips Reward Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single 10k → 5 gems daily tips reward with a two-stage system (stage 1: `10k × √elevatorLevel` → 2 gems; stage 2: `2 × stage1` → 3 gems) and redesign the progress bar UI with split milestones.

**Architecture:** Schema changes flow down through Zod-inferred types, so updating `gameState.ts` / `gameConfig.ts` / `command.ts` schemas automatically updates all TypeScript types. Engine logic lives in `lobbyUtils.ts` (calculation) and `lobbyCommands.ts` (command handler). The store and UI consume the new fields without knowing the calculation details.

**Tech Stack:** TypeScript, Zod schemas, Jest/ts-jest, React Native + Expo, Zustand (gameStore), LinearGradient, i18n via `t()`

## Global Constraints

- All schema changes must pass `GameStateSchema.parse()` / `GameConfigSchema.parse()` at runtime — Zod schemas are the source of truth for types
- Both test files use a local `testConfig` object — update it in every task that touches config field names
- `dailyTipsRewardClaimed` must not appear anywhere after Task 3 — grep to verify
- `formatShortCoins` replaces `formatCoins` only on milestone labels, not on the current amount display
- i18n: only `en/lobby.json` — no other locale files exist

---

## File Map

| File | Change |
|---|---|
| `shared/schemas/gameConfig.ts` | Rename/add lobbyConfig fields |
| `shared/schemas/gameState.ts` | Replace `dailyTipsRewardClaimed` with two booleans |
| `shared/schemas/command.ts` | Add `stage: 1 \| 2` to `ClaimDailyRewardCommandSchema` |
| `shared/config/gameConfig.ts` | Update `rawConfig` values + `createInitialState` defaults |
| `shared/engine/lobbyUtils.ts` | Add `getDailyTipsTargets()` |
| `shared/engine/lobbyCommands.ts` | Rewrite `handleClaimDailyReward` |
| `src/stores/gameStore.ts` | Replace all `dailyTipsRewardClaimed` references; update `claimDailyReward` action signature |
| `src/components/LobbyPanel.tsx` | Redesign daily tips card UI |
| `src/i18n/locales/en/lobby.json` | Update/add daily tips keys |
| `shared/engine/__tests__/lobbyUtils.test.ts` | Add `getDailyTipsTargets` tests; fix testConfig |
| `shared/engine/__tests__/lobbyCommands.test.ts` | Replace `claim_daily_reward` tests; fix testConfig |

---

## Task 1: Update Schemas and Config

**Files:**
- Modify: `shared/schemas/gameConfig.ts:37-50`
- Modify: `shared/schemas/gameState.ts:52`
- Modify: `shared/schemas/command.ts:111-113`
- Modify: `shared/config/gameConfig.ts:117-130` and `149-170`
- Modify: `shared/engine/__tests__/lobbyUtils.test.ts:28-43`
- Modify: `shared/engine/__tests__/lobbyCommands.test.ts:18-33`

**Interfaces:**
- Produces: `GameConfig.lobbyConfig.dailyTipsBaseTarget`, `.dailyTipsStage1Reward`, `.dailyTipsStage2Reward`
- Produces: `GameState.dailyTipsStage1Claimed`, `.dailyTipsStage2Claimed`
- Produces: `ClaimDailyRewardCommand.stage: 1 | 2`
- Produces: `createInitialState()` returns state with both `dailyTipsStage1Claimed: false` and `dailyTipsStage2Claimed: false`

- [ ] **Step 1: Update `LobbyConfigSchema` in `shared/schemas/gameConfig.ts`**

Replace these two lines (around line 39–40):
```ts
  dailyTipsTarget: z.number().positive(),
  dailyTipsReward: z.number().int().positive(),
```
With:
```ts
  dailyTipsBaseTarget: z.number().positive(),
  dailyTipsStage1Reward: z.number().int().positive(),
  dailyTipsStage2Reward: z.number().int().positive(),
```

- [ ] **Step 2: Update `GameStateSchema` in `shared/schemas/gameState.ts`**

Replace line 52:
```ts
  dailyTipsRewardClaimed: z.boolean(),
```
With:
```ts
  dailyTipsStage1Claimed: z.boolean(),
  dailyTipsStage2Claimed: z.boolean(),
```

- [ ] **Step 3: Update `ClaimDailyRewardCommandSchema` in `shared/schemas/command.ts`**

Replace:
```ts
export const ClaimDailyRewardCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('claim_daily_reward'),
});
```
With:
```ts
export const ClaimDailyRewardCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('claim_daily_reward'),
  stage: z.union([z.literal(1), z.literal(2)]),
});
```

- [ ] **Step 4: Update `rawConfig` in `shared/config/gameConfig.ts`**

In the `lobbyConfig` object (around lines 117–130), replace:
```ts
    dailyTipsTarget: 10_000,
    dailyTipsReward: 5,
```
With:
```ts
    dailyTipsBaseTarget: 10_000,
    dailyTipsStage1Reward: 2,
    dailyTipsStage2Reward: 3,
```

- [ ] **Step 5: Update `createInitialState` in `shared/config/gameConfig.ts`**

In `createInitialState`, find the line with `dailyTipsRewardClaimed: false` and replace it with:
```ts
    dailyTipsStage1Claimed: false,
    dailyTipsStage2Claimed: false,
```

- [ ] **Step 6: Fix `testConfig` in `shared/engine/__tests__/lobbyUtils.test.ts`**

In the `testConfig` object, replace:
```ts
    dailyTipsTarget: 10_000,
    dailyTipsReward: 5,
```
With:
```ts
    dailyTipsBaseTarget: 10_000,
    dailyTipsStage1Reward: 2,
    dailyTipsStage2Reward: 3,
```

- [ ] **Step 7: Fix `testConfig` in `shared/engine/__tests__/lobbyCommands.test.ts`**

Same replacement as Step 6 in the `testConfig` at the top of that file.

- [ ] **Step 8: Run tests to confirm schema changes compile**

```bash
npx jest shared/engine/__tests__/lobbyUtils.test.ts shared/engine/__tests__/lobbyCommands.test.ts --no-coverage 2>&1 | tail -20
```

Expected: tests that previously passed still pass; any test referencing `dailyTipsRewardClaimed` or `dailyTipsTarget`/`dailyTipsReward` in assertions will fail — that is expected and will be fixed in Task 2.

- [ ] **Step 9: Commit**

```bash
git add shared/schemas/gameConfig.ts shared/schemas/gameState.ts shared/schemas/command.ts shared/config/gameConfig.ts shared/engine/__tests__/lobbyUtils.test.ts shared/engine/__tests__/lobbyCommands.test.ts
git commit -m "feat(schema): two-stage daily tips — rename config fields and split claimed boolean"
```

---

## Task 2: Engine — `getDailyTipsTargets` and Updated Command Handler

**Files:**
- Modify: `shared/engine/lobbyUtils.ts` (add function after line 21)
- Modify: `shared/engine/lobbyCommands.ts:343-357` (rewrite `handleClaimDailyReward`)
- Modify: `shared/engine/__tests__/lobbyUtils.test.ts` (add new describe block)
- Modify: `shared/engine/__tests__/lobbyCommands.test.ts:276-294` (replace claim tests)

**Interfaces:**
- Consumes: `GameConfig.lobbyConfig.dailyTipsBaseTarget`, `.dailyTipsStage1Reward`, `.dailyTipsStage2Reward`
- Consumes: `GameState.dailyTipsStage1Claimed`, `.dailyTipsStage2Claimed`, `.elevatorLevel`
- Consumes: `command.stage: 1 | 2`
- Produces: `getDailyTipsTargets(elevatorLevel: number, config: GameConfig): { stage1: number; stage2: number }`

- [ ] **Step 1: Write failing tests for `getDailyTipsTargets` in `lobbyUtils.test.ts`**

Add this describe block after the existing tests:
```ts
describe('getDailyTipsTargets', () => {
  it('returns 10000/20000 at elevator level 1', () => {
    const { stage1, stage2 } = getDailyTipsTargets(1, testConfig);
    expect(stage1).toBe(10_000);
    expect(stage2).toBe(20_000);
  });

  it('scales stage1 by sqrt of elevatorLevel', () => {
    const { stage1 } = getDailyTipsTargets(4, testConfig);
    expect(stage1).toBe(20_000); // round(10000 * sqrt(4)) = round(10000 * 2) = 20000
  });

  it('stage2 is always 2 × stage1', () => {
    const { stage1, stage2 } = getDailyTipsTargets(9, testConfig);
    expect(stage2).toBe(stage1 * 2);
  });
});
```

Also add `getDailyTipsTargets` to the import at line 1:
```ts
import {
  calculateTip,
  calculateElevatorUpgradeCost,
  calculateLobbyUpgradeCost,
  getMaxElevatorLevel,
  getMaxLobbyCapacity,
  checkDailyReset,
  generateRandomVisitor,
  getFillLobbyCost,
  getDailyTipsTargets,
} from '../lobbyUtils';
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest shared/engine/__tests__/lobbyUtils.test.ts --no-coverage 2>&1 | tail -10
```

Expected: FAIL — `getDailyTipsTargets is not a function` (or similar export error).

- [ ] **Step 3: Fix `checkDailyReset` in `shared/engine/lobbyUtils.ts`**

In `checkDailyReset` (around line 52–58), replace:
```ts
      dailyTipsRewardClaimed: false,
```
With:
```ts
      dailyTipsStage1Claimed: false,
      dailyTipsStage2Claimed: false,
```

- [ ] **Step 4: Add `getDailyTipsTargets` to `shared/engine/lobbyUtils.ts`**

Add after the `calculateTip` function (after line 21):
```ts
export function getDailyTipsTargets(
  elevatorLevel: number,
  config: GameConfig,
): { stage1: number; stage2: number } {
  const stage1 = Math.round(config.lobbyConfig.dailyTipsBaseTarget * Math.sqrt(elevatorLevel));
  return { stage1, stage2: stage1 * 2 };
}
```

- [ ] **Step 5: Run lobbyUtils tests to confirm they pass**

```bash
npx jest shared/engine/__tests__/lobbyUtils.test.ts --no-coverage 2>&1 | tail -10
```

Expected: PASS all tests.

- [ ] **Step 6: Write failing tests for the updated `claim_daily_reward` in `lobbyCommands.test.ts`**

Replace the entire `describe('claim_daily_reward', ...)` block with:
```ts
describe('claim_daily_reward', () => {
  it('stage 1: grants stage1Reward when tips >= stage1 target and not yet claimed', () => {
    const state = makeState({ dailyTips: 10_000, dailyTipsStage1Claimed: false, dailyTipsStage2Claimed: false, gems: 20, elevatorLevel: 1 });
    const result = processCommand(state, { id: 'c1', type: 'claim_daily_reward', stage: 1, timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(22); // +2
    expect(result.state.dailyTipsStage1Claimed).toBe(true);
  });

  it('stage 1: fails when already claimed', () => {
    const state = makeState({ dailyTips: 10_000, dailyTipsStage1Claimed: true, gems: 20, elevatorLevel: 1 });
    const result = processCommand(state, { id: 'c1', type: 'claim_daily_reward', stage: 1, timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(false);
  });

  it('stage 1: fails when tips below stage1 target', () => {
    const state = makeState({ dailyTips: 5_000, dailyTipsStage1Claimed: false, gems: 20, elevatorLevel: 1 });
    const result = processCommand(state, { id: 'c1', type: 'claim_daily_reward', stage: 1, timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(false);
  });

  it('stage 2: grants stage2Reward when tips >= stage2 target and not yet claimed', () => {
    const state = makeState({ dailyTips: 20_000, dailyTipsStage1Claimed: false, dailyTipsStage2Claimed: false, gems: 20, elevatorLevel: 1 });
    const result = processCommand(state, { id: 'c1', type: 'claim_daily_reward', stage: 2, timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(23); // +3
    expect(result.state.dailyTipsStage2Claimed).toBe(true);
  });

  it('stage 2: fails when already claimed', () => {
    const state = makeState({ dailyTips: 20_000, dailyTipsStage2Claimed: true, gems: 20, elevatorLevel: 1 });
    const result = processCommand(state, { id: 'c1', type: 'claim_daily_reward', stage: 2, timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(false);
  });

  it('stage 2: fails when tips below stage2 target', () => {
    const state = makeState({ dailyTips: 10_000, dailyTipsStage2Claimed: false, gems: 20, elevatorLevel: 1 });
    const result = processCommand(state, { id: 'c1', type: 'claim_daily_reward', stage: 2, timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(false);
  });

  it('stages are independent: stage 2 can be claimed without stage 1 being claimed', () => {
    const state = makeState({ dailyTips: 20_000, dailyTipsStage1Claimed: false, dailyTipsStage2Claimed: false, gems: 20, elevatorLevel: 1 });
    const result = processCommand(state, { id: 'c1', type: 'claim_daily_reward', stage: 2, timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.dailyTipsStage1Claimed).toBe(false); // unchanged
    expect(result.state.dailyTipsStage2Claimed).toBe(true);
  });

  it('target scales with elevatorLevel', () => {
    // stage1 target at level 4 = round(10000 * sqrt(4)) = 20000
    const state = makeState({ dailyTips: 19_999, dailyTipsStage1Claimed: false, gems: 20, elevatorLevel: 4 });
    const result = processCommand(state, { id: 'c1', type: 'claim_daily_reward', stage: 1, timestamp: 1000 } as Command, testConfig, 1000);
    expect(result.success).toBe(false); // just below stage1 target for level 4
  });
});
```

- [ ] **Step 7: Run tests to confirm they fail**

```bash
npx jest shared/engine/__tests__/lobbyCommands.test.ts --no-coverage -t "claim_daily_reward" 2>&1 | tail -15
```

Expected: FAIL — various assertion errors because the handler still uses the old logic.

- [ ] **Step 8: Update the `handleClaimDailyReward` call in `processLobbyCommand` in `lobbyCommands.ts`**

Change the case handler from:
```ts
    case 'claim_daily_reward':
      return handleClaimDailyReward(state, config);
```
To:
```ts
    case 'claim_daily_reward':
      return handleClaimDailyReward(state, config, command);
```

- [ ] **Step 9: Add import for `getDailyTipsTargets` in `lobbyCommands.ts`**

The import at the top already imports from `./lobbyUtils`. Add `getDailyTipsTargets` to that import:
```ts
import {
  calculateTip,
  calculateElevatorUpgradeCost,
  calculateLobbyUpgradeCost,
  getMaxElevatorLevel,
  getMaxLobbyCapacity,
  checkDailyReset,
  generateRandomVisitorRole,
  getFillLobbyCost,
  getDailyTipsTargets,
} from './lobbyUtils';
```

- [ ] **Step 10: Rewrite `handleClaimDailyReward` in `lobbyCommands.ts`**

Replace the existing function (around lines 343–357):
```ts
function handleClaimDailyReward(
  state: GameState,
  config: GameConfig,
  command: Extract<Command, { type: 'claim_daily_reward' }>,
): ProcessResult {
  const { stage1, stage2 } = getDailyTipsTargets(state.elevatorLevel, config);

  if (command.stage === 1) {
    if (state.dailyTips < stage1) {
      return { success: false, state, error: 'Daily tips stage 1 target not met' };
    }
    if (state.dailyTipsStage1Claimed) {
      return { success: false, state, error: 'Stage 1 reward already claimed' };
    }
    return {
      success: true,
      state: {
        ...state,
        gems: state.gems + config.lobbyConfig.dailyTipsStage1Reward,
        dailyTipsStage1Claimed: true,
      },
    };
  }

  // stage 2
  if (state.dailyTips < stage2) {
    return { success: false, state, error: 'Daily tips stage 2 target not met' };
  }
  if (state.dailyTipsStage2Claimed) {
    return { success: false, state, error: 'Stage 2 reward already claimed' };
  }
  return {
    success: true,
    state: {
      ...state,
      gems: state.gems + config.lobbyConfig.dailyTipsStage2Reward,
      dailyTipsStage2Claimed: true,
    },
  };
}
```

- [ ] **Step 11: Run all engine tests**

```bash
npx jest shared/engine/__tests__/ --no-coverage 2>&1 | tail -20
```

Expected: All PASS.

- [ ] **Step 12: Commit**

```bash
git add shared/engine/lobbyUtils.ts shared/engine/lobbyCommands.ts shared/engine/__tests__/lobbyUtils.test.ts shared/engine/__tests__/lobbyCommands.test.ts
git commit -m "feat(engine): add getDailyTipsTargets, fix daily reset, two-stage claim_daily_reward handler"
```

---

## Task 3: Update gameStore

**Files:**
- Modify: `src/stores/gameStore.ts` (multiple locations — see steps below)

**Interfaces:**
- Consumes: `GameState.dailyTipsStage1Claimed`, `.dailyTipsStage2Claimed`
- Produces: `claimDailyReward(stage: 1 | 2): void` (replaces `claimDailyReward(): void`)
- Produces: `useLobbyState()` returns `dailyTipsStage1Claimed` and `dailyTipsStage2Claimed` instead of `dailyTipsRewardClaimed`

- [ ] **Step 1: Update the store interface type for `claimDailyReward`**

Find line ~76:
```ts
  claimDailyReward: () => void;
```
Replace with:
```ts
  claimDailyReward: (stage: 1 | 2) => void;
```

- [ ] **Step 2: Update `executeCommand` snapshot (lines ~108–118)**

Replace:
```ts
    dailyTips, dailyGemsCollected, dailyTipsRewardClaimed, lastDailyReset, nextVisitorAt,
```
With:
```ts
    dailyTips, dailyGemsCollected, dailyTipsStage1Claimed, dailyTipsStage2Claimed, lastDailyReset, nextVisitorAt,
```

And in the `gameState` object construction a few lines below (the second occurrence ~line 115):
```ts
    dailyTips, dailyGemsCollected, dailyTipsStage1Claimed, dailyTipsStage2Claimed, lastDailyReset, nextVisitorAt,
```

- [ ] **Step 3: Update the `set()` call after `processCommand` (~line 188)**

Replace:
```ts
    dailyTipsRewardClaimed: result.state.dailyTipsRewardClaimed,
```
With:
```ts
    dailyTipsStage1Claimed: result.state.dailyTipsStage1Claimed,
    dailyTipsStage2Claimed: result.state.dailyTipsStage2Claimed,
```

- [ ] **Step 4: Update the `claimDailyReward` action (~line 539)**

Replace:
```ts
  claimDailyReward: () => {
    executeCommand(get, set, {
      id: uuid(),
      type: 'claim_daily_reward',
      timestamp: clock.now(),
    });
  },
```
With:
```ts
  claimDailyReward: (stage: 1 | 2) => {
    executeCommand(get, set, {
      id: uuid(),
      type: 'claim_daily_reward',
      stage,
      timestamp: clock.now(),
    });
  },
```

- [ ] **Step 5: Update `hydrate` (~line 568)**

Replace:
```ts
    dailyTipsRewardClaimed: state.dailyTipsRewardClaimed ?? false,
```
With (migration: old persisted state may have `dailyTipsRewardClaimed`):
```ts
    dailyTipsStage1Claimed: (state as any).dailyTipsStage1Claimed ?? (state as any).dailyTipsRewardClaimed ?? false,
    dailyTipsStage2Claimed: (state as any).dailyTipsStage2Claimed ?? false,
```

- [ ] **Step 6: Update `reconcile` (~line 597)**

Replace:
```ts
    dailyTipsRewardClaimed: serverState.dailyTipsRewardClaimed,
```
With:
```ts
    dailyTipsStage1Claimed: serverState.dailyTipsStage1Claimed,
    dailyTipsStage2Claimed: serverState.dailyTipsStage2Claimed,
```

- [ ] **Step 7: Update `useLobbyState` (~line 694)**

Replace:
```ts
    dailyTipsRewardClaimed: state.dailyTipsRewardClaimed,
```
With:
```ts
    dailyTipsStage1Claimed: state.dailyTipsStage1Claimed,
    dailyTipsStage2Claimed: state.dailyTipsStage2Claimed,
```

- [ ] **Step 8: Verify no remaining references to `dailyTipsRewardClaimed`**

```bash
grep -rn "dailyTipsRewardClaimed" /Users/Apple/IT/tinytower/src /Users/Apple/IT/tinytower/shared
```

Expected: no output. If any remain, fix them before continuing.

- [ ] **Step 9: Run all tests**

```bash
npx jest --no-coverage 2>&1 | tail -20
```

Expected: All PASS (except possibly `gameStore.test.ts` which will be fixed here if needed).

- [ ] **Step 10: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat(store): wire two-stage daily tips claimed fields and update claimDailyReward action"
```

---

## Task 4: Redesign LobbyPanel UI

**Files:**
- Modify: `src/components/LobbyPanel.tsx` (daily tips card section ~lines 836–884 and styles ~1640–1660)
- Modify: `src/i18n/locales/en/lobby.json` (update dailyTips keys)

**Interfaces:**
- Consumes: `dailyTipsStage1Claimed`, `dailyTipsStage2Claimed`, `dailyTips`, `elevatorLevel` (all from `useLobbyState`)
- Consumes: `claimDailyReward(stage: 1 | 2)` from `useGameStore`
- Consumes: `gameConfig.lobbyConfig.dailyTipsBaseTarget`, `.dailyTipsStage1Reward`, `.dailyTipsStage2Reward`
- Consumes: `getDailyTipsTargets(elevatorLevel, gameConfig)` — import from `shared/engine/lobbyUtils`

- [ ] **Step 1: Update `src/i18n/locales/en/lobby.json`**

Replace the `dailyTips` block:
```json
"dailyTips": {
  "label": "Tips collected today",
  "claimReward": "Claim Reward",
  "received": "Received"
},
```

- [ ] **Step 2: Add import for `getDailyTipsTargets` in `LobbyPanel.tsx`**

Find the existing imports from shared engine (likely near the top of the file). Add:
```ts
import { getDailyTipsTargets } from '../../shared/engine/lobbyUtils';
```
(Adjust path depth to match other shared imports in the file.)

- [ ] **Step 3: Add `formatShortCoins` helper in `LobbyPanel.tsx`**

After the existing `formatCoins` function (~line 119), add:
```ts
function formatShortCoins(n: number): string {
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}
```

- [ ] **Step 4: Update state destructuring in the component**

Find where `dailyTipsRewardClaimed` is destructured from `useLobbyState` (~line 418). Replace:
```ts
    dailyTipsRewardClaimed,
```
With:
```ts
    dailyTipsStage1Claimed,
    dailyTipsStage2Claimed,
```

- [ ] **Step 5: Update computed values block (~line 458–461)**

Replace:
```ts
  const dailyTipsTarget = gameConfig.lobbyConfig.dailyTipsTarget;
  const dailyTipsReward = gameConfig.lobbyConfig.dailyTipsReward;
  const dailyTipsProgress = Math.min(1, dailyTips / dailyTipsTarget);
  const rewardReady = dailyTips >= dailyTipsTarget && !dailyTipsRewardClaimed;
```
With:
```ts
  const { stage1: stage1Target, stage2: stage2Target } = getDailyTipsTargets(elevatorLevel, gameConfig);
  const stage1Reward = gameConfig.lobbyConfig.dailyTipsStage1Reward;
  const stage2Reward = gameConfig.lobbyConfig.dailyTipsStage2Reward;
  const tipsProgress = Math.min(1, dailyTips / stage2Target);
  const stage1Ready = dailyTips >= stage1Target && !dailyTipsStage1Claimed;
  const stage2Ready = dailyTips >= stage2Target && !dailyTipsStage2Claimed;
```

- [ ] **Step 6: Update `claimDailyReward` binding (~line 435)**

Replace:
```ts
  const claimDailyReward = useGameStore((s) => s.claimDailyReward);
```
With (no change needed — the function now accepts a stage arg, so callers pass it; the binding stays the same):
```ts
  const claimDailyReward = useGameStore((s) => s.claimDailyReward);
```
(No change — binding is fine as-is; the call site in JSX will pass the stage.)

- [ ] **Step 7: Replace the daily tips card JSX (~lines 837–884)**

Replace the entire `{/* Daily tips card */}` block with:
```tsx
{/* Daily tips card */}
<View style={styles.dailyTipsCard}>
  <Text style={styles.dailyTipsLabel}>{t('dailyTips.label')}</Text>

  {/* Milestone label row above bar */}
  <View style={styles.milestoneLabelRow}>
    <View style={styles.milestoneLabelHalf}>
      <Text style={styles.milestoneAmount}>
        {dailyTipsStage1Claimed ? t('dailyTips.received') : formatShortCoins(stage1Target)}
      </Text>
      <GemIcon size={11} />
    </View>
    <View style={styles.milestoneLabelHalf}>
      <Text style={styles.milestoneAmount}>
        {dailyTipsStage2Claimed ? t('dailyTips.received') : formatShortCoins(stage2Target)}
      </Text>
      <GemIcon size={11} />
    </View>
  </View>

  {/* Progress bar with mid divider */}
  <View style={styles.progressTrack}>
    <LinearGradient
      colors={['#F6C642', '#E5A41C']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[styles.progressFill, { width: `${tipsProgress * 100}%` as any }]}
    />
    <View style={styles.stageDivider} pointerEvents="none" />
  </View>

  {/* Reward row below bar */}
  <View style={styles.milestoneLabelRow}>
    <View style={styles.milestoneLabelHalf}>
      <Text style={styles.milestoneReward}>+{stage1Reward}</Text>
      <GemIcon size={10} />
    </View>
    <View style={styles.milestoneLabelHalf}>
      <Text style={styles.milestoneReward}>+{stage2Reward}</Text>
      <GemIcon size={10} />
    </View>
  </View>

  {/* Claim button(s) */}
  {stage1Ready && (
    <Pressable
      onPress={() => claimDailyReward(1)}
      style={({ pressed }) => [
        styles.rewardButton,
        pressed && { opacity: 0.85, transform: [{ translateY: 1 }] },
      ]}
    >
      <LinearGradient
        colors={['#52A6E2', '#3B8BCB']}
        style={styles.rewardButtonGradient}
      >
        <GiftIcon size={16} color="#fff" />
        <Text style={styles.rewardButtonText}>{t('dailyTips.claimReward')}</Text>
        <GemIcon size={14} />
        <Text style={styles.rewardGemCount}>+{stage1Reward}</Text>
      </LinearGradient>
      <View style={styles.rewardButtonShadow} />
    </Pressable>
  )}
  {stage2Ready && (
    <Pressable
      onPress={() => claimDailyReward(2)}
      style={({ pressed }) => [
        styles.rewardButton,
        pressed && { opacity: 0.85, transform: [{ translateY: 1 }] },
      ]}
    >
      <LinearGradient
        colors={['#52A6E2', '#3B8BCB']}
        style={styles.rewardButtonGradient}
      >
        <GiftIcon size={16} color="#fff" />
        <Text style={styles.rewardButtonText}>{t('dailyTips.claimReward')}</Text>
        <GemIcon size={14} />
        <Text style={styles.rewardGemCount}>+{stage2Reward}</Text>
      </LinearGradient>
      <View style={styles.rewardButtonShadow} />
    </Pressable>
  )}
</View>
```

- [ ] **Step 8: Add new styles to the StyleSheet**

Find the `progressTrack` and surrounding styles (~line 1651). Add after `progressFill`:
```ts
  stageDivider: {
    position: 'absolute',
    left: '50%' as any,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 1,
  },
  milestoneLabelRow: {
    flexDirection: 'row',
    marginVertical: 3,
  },
  milestoneLabelHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  milestoneAmount: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
    color: '#5A6070',
  },
  milestoneReward: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 11,
    color: '#3B8BCB',
  },
```

Also remove the now-unused styles `dailyTipsHeader`, `dailyTipsValue`, `dailyTipsAmount`, `dailyTipsTarget`, and `claimedStrip` / `claimedText` if they are no longer referenced anywhere in the file. Grep first:
```bash
grep -n "dailyTipsHeader\|dailyTipsValue\|dailyTipsAmount\|dailyTipsTarget\|claimedStrip\|claimedText" /Users/Apple/IT/tinytower/src/components/LobbyPanel.tsx
```
Remove any that only appear in the style definition and nowhere else in JSX.

- [ ] **Step 9: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors. Fix any type errors before proceeding.

- [ ] **Step 10: Run all tests**

```bash
npx jest --no-coverage 2>&1 | tail -20
```

Expected: All PASS.

- [ ] **Step 11: Commit**

```bash
git add src/components/LobbyPanel.tsx src/i18n/locales/en/lobby.json
git commit -m "feat(ui): two-stage daily tips progress bar with split milestones and per-stage claim buttons"
```
