# GlobalOverlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all 8 notification modals into a single `GlobalOverlay` component rendered above all navigation, eliminating modal-blocking bugs caused by NativeTabs keeping tab screens mounted.

**Architecture:** A new `GlobalOverlay` component is rendered directly inside `GestureHandlerRootView` after `<Stack>`, using `StyleSheet.absoluteFill` with `pointerEvents="box-none"`. Three local-state modals are migrated to Zustand store. `claimDailyTask` changes from a return-value API to a fire-and-forget store setter. `deliverAll` computes and stores the summary instead of relying on LobbyPanel to compute it.

**Tech Stack:** React Native, Expo Router, Zustand (gameStore), react-native-reanimated

## Global Constraints

- Never add `set()` calls outside of `executeCommand` for game-state fields (balance, floors, workers, etc.) — only UIState fields are safe to set directly
- All new store state must be initialized in the default values block (`create<GameStore>((set, get) => ({ ... }))`), not just in the interface
- Animated modal components use `react-native-reanimated` (not `Animated` from react-native)
- All new components follow the same file structure as existing modals

---

### Task 1: Extend gameStore — new UIState + actions + refactor claimDailyTask + deliverAll

**Files:**
- Modify: `src/stores/gameStore.ts`
- Modify: `src/components/DeliverAllModal.tsx` (change type import source)

**Interfaces:**
- Produces:
  - `export type DeliverAllSummary` from gameStore.ts
  - `showTokenInsufficient(payload: { floorType: 'green'|'blue'|'yellow'|'purple'|'red'; have: number; need: number }) => void`
  - `clearTokenInsufficient() => void`
  - `setTaskReward(payload: PendingTaskReward) => void`
  - `clearTaskReward() => void`
  - `setPendingDeliverAll(summary: DeliverAllSummary) => void`
  - `clearPendingDeliverAll() => void`
  - `claimDailyTask(taskKey: string, taskTitle: string): void` (was `=> {...} | null`)
  - Store state: `tokenInsufficient`, `pendingTaskReward`, `pendingDeliverAll`

- [ ] **Step 1: Add `DeliverAllSummary` type to gameStore.ts and export it**

In `src/stores/gameStore.ts`, after the existing `FailedCommandEntry` type (around line 55), add:

```ts
export type DeliverAllSummary = {
  guestCount: number;
  businessmanCount: number;
  delivererCount: number;
  sellerCount: number;
  builderCount: number;
  totalCoins: number;
  totalGems: number;
  newWorkers: number;
};
```

- [ ] **Step 2: Add `PendingTaskReward` type and extend imports**

Below `DeliverAllSummary`, add:

```ts
export type PendingTaskReward = {
  taskTitle: string;
  coins: number;
  gems: number;
  tokenCount: number;
  tokenColor: string;
  matCount?: number;
  materialType?: string;
};
```

Update the lobbyUtils import (line ~5) to add `calculateTip`:
```ts
import { generateRandomVisitorRole, generateVisitorAppearance, getFillLobbyCost, checkDailyReset, calculateTip } from '../../shared/engine/lobbyUtils';
```

Update the shared types import (line ~10) to add `Visitor`:
```ts
import type { GameState, Command, Floor, Worker, ToolsState, Visitor } from '../../shared/types';
```

- [ ] **Step 3: Add `computeDeliverAllSummary` as a local function**

After the `uuid` function (around line 22), add this function (moved from LobbyPanel.tsx):

```ts
function computeDeliverAllSummary(
  visitors: Visitor[],
  elevatorLevel: number,
  dailyGemsCollected: number,
  playerLevel: number,
): DeliverAllSummary {
  let guestCount = 0, businessmanCount = 0, delivererCount = 0, sellerCount = 0, builderCount = 0;
  let totalCoins = 0, totalGems = 0, newWorkers = 0;
  let gemsCollected = dailyGemsCollected;
  const gemLimit = gameConfig.lobbyConfig.dailyGemLimitBase + playerLevel;

  for (const v of visitors) {
    const role = v.role ?? 'guest';
    const targetFloor = v.targetFloor ?? 1;
    switch (role) {
      case 'guest':
        guestCount++;
        totalCoins += calculateTip('guest', targetFloor, elevatorLevel, gameConfig);
        if (targetFloor === 1) newWorkers++;
        break;
      case 'businessman':
        businessmanCount++;
        if (gemsCollected < gemLimit) {
          totalGems++;
          gemsCollected++;
        } else {
          totalCoins += calculateTip('businessman', targetFloor, elevatorLevel, gameConfig);
        }
        break;
      case 'deliverer':
        delivererCount++;
        totalCoins += calculateTip('deliverer', targetFloor, elevatorLevel, gameConfig);
        break;
      case 'seller':
        sellerCount++;
        totalCoins += calculateTip('seller', targetFloor, elevatorLevel, gameConfig);
        break;
      case 'builder':
        builderCount++;
        break;
    }
  }

  return { guestCount, businessmanCount, delivererCount, sellerCount, builderCount, totalCoins, totalGems, newWorkers };
}
```

- [ ] **Step 4: Extend UIState interface with 3 new fields**

In the `UIState` interface (around line 63), add:

```ts
tokenInsufficient: { floorType: 'green' | 'blue' | 'yellow' | 'purple' | 'red'; have: number; need: number } | null;
pendingTaskReward: PendingTaskReward | null;
pendingDeliverAll: DeliverAllSummary | null;
```

- [ ] **Step 5: Extend GameActions interface with 6 new actions + update claimDailyTask signature**

In the `GameActions` interface, change:
```ts
// OLD:
claimDailyTask: (taskKey: string) => { coins: number; gems: number; tokenCount: number; tokenColor: string; matCount?: number; materialType?: string } | null;
// NEW:
claimDailyTask: (taskKey: string, taskTitle: string) => void;
```

Add these 6 new action signatures anywhere in `GameActions`:
```ts
showTokenInsufficient: (payload: { floorType: 'green' | 'blue' | 'yellow' | 'purple' | 'red'; have: number; need: number }) => void;
clearTokenInsufficient: () => void;
setTaskReward: (payload: PendingTaskReward) => void;
clearTaskReward: () => void;
setPendingDeliverAll: (summary: DeliverAllSummary) => void;
clearPendingDeliverAll: () => void;
```

- [ ] **Step 6: Initialize new fields in the store defaults**

In the `create<GameStore>((set, get) => ({ ...` block, in the UIState defaults section (around line 290 where `pendingDailyLoginReward: null` is set), add:

```ts
tokenInsufficient: null,
pendingTaskReward: null,
pendingDeliverAll: null,
```

- [ ] **Step 7: Implement 6 new actions**

Near the `showInsufficientResources` / `clearInsufficientResources` actions (around line 120 area of the actions block), add:

```ts
showTokenInsufficient: (payload) => set({ tokenInsufficient: payload }),
clearTokenInsufficient: () => set({ tokenInsufficient: null }),
setTaskReward: (payload) => set({ pendingTaskReward: payload }),
clearTaskReward: () => set({ pendingTaskReward: null }),
setPendingDeliverAll: (summary) => set({ pendingDeliverAll: summary }),
clearPendingDeliverAll: () => set({ pendingDeliverAll: null }),
```

- [ ] **Step 8: Refactor `claimDailyTask` — set store state instead of returning**

Find the `claimDailyTask` action (around line 743). Change it from:

```ts
claimDailyTask: (taskKey) => {
  // ... existing logic ...
  return { coins, gems: taskConfig.rewards.gems, tokenCount, tokenColor, matCount, materialType };
},
```

To:

```ts
claimDailyTask: (taskKey, taskTitle) => {
  const COLORS = ['green', 'blue', 'yellow', 'purple', 'red'] as const;
  const MATERIAL_TYPES = ['briks', 'glass', 'nails', 'screw'] as const;
  const taskConfig = DAILY_TASKS.find((t) => t.key === taskKey);
  if (!taskConfig) return;
  const state = get();
  const tokenCount = Math.floor(Math.random() * 5) + 1;
  const tokenColor = COLORS[Math.floor(Math.random() * COLORS.length)];
  const materialType = taskConfig.rewards.hasMaterials
    ? (state.dailyTasks.dailyMaterialType ?? MATERIAL_TYPES[Math.floor(Math.random() * MATERIAL_TYPES.length)])
    : undefined;
  const multiplier = getCoinMultiplier(state.playerLevel);
  const doubleMultiplier = state.dailyTasks.doubleRewardActive ? 2 : 1;
  const coins = taskConfig.rewards.baseCoins * multiplier * doubleMultiplier;
  const matCount = taskConfig.rewards.hasMaterials
    ? getMaterialCount(state.playerLevel) * doubleMultiplier
    : undefined;
  executeCommand(get, set, {
    id: uuid(),
    type: 'claim_daily_task',
    taskKey,
    tokenCount,
    tokenColor,
    materialType,
    timestamp: clock.now(),
  });
  set({ pendingTaskReward: { taskTitle, coins, gems: taskConfig.rewards.gems, tokenCount, tokenColor, matCount, materialType } });
},
```

- [ ] **Step 9: Refactor `deliverAll` — compute and store summary**

Find the `deliverAll` action (around line 618). After the `executeCommand(...)` call (after line 655), add:

```ts
const summary = computeDeliverAllSummary(
  state.lobbyVisitors,
  state.elevatorLevel,
  state.dailyGemsCollected,
  state.playerLevel,
);
set({ pendingDeliverAll: summary });
```

Note: `state` is already captured at the top of the action via `const state = get();` (line 619), so it holds the pre-command snapshot — exactly what we need.

- [ ] **Step 10: Update DeliverAllModal.tsx to import type from gameStore**

In `src/components/DeliverAllModal.tsx`:
- Remove the local `export interface DeliverAllSummary { ... }` block (lines 16–25)
- Add import at the top:

```ts
import type { DeliverAllSummary } from '../stores/gameStore';
```

The `DeliverAllModalProps` interface and the rest of the component stay unchanged, but `DeliverAllSummary` is now imported instead of locally defined.

- [ ] **Step 11: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -40
```

Expected: 0 errors related to the new fields. (There will be errors in later tasks about missing imports in callers — those are expected until cleanup tasks run.)

- [ ] **Step 12: Commit**

```bash
git add src/stores/gameStore.ts src/components/DeliverAllModal.tsx
git commit -m "feat: extend gameStore with GlobalOverlay state — tokenInsufficient, pendingTaskReward, pendingDeliverAll"
```

---

### Task 2: Create TokenInsufficientModal component

**Files:**
- Create: `src/components/TokenInsufficientModal.tsx`

**Interfaces:**
- Consumes: `tokenInsufficient`, `clearTokenInsufficient` from gameStore (Task 1)
- Produces: `export default function TokenInsufficientModal()` — no props, self-contained

- [ ] **Step 1: Create the component file**

Create `src/components/TokenInsufficientModal.tsx`:

```tsx
import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';
import { formatNum } from '../utils/format';

const { width: SCREEN_W } = Dimensions.get('window');

type FloorType = 'green' | 'blue' | 'yellow' | 'purple' | 'red';

const TYPE_COLORS: Record<FloorType, string> = {
  green: '#3FA535', blue: '#3376E5', yellow: '#E5A72E', purple: '#9A6FD0', red: '#E05A4A',
};

const TOKEN_ICONS: Record<FloorType, ReturnType<typeof require>> = {
  green:  require('../../assets/img/tokens/tokenGreen.png'),
  blue:   require('../../assets/img/tokens/tokenBlue.png'),
  yellow: require('../../assets/img/tokens/tokenYellow.png'),
  purple: require('../../assets/img/tokens/tokenViolet.png'),
  red:    require('../../assets/img/tokens/tokenRed.png'),
};

export default function TokenInsufficientModal() {
  const { t } = useTranslation('hotel');
  const payload = useGameStore((s) => s.tokenInsufficient);
  const clearTokenInsufficient = useGameStore((s) => s.clearTokenInsufficient);

  const scale   = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (payload) {
      opacity.value = withTiming(1, { duration: 200 });
      scale.value   = withTiming(1, { duration: 350, easing: Easing.out(Easing.back(1.4)) });
    } else {
      opacity.value = 0;
      scale.value   = 0.5;
    }
  }, [payload]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle  = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!payload) return null;

  const ft    = payload.floorType;
  const color = TYPE_COLORS[ft];

  return (
    <Modal visible transparent animationType="none" onRequestClose={clearTokenInsufficient}>
      <Animated.View style={[styles.scrim, scrimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={clearTokenInsufficient} />
        <Animated.View style={[styles.card, cardStyle]}>
          <LinearGradient colors={['#F0F4FA', '#E4EAF2']} style={styles.cardGradient}>

            <View style={styles.iconWrap}>
              <Image source={TOKEN_ICONS[ft]} style={styles.tokenImg} contentFit="contain" />
            </View>

            <Text style={styles.title}>{t('myBusiness.notEnoughTokens')}</Text>

            <View style={styles.deficitCard}>
              <View style={styles.deficitRow}>
                <View style={styles.deficitCell}>
                  <Text style={styles.deficitLabel}>{t('myBusiness.have')}</Text>
                  <View style={styles.deficitValueRow}>
                    <Image source={TOKEN_ICONS[ft]} style={styles.deficitIcon} contentFit="contain" />
                    <Text style={[styles.deficitValue, { color }]}>{formatNum(payload.have)}</Text>
                  </View>
                </View>
                <Text style={styles.arrow}>→</Text>
                <View style={styles.deficitCell}>
                  <Text style={styles.deficitLabel}>{t('myBusiness.need')}</Text>
                  <View style={styles.deficitValueRow}>
                    <Image source={TOKEN_ICONS[ft]} style={styles.deficitIcon} contentFit="contain" />
                    <Text style={[styles.deficitValue, { color }]}>{formatNum(payload.need)}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.missingRow}>
                <Text style={styles.missingLabel}>{t('myBusiness.missing')}:</Text>
                <View style={styles.deficitValueRow}>
                  <Image source={TOKEN_ICONS[ft]} style={styles.deficitIcon} contentFit="contain" />
                  <Text style={styles.missingValue}>{formatNum(payload.need - payload.have)}</Text>
                </View>
              </View>
            </View>

            <Pressable
              onPress={() => { clearTokenInsufficient(); router.replace('/shop'); }}
              style={({ pressed }) => [styles.shopBtn, pressed && { opacity: 0.85 }]}
            >
              <LinearGradient colors={['#52A6E2', '#3B8BCB']} style={styles.shopBtnGradient}>
                <Text style={styles.shopBtnText}>{t('myBusiness.goToShop')}</Text>
              </LinearGradient>
              <View style={styles.shopBtnShadow} />
            </Pressable>

            <Pressable onPress={clearTokenInsufficient} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>{t('myBusiness.cancel')}</Text>
            </Pressable>

          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: SCREEN_W * 0.82,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: 'rgba(0,0,0,1)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  cardGradient: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 24,
    gap: 14,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenImg: { width: 40, height: 40 },
  title: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 20,
    color: '#3D3D3D',
    textAlign: 'center',
  },
  deficitCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  deficitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  deficitCell: { alignItems: 'center', gap: 4 },
  deficitLabel: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 12,
    color: '#9BA3B0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deficitValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deficitIcon: { width: 18, height: 18 },
  deficitValue: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 22,
  },
  arrow: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 20,
    color: '#9BA3B0',
  },
  missingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(100,110,120,0.12)',
  },
  missingLabel: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 14,
    color: '#E05A4A',
  },
  missingValue: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
    color: '#E05A4A',
  },
  shopBtn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  shopBtnGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    zIndex: 1,
  },
  shopBtnText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 17,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  shopBtnShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  closeBtn: {
    paddingVertical: 6,
  },
  closeBtnText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 14,
    color: '#9BA3B0',
  },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | grep TokenInsufficient
```

Expected: no errors for this file.

- [ ] **Step 3: Commit**

```bash
git add src/components/TokenInsufficientModal.tsx
git commit -m "feat: add TokenInsufficientModal connected to gameStore"
```

---

### Task 3: Create TaskRewardModal component

**Files:**
- Create: `src/components/TaskRewardModal.tsx`

**Interfaces:**
- Consumes: `pendingTaskReward`, `clearTaskReward` from gameStore (Task 1)
- Produces: `export default function TaskRewardModal()` — no props, self-contained

- [ ] **Step 1: Create the component file**

Create `src/components/TaskRewardModal.tsx`:

```tsx
import React, { useCallback, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, withSpring, Easing,
} from 'react-native-reanimated';
import { useGameStore } from '../stores/gameStore';
import { formatNum } from '../utils/format';

const { width: SCREEN_W } = Dimensions.get('window');

const TOKEN_COLORS: Record<string, string> = {
  green: '#3FA535', blue: '#3376E5', yellow: '#E5A72E', purple: '#9A6FD0', red: '#E05A4A',
};

const TOKEN_ICONS: Record<string, ReturnType<typeof require>> = {
  green:  require('../../assets/img/tokens/tokenGreen.png'),
  blue:   require('../../assets/img/tokens/tokenBlue.png'),
  yellow: require('../../assets/img/tokens/tokenYellow.png'),
  purple: require('../../assets/img/tokens/tokenViolet.png'),
  red:    require('../../assets/img/tokens/tokenRed.png'),
};

const MATERIAL_ICONS: Record<string, ReturnType<typeof require>> = {
  briks: require('../../assets/img/tools/briks.png'),
  glass: require('../../assets/img/tools/glass.png'),
  nails: require('../../assets/img/tools/nails.png'),
  screw: require('../../assets/img/tools/screw.png'),
};

const COIN_ICON    = require('../../assets/img/coin.png');
const DIAMOND_ICON = require('../../assets/img/diamond.png');

export default function TaskRewardModal() {
  const reward       = useGameStore((s) => s.pendingTaskReward);
  const clearReward  = useGameStore((s) => s.clearTaskReward);

  const scale          = useSharedValue(0.6);
  const rewardsOpacity = useSharedValue(0);
  const rewardsY       = useSharedValue(16);

  const cardStyle    = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const rewardsStyle = useAnimatedStyle(() => ({
    opacity: rewardsOpacity.value,
    transform: [{ translateY: rewardsY.value }],
  }));

  const runIn = useCallback(() => {
    scale.value = 0.6;
    rewardsOpacity.value = 0;
    rewardsY.value = 16;
    scale.value = withSpring(1, { damping: 14, stiffness: 180 });
    rewardsOpacity.value = withDelay(220, withTiming(1, { duration: 260 }));
    rewardsY.value = withDelay(220, withTiming(0, { duration: 280, easing: Easing.out(Easing.back(1.2)) }));
  }, [scale, rewardsOpacity, rewardsY]);

  if (!reward) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={clearReward} onShow={runIn}>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={clearReward} />

        <Animated.View style={[styles.card, cardStyle]}>
          <LinearGradient colors={['#F0FBE8', '#E2F5D0']} style={styles.cardInner}>
            <View style={styles.starsRow}>
              <Text style={[styles.star, styles.starSm]}>★</Text>
              <Text style={[styles.star, styles.starLg]}>★</Text>
              <Text style={[styles.star, styles.starSm]}>★</Text>
            </View>

            <Text style={styles.title}>Task Complete!</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{reward.taskTitle}</Text>

            <Animated.View style={[styles.chipsWrap, rewardsStyle]}>
              <View style={styles.chip}>
                <Image source={COIN_ICON} style={styles.chipIcon} contentFit="contain" />
                <Text style={styles.chipCoins}>+{formatNum(reward.coins)}</Text>
              </View>
              <View style={styles.chip}>
                <Image source={DIAMOND_ICON} style={styles.chipIcon} contentFit="contain" />
                <Text style={styles.chipGems}>+{reward.gems}</Text>
              </View>
              <View style={styles.chip}>
                <Image source={TOKEN_ICONS[reward.tokenColor]} style={styles.chipIcon} contentFit="contain" />
                <Text style={[styles.chipToken, { color: TOKEN_COLORS[reward.tokenColor] }]}>
                  +{reward.tokenCount}
                </Text>
              </View>
              {reward.matCount != null && reward.materialType && (
                <View style={styles.chip}>
                  <Image source={MATERIAL_ICONS[reward.materialType]} style={styles.chipIcon} contentFit="contain" />
                  <Text style={styles.chipMat}>+{reward.matCount}</Text>
                </View>
              )}
            </Animated.View>

            <Pressable
              onPress={clearReward}
              style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
            >
              <LinearGradient colors={['#74D44F', '#5BA63C']} style={styles.btnGradient}>
                <Text style={styles.btnText}>Awesome!</Text>
              </LinearGradient>
              <View style={styles.btnShadow} />
            </Pressable>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: SCREEN_W * 0.80,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: 'rgba(60,120,20,1)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 28,
    elevation: 12,
  },
  cardInner: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 24,
    gap: 8,
  },
  starsRow: { flexDirection: 'row', gap: 4, marginBottom: 2 },
  star: { color: '#F5C842' },
  starSm: { fontSize: 18 },
  starLg: { fontSize: 26 },
  title: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 24,
    color: '#2E6B12',
  },
  subtitle: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 14,
    color: '#5A7A4A',
    textAlign: 'center',
    marginBottom: 4,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: 'rgba(60,80,20,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  chipIcon: { width: 18, height: 18 },
  chipCoins: { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#C28A22' },
  chipGems:  { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#2592AB' },
  chipToken: { fontFamily: 'Fredoka_700Bold', fontSize: 16 },
  chipMat:   { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#7A6050' },
  btn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4,
  },
  btnGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    zIndex: 1,
  },
  btnText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 18,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  btnShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(20,60,0,0.3)',
  },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | grep TaskReward
```

Expected: no errors for this file.

- [ ] **Step 3: Commit**

```bash
git add src/components/TaskRewardModal.tsx
git commit -m "feat: add TaskRewardModal connected to gameStore"
```

---

### Task 4: Create GlobalOverlay component + wire into _layout.tsx

**Files:**
- Create: `src/components/GlobalOverlay.tsx`
- Modify: `app/_layout.tsx`

**Interfaces:**
- Consumes: all 8 modal components + `pendingDeliverAll`, `clearPendingDeliverAll` from store
- Produces: `export default function GlobalOverlay()` — no props

- [ ] **Step 1: Create GlobalOverlay.tsx**

Create `src/components/GlobalOverlay.tsx`:

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import AchievementModal from './AchievementModal';
import LevelUpModal from './LevelUpModal';
import ReferralNotificationModal from './ReferralNotificationModal';
import DailyLoginRewardModal from './DailyLoginRewardModal';
import InsufficientResourcesModal from './InsufficientResourcesModal';
import TokenInsufficientModal from './TokenInsufficientModal';
import TaskRewardModal from './TaskRewardModal';
import DeliverAllModal from './DeliverAllModal';
import { useGameStore } from '../stores/gameStore';

export default function GlobalOverlay() {
  const pendingDeliverAll     = useGameStore((s) => s.pendingDeliverAll);
  const clearPendingDeliverAll = useGameStore((s) => s.clearPendingDeliverAll);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <AchievementModal />
      <LevelUpModal />
      <ReferralNotificationModal />
      <DailyLoginRewardModal />
      <InsufficientResourcesModal />
      <TokenInsufficientModal />
      <TaskRewardModal />
      <DeliverAllModal
        visible={pendingDeliverAll !== null}
        summary={pendingDeliverAll}
        onDismiss={clearPendingDeliverAll}
      />
    </View>
  );
}
```

- [ ] **Step 2: Update _layout.tsx**

In `app/_layout.tsx`:

Remove:
```tsx
import DailyLoginRewardModal from '../src/components/DailyLoginRewardModal';
```

Add:
```tsx
import GlobalOverlay from '../src/components/GlobalOverlay';
```

In the JSX, replace:
```tsx
<DailyLoginRewardModal />
```

With:
```tsx
<GlobalOverlay />
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors for GlobalOverlay or _layout.

- [ ] **Step 4: Commit**

```bash
git add src/components/GlobalOverlay.tsx app/_layout.tsx
git commit -m "feat: add GlobalOverlay and mount it in root layout above all screens"
```

---

### Task 5: Remove modals from game.tsx + clean up LevelUpModal and InsufficientResourcesModal props

**Files:**
- Modify: `app/(tabs)/game.tsx`
- Modify: `src/components/LevelUpModal.tsx`
- Modify: `src/components/InsufficientResourcesModal.tsx`

**Interfaces:**
- `LevelUpModal` loses `suppressWhileOpen` prop entirely
- `InsufficientResourcesModal` loses `asOverlay` prop entirely

- [ ] **Step 1: Remove modal imports and JSX from game.tsx**

In `app/(tabs)/game.tsx`:

Remove these 4 import lines:
```tsx
import LevelUpModal from '../../src/components/LevelUpModal';
import AchievementModal from '../../src/components/AchievementModal';
import ReferralNotificationModal from '../../src/components/ReferralNotificationModal';
import InsufficientResourcesModal from '../../src/components/InsufficientResourcesModal';
```

Remove these 4 JSX lines from the return block (near the bottom of the component, around line 691–694):
```tsx
<LevelUpModal suppressWhileOpen={lobbyOpen || hotelOpen} />
<AchievementModal />
<ReferralNotificationModal />
{!hotelOpen && !lobbyOpen && <InsufficientResourcesModal />}
```

- [ ] **Step 2: Remove `suppressWhileOpen` from LevelUpModal**

In `src/components/LevelUpModal.tsx`, find the function signature:
```tsx
export default function LevelUpModal({ suppressWhileOpen = false }: { suppressWhileOpen?: boolean }) {
```

Change it to:
```tsx
export default function LevelUpModal() {
```

Find the usage of `suppressWhileOpen` inside the component (it will be in the `visible` calculation). Remove the condition that uses it. The modal should simply show when `event !== null`:

Search for any line like `if (suppressWhileOpen) return null;` or `visible={!suppressWhileOpen && event !== null}` — remove the `suppressWhileOpen` part, leaving just the event-based check.

- [ ] **Step 3: Remove `asOverlay` from InsufficientResourcesModal**

In `src/components/InsufficientResourcesModal.tsx`:

Remove the `Props` interface:
```tsx
interface Props {
  asOverlay?: boolean;
}
```

Change the function signature from:
```tsx
export default function InsufficientResourcesModal({ asOverlay = false }: Props = {}) {
```
To:
```tsx
export default function InsufficientResourcesModal() {
```

Find any usage of `asOverlay` inside the component (it may affect z-index or positioning) and remove those conditional branches entirely.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors from game.tsx, LevelUpModal, or InsufficientResourcesModal. There may still be errors from WorkersPanel, HotelPanel, LobbyPanel passing `asOverlay` — those are fixed in Task 6.

- [ ] **Step 5: Commit**

```bash
git add app/\(tabs\)/game.tsx src/components/LevelUpModal.tsx src/components/InsufficientResourcesModal.tsx
git commit -m "refactor: remove modals from game.tsx; drop suppressWhileOpen and asOverlay props"
```

---

### Task 6: Remove modals from WorkersPanel, HotelPanel, LobbyPanel

**Files:**
- Modify: `src/components/WorkersPanel.tsx`
- Modify: `src/components/HotelPanel.tsx`
- Modify: `src/components/LobbyPanel.tsx`

- [ ] **Step 1: Clean up WorkersPanel.tsx**

In `src/components/WorkersPanel.tsx`:

Remove line:
```tsx
import InsufficientResourcesModal from './InsufficientResourcesModal';
```

Find and remove the JSX render (around line 545):
```tsx
<InsufficientResourcesModal asOverlay />
```

Keep `showInsufficientResources` and `clearInsufficientResources` store calls — those are still needed to trigger the modal (which is now in GlobalOverlay).

- [ ] **Step 2: Clean up HotelPanel.tsx**

In `src/components/HotelPanel.tsx`:

Remove line:
```tsx
import InsufficientResourcesModal from './InsufficientResourcesModal';
```

Find and remove the JSX render (around line 384):
```tsx
<InsufficientResourcesModal asOverlay />
```

Keep `showInsufficientResources` and `clearInsufficientResources` store calls.

- [ ] **Step 3: Clean up LobbyPanel.tsx**

In `src/components/LobbyPanel.tsx`:

**Imports to remove:**
```tsx
import DeliverAllModal, { type DeliverAllSummary } from './DeliverAllModal';
import InsufficientResourcesModal from './InsufficientResourcesModal';
```

Add to the existing lobbyUtils import (or as a new import) if `DeliverAllSummary` type is needed — but it shouldn't be since we're removing all local usage of it.

**State to remove** (around line 415):
```tsx
const [deliverSummary, setDeliverSummary] = useState<DeliverAllSummary | null>(null);
```

**Function to remove** — the entire `computeDeliverAllSummary` function (lines 73–118 approximately). Remove the whole function.

**Deliver button handler** — in the `onPress` of the deliver-all button (around line 850), remove:
```tsx
const summary = computeDeliverAllSummary(lobbyVisitors, elevatorLevel, dailyGemsCollected, playerLevel);
// and
setDeliverSummary(summary);
```

The handler should just call `deliverAll()` (with the existing `suppressNewWorkerPopup` setup):
```tsx
onPress={() => {
  if (gems < 1) {
    showInsufficientResources({ currency: 'gems', need: 1, have: gems });
    return;
  }
  suppressNewWorkerPopup.current = true;
  deliverAll();
  suppressNewWorkerPopup.current = false;
}}
```

**JSX to remove** (around line 1233–1239):
```tsx
<DeliverAllModal
  visible={deliverSummary !== null}
  summary={deliverSummary}
  onDismiss={() => setDeliverSummary(null)}
/>

<InsufficientResourcesModal asOverlay />
```

If `calculateTip` was only imported for `computeDeliverAllSummary`, remove it from the import line too. Check line 25 — if `calculateTip` is used elsewhere in LobbyPanel (it is, e.g. for the elevator tip display), keep it. Otherwise remove.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors from the three panel files.

- [ ] **Step 5: Commit**

```bash
git add src/components/WorkersPanel.tsx src/components/HotelPanel.tsx src/components/LobbyPanel.tsx
git commit -m "refactor: remove modal renders from WorkersPanel, HotelPanel, LobbyPanel"
```

---

### Task 7: Remove modals from screens — my-business/[category].tsx and daily-tasks.tsx

**Files:**
- Modify: `app/my-business/[category].tsx`
- Modify: `app/daily-tasks.tsx`

- [ ] **Step 1: Clean up my-business/[category].tsx**

**Imports to remove:**
```tsx
import InsufficientResourcesModal from '../../src/components/InsufficientResourcesModal';
```

**Add import** (for `showTokenInsufficient`):
The component already calls `useGameStore` — just add `showTokenInsufficient` to the selector:
```tsx
const showTokenInsufficient = useGameStore((s) => s.showTokenInsufficient);
```

**State to remove** (around line 48):
```tsx
const [tokenModal, setTokenModal] = useState<{ have: number; need: number } | null>(null);
const tokenModalScale   = useSharedValue(0.5);
const tokenModalOpacity = useSharedValue(0);
```

**useEffect to remove** (lines 52–60 — the tokenModal animation effect):
```tsx
useEffect(() => {
  if (tokenModal) { ... }
}, [tokenModal]);
```

**Animated styles to remove** (lines 62–65):
```tsx
const tokenScrimStyle = useAnimatedStyle(() => ({ opacity: tokenModalOpacity.value }));
const tokenCardStyle  = useAnimatedStyle(() => ({ ... }));
```

**In handleUpgrade** — change `setTokenModal({ have: tokenBal, need: nextCost.tokens })` to:
```tsx
showTokenInsufficient({ floorType: ft, have: tokenBal, need: nextCost.tokens });
```

**JSX to remove** — the entire inline `<Modal visible={tokenModal !== null} ...>` block (lines 181–239) AND the `<InsufficientResourcesModal asOverlay />` on line 240.

**Clean up now-unused imports** — after removing the animation code and Modal, check if `Easing`, `useAnimatedStyle`, `useSharedValue`, `withTiming` are still used in this file. If not (only used for token modal), remove them from the `react-native-reanimated` import. If `useState` is no longer used, remove it too. Check `Modal` from `react-native` — remove if unused.

- [ ] **Step 2: Clean up daily-tasks.tsx**

**Remove `RewardData` type** (lines 65–73):
```tsx
type RewardData = {
  taskTitle: string;
  coins: number;
  gems: number;
  tokenCount: number;
  tokenColor: string;
  matCount?: number;
  materialType?: string;
};
```

**Remove `TaskRewardModal` function component** (lines 84–159 — the entire function definition).

**Remove local state** (line 179):
```tsx
const [reward, setReward] = useState<RewardData | null>(null);
```

**Update `handleClaim`** (lines 181–194). Change from:
```tsx
const handleClaim = useCallback((taskKey: string, taskTitle: string) => {
  const result = claimDailyTask(taskKey);
  if (result) {
    setReward({
      taskTitle,
      coins: result.coins,
      gems: result.gems,
      tokenCount: result.tokenCount,
      tokenColor: result.tokenColor,
      matCount: result.matCount,
      materialType: result.materialType,
    });
  }
}, [claimDailyTask]);
```

To:
```tsx
const handleClaim = useCallback((taskKey: string, taskTitle: string) => {
  claimDailyTask(taskKey, taskTitle);
}, [claimDailyTask]);
```

**Remove TaskRewardModal render** (line 333):
```tsx
<TaskRewardModal reward={reward} onDismiss={() => setReward(null)} />
```

**Clean up now-unused imports** — remove from the `react-native` import: `Modal` (if only used by TaskRewardModal). Remove unused imports from `react-native-reanimated` if any (check which animated values/styles were only in TaskRewardModal). Check if `useState` is still needed (yes — `now` state on line 170 uses it, keep it).

Token/material image requires like `TOKEN_ICONS`, `TOKEN_COLORS`, `MATERIAL_ICONS`, `COIN_ICON`, `DIAMOND_ICON` — these were also used in `TaskRewardModal`. Check if they're used in the screen's own render. If not, remove them.

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/my-business/\[category\].tsx app/daily-tasks.tsx
git commit -m "refactor: remove inline token modal and task reward modal from screens; route through GlobalOverlay"
```

---

### Task 8: Final verification

- [ ] **Step 1: Full TypeScript check**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Run existing tests**

```bash
cd /Users/Apple/IT/tinytower && npx jest --passWithNoTests 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 3: Manual smoke test checklist**

Open the app and verify:
1. **AchievementModal**: trigger an achievement — it appears above all UI, no blocking
2. **LevelUpModal**: level up — modal appears
3. **InsufficientResourcesModal**: try to buy a floor with insufficient coins — modal appears
4. **TokenInsufficientModal**: go to My Business → try to upgrade with insufficient tokens — modal appears with correct color/icon, "Go to Shop" navigates to shop
5. **TaskRewardModal**: claim a completed daily task — reward modal appears
6. **DeliverAllModal**: fill lobby, deliver all — summary modal appears
7. **DailyLoginRewardModal**: log in — reward modal appears (or check store trigger)
8. **Navigate to another tab while a modal would be pending**: confirm it shows correctly above all tabs
9. **Dismiss each modal**: confirm it dismisses cleanly

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: GlobalOverlay complete — all modals routed through single overlay above all screens"
```
