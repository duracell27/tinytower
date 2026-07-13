# Optimistic Achievements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show achievement modals and credit gems immediately when a command crosses a threshold, instead of waiting up to 30 s for server sync.

**Architecture:** A pure `detectOptimisticGrants` function compares old/new stats against `ACHIEVEMENT_CATEGORIES` thresholds. `executeCommand` calls it after `processCommand`, pushes grants to `achievementQueue`, and credits gems immediately. The store tracks `locallyGrantedAchievements: Set<string>` so `sync.ts` can filter duplicates from the server's `newAchievements`. `reconcile` resets the set — after that, `categoryProgress.claimedLevels` from the server is the authority.

**Tech Stack:** TypeScript, Zustand, Jest (ts-jest), React Native / Expo

## Global Constraints

- No changes to `shared/engine/processCommand.ts` or any server code.
- `locallyGrantedAchievements` must NOT be persisted to AsyncStorage — it is ephemeral session state.
- Use relative import paths (not `@shared` alias) to match existing style in `gameStore.ts`.
- Test runner: `npx jest` (Jest + ts-jest, config in `package.json`).

---

### Task 1: `detectOptimisticGrants` pure helper + tests

**Files:**
- Create: `src/utils/detectOptimisticGrants.ts`
- Create: `src/utils/__tests__/detectOptimisticGrants.test.ts`

**Interfaces:**
- Produces: `detectOptimisticGrants(oldStats: Stats, newStats: Stats, categoryProgress: Record<string, CategoryProgressState>, alreadyGranted: Set<string>): NewAchievementGrant[]`

- [ ] **Step 1: Write failing tests**

Create `src/utils/__tests__/detectOptimisticGrants.test.ts`:

```ts
import { detectOptimisticGrants } from '../detectOptimisticGrants';
import type { Stats } from '../../../shared/types';
import type { CategoryProgressState } from '../../../shared/types/achievements';

const base: Stats = { totalBought: 0, totalListed: 0, totalCollected: 0, totalPassengersLifted: 0 };

describe('detectOptimisticGrants', () => {
  it('returns [] when no threshold is crossed', () => {
    const result = detectOptimisticGrants(
      { ...base, totalBought: 5 },
      { ...base, totalBought: 6 },
      {},
      new Set(),
    );
    expect(result).toEqual([]);
  });

  it('fires buy level 1 when totalBought crosses 100', () => {
    const grants = detectOptimisticGrants(
      { ...base, totalBought: 99 },
      { ...base, totalBought: 100 },
      {},
      new Set(),
    );
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({ categoryKey: 'buy', level: 1, gems: 5 });
  });

  it('excludes levels already in categoryProgress.claimedLevels', () => {
    const progress: Record<string, CategoryProgressState> = {
      buy: { progress: 200, currentLevel: 1, claimedLevels: [1] },
    };
    const grants = detectOptimisticGrants(
      { ...base, totalBought: 99 },
      { ...base, totalBought: 100 },
      progress,
      new Set(),
    );
    expect(grants).toHaveLength(0);
  });

  it('excludes levels already in alreadyGranted', () => {
    const grants = detectOptimisticGrants(
      { ...base, totalBought: 99 },
      { ...base, totalBought: 100 },
      {},
      new Set(['buy-1']),
    );
    expect(grants).toHaveLength(0);
  });

  it('fires multiple levels when multiple thresholds crossed in one step', () => {
    // level 1 threshold = 100, level 2 threshold = 500
    const grants = detectOptimisticGrants(
      { ...base, totalBought: 99 },
      { ...base, totalBought: 500 },
      {},
      new Set(),
    );
    expect(grants.map((g) => g.level).sort()).toEqual([1, 2]);
  });

  it('does not re-fire a threshold oldStats already met', () => {
    const grants = detectOptimisticGrants(
      { ...base, totalBought: 100 },
      { ...base, totalBought: 101 },
      {},
      new Set(),
    );
    expect(grants).toHaveLength(0);
  });

  it('fires collect category independently', () => {
    const grants = detectOptimisticGrants(
      { ...base, totalCollected: 99 },
      { ...base, totalCollected: 100 },
      {},
      new Set(),
    );
    expect(grants).toHaveLength(1);
    expect(grants[0].categoryKey).toBe('collect');
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npx jest src/utils/__tests__/detectOptimisticGrants.test.ts --no-coverage
```

Expected: all 7 tests fail with "Cannot find module '../detectOptimisticGrants'".

- [ ] **Step 3: Implement the helper**

Create `src/utils/detectOptimisticGrants.ts`:

```ts
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_GEM_REWARDS,
  ACHIEVEMENT_INCOME_BONUS,
  ACHIEVEMENT_XP_BONUS,
} from '../../shared/config/achievementCategories';
import type { Stats } from '../../shared/types';
import type { CategoryProgressState, NewAchievementGrant } from '../../shared/types/achievements';

export function detectOptimisticGrants(
  oldStats: Stats,
  newStats: Stats,
  categoryProgress: Record<string, CategoryProgressState>,
  alreadyGranted: Set<string>,
): NewAchievementGrant[] {
  const grants: NewAchievementGrant[] = [];

  for (const category of ACHIEVEMENT_CATEGORIES) {
    const oldVal = oldStats[category.stat];
    const newVal = newStats[category.stat];
    if (newVal === oldVal) continue;

    const claimed = new Set<number>(categoryProgress[category.key]?.claimedLevels ?? []);

    for (const { level, threshold, title } of category.levels) {
      const key = `${category.key}-${level}`;
      if (newVal >= threshold && oldVal < threshold && !claimed.has(level) && !alreadyGranted.has(key)) {
        grants.push({
          categoryKey: category.key,
          level,
          title,
          categoryTitle: category.title,
          gems: ACHIEVEMENT_GEM_REWARDS[level] ?? 0,
          incomeBonus: ACHIEVEMENT_INCOME_BONUS[level] ?? 0,
          xpBonus: ACHIEVEMENT_XP_BONUS[level] ?? 0,
        });
      }
    }
  }

  return grants;
}
```

- [ ] **Step 4: Run tests — confirm all 7 pass**

```bash
npx jest src/utils/__tests__/detectOptimisticGrants.test.ts --no-coverage
```

Expected: 7 tests pass, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/utils/detectOptimisticGrants.ts src/utils/__tests__/detectOptimisticGrants.test.ts
git commit -m "feat: add detectOptimisticGrants pure helper"
```

---

### Task 2: Wire optimistic grants into `gameStore`

**Files:**
- Modify: `src/stores/gameStore.ts`

**Interfaces:**
- Consumes: `detectOptimisticGrants` from Task 1
- Produces: store field `locallyGrantedAchievements: Set<string>` (read by Task 3)

- [ ] **Step 1: Add `locallyGrantedAchievements` to `UIState`**

In `src/stores/gameStore.ts`, find the `UIState` interface and add one line:

```ts
// Before (existing interface):
interface UIState {
  insufficientResources: InsufficientResourcesPayload | null;
  builderToolDrop: ToolKey | null;
  achievementQueue: NewAchievementGrant[];
  coinBonusPercent: number;
  xpBonusPercent: number;
  categoryProgress: Record<string, CategoryProgressState>;
}

// After:
interface UIState {
  insufficientResources: InsufficientResourcesPayload | null;
  builderToolDrop: ToolKey | null;
  achievementQueue: NewAchievementGrant[];
  coinBonusPercent: number;
  xpBonusPercent: number;
  categoryProgress: Record<string, CategoryProgressState>;
  locallyGrantedAchievements: Set<string>;
}
```

- [ ] **Step 2: Add import and initialize field**

Add import at the top of the file, alongside the existing imports:

```ts
import { detectOptimisticGrants } from '../utils/detectOptimisticGrants';
```

In `create<GameStore>((set, get) => ({`, find the block that initializes `achievementQueue: [],` and add the new field on the next line:

```ts
achievementQueue: [],
locallyGrantedAchievements: new Set<string>(),
```

- [ ] **Step 3: Update `executeCommand` to detect and apply grants**

In the `executeCommand` function, find this existing line:

```ts
let newGems = result.state.gems + xpResult.bonusGems;
```

Immediately after it, add:

```ts
const optimisticGrants = detectOptimisticGrants(
  stats,
  result.state.stats,
  store.categoryProgress,
  store.locallyGrantedAchievements,
);
if (optimisticGrants.length > 0) {
  newGems += optimisticGrants.reduce((sum, g) => sum + g.gems, 0);
}
```

Then in the `set({...})` call at the end of `executeCommand`, add a conditional spread after `levelUpQueue`:

```ts
set({
  balance: newBalance,
  gems: newGems,
  // ... all existing fields unchanged ...
  levelUpQueue: [...store.levelUpQueue, ...levelUps],
  ...(optimisticGrants.length > 0 ? {
    achievementQueue: [...store.achievementQueue, ...optimisticGrants],
    locallyGrantedAchievements: new Set([
      ...store.locallyGrantedAchievements,
      ...optimisticGrants.map((g) => `${g.categoryKey}-${g.level}`),
    ]),
  } : {}),
});
```

- [ ] **Step 4: Clear `locallyGrantedAchievements` in `reconcile`**

In the `reconcile` action's `set((cur) => ({...}))` call, add one line alongside the existing fields (e.g., after `stats:`):

```ts
locallyGrantedAchievements: new Set<string>(),
```

- [ ] **Step 5: Run full test suite — no regressions**

```bash
npx jest --no-coverage
```

Expected: all tests pass (including the 7 from Task 1).

- [ ] **Step 6: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat: apply optimistic achievement grants in executeCommand"
```

---

### Task 3: Deduplicate server achievements in sync

**Files:**
- Modify: `src/services/sync.ts`

**Interfaces:**
- Consumes: `store.locallyGrantedAchievements: Set<string>` from Task 2
  - `store` is already captured as `const store = useGameStore.getState()` early in `doSync`, before `reconcile` runs. After `reconcile` clears the live Zustand state, `store` still references the pre-reconcile snapshot — so `store.locallyGrantedAchievements` has the correct pre-reconcile keys at filter time.

- [ ] **Step 1: Replace the achievement enqueue block**

In `src/services/sync.ts`, find and replace the existing block:

```ts
if (response.newAchievements && response.newAchievements.length > 0) {
  useGameStore.getState().addAchievements(response.newAchievements);
}
```

With:

```ts
if (response.newAchievements && response.newAchievements.length > 0) {
  const unshown = response.newAchievements.filter(
    (g) => !store.locallyGrantedAchievements.has(`${g.categoryKey}-${g.level}`),
  );
  if (unshown.length > 0) useGameStore.getState().addAchievements(unshown);
}
```

- [ ] **Step 2: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/services/sync.ts
git commit -m "feat: skip already-shown optimistic achievements from sync response"
```

---

## Manual verification

1. Open the app with a fresh or near-threshold account.
2. Trigger the buy action enough times to cross the level-1 threshold (100 total buys).
3. **Expected:** Achievement modal appears immediately on the action that crosses 100 — no 30-second wait.
4. Observe the gem balance — it should increase instantly alongside the modal.
5. Wait for the next sync cycle (~30 s or force by backgrounding/foregrounding the app).
6. **Expected:** The achievement modal does NOT reappear after sync.
