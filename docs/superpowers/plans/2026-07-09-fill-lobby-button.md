# Fill Lobby Button — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Fill Lobby" button to the elevator panel's empty state that instantly fills the lobby to capacity for a gem cost that scales with daily usage.

**Architecture:** New `fill_lobby` command carries pre-generated visitor data for deterministic replay (same pattern as `spawn_visitor`). State gets a new `dailyFillLobbyUses` counter that resets with the existing daily reset cycle. The button is only shown when `lobbyVisitors.length === 0`.

**Tech Stack:** TypeScript, Zod, Zustand, React Native, react-i18next

## Global Constraints

- Command pattern: all state mutations go through `executeCommand` → engine handler — never mutate store fields directly
- `executeCommand` in `gameStore.ts` explicitly lists every `GameState` field — `dailyFillLobbyUses` must be added to the extraction object, the `set({…})` call, `hydrate`, and `reconcile`
- Test files mirror `shared/engine/__tests__/lobbyCommands.test.ts` patterns — use `processCommand` wrapper, not engine handlers directly
- Run tests with: `npx jest --testPathPattern=lobbyCommands`

---

### Task 1: Add `dailyFillLobbyUses` to state schema + daily reset + cost helper

**Files:**
- Modify: `shared/schemas/gameState.ts`
- Modify: `shared/engine/lobbyUtils.ts`
- Test: `shared/engine/__tests__/lobbyUtils.test.ts`

**Interfaces:**
- Produces:
  - `GameState.dailyFillLobbyUses: number` (Zod default `0`)
  - `getFillLobbyCost(uses: number): number` exported from `lobbyUtils.ts`
  - `checkDailyReset` now also resets `dailyFillLobbyUses: 0`

- [ ] **Step 1: Write failing tests**

Add to `shared/engine/__tests__/lobbyUtils.test.ts`:

```ts
import { checkDailyReset, getFillLobbyCost } from '../lobbyUtils';
import { createInitialState } from '../../config/gameConfig';

const testConfig = {
  floorTypes: { green: { shirtColor: '#62B23F', accent: '#4E9A2E', businesses: [] } },
  floors: [{ id: 2, slots: 3, floorType: 'green', availableTypes: [] }],
  productionTypes: {},
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
  floorUnlocks: [],
  achievements: [],
} as any;

describe('getFillLobbyCost', () => {
  it('returns 1 for uses 0–4', () => {
    expect(getFillLobbyCost(0)).toBe(1);
    expect(getFillLobbyCost(4)).toBe(1);
  });
  it('returns 2 for uses 5–9', () => {
    expect(getFillLobbyCost(5)).toBe(2);
    expect(getFillLobbyCost(9)).toBe(2);
  });
  it('returns 3 for uses 10–14', () => {
    expect(getFillLobbyCost(10)).toBe(3);
    expect(getFillLobbyCost(14)).toBe(3);
  });
  it('returns 5 for uses 15+', () => {
    expect(getFillLobbyCost(15)).toBe(5);
    expect(getFillLobbyCost(100)).toBe(5);
  });
});

describe('checkDailyReset resets dailyFillLobbyUses', () => {
  it('resets dailyFillLobbyUses to 0 on new day', () => {
    const midnight = new Date('2026-01-01T00:00:00').getTime();
    const state = {
      ...createInitialState(testConfig),
      dailyFillLobbyUses: 7,
      lastDailyReset: midnight,
    };
    const nextDay = midnight + 25 * 60 * 60 * 1000;
    const result = checkDailyReset(state, nextDay);
    expect(result.dailyFillLobbyUses).toBe(0);
  });

  it('does not reset dailyFillLobbyUses within same day', () => {
    const midnight = new Date('2026-01-01T00:00:00').getTime();
    const state = {
      ...createInitialState(testConfig),
      dailyFillLobbyUses: 7,
      lastDailyReset: midnight,
    };
    const sameDay = midnight + 10 * 60 * 60 * 1000;
    const result = checkDailyReset(state, sameDay);
    expect(result.dailyFillLobbyUses).toBe(7);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```
npx jest --testPathPattern=lobbyUtils
```

Expected: FAIL — `getFillLobbyCost` not found, `dailyFillLobbyUses` not on state.

- [ ] **Step 3: Add `dailyFillLobbyUses` to `GameStateSchema`**

In `shared/schemas/gameState.ts`, add one line inside `GameStateSchema`:

```ts
dailyFillLobbyUses: z.number().int().nonnegative().default(0),
```

Place it after `lastDailyReset` (line 52).

- [ ] **Step 4: Add `getFillLobbyCost` to `lobbyUtils.ts`**

Add this function anywhere after the existing exports in `shared/engine/lobbyUtils.ts`:

```ts
export function getFillLobbyCost(uses: number): number {
  if (uses < 5)  return 1;
  if (uses < 10) return 2;
  if (uses < 15) return 3;
  return 5;
}
```

- [ ] **Step 5: Reset `dailyFillLobbyUses` in `checkDailyReset`**

In `shared/engine/lobbyUtils.ts`, inside `checkDailyReset`, add `dailyFillLobbyUses: 0` to the reset object:

```ts
  if (commandTimestamp >= nextMidnight) {
    return {
      ...state,
      dailyTips: 0,
      dailyGemsCollected: 0,
      dailyTipsRewardClaimed: false,
      dailyFillLobbyUses: 0,
      lastDailyReset: getMidnightBefore(commandTimestamp),
    };
  }
```

- [ ] **Step 6: Run tests — verify they pass**

```
npx jest --testPathPattern=lobbyUtils
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add shared/schemas/gameState.ts shared/engine/lobbyUtils.ts shared/engine/__tests__/lobbyUtils.test.ts
git commit -m "feat(fill-lobby): add dailyFillLobbyUses to state, getFillLobbyCost helper, daily reset"
```

---

### Task 2: Add `fill_lobby` command schema + engine handler

**Files:**
- Modify: `shared/schemas/command.ts`
- Modify: `shared/engine/lobbyCommands.ts`
- Test: `shared/engine/__tests__/lobbyCommands.test.ts`

**Interfaces:**
- Consumes:
  - `GameState.dailyFillLobbyUses: number` (Task 1)
  - `getFillLobbyCost(uses: number): number` from `lobbyUtils.ts` (Task 1)
- Produces:
  - `FillLobbyCommandSchema` exported from `command.ts`
  - `Command` union includes `fill_lobby`
  - `processLobbyCommand` handles `fill_lobby`

- [ ] **Step 1: Write failing tests**

Add to `shared/engine/__tests__/lobbyCommands.test.ts`:

```ts
describe('fill_lobby', () => {
  it('fills lobby to capacity and deducts 1 gem on first use', () => {
    const state = makeState({ gems: 5, lobbyCapacity: 3, lobbyVisitors: [] });
    const cmd: Command = {
      id: 'c1', type: 'fill_lobby', timestamp: 1000,
      visitors: [
        { visitorId: 'v1', role: 'guest', targetFloor: 2, hairColor: '#aaa', female: false },
        { visitorId: 'v2', role: 'businessman', targetFloor: 2, hairColor: '#bbb', female: true },
        { visitorId: 'v3', role: 'guest', targetFloor: 3, hairColor: '#ccc', female: false },
      ],
    };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(4);
    expect(result.state.lobbyVisitors).toHaveLength(3);
    expect(result.state.lobbyVisitors[0].id).toBe('v1');
    expect(result.state.dailyFillLobbyUses).toBe(1);
    expect(result.state.nextVisitorAt).toBe(0);
  });

  it('deducts 2 gems when dailyFillLobbyUses is 5', () => {
    const state = makeState({ gems: 5, lobbyCapacity: 2, lobbyVisitors: [], dailyFillLobbyUses: 5 });
    const cmd: Command = {
      id: 'c1', type: 'fill_lobby', timestamp: 1000,
      visitors: [
        { visitorId: 'v1', role: 'guest', targetFloor: 2, hairColor: '#aaa', female: false },
        { visitorId: 'v2', role: 'guest', targetFloor: 2, hairColor: '#bbb', female: true },
      ],
    };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(3);
  });

  it('fails when not enough gems', () => {
    const state = makeState({ gems: 0, lobbyCapacity: 2, lobbyVisitors: [] });
    const cmd: Command = {
      id: 'c1', type: 'fill_lobby', timestamp: 1000,
      visitors: [
        { visitorId: 'v1', role: 'guest', targetFloor: 2, hairColor: '#aaa', female: false },
      ],
    };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(false);
    expect(result.state.gems).toBe(0);
  });

  it('fails when lobby already has visitors', () => {
    const state = makeState({ gems: 5, lobbyVisitors: [makeVisitor()], lobbyCapacity: 3 });
    const cmd: Command = {
      id: 'c1', type: 'fill_lobby', timestamp: 1000,
      visitors: [
        { visitorId: 'v2', role: 'guest', targetFloor: 2, hairColor: '#aaa', female: false },
      ],
    };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(false);
  });

  it('only adds visitors up to capacity (ignores excess in command)', () => {
    const state = makeState({ gems: 5, lobbyCapacity: 2, lobbyVisitors: [] });
    const cmd: Command = {
      id: 'c1', type: 'fill_lobby', timestamp: 1000,
      visitors: [
        { visitorId: 'v1', role: 'guest', targetFloor: 2, hairColor: '#aaa', female: false },
        { visitorId: 'v2', role: 'guest', targetFloor: 2, hairColor: '#bbb', female: true },
        { visitorId: 'v3', role: 'guest', targetFloor: 2, hairColor: '#ccc', female: false },
      ],
    };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.lobbyVisitors).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```
npx jest --testPathPattern=lobbyCommands
```

Expected: FAIL — `fill_lobby` not in Command type.

- [ ] **Step 3: Add `FillLobbyCommandSchema` to `command.ts`**

In `shared/schemas/command.ts`, add after `ExpandHotelCommandSchema`:

```ts
export const FillLobbyCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('fill_lobby'),
  visitors: z.array(z.object({
    visitorId: z.string(),
    role: VisitorRoleSchema,
    targetFloor: z.number().int().positive(),
    hairColor: z.string(),
    female: z.boolean(),
    pendingFloorType: z.string().optional(),
  })),
});
```

Then add `FillLobbyCommandSchema` to the `CommandSchema` discriminated union array.

- [ ] **Step 4: Add `fill_lobby` handler to `lobbyCommands.ts`**

In `shared/engine/lobbyCommands.ts`:

1. Add `'fill_lobby'` to the `LobbyCommand` union type:
```ts
type LobbyCommand = Extract<Command, { type:
  'spawn_visitor' | 'lift_visitor' | 'collect_tip' |
  'deliver_all' | 'upgrade_elevator' | 'upgrade_lobby' | 'claim_daily_reward' | 'expand_hotel' | 'fill_lobby'
}>;
```

2. Add import of `getFillLobbyCost` at the top:
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
} from './lobbyUtils';
```

3. Add `case 'fill_lobby'` to the switch in `processLobbyCommand`:
```ts
    case 'fill_lobby':
      return handleFillLobby(state, command, config);
```

4. Add the handler function after `handleClaimDailyReward`:
```ts
function handleFillLobby(
  state: GameState,
  command: Extract<Command, { type: 'fill_lobby' }>,
  config: GameConfig,
): ProcessResult {
  if (state.lobbyVisitors.length > 0) {
    return { success: false, state, error: 'Lobby is not empty' };
  }
  const cost = getFillLobbyCost(state.dailyFillLobbyUses);
  if (state.gems < cost) {
    return { success: false, state, error: 'Not enough gems' };
  }
  const slots = state.lobbyCapacity - state.lobbyVisitors.length;
  const newVisitors: Visitor[] = command.visitors.slice(0, slots).map((v) => ({
    id: v.visitorId,
    role: v.role,
    targetFloor: v.targetFloor,
    hairColor: v.hairColor,
    female: v.female,
    pendingFloorType: v.pendingFloorType,
  }));
  return {
    success: true,
    state: {
      ...state,
      gems: state.gems - cost,
      lobbyVisitors: newVisitors,
      dailyFillLobbyUses: state.dailyFillLobbyUses + 1,
      nextVisitorAt: 0,
    },
  };
}
```

- [ ] **Step 5: Run tests — verify they pass**

```
npx jest --testPathPattern=lobbyCommands
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add shared/schemas/command.ts shared/engine/lobbyCommands.ts shared/engine/__tests__/lobbyCommands.test.ts
git commit -m "feat(fill-lobby): add fill_lobby command schema and engine handler"
```

---

### Task 3: Wire `dailyFillLobbyUses` through the store + add `fillLobby` action

**Files:**
- Modify: `src/stores/gameStore.ts`

**Interfaces:**
- Consumes:
  - `Command` union with `fill_lobby` (Task 2)
  - `getFillLobbyCost` from `lobbyUtils.ts` (Task 1)
  - `generateRandomVisitorRole`, `generateVisitorAppearance` already imported in this file
- Produces:
  - `fillLobby: () => void` action on the store
  - `dailyFillLobbyUses` in `useLobbyState()` return value

- [ ] **Step 1: Add `getFillLobbyCost` to the import from `lobbyUtils`**

In `src/stores/gameStore.ts`, line 5, update the import:

```ts
import { generateRandomVisitorRole, generateVisitorAppearance, getFillLobbyCost } from '../../shared/engine/lobbyUtils';
```

- [ ] **Step 2: Thread `dailyFillLobbyUses` through `executeCommand`**

In `src/stores/gameStore.ts`, in the `executeCommand` function:

2a. Add `dailyFillLobbyUses` to the destructuring of `store` (around line 91):
```ts
  const { balance, gems, floors, commandQueue, workers, hotelCapacity,
    lobbyVisitors, lobbyCapacity, elevatorLevel, elevatorFloor,
    dailyTips, dailyGemsCollected, dailyTipsRewardClaimed, lastDailyReset, nextVisitorAt,
    tools, underConstruction, openedFloorTypes, stats, dailyFillLobbyUses,
  } = store;
```

2b. Add `dailyFillLobbyUses` to the `gameState` object constructed below:
```ts
  const gameState: GameState = {
    balance, gems, floors, commandQueue, workers, hotelCapacity,
    lobbyVisitors, lobbyCapacity, elevatorLevel, elevatorFloor,
    dailyTips, dailyGemsCollected, dailyTipsRewardClaimed, lastDailyReset, nextVisitorAt,
    tools, underConstruction, openedFloorTypes, stats, dailyFillLobbyUses,
  };
```

2c. Add `dailyFillLobbyUses` to the `set({…})` call in `executeCommand`:
```ts
    dailyFillLobbyUses: result.state.dailyFillLobbyUses,
```
(add after `nextVisitorAt: result.state.nextVisitorAt,`)

- [ ] **Step 3: Add `dailyFillLobbyUses` to `hydrate`**

In the `hydrate` action (around line 383), add:
```ts
    dailyFillLobbyUses: state.dailyFillLobbyUses ?? 0,
```

- [ ] **Step 4: Add `dailyFillLobbyUses` to `reconcile`**

In the `reconcile` action (around line 410), add:
```ts
    dailyFillLobbyUses: serverState.dailyFillLobbyUses ?? 0,
```

- [ ] **Step 5: Add `fillLobby` to `GameActions` interface**

In the `GameActions` interface (around line 55), add:
```ts
  fillLobby: () => void;
```

- [ ] **Step 6: Add `fillLobby` action implementation**

Add after the `deliverAll` action (around line 341):

```ts
  fillLobby: () => {
    const state = get();
    const slotsToFill = state.lobbyCapacity - state.lobbyVisitors.length;
    const now = clock.now();
    const cost = getFillLobbyCost(state.dailyFillLobbyUses);
    if (state.gems < cost) {
      state.showInsufficientResources({ currency: 'gems', need: cost, have: state.gems });
      return;
    }
    const visitors = Array.from({ length: slotsToFill }, () => {
      const { role, targetFloor } = generateRandomVisitorRole({ ...state }, gameConfig, now, state.playerLevel);
      const { id, hairColor, female } = generateVisitorAppearance();
      const pendingFloorType = (role === 'guest' && targetFloor === 1)
        ? Object.keys(gameConfig.floorTypes)[Math.floor(Math.random() * Object.keys(gameConfig.floorTypes).length)]
        : undefined;
      return { visitorId: id, role, targetFloor, hairColor, female, pendingFloorType };
    });
    executeCommand(get, set, {
      id: uuid(),
      type: 'fill_lobby',
      timestamp: now,
      visitors,
    });
  },
```

- [ ] **Step 7: Add `dailyFillLobbyUses` to `useLobbyState`**

In `useLobbyState` (line 497), add `dailyFillLobbyUses` to the selector:
```ts
export function useLobbyState() {
  return useGameStore(useShallow((state) => ({
    lobbyVisitors: state.lobbyVisitors,
    lobbyCapacity: state.lobbyCapacity,
    elevatorLevel: state.elevatorLevel,
    elevatorFloor: state.elevatorFloor,
    dailyTips: state.dailyTips,
    dailyGemsCollected: state.dailyGemsCollected,
    dailyTipsRewardClaimed: state.dailyTipsRewardClaimed,
    nextVisitorAt: state.nextVisitorAt,
    gems: state.gems,
    dailyFillLobbyUses: state.dailyFillLobbyUses,
  })));
}
```

- [ ] **Step 8: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat(fill-lobby): wire dailyFillLobbyUses through store, add fillLobby action"
```

---

### Task 4: UI — button in empty state + i18n

**Files:**
- Modify: `src/components/LobbyPanel.tsx`
- Modify: `src/i18n/locales/en/lobby.json`

**Interfaces:**
- Consumes:
  - `fillLobby: () => void` from store (Task 3)
  - `dailyFillLobbyUses: number` from `useLobbyState()` (Task 3)
  - `getFillLobbyCost` from `lobbyUtils.ts` (Task 1)
  - `gems: number` already in `useLobbyState()`

- [ ] **Step 1: Add i18n key**

In `src/i18n/locales/en/lobby.json`, add inside the `"actions"` object:
```json
"fillLobby": "Fill Lobby"
```

- [ ] **Step 2: Add `fillLobby` and `dailyFillLobbyUses` from the store in `LobbyPanel`**

In `LobbyPanel.tsx`, add alongside the other store selectors (around line 426):
```ts
  const fillLobby = useGameStore((s) => s.fillLobby);
```

And add `dailyFillLobbyUses` to the destructuring of `useLobbyState()` (line 411):
```ts
  const {
    lobbyVisitors,
    lobbyCapacity,
    elevatorLevel,
    elevatorFloor,
    dailyTips,
    dailyGemsCollected,
    dailyTipsRewardClaimed,
    nextVisitorAt,
    gems,
    dailyFillLobbyUses,
  } = useLobbyState();
```

- [ ] **Step 3: Add `getFillLobbyCost` import**

In `LobbyPanel.tsx`, update the import from `lobbyUtils`:
```ts
import { calculateTip, calculateElevatorUpgradeCost, calculateLobbyUpgradeCost, getMaxElevatorLevel, getMaxLobbyCapacity, getFillLobbyCost } from '../../shared/engine/lobbyUtils';
```

- [ ] **Step 4: Add the button to the empty state block**

In `LobbyPanel.tsx`, find the empty state block (around line 785):
```tsx
                    <View style={styles.emptyState}>
                      <EmptyElevatorIcon />
                      <Text style={styles.emptyTitle}>{t('empty.title')}</Text>
                      <Text style={styles.emptySubtitle}>{t('empty.subtitle')}</Text>
                    </View>
```

Replace with:
```tsx
                    <View style={styles.emptyState}>
                      <EmptyElevatorIcon />
                      <Text style={styles.emptyTitle}>{t('empty.title')}</Text>
                      <Text style={styles.emptySubtitle}>{t('empty.subtitle')}</Text>
                      <Pressable
                        onPress={fillLobby}
                        style={({ pressed }) => [
                          styles.fillLobbyButton,
                          pressed && { opacity: 0.85, transform: [{ translateY: 1 }] },
                        ]}
                      >
                        <LinearGradient
                          colors={['#52A6E2', '#3B8BCB']}
                          style={styles.fillLobbyGradient}
                        >
                          <Text style={styles.fillLobbyText}>{t('actions.fillLobby')}</Text>
                          <GemIcon size={14} />
                          <Text style={styles.fillLobbyGemCount}>{getFillLobbyCost(dailyFillLobbyUses)}</Text>
                        </LinearGradient>
                        <View style={styles.fillLobbyButtonShadow} />
                      </Pressable>
                    </View>
```

- [ ] **Step 5: Add styles**

In `LobbyPanel.tsx`, inside the `StyleSheet.create({…})` at the bottom, add after `emptySubtitle`:
```ts
  fillLobbyButton: {
    borderRadius: 13,
    overflow: 'hidden',
    position: 'relative',
    marginTop: 8,
    alignSelf: 'stretch',
  },
  fillLobbyGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 13,
    zIndex: 1,
  },
  fillLobbyText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 14.5,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  fillLobbyGemCount: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 14.5,
    color: '#fff',
  },
  fillLobbyButtonShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#2E72A8',
    borderBottomLeftRadius: 13,
    borderBottomRightRadius: 13,
  },
```

- [ ] **Step 6: Commit**

```bash
git add src/components/LobbyPanel.tsx src/i18n/locales/en/lobby.json
git commit -m "feat(fill-lobby): add Fill Lobby button to empty state UI"
```

---

## Self-Review

**Spec coverage:**
- ✅ Button shown only when lobby completely empty — Task 4, `lobbyVisitors.length === 0` is the existing condition on the empty state block
- ✅ Fills lobby to full capacity — Task 2 `handleFillLobby` adds `command.visitors.slice(0, slots)` where `slots = lobbyCapacity - lobbyVisitors.length`
- ✅ Cost 1–5 = 1 gem, 6–10 = 2, 11–15 = 3, 16+ = 5 — Task 1 `getFillLobbyCost`
- ✅ Daily counter resets at midnight — Task 1 `checkDailyReset`
- ✅ No counter displayed on button — Task 4 button shows only gem icon + cost
- ✅ Insufficient gems → `showInsufficientResources` — Task 3 `fillLobby` action

**Placeholder scan:** No TBDs, TODOs, or vague steps found.

**Type consistency:**
- `getFillLobbyCost` defined in Task 1, used in Tasks 3 and 4 ✅
- `FillLobbyCommandSchema` field names (`visitorId`, `role`, `targetFloor`, `hairColor`, `female`, `pendingFloorType`) match `handleFillLobby` usage in Task 2 ✅
- `dailyFillLobbyUses` added to schema (Task 1), threaded through store (Task 3), exposed via `useLobbyState` (Task 3), consumed in UI (Task 4) ✅
- `fillLobby` action defined in `GameActions` interface and implemented in Task 3, consumed in Task 4 ✅
