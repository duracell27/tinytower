# My Business Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "My Business" section to the Profile tab where players upgrade 5 business categories (one per floor type) to boost profit on all floors of that type by +5% per level, up to +200%.

**Architecture:** New `businessUpgrades` field in `GameState` schema + new `upgrade_business_category` command processed in `processCommand.ts`. Category bonus stacks additively with existing `coinBonusPercent` in `handleCollect`. UI is two expo-router screens: list (`/my-business`) and detail (`/my-business/[category]`), navigated from the Profile tab.

**Tech Stack:** TypeScript, Zod (schemas), Zustand (gameStore), React Native + expo-router (UI), react-i18next (i18n), Jest (tests)

## Global Constraints

- All game state mutations MUST go through `executeCommand` → `processCommand` (never `set()` directly for game data)
- `GameState` schema lives in `shared/schemas/gameState.ts` — Zod schema with `.default()` on every new field
- Commands are Zod discriminated union in `shared/schemas/command.ts` — every new command must be added to the union
- New types exported from `shared/types/index.ts`
- i18n strings in `src/i18n/locales/en/hotel.json` under a `myBusiness` namespace key
- Run tests with: `npx jest` from repo root
- Floor types: `'green' | 'blue' | 'yellow' | 'purple' | 'red'`
- Max upgrade level per category: 40 (= +200% profit). Profit bonus = `level × 5` percent.

---

### Task 1: Cost table + schemas

**Files:**
- Create: `shared/config/businessUpgradeCosts.ts`
- Modify: `shared/schemas/gameState.ts`
- Modify: `shared/schemas/command.ts`
- Modify: `shared/types/index.ts`
- Test: `shared/config/__tests__/businessUpgradeCosts.test.ts`

**Interfaces:**
- Produces:
  - `BUSINESS_UPGRADE_COSTS: BusinessUpgradeCost[]` (40 entries, index = level − 1)
  - `BusinessUpgradeCost = { kind: 'coins'; coins: number; tokens: number } | { kind: 'gems'; gems: number }`
  - `BusinessUpgradesSchema` (Zod object, exported from `gameState.ts`)
  - `UpgradeBusinessCategoryCommandSchema` (added to discriminated union in `command.ts`)
  - `UpgradeBusinessCategoryCommand` type (exported from `types/index.ts`)

- [ ] **Step 1: Create the cost table file**

```ts
// shared/config/businessUpgradeCosts.ts
type CoinCost = { kind: 'coins'; coins: number; tokens: number };
type GemCost  = { kind: 'gems';  gems: number };
export type BusinessUpgradeCost = CoinCost | GemCost;

export const BUSINESS_UPGRADE_COSTS: BusinessUpgradeCost[] = [
  { kind: 'coins', coins: 1_000,           tokens: 3   }, // level 1  → +5%
  { kind: 'coins', coins: 2_500,           tokens: 3   }, // level 2  → +10%
  { kind: 'coins', coins: 5_000,           tokens: 4   }, // level 3  → +15%
  { kind: 'coins', coins: 10_000,          tokens: 5   }, // level 4  → +20%
  { kind: 'gems',  gems:  50              },              // level 5  → +25%
  { kind: 'coins', coins: 15_000,          tokens: 5   }, // level 6  → +30%
  { kind: 'coins', coins: 30_000,          tokens: 6   }, // level 7  → +35%
  { kind: 'coins', coins: 50_000,          tokens: 7   }, // level 8  → +40%
  { kind: 'gems',  gems:  100             },              // level 9  → +45%
  { kind: 'coins', coins: 50_000,          tokens: 8   }, // level 10 → +50%
  { kind: 'coins', coins: 100_000,         tokens: 9   }, // level 11 → +55%
  { kind: 'coins', coins: 200_000,         tokens: 10  }, // level 12 → +60%
  { kind: 'gems',  gems:  200             },              // level 13 → +65%
  { kind: 'coins', coins: 200_000,         tokens: 12  }, // level 14 → +70%
  { kind: 'coins', coins: 350_000,         tokens: 14  }, // level 15 → +75%
  { kind: 'coins', coins: 500_000,         tokens: 16  }, // level 16 → +80%
  { kind: 'gems',  gems:  400             },              // level 17 → +85%
  { kind: 'coins', coins: 500_000,         tokens: 18  }, // level 18 → +90%
  { kind: 'coins', coins: 750_000,         tokens: 20  }, // level 19 → +95%
  { kind: 'coins', coins: 1_000_000,       tokens: 25  }, // level 20 → +100%
  { kind: 'gems',  gems:  1_000           },              // level 21 → +105%
  { kind: 'coins', coins: 1_500_000,       tokens: 28  }, // level 22 → +110%
  { kind: 'coins', coins: 2_000_000,       tokens: 30  }, // level 23 → +115%
  { kind: 'coins', coins: 3_000_000,       tokens: 35  }, // level 24 → +120%
  { kind: 'gems',  gems:  2_000           },              // level 25 → +125%
  { kind: 'coins', coins: 3_000_000,       tokens: 40  }, // level 26 → +130%
  { kind: 'coins', coins: 5_000_000,       tokens: 50  }, // level 27 → +135%
  { kind: 'coins', coins: 7_000_000,       tokens: 55  }, // level 28 → +140%
  { kind: 'gems',  gems:  5_000           },              // level 29 → +145%
  { kind: 'coins', coins: 10_000_000,      tokens: 60  }, // level 30 → +150%
  { kind: 'coins', coins: 25_000_000,      tokens: 70  }, // level 31 → +155%
  { kind: 'coins', coins: 50_000_000,      tokens: 80  }, // level 32 → +160%
  { kind: 'gems',  gems:  8_000           },              // level 33 → +165%
  { kind: 'coins', coins: 100_000_000,     tokens: 100 }, // level 34 → +170%
  { kind: 'coins', coins: 250_000_000,     tokens: 110 }, // level 35 → +175%
  { kind: 'coins', coins: 500_000_000,     tokens: 125 }, // level 36 → +180%
  { kind: 'gems',  gems:  10_000          },              // level 37 → +185%
  { kind: 'coins', coins: 1_000_000_000,   tokens: 145 }, // level 38 → +190%
  { kind: 'coins', coins: 2_500_000_000,   tokens: 165 }, // level 39 → +195%
  { kind: 'coins', coins: 5_000_000_000,   tokens: 200 }, // level 40 → +200%
];
```

- [ ] **Step 2: Write the failing test**

```ts
// shared/config/__tests__/businessUpgradeCosts.test.ts
import { BUSINESS_UPGRADE_COSTS } from '../businessUpgradeCosts';

describe('BUSINESS_UPGRADE_COSTS', () => {
  it('has exactly 40 entries', () => {
    expect(BUSINESS_UPGRADE_COSTS).toHaveLength(40);
  });

  it('level 1 costs 1000 coins + 3 tokens', () => {
    const cost = BUSINESS_UPGRADE_COSTS[0];
    expect(cost.kind).toBe('coins');
    if (cost.kind === 'coins') {
      expect(cost.coins).toBe(1_000);
      expect(cost.tokens).toBe(3);
    }
  });

  it('level 5 (index 4) is a gem milestone with 50 gems', () => {
    const cost = BUSINESS_UPGRADE_COSTS[4];
    expect(cost.kind).toBe('gems');
    if (cost.kind === 'gems') expect(cost.gems).toBe(50);
  });

  it('level 40 (index 39) costs 5_000_000_000 coins + 200 tokens', () => {
    const cost = BUSINESS_UPGRADE_COSTS[39];
    expect(cost.kind).toBe('coins');
    if (cost.kind === 'coins') {
      expect(cost.coins).toBe(5_000_000_000);
      expect(cost.tokens).toBe(200);
    }
  });

  it('gem milestones are at indices 4, 8, 12, 16, 20, 24, 28, 32, 36', () => {
    const gemIndices = [4, 8, 12, 16, 20, 24, 28, 32, 36];
    gemIndices.forEach((i) => expect(BUSINESS_UPGRADE_COSTS[i].kind).toBe('gems'));
  });

  it('all non-gem entries have positive coins and tokens', () => {
    BUSINESS_UPGRADE_COSTS.forEach((cost, i) => {
      if (cost.kind === 'coins') {
        expect(cost.coins).toBeGreaterThan(0);
        expect(cost.tokens).toBeGreaterThan(0);
      }
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx jest shared/config/__tests__/businessUpgradeCosts.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '../businessUpgradeCosts'`

- [ ] **Step 4: Add `BusinessUpgradesSchema` to `shared/schemas/gameState.ts`**

After the `TokensSchema` definition (around line 40), add:

```ts
export const BusinessUpgradesSchema = z.object({
  green:  z.number().int().min(0).max(40).default(0),
  blue:   z.number().int().min(0).max(40).default(0),
  yellow: z.number().int().min(0).max(40).default(0),
  purple: z.number().int().min(0).max(40).default(0),
  red:    z.number().int().min(0).max(40).default(0),
});
```

Then inside `GameStateSchema` (after the `tokens` line), add:

```ts
businessUpgrades: BusinessUpgradesSchema.default({ green: 0, blue: 0, yellow: 0, purple: 0, red: 0 }),
```

- [ ] **Step 5: Add `UpgradeBusinessCategoryCommandSchema` to `shared/schemas/command.ts`**

After `ClaimDailyTaskCommandSchema`, add:

```ts
export const UpgradeBusinessCategoryCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('upgrade_business_category'),
  floorType: z.enum(['green', 'blue', 'yellow', 'purple', 'red']),
});
```

Then add it to the `CommandSchema` discriminated union array:

```ts
UpgradeBusinessCategoryCommandSchema,
```

- [ ] **Step 6: Export new type from `shared/types/index.ts`**

Add to the imports at the top:

```ts
import { ..., UpgradeBusinessCategoryCommandSchema } from '../schemas/command';
import { ..., BusinessUpgradesSchema } from '../schemas/gameState';
```

Add to the type exports:

```ts
export type UpgradeBusinessCategoryCommand = z.infer<typeof UpgradeBusinessCategoryCommandSchema>;
export type BusinessUpgrades = z.infer<typeof BusinessUpgradesSchema>;
```

- [ ] **Step 7: Run test to verify it passes**

```bash
npx jest shared/config/__tests__/businessUpgradeCosts.test.ts --no-coverage
```
Expected: PASS (5 tests)

- [ ] **Step 8: Run full test suite to ensure no regressions**

```bash
npx jest --no-coverage
```
Expected: all existing tests still PASS

- [ ] **Step 9: Commit**

```bash
git add shared/config/businessUpgradeCosts.ts shared/config/__tests__/businessUpgradeCosts.test.ts shared/schemas/gameState.ts shared/schemas/command.ts shared/types/index.ts
git commit -m "feat: add businessUpgrades schema, cost table, and upgrade_business_category command"
```

---

### Task 2: processCommand — handler + profit integration

**Files:**
- Modify: `shared/engine/processCommand.ts`
- Test: `shared/engine/__tests__/processCommand.test.ts` (add cases at the end)

**Interfaces:**
- Consumes:
  - `BUSINESS_UPGRADE_COSTS` from `shared/config/businessUpgradeCosts.ts`
  - `state.businessUpgrades` (from Task 1 schema)
  - `state.tokens` (already exists)
- Produces:
  - `handleUpgradeBusinessCategory(state, command): ProcessResult`
  - `handleCollect` now includes `categoryBonus` in `coinMultiplier`

- [ ] **Step 1: Write the failing tests**

Add to `shared/engine/__tests__/processCommand.test.ts` (at the end of the file, before the closing `}`):

```ts
describe('upgrade_business_category', () => {
  it('upgrades from level 0 to 1, deducts coins and tokens', () => {
    const state = makeState({ balance: 10_000, tokens: { green: 5, blue: 0, yellow: 0, purple: 0, red: 0 } });
    const result = processCommand(
      state,
      { id: 'u1', type: 'upgrade_business_category', floorType: 'green', timestamp: 1000 },
      testConfig, 1000,
    );
    expect(result.success).toBe(true);
    expect(result.state.balance).toBe(9_000);         // 10_000 − 1_000
    expect(result.state.tokens.green).toBe(2);         // 5 − 3
    expect(result.state.businessUpgrades.green).toBe(1);
  });

  it('fails when balance is insufficient for coin cost', () => {
    const state = makeState({ balance: 500, tokens: { green: 10, blue: 0, yellow: 0, purple: 0, red: 0 } });
    const result = processCommand(
      state,
      { id: 'u2', type: 'upgrade_business_category', floorType: 'green', timestamp: 1000 },
      testConfig, 1000,
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient balance');
  });

  it('fails when token balance is insufficient', () => {
    const state = makeState({ balance: 10_000, tokens: { green: 1, blue: 0, yellow: 0, purple: 0, red: 0 } });
    const result = processCommand(
      state,
      { id: 'u3', type: 'upgrade_business_category', floorType: 'green', timestamp: 1000 },
      testConfig, 1000,
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient tokens');
  });

  it('level 5 upgrade costs gems (no tokens)', () => {
    const state = makeState({
      gems: 100,
      businessUpgrades: { green: 4, blue: 0, yellow: 0, purple: 0, red: 0 },
    });
    const result = processCommand(
      state,
      { id: 'u4', type: 'upgrade_business_category', floorType: 'green', timestamp: 1000 },
      testConfig, 1000,
    );
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(50);               // 100 − 50 gems
    expect(result.state.businessUpgrades.green).toBe(5);
    expect(result.state.tokens.green).toBe(0);        // tokens unchanged
  });

  it('fails on gem cost when gems insufficient', () => {
    const state = makeState({
      gems: 10,
      businessUpgrades: { green: 4, blue: 0, yellow: 0, purple: 0, red: 0 },
    });
    const result = processCommand(
      state,
      { id: 'u5', type: 'upgrade_business_category', floorType: 'green', timestamp: 1000 },
      testConfig, 1000,
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient gems');
  });

  it('fails when already at max level 40', () => {
    const state = makeState({
      businessUpgrades: { green: 40, blue: 0, yellow: 0, purple: 0, red: 0 },
    });
    const result = processCommand(
      state,
      { id: 'u6', type: 'upgrade_business_category', floorType: 'green', timestamp: 1000 },
      testConfig, 1000,
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('Max level reached');
  });

  it('category bonus applies to collect revenue on matching floor type', () => {
    // Level 2 on green = +10% profit
    const state: GameState = {
      ...stateWithWorker(),
      balance: 0,
      businessUpgrades: { green: 2, blue: 0, yellow: 0, purple: 0, red: 0 },
      floors: [{
        id: 1,
        productions: [{
          typeId: 'coffee_shop',
          stage: 'SELLING',
          stageStartedAt: 0,
        }],
      }],
    };
    const result = processCommand(
      state,
      { id: 'c1', type: 'collect', floorId: 1, slotIdx: 0, timestamp: 20_000 },
      testConfig, 20_000,
    );
    expect(result.success).toBe(true);
    // batchValue=25, workerMultiplier for dream job = 2x, categoryBonus=10%
    // revenue = floor(25 * 1.10 * 2) = floor(55) = 55
    expect(result.state.balance).toBeGreaterThan(0);
    // Without bonus: floor(25 * 1.0 * 2) = 50. With +10%: floor(25 * 1.1 * 2) = 55
    expect(result.state.balance).toBe(55);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest shared/engine/__tests__/processCommand.test.ts --no-coverage
```
Expected: FAIL — `upgrade_business_category` not handled

- [ ] **Step 3: Add import + handler to `processCommand.ts`**

At the top of `shared/engine/processCommand.ts`, add the import:

```ts
import { BUSINESS_UPGRADE_COSTS } from '../config/businessUpgradeCosts';
```

Add the handler function (after `handleExchangeGems` or before the final export):

```ts
function handleUpgradeBusinessCategory(
  state: GameState,
  command: Extract<Command, { type: 'upgrade_business_category' }>,
): ProcessResult {
  const { floorType } = command;
  const currentLevel = state.businessUpgrades?.[floorType] ?? 0;
  if (currentLevel >= 40) {
    return { success: false, state, error: 'Max level reached' };
  }
  const cost = BUSINESS_UPGRADE_COSTS[currentLevel];
  const upgradedBusinessUpgrades = {
    green: 0, blue: 0, yellow: 0, purple: 0, red: 0,
    ...(state.businessUpgrades ?? {}),
    [floorType]: currentLevel + 1,
  };
  if (cost.kind === 'gems') {
    if (state.gems < cost.gems) {
      return { success: false, state, error: 'Insufficient gems' };
    }
    return {
      success: true,
      state: { ...state, gems: state.gems - cost.gems, businessUpgrades: upgradedBusinessUpgrades },
    };
  }
  if (state.balance < cost.coins) {
    return { success: false, state, error: 'Insufficient balance' };
  }
  const tokenBalance = state.tokens?.[floorType] ?? 0;
  if (tokenBalance < cost.tokens) {
    return { success: false, state, error: 'Insufficient tokens' };
  }
  return {
    success: true,
    state: {
      ...state,
      balance: state.balance - cost.coins,
      tokens: { ...state.tokens, [floorType]: tokenBalance - cost.tokens },
      businessUpgrades: upgradedBusinessUpgrades,
    },
  };
}
```

- [ ] **Step 4: Wire handler into the `processCommand` switch**

In the main `processCommand` function switch, add before the lobby command cases:

```ts
case 'upgrade_business_category':
  return handleUpgradeBusinessCategory(state, command);
```

- [ ] **Step 5: Add category bonus to `handleCollect`**

In `handleCollect` (around line 551), replace:

```ts
const floorType = resolveFloorType(state, config, floorId);
const workerMultiplier = getRevenueMultiplier(worker, floorType, production.typeId);
const specialistBonusPercent = Math.round(getFloorSpecialistBonus(state.workers, floorId) * 100);

const coinMultiplier = 1 + (bonuses.coinPercent + specialistBonusPercent) / 100;
```

with:

```ts
const floorType = resolveFloorType(state, config, floorId);
const workerMultiplier = getRevenueMultiplier(worker, floorType, production.typeId);
const specialistBonusPercent = Math.round(getFloorSpecialistBonus(state.workers, floorId) * 100);
const categoryBonus = (state.businessUpgrades?.[floorType] ?? 0) * 5;

const coinMultiplier = 1 + (bonuses.coinPercent + specialistBonusPercent + categoryBonus) / 100;
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx jest shared/engine/__tests__/processCommand.test.ts --no-coverage
```
Expected: all tests PASS

- [ ] **Step 7: Run full suite**

```bash
npx jest --no-coverage
```
Expected: all tests PASS

- [ ] **Step 8: Commit**

```bash
git add shared/engine/processCommand.ts shared/engine/__tests__/processCommand.test.ts
git commit -m "feat: add upgrade_business_category handler and category profit bonus in handleCollect"
```

---

### Task 3: gameStore integration

**Files:**
- Modify: `src/stores/gameStore.ts`

**Interfaces:**
- Consumes: `handleUpgradeBusinessCategory` via `executeCommand` → `processCommand`
- Produces: `upgradeBusinessCategory(floorType: 'green'|'blue'|'yellow'|'purple'|'red'): void` action on `useGameStore`

- [ ] **Step 1: Add `businessUpgrades` to `GameStore` state fields**

In `src/stores/gameStore.ts`, find the `GameState` fields that are spread into the store. The store already spreads `createInitialState(gameConfig)` which now includes `businessUpgrades` from the schema default. No extra initial value needed — it comes through automatically.

- [ ] **Step 2: Add `upgradeBusinessCategory` to the `GameActions` interface**

In the `GameActions` interface (around line 77), add:

```ts
upgradeBusinessCategory: (floorType: 'green' | 'blue' | 'yellow' | 'purple' | 'red') => void;
```

- [ ] **Step 3: Add `businessUpgrades` to the `executeCommand` state extraction**

In the `executeCommand` function (around line 148), add `businessUpgrades` to the destructure:

```ts
const { balance, gems, floors, commandQueue, workers, hotelCapacity,
  lobbyVisitors, lobbyCapacity, elevatorLevel, elevatorFloor,
  dailyTips, dailyGemsCollected, dailyTipsStage1Claimed, dailyTipsStage2Claimed, lastDailyReset, nextVisitorAt,
  tools, underConstruction, openedFloorTypes, stats, dailyFillLobbyUses,
  coinBonusPercent, xpBonusPercent, tokens, dailyTasks, businessUpgrades,
} = store;
let gameState: GameState = {
  balance, gems, floors, commandQueue, workers, hotelCapacity,
  lobbyVisitors, lobbyCapacity, elevatorLevel, elevatorFloor,
  dailyTips, dailyGemsCollected, dailyTipsStage1Claimed, dailyTipsStage2Claimed, lastDailyReset, nextVisitorAt,
  tools, underConstruction, openedFloorTypes, stats, dailyFillLobbyUses,
  coinBonusPercent, xpBonusPercent, tokens, dailyTasks, businessUpgrades,
};
```

- [ ] **Step 4: Add `upgradeBusinessCategory` action in the store**

After `devAddGems`, add:

```ts
upgradeBusinessCategory: (floorType) => {
  executeCommand(get, set, {
    id: uuid(),
    type: 'upgrade_business_category',
    floorType,
    timestamp: clock.now(),
  });
},
```

- [ ] **Step 5: Update `hydrate` to handle `businessUpgrades`**

In the `hydrate` action (around line 780 where other fields are hydrated), add:

```ts
businessUpgrades: state.businessUpgrades ?? { green: 0, blue: 0, yellow: 0, purple: 0, red: 0 },
```

- [ ] **Step 6: Update `reconcile` to pass through `businessUpgrades`**

In the `reconcile` action (around line 891 after `tokens`), add:

```ts
businessUpgrades: serverState.businessUpgrades ?? { green: 0, blue: 0, yellow: 0, purple: 0, red: 0 },
```

- [ ] **Step 7: Run full test suite**

```bash
npx jest --no-coverage
```
Expected: all tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat: add upgradeBusinessCategory action to gameStore"
```

---

### Task 4: i18n strings

**Files:**
- Modify: `src/i18n/locales/en/hotel.json`

**Interfaces:**
- Produces: `t('hotel:myBusiness.title')` and related keys available via `useTranslation('hotel')`

- [ ] **Step 1: Add `myBusiness` section to `hotel.json`**

Open `src/i18n/locales/en/hotel.json` and add the following as a new top-level key (alongside existing keys like `floorCard`, `workerCard`, etc.):

```json
"myBusiness": {
  "title": "My Business",
  "subtitle": "Upgrade categories to increase profit on floors",
  "upgrade": "Upgrade",
  "maxLevel": "Max level",
  "profitBonus": "+{{percent}}% Profit",
  "floorCount_one": "{{count}} floor",
  "floorCount_other": "{{count}} floors",
  "level": "Level {{level}}",
  "noBonus": "+0% Profit",
  "costCoins": "{{coins}} coins",
  "costTokens": "{{tokens}} tokens",
  "costGems": "{{gems}} gems",
  "tokenBalance": "{{count}} tokens",
  "categories": {
    "green": "Quality",
    "blue": "Service",
    "yellow": "Entertainment",
    "purple": "Exclusiveness",
    "red": "Warranty"
  },
  "tokenLabels": {
    "green": "Food tokens",
    "blue": "Service tokens",
    "yellow": "Entertainment tokens",
    "purple": "Fashion tokens",
    "red": "Tech tokens"
  }
}
```

- [ ] **Step 2: Run i18n key existence test**

```bash
npx jest src/i18n/__tests__/keysExist.test.ts --no-coverage
```
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales/en/hotel.json
git commit -m "feat: add myBusiness i18n keys to hotel.json"
```

---

### Task 5: Profile button + My Business list screen

**Files:**
- Modify: `app/(tabs)/profile.tsx`
- Create: `app/my-business.tsx`

**Interfaces:**
- Consumes:
  - `useGameStore` selectors: `balance`, `gems`, `tokens`, `businessUpgrades`, `floors`, `openedFloorTypes`
  - `BUSINESS_UPGRADE_COSTS` from `shared/config/businessUpgradeCosts.ts`
  - `useTranslation('hotel')` for `myBusiness.*` keys
- Produces: navigable screen at `/my-business`; tapping a category card navigates to `/my-business/green` (etc.)

- [ ] **Step 1: Add "My Business" button to profile screen**

In `app/(tabs)/profile.tsx`, after the `router.push('/referrals')` Pressable and before the `router.push('/daily-tasks')` Pressable, add:

```tsx
<Pressable
  onPress={() => router.push('/my-business')}
  style={({ pressed }) => [styles.achievementsButton, pressed && styles.achievementsButtonPressed]}
>
  <Image source={require('../../assets/img/profile/achivProfileIcon.png')} style={styles.achievementsIcon} />
  <Text style={styles.achievementsButtonText}>{tHotel('myBusiness.title')}</Text>
</Pressable>
```

(Reuse `achivProfileIcon.png` as a placeholder — it can be swapped for a business icon later.)

- [ ] **Step 2: Create `app/my-business.tsx`**

```tsx
import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ImageBackground } from 'react-native';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../src/stores/gameStore';
import { gameConfig } from '../shared/config/gameConfig';
import { BUSINESS_UPGRADE_COSTS } from '../shared/config/businessUpgradeCosts';
import { formatNum } from '../src/utils/format';
import { CoinIcon, GemIcon } from '../src/components/CurrencyIcons';

const FLOOR_TYPES = ['green', 'blue', 'yellow', 'purple', 'red'] as const;
type FloorType = typeof FLOOR_TYPES[number];

const TYPE_COLORS: Record<FloorType, string> = {
  green:  '#3FA535',
  blue:   '#3376E5',
  yellow: '#E5A72E',
  purple: '#9A6FD0',
  red:    '#E05A4A',
};

export default function MyBusinessScreen() {
  const { t: tHotel } = useTranslation('hotel');
  const balance       = useGameStore((s) => s.balance);
  const gems          = useGameStore((s) => s.gems);
  const tokens        = useGameStore((s) => s.tokens);
  const businessUpgrades = useGameStore((s) => s.businessUpgrades);
  const floors        = useGameStore((s) => s.floors);
  const openedFloorTypes = useGameStore((s) => s.openedFloorTypes);

  function floorCountForType(ft: FloorType): number {
    const staticCount = gameConfig.floors.filter((f) => f.floorType === ft && floors.some((sf) => sf.id === f.id)).length;
    const dynamicCount = Object.entries(openedFloorTypes).filter(([, t]) => t === ft).length;
    return staticCount + dynamicCount;
  }

  return (
    <ImageBackground
      source={require('../assets/img/backgroung/bg15.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>{'‹'}</Text>
          </Pressable>
          <Text style={styles.title}>{tHotel('myBusiness.title')}</Text>
        </View>

        <Text style={styles.subtitle}>{tHotel('myBusiness.subtitle')}</Text>

        <View style={styles.balanceRow}>
          <CoinIcon size={16} />
          <Text style={styles.balanceText}>{formatNum(balance)}</Text>
          <GemIcon size={14} />
          <Text style={styles.balanceTextGem}>{formatNum(gems)}</Text>
        </View>

        {FLOOR_TYPES.map((ft) => {
          const level = businessUpgrades?.[ft] ?? 0;
          const tokenBal = tokens?.[ft] ?? 0;
          const count = floorCountForType(ft);
          const nextCost = level < 40 ? BUSINESS_UPGRADE_COSTS[level] : null;
          const color = TYPE_COLORS[ft];

          return (
            <Pressable
              key={ft}
              onPress={() => router.push(`/my-business/${ft}`)}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              <View style={[styles.colorBar, { backgroundColor: color }]} />
              <View style={styles.cardContent}>
                <View style={styles.cardRow}>
                  <Text style={styles.categoryName}>{tHotel(`myBusiness.categories.${ft}`)}</Text>
                  <Text style={[styles.bonus, { color }]}>
                    {level >= 40 ? tHotel('myBusiness.maxLevel') : tHotel('myBusiness.profitBonus', { percent: level * 5 })}
                  </Text>
                </View>

                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${(level / 40) * 100}%`, backgroundColor: color }]} />
                </View>

                <View style={styles.cardRow}>
                  <Text style={styles.meta}>{tHotel('myBusiness.floorCount', { count })}</Text>
                  <Text style={styles.meta}>{tHotel('myBusiness.tokenBalance', { count: tokenBal })} {tHotel(`myBusiness.tokenLabels.${ft}`)}</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: 60, marginHorizontal: 20, gap: 12 },
  backBtn: { padding: 4 },
  backText: { fontSize: 28, color: '#27331F', fontFamily: 'Fredoka_600SemiBold', lineHeight: 32 },
  title: { fontFamily: 'Fredoka_700Bold', fontSize: 24, color: '#27331F' },
  subtitle: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: '#7C8A6E', marginHorizontal: 20, marginTop: 6 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 20, marginTop: 12 },
  balanceText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15, color: '#C28A22', marginRight: 8 },
  balanceTextGem: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15, color: '#2592AB' },
  card: {
    marginHorizontal: 20, marginTop: 12, backgroundColor: '#fff', borderRadius: 18,
    flexDirection: 'row', overflow: 'hidden',
    shadowColor: 'rgba(60,80,45,1)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  cardPressed: { opacity: 0.8 },
  colorBar: { width: 6 },
  cardContent: { flex: 1, padding: 16, gap: 10 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryName: { fontFamily: 'Fredoka_600SemiBold', fontSize: 18, color: '#27331F' },
  bonus: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16 },
  progressBarBg: { height: 6, borderRadius: 3, backgroundColor: 'rgba(60,120,40,0.12)', overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
  meta: { fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: '#7C8A6E' },
});
```

- [ ] **Step 3: Run full test suite (no UI test needed — check TS compiles)**

```bash
npx jest --no-coverage
```
Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add app/my-business.tsx app/(tabs)/profile.tsx
git commit -m "feat: add My Business list screen and profile nav button"
```

---

### Task 6: My Business category detail screen

**Files:**
- Create: `app/my-business/[category].tsx`

**Interfaces:**
- Consumes:
  - `useLocalSearchParams` from expo-router to read `category` param
  - `useGameStore` selectors: `balance`, `gems`, `tokens`, `businessUpgrades`, `floors`, `openedFloorTypes`, `upgradeBusinessCategory`
  - `BUSINESS_UPGRADE_COSTS[level]` for next-level cost
  - `useTranslation('hotel')` for `myBusiness.*` keys
- Produces: upgrade UI at `/my-business/green` etc. Pressing "Upgrade" calls `upgradeBusinessCategory(ft)`

- [ ] **Step 1: Create directory and file**

Create `app/my-business/[category].tsx`:

```tsx
import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ImageBackground } from 'react-native';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../../src/stores/gameStore';
import { gameConfig } from '../../shared/config/gameConfig';
import { BUSINESS_UPGRADE_COSTS } from '../../shared/config/businessUpgradeCosts';
import { formatNum } from '../../src/utils/format';
import { CoinIcon, GemIcon } from '../../src/components/CurrencyIcons';

type FloorType = 'green' | 'blue' | 'yellow' | 'purple' | 'red';
const VALID_TYPES = new Set<string>(['green', 'blue', 'yellow', 'purple', 'red']);

const TYPE_COLORS: Record<FloorType, string> = {
  green:  '#3FA535',
  blue:   '#3376E5',
  yellow: '#E5A72E',
  purple: '#9A6FD0',
  red:    '#E05A4A',
};

export default function BusinessCategoryScreen() {
  const { t: tHotel } = useTranslation('hotel');
  const { category } = useLocalSearchParams<{ category: string }>();
  const ft = VALID_TYPES.has(category ?? '') ? (category as FloorType) : 'green';

  const balance          = useGameStore((s) => s.balance);
  const gems             = useGameStore((s) => s.gems);
  const tokens           = useGameStore((s) => s.tokens);
  const businessUpgrades = useGameStore((s) => s.businessUpgrades);
  const floors           = useGameStore((s) => s.floors);
  const openedFloorTypes = useGameStore((s) => s.openedFloorTypes);
  const upgradeBusinessCategory = useGameStore((s) => s.upgradeBusinessCategory);

  const level     = businessUpgrades?.[ft] ?? 0;
  const tokenBal  = tokens?.[ft] ?? 0;
  const color     = TYPE_COLORS[ft];
  const isMaxed   = level >= 40;
  const nextCost  = !isMaxed ? BUSINESS_UPGRADE_COSTS[level] : null;

  const canAfford = !isMaxed && nextCost != null && (
    nextCost.kind === 'gems'
      ? gems >= nextCost.gems
      : balance >= nextCost.coins && tokenBal >= nextCost.tokens
  );

  function builtFloorsOfType(): { id: number; name: string }[] {
    const result: { id: number; name: string }[] = [];
    for (const floor of gameConfig.floors) {
      if (floor.floorType === ft && floors.some((f) => f.id === floor.id)) {
        const businesses = gameConfig.floorTypes[ft]?.businesses ?? [];
        const tier = gameConfig.floors
          .filter((f) => f.floorType === ft && floors.some((sf) => sf.id === f.id))
          .indexOf(floor);
        result.push({ id: floor.id, name: businesses[tier]?.name ?? `Floor ${floor.id}` });
      }
    }
    for (const [idStr, type] of Object.entries(openedFloorTypes)) {
      if (type === ft) {
        const id = Number(idStr);
        const tier = Object.entries(openedFloorTypes).filter(([, t]) => t === ft).map(([k]) => Number(k)).sort((a, b) => a - b).indexOf(id);
        const businesses = gameConfig.floorTypes[ft]?.businesses ?? [];
        result.push({ id, name: businesses[tier]?.name ?? `Floor ${id}` });
      }
    }
    return result;
  }

  const builtFloors = builtFloorsOfType();

  function renderCost() {
    if (!nextCost) return null;
    if (nextCost.kind === 'gems') {
      return (
        <View style={styles.costRow}>
          <GemIcon size={16} />
          <Text style={[styles.costText, !canAfford && styles.costInsufficient]}>
            {formatNum(nextCost.gems)} {tHotel('myBusiness.costGems', { gems: '' }).trim()}
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.costRow}>
        <CoinIcon size={16} />
        <Text style={[styles.costText, balance < nextCost.coins && styles.costInsufficient]}>
          {formatNum(nextCost.coins)}
        </Text>
        <Text style={styles.costSep}>+</Text>
        <Text style={[styles.costText, tokenBal < nextCost.tokens && styles.costInsufficient]}>
          {nextCost.tokens} {tHotel(`myBusiness.tokenLabels.${ft}`)}
        </Text>
      </View>
    );
  }

  return (
    <ImageBackground
      source={require('../../assets/img/backgroung/bg15.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>{'‹'}</Text>
          </Pressable>
          <Text style={[styles.title, { color }]}>{tHotel(`myBusiness.categories.${ft}`)}</Text>
        </View>

        {/* Level + progress */}
        <View style={styles.card}>
          <Text style={styles.levelText}>{tHotel('myBusiness.level', { level })}</Text>
          <Text style={[styles.bonusText, { color }]}>
            {isMaxed ? tHotel('myBusiness.maxLevel') : tHotel('myBusiness.profitBonus', { percent: level * 5 })}
          </Text>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${(level / 40) * 100}%`, backgroundColor: color }]} />
          </View>
          <Text style={styles.progressLabel}>{level} / 40</Text>
        </View>

        {/* Balance */}
        <View style={styles.balanceCard}>
          <CoinIcon size={16} />
          <Text style={styles.balanceCoin}>{formatNum(balance)}</Text>
          <GemIcon size={14} />
          <Text style={styles.balanceGem}>{formatNum(gems)}</Text>
          <Text style={styles.balanceToken}>
            {tHotel(`myBusiness.tokenLabels.${ft}`)}: {formatNum(tokenBal)}
          </Text>
        </View>

        {/* Upgrade button */}
        <View style={styles.upgradeSection}>
          {renderCost()}
          <Pressable
            onPress={() => !isMaxed && canAfford && upgradeBusinessCategory(ft)}
            style={({ pressed }) => [
              styles.upgradeBtn,
              { backgroundColor: color },
              (!canAfford || isMaxed) && styles.upgradeBtnDisabled,
              pressed && canAfford && !isMaxed && styles.upgradeBtnPressed,
            ]}
            disabled={isMaxed || !canAfford}
          >
            <Text style={styles.upgradeBtnText}>
              {isMaxed ? tHotel('myBusiness.maxLevel') : tHotel('myBusiness.upgrade')}
            </Text>
          </Pressable>
        </View>

        {/* Floor list */}
        {builtFloors.length > 0 && (
          <View style={styles.floorSection}>
            <Text style={styles.floorSectionTitle}>
              {tHotel('myBusiness.floorCount', { count: builtFloors.length })}
            </Text>
            {builtFloors.map(({ id, name }) => (
              <View key={id} style={styles.floorRow}>
                <View style={[styles.floorDot, { backgroundColor: color }]} />
                <Text style={styles.floorName}>{name}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: 60, marginHorizontal: 20, gap: 12 },
  backBtn: { padding: 4 },
  backText: { fontSize: 28, color: '#27331F', fontFamily: 'Fredoka_600SemiBold', lineHeight: 32 },
  title: { fontFamily: 'Fredoka_700Bold', fontSize: 24 },
  card: {
    margin: 20, backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', gap: 10,
    shadowColor: 'rgba(60,80,45,1)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  levelText: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: '#7C8A6E', textTransform: 'uppercase', letterSpacing: 0.5 },
  bonusText: { fontFamily: 'Fredoka_700Bold', fontSize: 32 },
  progressBg: { width: '100%', height: 8, borderRadius: 4, backgroundColor: 'rgba(60,120,40,0.12)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressLabel: { fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: '#9BA3B0' },
  balanceCard: {
    marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 16, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    shadowColor: 'rgba(60,80,45,1)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  balanceCoin: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15, color: '#C28A22', marginRight: 6 },
  balanceGem:  { fontFamily: 'Fredoka_600SemiBold', fontSize: 15, color: '#2592AB', marginRight: 6 },
  balanceToken:{ fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: '#7C8A6E', flex: 1, textAlign: 'right' },
  upgradeSection: { marginHorizontal: 20, marginTop: 16, gap: 10 },
  costRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  costText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16, color: '#27331F' },
  costInsufficient: { color: '#C0372A' },
  costSep: { fontFamily: 'Nunito_600SemiBold', fontSize: 14, color: '#7C8A6E' },
  upgradeBtn: { borderRadius: 16, padding: 16, alignItems: 'center' },
  upgradeBtnDisabled: { opacity: 0.4 },
  upgradeBtnPressed: { opacity: 0.85 },
  upgradeBtnText: { fontFamily: 'Fredoka_700Bold', fontSize: 18, color: '#fff' },
  floorSection: { marginHorizontal: 20, marginTop: 20, gap: 8 },
  floorSectionTitle: { fontFamily: 'Nunito_600SemiBold', fontSize: 11, color: '#9BA3B0', textTransform: 'uppercase', letterSpacing: 0.5 },
  floorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F0EDE5' },
  floorDot: { width: 8, height: 8, borderRadius: 4 },
  floorName: { fontFamily: 'Nunito_600SemiBold', fontSize: 15, color: '#27331F' },
});
```

- [ ] **Step 2: Run full test suite**

```bash
npx jest --no-coverage
```
Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add app/my-business/[category].tsx
git commit -m "feat: add My Business category detail screen with upgrade button"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Cost table (40 levels) ✓ · schema `businessUpgrades` ✓ · command `upgrade_business_category` ✓ · profit integration in `handleCollect` ✓ · list screen with token balance ✓ · detail screen with upgrade button + floor list ✓ · i18n keys ✓ · profile nav button ✓
- [x] **Placeholders:** None — all code blocks are complete implementations
- [x] **Type consistency:** `FloorType` used identically across tasks · `BUSINESS_UPGRADE_COSTS[level]` indexing consistent (0-based, level = current level before upgrade) · `businessUpgrades` key name consistent in schema, store, and screens
- [x] **Hydrate + reconcile:** Both updated in Task 3 to pass `businessUpgrades` through
- [x] **executeCommand extraction:** `businessUpgrades` added to destructure in Task 3
