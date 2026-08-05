# Daily Login Reward Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grant players a once-per-day login reward (floors × 3 000 coins + 3 gems) automatically on first sync after midnight, showing a full-screen animated modal.

**Architecture:** The server checks `lastDailyLoginClaimedAt` on each sync; if it's before today's UTC midnight, it grants the reward inside the existing DB transaction (under the Player `FOR UPDATE` lock) and returns `dailyLoginReward: { coins, gems }` in the sync response. The client stores the pending reward in Zustand UIState and renders `DailyLoginRewardModal` globally from `_layout.tsx`.

**Tech Stack:** NestJS + Prisma (PostgreSQL) on the server; React Native (Expo), Zustand, react-native-reanimated, expo-linear-gradient on the client.

## Global Constraints

- Reward formula: `player.floors.length × 3 000` coins + `3` gems — floor count is always the DB value before command processing.
- Day boundary: server-local midnight via `new Date(serverNow)` with `setHours(0,0,0,0)` — same convention as `getMidnightBefore` in `shared/engine/lobbyUtils.ts`.
- Deduplication is server-authoritative; the `lastDailyLoginClaimedAt` re-read inside the transaction (after `FOR UPDATE` serializes concurrent requests) is the authoritative guard.
- Modal style follows `LevelUpModal.tsx` exactly (scale + delayed-rewards animation, LinearGradient card, Pressable dismiss, Fredoka fonts).
- i18n namespace: `hotel`, keys under `dailyLoginReward.*`.

---

### Task 1: Prisma Schema Migration

**Files:**
- Modify: `server/prisma/schema.prisma`
- Creates: `server/prisma/migrations/<timestamp>_add_daily_login_claimed_at/`

**Interfaces:**
- Produces: `PlayerState.lastDailyLoginClaimedAt: BigInt` readable via `player.state?.lastDailyLoginClaimedAt` in sync service.

- [ ] **Step 1: Add field to PlayerState model**

In `server/prisma/schema.prisma`, find the `model PlayerState` block and add one line after `dailyFillLobbyUses`:

```prisma
model PlayerState {
  playerId               String  @id
  gems                   Int     @default(20)
  lobbyCapacity          Int     @default(10)
  hotelCapacity          Int     @default(10)
  elevatorLevel          Int     @default(1)
  elevatorFloor          Int     @default(0)
  dailyTips              Float   @default(0)
  dailyGemsCollected     Int     @default(0)
  dailyTipsRewardClaimed Boolean @default(false)
  dailyTipsStage2Claimed Boolean @default(false)
  dailyFillLobbyUses     Int     @default(0)
  lastDailyLoginClaimedAt BigInt  @default(0)
  lastDailyReset         BigInt  @default(0)
  coinBonusPercent       Int     @default(0)
  xpBonusPercent         Int     @default(0)
  nextVisitorAt          BigInt  @default(0)
  briks                  Int     @default(1)
  glass                  Int     @default(1)
  nails                  Int     @default(1)
  screw                  Int     @default(1)
  lobbyVisitors          Json    @default("[]")
  player                 Player  @relation(fields: [playerId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Run migration**

```bash
cd /Users/Apple/IT/tinytower/server
npx prisma migrate dev --name add_daily_login_claimed_at
```

Expected output ends with:
```
✔  Generated Prisma Client
```

- [ ] **Step 3: Verify generated client has the field**

```bash
grep -n "lastDailyLoginClaimedAt" /Users/Apple/IT/tinytower/server/node_modules/.prisma/client/index.d.ts | head -5
```

Expected: at least one match showing the field on the `PlayerState` type.

- [ ] **Step 4: Commit**

```bash
cd /Users/Apple/IT/tinytower
git add server/prisma/schema.prisma server/prisma/migrations/
git commit -m "feat: add lastDailyLoginClaimedAt to PlayerState for daily login reward"
```

---

### Task 2: Server — Grant Reward in Sync + Tests

**Files:**
- Modify: `server/src/sync/sync.service.ts`
- Modify: `server/src/sync/__tests__/sync.service.spec.ts`

**Interfaces:**
- Consumes: `PlayerState.lastDailyLoginClaimedAt` (from Task 1)
- Produces: `SyncResult.dailyLoginReward: { coins: number; gems: number } | null` — consumed by Task 4

- [ ] **Step 1: Write failing tests**

In `server/src/sync/__tests__/sync.service.spec.ts`:

1. Add `findUnique: jest.fn()` to `txMock.playerState` in `beforeEach` so it returns "already claimed today" by default (prevents existing tests from unexpectedly receiving a reward):

```ts
// In beforeEach, change txMock.playerState to:
playerState: {
  upsert: jest.fn().mockResolvedValue({}),
  update: jest.fn().mockResolvedValue({}),
  findUnique: jest.fn().mockResolvedValue({ lastDailyLoginClaimedAt: BigInt(Date.now()) }),
},
```

2. Add two new test cases at the end of the `describe('processSync')` block:

```ts
it('should grant daily login reward when lastDailyLoginClaimedAt is 0', async () => {
  const playerWithNoState = {
    ...mockPlayer,
    state: null,
  };
  prisma.player.findUnique
    .mockResolvedValueOnce(playerWithNoState)
    .mockResolvedValueOnce({ ...playerWithNoState, stateVersion: 1 });

  // Override txMock: simulate no prior claim
  txMock.playerState.findUnique.mockResolvedValueOnce({ lastDailyLoginClaimedAt: BigInt(0) });

  const result = await syncService.processSync('player-uuid', [], 0);

  const expectedCoins = mockFloors.length * 3000; // 5 floors × 3000 = 15000
  expect(result.dailyLoginReward).toEqual({ coins: expectedCoins, gems: 3 });
  expect(result.state.balance).toBe(100 + expectedCoins);
  expect(result.state.gems).toBe(20 + 3); // default gems + 3
});

it('should not grant daily login reward when already claimed today', async () => {
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const claimedAt = BigInt(todayMidnight.getTime() + 1000); // claimed after midnight = today

  const playerWithTodayClaim = {
    ...mockPlayer,
    state: {
      playerId: 'player-uuid',
      gems: 20,
      lobbyCapacity: 10,
      hotelCapacity: 10,
      elevatorLevel: 1,
      elevatorFloor: 0,
      dailyTips: 0,
      dailyGemsCollected: 0,
      dailyTipsRewardClaimed: false,
      dailyTipsStage2Claimed: false,
      dailyFillLobbyUses: 0,
      lastDailyLoginClaimedAt: claimedAt,
      lastDailyReset: BigInt(0),
      coinBonusPercent: 0,
      xpBonusPercent: 0,
      nextVisitorAt: BigInt(0),
      briks: 1,
      glass: 1,
      nails: 1,
      screw: 1,
      lobbyVisitors: [],
    },
  };
  prisma.player.findUnique
    .mockResolvedValueOnce(playerWithTodayClaim)
    .mockResolvedValueOnce({ ...playerWithTodayClaim, stateVersion: 1 });

  const result = await syncService.processSync('player-uuid', [], 0);

  expect(result.dailyLoginReward).toBeNull();
  expect(result.state.balance).toBe(100); // no change
  expect(result.state.gems).toBe(20);     // no change
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/Apple/IT/tinytower/server
npx jest sync.service.spec --no-coverage 2>&1 | tail -30
```

Expected: the two new tests fail ("Cannot read properties of undefined" or type errors on `result.dailyLoginReward`). Existing tests may also fail because `txMock.playerState` is missing `findUnique`.

- [ ] **Step 3: Implement server logic**

In `server/src/sync/sync.service.ts`:

**3a. Add `dailyLoginReward` to `SyncResult` interface** (around line 13):

```ts
export interface SyncResult {
  state: GameState;
  stateVersion: number;
  ackCursor: number;
  serverTime: number;
  playerLevel: number;
  playerXp: number;
  newAchievements: NewAchievementGrant[];
  coinBonusPercent: number;
  xpBonusPercent: number;
  categoryProgress: Record<string, CategoryProgressState>;
  dailyLoginReward: { coins: number; gems: number } | null;
  pendingReferralClaims: Array<{
    id: string;
    referredName: string;
    milestone: 'registered' | 'level10' | 'level30';
    gems?: number;
    coins?: number;
  }>;
  referralPurchaseBonuses: Array<{
    referredName: string;
    bonus: number;
    purchaseAmount: number;
  }>;
}
```

**3b. Add pre-transaction variables** — insert after `let totalXpGained = 0;` (around line 93):

```ts
const todayMidnight = (() => {
  const d = new Date(serverNow);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
})();
const shouldCheckLoginReward =
  Number(player.state?.lastDailyLoginClaimedAt ?? 0) < todayMidnight;
let dailyLoginReward: { coins: number; gems: number } | null = null;
```

**3c. Add `|| shouldCheckLoginReward` to the transaction guard** — change line ~162:

```ts
if (acceptedCommands.length > 0 || newCommands.length === 0 || shouldCheckLoginReward) {
```

**3d. Add daily login check inside the transaction** — insert after the XP-recompute `if (locked && ...)` block and before the `finalStats` computation (after line ~186):

```ts
// Daily login reward — re-read under the Player FOR UPDATE lock to deduplicate
if (shouldCheckLoginReward) {
  const currentState = await tx.playerState.findUnique({
    where: { playerId },
    select: { lastDailyLoginClaimedAt: true },
  });
  if (Number(currentState?.lastDailyLoginClaimedAt ?? 0) < todayMidnight) {
    const loginCoins = player.floors.length * 3000;
    gameState = {
      ...gameState,
      balance: gameState.balance + loginCoins,
      gems: gameState.gems + 3,
    };
    dailyLoginReward = { coins: loginCoins, gems: 3 };
  }
}
```

**3e. Add `lastDailyLoginClaimedAt` to the `playerState.upsert`** — in both `create` and `update` sections of the upsert (around lines 244–285), add:

```ts
// In create:
...(dailyLoginReward ? { lastDailyLoginClaimedAt: BigInt(serverNow) } : {}),

// In update:
...(dailyLoginReward ? { lastDailyLoginClaimedAt: BigInt(serverNow) } : {}),
```

**3f. Add `dailyLoginReward` to the return statement** (around line 493):

```ts
return {
  state: gameState,
  stateVersion: updatedPlayer?.stateVersion ?? player.stateVersion,
  ackCursor,
  serverTime: serverNow,
  playerLevel: updatedPlayer?.playerLevel ?? xpResult.playerLevel,
  playerXp: updatedPlayer?.playerXp ?? xpResult.playerXp,
  newAchievements: allNewGrants,
  coinBonusPercent: finalCoinBonus,
  xpBonusPercent: finalXpBonus,
  categoryProgress,
  dailyLoginReward,
  pendingReferralClaims,
  referralPurchaseBonuses,
};
```

- [ ] **Step 4: Run tests — all should pass**

```bash
cd /Users/Apple/IT/tinytower/server
npx jest sync.service.spec --no-coverage 2>&1 | tail -30
```

Expected:
```
PASS src/sync/__tests__/sync.service.spec.ts
Tests: X passed
```

- [ ] **Step 5: Commit**

```bash
cd /Users/Apple/IT/tinytower
git add server/src/sync/sync.service.ts server/src/sync/__tests__/sync.service.spec.ts
git commit -m "feat: grant daily login reward on first sync per day"
```

---

### Task 3: Client Store — Pending Reward State

**Files:**
- Modify: `src/stores/gameStore.ts`

**Interfaces:**
- Produces:
  - `useGameStore(s => s.pendingDailyLoginReward)` → `{ coins: number; gems: number } | null`
  - `useGameStore(s => s.setDailyLoginReward)` → `(r: { coins: number; gems: number }) => void`
  - `useGameStore(s => s.dismissDailyLoginReward)` → `() => void`

- [ ] **Step 1: Add to `UIState` interface** — in the `UIState` interface (around line 61), add one field:

```ts
interface UIState {
  insufficientResources: InsufficientResourcesPayload | null;
  builderToolDrop: ToolKey | null;
  achievementQueue: NewAchievementGrant[];
  coinBonusPercent: number;
  xpBonusPercent: number;
  categoryProgress: Record<string, CategoryProgressState>;
  locallyGrantedAchievements: Set<string>;
  failedCommandLog: FailedCommandEntry[];
  pendingReferralNotifications: ReferralNotification[];
  pendingWorkerFocus: string | null;
  pendingDailyLoginReward: { coins: number; gems: number } | null;
}
```

- [ ] **Step 2: Add to `GameActions` interface** — after `clearPendingWorkerFocus`:

```ts
setDailyLoginReward: (reward: { coins: number; gems: number }) => void;
dismissDailyLoginReward: () => void;
```

- [ ] **Step 3: Add initial value in `create()`** — in the store initializer (around line 256), after `pendingWorkerFocus: null`:

```ts
pendingDailyLoginReward: null,
```

- [ ] **Step 4: Add actions in `create()`** — after `clearPendingWorkerFocus`:

```ts
setDailyLoginReward: (reward) => set({ pendingDailyLoginReward: reward }),
dismissDailyLoginReward: () => set({ pendingDailyLoginReward: null }),
```

- [ ] **Step 5: Add to `reset()` action** — in the `reset()` call (around line 360), add:

```ts
pendingDailyLoginReward: null,
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to `pendingDailyLoginReward`, `setDailyLoginReward`, or `dismissDailyLoginReward`.

- [ ] **Step 7: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat: add pendingDailyLoginReward to game store UIState"
```

---

### Task 4: Client Sync — Wire Response to Store

**Files:**
- Modify: `src/services/sync.ts`

**Interfaces:**
- Consumes: `SyncResult.dailyLoginReward` (from Task 2), `useGameStore.setDailyLoginReward` (from Task 3)
- Produces: triggers modal via `pendingDailyLoginReward` (consumed by Task 5)

- [ ] **Step 1: Add `dailyLoginReward` to `SyncResponse` type** — in `src/services/sync.ts`, in the `SyncResponse` interface (around line 9):

```ts
interface SyncResponse {
  state: GameState;
  stateVersion: number;
  ackCursor: number;
  serverTime: number;
  playerLevel: number;
  playerXp: number;
  newAchievements: NewAchievementGrant[];
  coinBonusPercent: number;
  xpBonusPercent: number;
  categoryProgress: Record<string, CategoryProgressState>;
  dailyLoginReward?: { coins: number; gems: number } | null;
  pendingReferralClaims?: Array<{
    id: string;
    referredName: string;
    milestone: 'registered' | 'level10' | 'level30';
    gems?: number;
    coins?: number;
  }>;
  referralPurchaseBonuses?: Array<{
    referredName: string;
    bonus: number;
    purchaseAmount: number;
  }>;
}
```

- [ ] **Step 2: Call `setDailyLoginReward` after reconcile** — in `doSync()`, after the existing referral notifications block (around line 97), add:

```ts
if (response.dailyLoginReward) {
  useGameStore.getState().setDailyLoginReward(response.dailyLoginReward);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/services/sync.ts
git commit -m "feat: propagate dailyLoginReward from sync response to store"
```

---

### Task 5: Modal Component + i18n + Layout

**Files:**
- Modify: `src/i18n/locales/en/hotel.json`
- Create: `src/components/DailyLoginRewardModal.tsx`
- Modify: `app/_layout.tsx`

**Interfaces:**
- Consumes: `pendingDailyLoginReward` + `dismissDailyLoginReward` from store (Task 3)

- [ ] **Step 1: Add i18n keys**

In `src/i18n/locales/en/hotel.json`, add a `dailyLoginReward` block (for example after the `achievement` block):

```json
"dailyLoginReward": {
  "title": "Daily Reward",
  "subtitle": "Here's your reward for today!",
  "claim": "Collect"
}
```

- [ ] **Step 2: Create `DailyLoginRewardModal.tsx`**

Create `src/components/DailyLoginRewardModal.tsx` with the following content:

```tsx
import React, { useCallback } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';
import { CoinIcon, GemIcon } from './CurrencyIcons';
import { formatNum } from '../utils/format';

const { width: SCREEN_W } = Dimensions.get('window');

export default function DailyLoginRewardModal() {
  const { t } = useTranslation('hotel');
  const reward = useGameStore((s) => s.pendingDailyLoginReward);
  const dismiss = useGameStore((s) => s.dismissDailyLoginReward);

  const scale = useSharedValue(0.5);
  const rewardsOpacity = useSharedValue(0);
  const rewardsY = useSharedValue(20);

  const triggerAnimations = useCallback(() => {
    scale.value = 0.5;
    rewardsOpacity.value = 0;
    rewardsY.value = 20;
    scale.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.back(1.4)) });
    rewardsOpacity.value = withDelay(250, withTiming(1, { duration: 250 }));
    rewardsY.value = withDelay(250, withTiming(0, { duration: 300, easing: Easing.out(Easing.back(1.3)) }));
  }, []);

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const rewardsStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: rewardsY.value }],
    opacity: rewardsOpacity.value,
  }));

  return (
    <Modal
      visible={!!reward}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
      onShow={triggerAnimations}
    >
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />

        {reward && (
          <Animated.View style={[styles.card, cardStyle]}>
            <LinearGradient colors={['#FFF9E6', '#FFF3CC']} style={styles.cardGradient}>
              <View style={styles.starsRow}>
                <Text style={[styles.starText, styles.starSmall]}>★</Text>
                <Text style={[styles.starText, styles.starLarge]}>★</Text>
                <Text style={[styles.starText, styles.starSmall]}>★</Text>
              </View>

              <Text style={styles.title}>{t('dailyLoginReward.title')}</Text>
              <Text style={styles.subtitle}>{t('dailyLoginReward.subtitle')}</Text>

              <Animated.View style={[styles.rewardsContainer, rewardsStyle]}>
                <View style={styles.rewardRow}>
                  <CoinIcon size={20} />
                  <Text style={styles.rewardText}>+{formatNum(reward.coins)}</Text>
                </View>
                <View style={styles.rewardRow}>
                  <GemIcon size={16} />
                  <Text style={styles.rewardTextGem}>+{reward.gems}</Text>
                </View>
              </Animated.View>

              <Pressable
                onPress={dismiss}
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              >
                <LinearGradient colors={['#74D44F', '#5BA63C']} style={styles.buttonGradient}>
                  <Text style={styles.buttonText}>{t('dailyLoginReward.claim')}</Text>
                </LinearGradient>
                <View style={styles.buttonShadow} />
              </Pressable>
            </LinearGradient>
          </Animated.View>
        )}
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
    width: SCREEN_W * 0.78,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: 'rgba(120,100,20,1)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 12,
  },
  cardGradient: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  starText: {
    color: '#F2B330',
    textShadowColor: 'rgba(180,130,30,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  starSmall: { fontSize: 22 },
  starLarge: { fontSize: 34 },
  title: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 24,
    color: '#3D6B1E',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 14,
    color: '#7C9A5E',
    marginBottom: 20,
  },
  rewardsContainer: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 22,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 14,
    borderRadius: 14,
    shadowColor: 'rgba(100,90,40,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  rewardText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
    color: '#C28A22',
  },
  rewardTextGem: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
    color: '#2592AB',
  },
  button: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  buttonPressed: { opacity: 0.85 },
  buttonGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    zIndex: 1,
  },
  buttonText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 18,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  buttonShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(40,90,25,0.35)',
  },
});
```

- [ ] **Step 3: Mount modal in `_layout.tsx`**

In `app/_layout.tsx`, import the modal and render it inside the `GestureHandlerRootView`:

```tsx
import '../src/i18n';
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import {
  Fredoka_400Regular,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
} from '@expo-google-fonts/fredoka';
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import { useAuthStore } from '../src/stores/authStore';
import { setAuthFailureCallback } from '../src/services/api';
import * as Linking from 'expo-linking';
import { createMMKV } from 'react-native-mmkv';
import DailyLoginRewardModal from '../src/components/DailyLoginRewardModal';

const authStorage = createMMKV({ id: 'auth' });

function extractReferralCode(url: string): string | null {
  try {
    const parsed = Linking.parse(url);
    if (parsed.hostname !== 'ref') return null;
    const code = parsed.queryParams?.code;
    return typeof code === 'string' && code.length === 6 ? code.toUpperCase() : null;
  } catch {
    return null;
  }
}

function handleReferralLink(url: string | null) {
  if (!url) return;
  const code = extractReferralCode(url);
  if (code) authStorage.set('referral.pendingCode', code);
}

export default function RootLayout() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  useEffect(() => {
    useAuthStore.getState().loadTokens();
    setAuthFailureCallback(() => {
      useAuthStore.getState().logout();
      router.replace('/');
    });
    Linking.getInitialURL().then(handleReferralLink);
    const sub = Linking.addEventListener('url', ({ url }) => handleReferralLink(url));
    return () => sub.remove();
  }, [router]);

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#3FA535" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="login" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
        <Stack.Screen name="achievements" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="referrals" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="chat-screen" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="forum-screen" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
      <DailyLoginRewardModal />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FBFAF5',
  },
});
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales/en/hotel.json src/components/DailyLoginRewardModal.tsx app/_layout.tsx
git commit -m "feat: add DailyLoginRewardModal and wire to layout"
```
