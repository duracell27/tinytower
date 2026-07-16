# Referral System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a referral system where players share invite links, earn gems when referred players register and reach level 30, and get 10% of referred players' gem purchases — with modals announcing each reward.

**Architecture:** Referral notifications arrive via the existing sync response (`pendingReferralClaims`, `referralPurchaseBonuses`); sync.ts enqueues them into a `pendingReferralNotifications` array in `gameStore` (same pattern as `achievementQueue`). Claiming a reward calls `POST /referrals/claim`, then immediately triggers a sync to update the gems balance from the server. The referral profile data (code, referred player list) lives in a lightweight separate `referralStore`.

**Tech Stack:** Expo / React Native, Zustand, expo-linking (deep links), expo-clipboard, react-native-mmkv, expo-router

## Global Constraints

- All fonts: `Fredoka_700Bold` / `Fredoka_600SemiBold` / `Nunito_600SemiBold` / `Nunito_400Regular` (no other fonts)
- Colors follow existing palette: `#27331F` dark text, `#2592AB` gems, `#3FA535` green, `#E87C5E` red/orange
- Referral code format: 6 uppercase alphanumeric characters (e.g. `AB12CD`)
- Reward amounts: 5 💎 for registration, 50 💎 for level 30 (placeholder — adjust before launch)
- MMKV key for pending deep-link code: `referral.pendingCode` (in the `auth` storage instance)
- Deep link scheme: `tinytower://ref?code=AB12CD`
- No command schema changes needed — claim is handled via a dedicated REST endpoint, gems are updated by the following sync

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/stores/gameStore.ts` | Modify | Add `pendingReferralNotifications` UIState + `enqueueReferralNotifications` / `dismissReferralNotification` actions |
| `src/services/sync.ts` | Modify | Extend `SyncResponse` type; call `enqueueReferralNotifications` after each sync |
| `src/components/ReferralNotificationModal.tsx` | Create | Claim modal + purchase-bonus info modal, reads from `pendingReferralNotifications[0]` |
| `app/(tabs)/game.tsx` | Modify | Mount `<ReferralNotificationModal />` |
| `app/_layout.tsx` | Modify | Handle incoming deep links with `expo-linking`, store code in MMKV |
| `src/stores/authStore.ts` | Modify | `register()` accepts optional `referralCode`; clears MMKV on success |
| `src/screens/LoginScreen.tsx` | Modify | Add optional referral code field on register tab; pre-fill from MMKV |
| `src/stores/referralStore.ts` | Create | Fetches and holds `GET /player/referral` data; `claimMilestone()` action |
| `src/screens/ReferralScreen.tsx` | Create | Shows code, share button, referred players list with milestone status |
| `app/referrals.tsx` | Create | Expo-router entry for ReferralScreen |
| `app/(tabs)/profile.tsx` | Modify | Add Referrals button (same style as Achievements button) |

---

### Task 1: Referral notification state in gameStore

**Files:**
- Modify: `src/stores/gameStore.ts`

**Interfaces:**
- Produces:
  ```ts
  // New type exported from gameStore.ts
  export type ReferralNotification =
    | { type: 'claim'; referralId: string; referredName: string; milestone: 'registered' | 'level30'; gems: number }
    | { type: 'purchase_bonus'; names: string[]; totalBonus: number };

  // New actions on GameStore
  enqueueReferralNotifications(
    claims: Array<{ id: string; referredName: string; milestone: 'registered' | 'level30'; gems: number }>,
    bonuses: Array<{ referredName: string; bonus: number; purchaseAmount: number }>
  ): void
  dismissReferralNotification(): void
  ```

- [ ] **Step 1: Add `ReferralNotification` type and UIState field**

  In `src/stores/gameStore.ts`, after the `FailedCommandEntry` interface (around line 53), add:

  ```ts
  export type ReferralNotification =
    | { type: 'claim'; referralId: string; referredName: string; milestone: 'registered' | 'level30'; gems: number }
    | { type: 'purchase_bonus'; names: string[]; totalBonus: number };
  ```

  In the `UIState` interface, add the field:
  ```ts
  pendingReferralNotifications: ReferralNotification[];
  ```

- [ ] **Step 2: Add actions to `GameActions` interface**

  In the `GameActions` interface, add:
  ```ts
  enqueueReferralNotifications: (
    claims: Array<{ id: string; referredName: string; milestone: 'registered' | 'level30'; gems: number }>,
    bonuses: Array<{ referredName: string; bonus: number; purchaseAmount: number }>
  ) => void;
  dismissReferralNotification: () => void;
  ```

- [ ] **Step 3: Initialize state and implement actions**

  In `useGameStore` initial state (where `achievementQueue: []` is), add:
  ```ts
  pendingReferralNotifications: [],
  ```

  In the `reset:` action, add:
  ```ts
  pendingReferralNotifications: [],
  ```

  After `dismissAchievement`, add the two new actions:
  ```ts
  enqueueReferralNotifications: (claims, bonuses) => set((cur) => {
    const newNotifs: ReferralNotification[] = [
      ...claims.map((c) => ({
        type: 'claim' as const,
        referralId: c.id,
        referredName: c.referredName,
        milestone: c.milestone,
        gems: c.gems,
      })),
    ];
    if (bonuses.length > 0) {
      const names = bonuses.map((b) => b.referredName);
      const totalBonus = bonuses.reduce((sum, b) => sum + b.bonus, 0);
      newNotifs.push({ type: 'purchase_bonus', names, totalBonus });
    }
    return { pendingReferralNotifications: [...cur.pendingReferralNotifications, ...newNotifs] };
  }),

  dismissReferralNotification: () => set((cur) => ({
    pendingReferralNotifications: cur.pendingReferralNotifications.slice(1),
  })),
  ```

- [ ] **Step 4: Verify TypeScript compiles**

  Run: `cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -30`
  Expected: no errors related to `gameStore.ts`

- [ ] **Step 5: Commit**

  ```bash
  git add src/stores/gameStore.ts
  git commit -m "feat(referrals): add referral notification queue to gameStore"
  ```

---

### Task 2: Extend sync.ts to enqueue referral notifications

**Files:**
- Modify: `src/services/sync.ts`

**Interfaces:**
- Consumes: `enqueueReferralNotifications` from Task 1
- Produces: `SyncResponse` extended with `pendingReferralClaims` and `referralPurchaseBonuses`

- [ ] **Step 1: Extend `SyncResponse` interface**

  In `src/services/sync.ts`, in the `SyncResponse` interface, add two optional fields after `categoryProgress`:
  ```ts
  pendingReferralClaims?: Array<{
    id: string;
    referredName: string;
    milestone: 'registered' | 'level30';
    gems: number;
  }>;
  referralPurchaseBonuses?: Array<{
    referredName: string;
    bonus: number;
    purchaseAmount: number;
  }>;
  ```

- [ ] **Step 2: Call `enqueueReferralNotifications` after sync**

  In `doSync()`, after the block that calls `useGameStore.setState({ coinBonusPercent, xpBonusPercent, categoryProgress: mergedCP })`, add:

  ```ts
  if (
    (response.pendingReferralClaims && response.pendingReferralClaims.length > 0) ||
    (response.referralPurchaseBonuses && response.referralPurchaseBonuses.length > 0)
  ) {
    useGameStore.getState().enqueueReferralNotifications(
      response.pendingReferralClaims ?? [],
      response.referralPurchaseBonuses ?? [],
    );
  }
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  Run: `cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -30`
  Expected: no errors

- [ ] **Step 4: Commit**

  ```bash
  git add src/services/sync.ts
  git commit -m "feat(referrals): enqueue referral notifications from sync response"
  ```

---

### Task 3: Create ReferralNotificationModal and mount it

**Files:**
- Create: `src/components/ReferralNotificationModal.tsx`
- Modify: `app/(tabs)/game.tsx`

**Interfaces:**
- Consumes:
  - `useGameStore((s) => s.pendingReferralNotifications[0] ?? null)` — current notification
  - `useGameStore((s) => s.dismissReferralNotification)` — dismiss action
  - `api.post<{ gems: number }>('/referrals/claim', { referralId, milestone })` — claim endpoint
  - `syncService.triggerSync()` — needs to be exported from sync.ts (see Step 1 below)

- [ ] **Step 1: Export `triggerSync` from sync.ts**

  In `src/services/sync.ts`, the exported `syncService` object — add `triggerSync`:
  ```ts
  export const syncService = {
    // ... existing methods ...
    triggerSync: () => doSync(),
  };
  ```

- [ ] **Step 2: Create `ReferralNotificationModal.tsx`**

  Create `src/components/ReferralNotificationModal.tsx`:

  ```tsx
  import React, { useState, useCallback } from 'react';
  import { View, Text, Pressable, Modal, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
  import { LinearGradient } from 'expo-linear-gradient';
  import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
  import { useGameStore } from '../stores/gameStore';
  import { GemIcon } from './CurrencyIcons';
  import { api } from '../services/api';
  import { syncService } from '../services/sync';

  const { width: SCREEN_W } = Dimensions.get('window');

  export default function ReferralNotificationModal() {
    const notification = useGameStore((s) => s.pendingReferralNotifications[0] ?? null);
    const dismiss = useGameStore((s) => s.dismissReferralNotification);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const scale = useSharedValue(0.5);
    const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

    const triggerAnimation = useCallback(() => {
      scale.value = 0.5;
      scale.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.back(1.4)) });
      setError('');
      setLoading(false);
    }, []);

    const handleClaim = async () => {
      if (notification?.type !== 'claim') return;
      setLoading(true);
      setError('');
      try {
        await api.post<{ gems: number }>('/referrals/claim', {
          referralId: notification.referralId,
          milestone: notification.milestone,
        });
        dismiss();
        syncService.triggerSync();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Помилка. Спробуй ще раз.');
      } finally {
        setLoading(false);
      }
    };

    const isClaimModal = notification?.type === 'claim';
    const isPurchaseModal = notification?.type === 'purchase_bonus';

    return (
      <Modal
        visible={!!notification}
        transparent
        animationType="fade"
        onRequestClose={isClaimModal ? undefined : dismiss}
        onShow={triggerAnimation}
      >
        <View style={styles.scrim}>
          {!isClaimModal && <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />}

          {notification && (
            <Animated.View style={[styles.card, cardStyle]}>
              <LinearGradient colors={['#E8F4FF', '#D0E8FF']} style={styles.cardGradient}>

                {isClaimModal && (
                  <>
                    <Text style={styles.emoji}>🎉</Text>
                    <Text style={styles.title}>Реферальна нагорода!</Text>
                    <Text style={styles.body}>
                      {notification.referredName}{' '}
                      {notification.milestone === 'registered'
                        ? 'зареєструвався за твоїм посиланням'
                        : 'досяг 30 рівня'}
                    </Text>
                    <View style={styles.rewardRow}>
                      <GemIcon size={18} />
                      <Text style={styles.rewardText}>+{notification.gems}</Text>
                    </View>
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                    <Pressable
                      onPress={handleClaim}
                      disabled={loading}
                      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                    >
                      <LinearGradient colors={['#4A9FE0', '#2F7BC0']} style={styles.buttonGradient}>
                        {loading
                          ? <ActivityIndicator color="#fff" />
                          : <Text style={styles.buttonText}>Отримати {notification.gems} 💎</Text>
                        }
                      </LinearGradient>
                      <View style={styles.buttonShadow} />
                    </Pressable>
                  </>
                )}

                {isPurchaseModal && (
                  <>
                    <Text style={styles.emoji}>💎</Text>
                    <Text style={styles.title}>Бонус від реферала!</Text>
                    <Text style={styles.body}>
                      {notification.names.length === 1
                        ? `${notification.names[0]} поповнив баланс`
                        : `${notification.names[0]} та ще ${notification.names.length - 1} гравців поповнили баланс`}
                    </Text>
                    <View style={styles.rewardRow}>
                      <GemIcon size={18} />
                      <Text style={styles.rewardText}>+{notification.totalBonus}</Text>
                    </View>
                    <Pressable
                      onPress={dismiss}
                      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                    >
                      <LinearGradient colors={['#4A9FE0', '#2F7BC0']} style={styles.buttonGradient}>
                        <Text style={styles.buttonText}>Чудово!</Text>
                      </LinearGradient>
                      <View style={styles.buttonShadow} />
                    </Pressable>
                  </>
                )}

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
      shadowColor: 'rgba(20,60,120,1)',
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
      gap: 12,
    },
    emoji: {
      fontSize: 40,
    },
    title: {
      fontFamily: 'Fredoka_700Bold',
      fontSize: 22,
      color: '#1A3D6B',
      textAlign: 'center',
    },
    body: {
      fontFamily: 'Nunito_600SemiBold',
      fontSize: 15,
      color: '#3E5A80',
      textAlign: 'center',
    },
    rewardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#fff',
      paddingVertical: 8,
      paddingHorizontal: 18,
      borderRadius: 14,
      shadowColor: 'rgba(30,60,120,1)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 4,
      elevation: 2,
      marginVertical: 4,
    },
    rewardText: {
      fontFamily: 'Fredoka_700Bold',
      fontSize: 20,
      color: '#2592AB',
    },
    errorText: {
      fontFamily: 'Nunito_400Regular',
      fontSize: 13,
      color: '#C0372A',
      textAlign: 'center',
    },
    button: {
      width: '100%',
      borderRadius: 14,
      overflow: 'hidden',
      marginTop: 4,
    },
    buttonPressed: { opacity: 0.85 },
    buttonGradient: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 13,
      zIndex: 1,
      minHeight: 46,
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
      backgroundColor: 'rgba(20,60,100,0.35)',
    },
  });
  ```

- [ ] **Step 3: Mount modal in game.tsx**

  In `app/(tabs)/game.tsx`, add the import after existing modal imports:
  ```ts
  import ReferralNotificationModal from '../../src/components/ReferralNotificationModal';
  ```

  In the JSX, add `<ReferralNotificationModal />` after `<AchievementModal />`:
  ```tsx
  <AchievementModal />
  <ReferralNotificationModal />
  ```

- [ ] **Step 4: Verify TypeScript compiles**

  Run: `cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -30`
  Expected: no errors

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/ReferralNotificationModal.tsx app/(tabs)/game.tsx src/services/sync.ts
  git commit -m "feat(referrals): add referral notification modal"
  ```

---

### Task 4: Deep link handling and MMKV storage

**Files:**
- Modify: `app/_layout.tsx`

**Interfaces:**
- Produces: MMKV key `referral.pendingCode` (string) in the `auth` storage instance, readable by LoginScreen

- [ ] **Step 1: Add deep link handler to `_layout.tsx`**

  In `app/_layout.tsx`, add the import at the top:
  ```ts
  import * as Linking from 'expo-linking';
  import { createMMKV } from 'react-native-mmkv';
  ```

  Add a helper after the imports (before `RootLayout`):
  ```ts
  const authStorage = createMMKV({ id: 'auth' });

  function extractReferralCode(url: string): string | null {
    try {
      const parsed = Linking.parse(url);
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
  ```

  In `RootLayout`, inside the existing `useEffect` (after `useAuthStore.getState().loadTokens()`), add:
  ```ts
  // Handle deep link that opened the app from cold start
  Linking.getInitialURL().then(handleReferralLink);
  // Handle deep link while app is already open
  const sub = Linking.addEventListener('url', ({ url }) => handleReferralLink(url));
  return () => sub.remove();
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  Run: `cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -30`
  Expected: no errors

- [ ] **Step 3: Commit**

  ```bash
  git add app/_layout.tsx
  git commit -m "feat(referrals): handle deep link and store pending referral code in MMKV"
  ```

---

### Task 5: Referral code field in registration

**Files:**
- Modify: `src/stores/authStore.ts`
- Modify: `src/screens/LoginScreen.tsx`

**Interfaces:**
- Consumes: `authStorage.getString('referral.pendingCode')` — set by Task 4
- Modifies: `POST /auth/register` body to include `referralCode?: string`

- [ ] **Step 1: Update `authStore.register()` signature**

  In `src/stores/authStore.ts`:

  1. In `AuthActions` interface, change:
     ```ts
     register: (email: string, password: string, playerName: string) => Promise<void>;
     ```
     to:
     ```ts
     register: (email: string, password: string, playerName: string, referralCode?: string) => Promise<void>;
     ```

  2. In the `register` implementation, change the function signature:
     ```ts
     register: async (email, password, playerName, referralCode) => {
     ```

  3. In the `api.post` call inside `register`, change the body:
     ```ts
     }>('/auth/register', { email, password, playerName, ...(referralCode ? { referralCode } : {}) });
     ```

  4. After `setupUserPersistence(data.player.id)` in `register`, add:
     ```ts
     getStorage().remove('referral.pendingCode');
     ```

- [ ] **Step 2: Add referral code field to LoginScreen**

  In `src/screens/LoginScreen.tsx`:

  1. After the `showPassword` state (around line 56), add:
     ```ts
     const [referralCode, setReferralCode] = useState('');
     ```

  2. Add a `useEffect` to pre-fill from MMKV when switching to register tab. Add this import at the top of the file:
     ```ts
     import { createMMKV } from 'react-native-mmkv';
     ```
     Then after the `showPassword` state:
     ```ts
     const authStorage = React.useMemo(() => createMMKV({ id: 'auth' }), []);

     useEffect(() => {
       if (tab === 'register') {
         const pending = authStorage.getString('referral.pendingCode');
         if (pending) setReferralCode(pending);
       }
     }, [tab, authStorage]);
     ```

  3. In `handleSubmit`, change the register call from:
     ```ts
     await useAuthStore.getState().register(email.trim(), password, playerName.trim());
     ```
     to:
     ```ts
     await useAuthStore.getState().register(
       email.trim(),
       password,
       playerName.trim(),
       referralCode.trim() || undefined,
     );
     ```

  4. In the JSX, find the `playerName` `TextInput` block and add the referral code field directly after it (only show on register tab — it's already inside `{!isLogin && (...)}` scope, so add it there):
     ```tsx
     {!isLogin && (
       <>
         {/* existing playerName TextInput */}
         <TextInput
           style={styles.input}
           placeholder="Реферальний код (необов'язково)"
           placeholderTextColor="rgba(255,255,255,0.5)"
           value={referralCode}
           onChangeText={(t) => setReferralCode(t.toUpperCase())}
           autoCapitalize="characters"
           maxLength={6}
         />
       </>
     )}
     ```
     
     Add the referral field after the existing playerName input but still inside the `!isLogin` conditional block. Match the same `styles.input` used by other inputs in LoginScreen.

- [ ] **Step 3: Verify TypeScript compiles**

  Run: `cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -30`
  Expected: no errors

- [ ] **Step 4: Commit**

  ```bash
  git add src/stores/authStore.ts src/screens/LoginScreen.tsx
  git commit -m "feat(referrals): add referral code field to registration"
  ```

---

### Task 6: Referral store, screen, and route

**Files:**
- Create: `src/stores/referralStore.ts`
- Create: `src/screens/ReferralScreen.tsx`
- Create: `app/referrals.tsx`

**Interfaces:**
- Consumes: `api.get<ReferralProfileResponse>('/player/referral')`, `api.post<{ gems: number }>('/referrals/claim', ...)`
- Produces:
  ```ts
  // from referralStore.ts
  export interface ReferralEntry {
    id: string;
    referredName: string;
    referredLevel: number;
    milestones: {
      registered: { claimedAt: string | null };
      level30: { reachedAt: string | null; claimedAt: string | null };
    };
    gemBonusEarned: number;
  }

  export const useReferralStore: StoreApi with:
    code: string | null
    referrals: ReferralEntry[]
    isLoading: boolean
    fetchReferral(): Promise<void>
  ```

- [ ] **Step 1: Create `referralStore.ts`**

  Create `src/stores/referralStore.ts`:

  ```ts
  import { create } from 'zustand';
  import { api } from '../services/api';

  export interface ReferralEntry {
    id: string;
    referredName: string;
    referredLevel: number;
    milestones: {
      registered: { claimedAt: string | null };
      level30: { reachedAt: string | null; claimedAt: string | null };
    };
    gemBonusEarned: number;
  }

  interface ReferralProfileResponse {
    code: string;
    referrals: ReferralEntry[];
  }

  interface ReferralState {
    code: string | null;
    referrals: ReferralEntry[];
    isLoading: boolean;
    fetchReferral: () => Promise<void>;
  }

  export const useReferralStore = create<ReferralState>((set) => ({
    code: null,
    referrals: [],
    isLoading: false,

    fetchReferral: async () => {
      set({ isLoading: true });
      try {
        const data = await api.get<ReferralProfileResponse>('/player/referral');
        set({ code: data.code, referrals: data.referrals });
      } finally {
        set({ isLoading: false });
      }
    },
  }));
  ```

- [ ] **Step 2: Create `ReferralScreen.tsx`**

  Create `src/screens/ReferralScreen.tsx`:

  ```tsx
  import React, { useEffect } from 'react';
  import {
    View, Text, Pressable, StyleSheet, ScrollView,
    Share, ActivityIndicator, ImageBackground,
  } from 'react-native';
  import { BlurView } from 'expo-blur';
  import * as Clipboard from 'expo-clipboard';
  import { router } from 'expo-router';
  import { useReferralStore, type ReferralEntry } from '../stores/referralStore';
  import { GemIcon } from '../components/CurrencyIcons';

  const DEEP_LINK_BASE = 'tinytower://ref?code=';

  function MilestoneRow({
    label,
    gems,
    claimed,
    reachable,
    currentLevel,
  }: {
    label: string;
    gems: number;
    claimed: boolean;
    reachable: boolean;
    currentLevel?: number;
  }) {
    return (
      <View style={styles.milestoneRow}>
        <Text style={styles.milestoneDot}>{claimed ? '✅' : reachable ? '✅' : '⏳'}</Text>
        <Text style={styles.milestoneLabel}>{label}</Text>
        <View style={{ flex: 1 }} />
        {claimed ? (
          <Text style={styles.milestoneEarned}>+{gems} 💎 Отримано</Text>
        ) : reachable ? (
          <Text style={styles.milestoneEarned}>+{gems} 💎 Отримано</Text>
        ) : currentLevel !== undefined ? (
          <Text style={styles.milestonePending}>{currentLevel} рівень</Text>
        ) : (
          <Text style={styles.milestonePending}>Не виконано</Text>
        )}
      </View>
    );
  }

  function ReferralCard({ entry }: { entry: ReferralEntry }) {
    return (
      <View style={styles.referralCard}>
        <Text style={styles.referralName}>👤 {entry.referredName}</Text>
        <MilestoneRow
          label="Реєстрація  +5 💎"
          gems={5}
          claimed={!!entry.milestones.registered.claimedAt}
          reachable={false}
        />
        <MilestoneRow
          label="Рівень 30  +50 💎"
          gems={50}
          claimed={!!entry.milestones.level30.claimedAt}
          reachable={!!entry.milestones.level30.reachedAt}
          currentLevel={entry.milestones.level30.reachedAt ? undefined : entry.referredLevel}
        />
        {entry.gemBonusEarned > 0 && (
          <View style={styles.milestoneRow}>
            <Text style={styles.milestoneDot}>💰</Text>
            <Text style={styles.milestoneLabel}>Бонус з покупок</Text>
            <View style={{ flex: 1 }} />
            <Text style={styles.milestoneEarned}>+{entry.gemBonusEarned} 💎</Text>
          </View>
        )}
      </View>
    );
  }

  export default function ReferralScreen() {
    const { code, referrals, isLoading, fetchReferral } = useReferralStore();
    const [copied, setCopied] = React.useState(false);

    useEffect(() => {
      fetchReferral();
    }, []);

    const shareLink = code ? `${DEEP_LINK_BASE}${code}` : '';

    const handleCopy = async () => {
      if (!code) return;
      await Clipboard.setStringAsync(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    const handleShare = () => {
      if (!shareLink) return;
      Share.share({
        message: `Грай зі мною у TinyTower! Мій код: ${code}\n${shareLink}`,
      });
    };

    return (
      <ImageBackground
        source={require('../../assets/welcome-bg.png')}
        style={styles.container}
        resizeMode="cover"
      >
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backArrow}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Реферали</Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3FA535" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.codeCard}>
              <Text style={styles.codeLabel}>Твій код</Text>
              <View style={styles.codeRow}>
                <Text style={styles.codeText}>{code ?? '------'}</Text>
                <Pressable onPress={handleCopy} style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.7 }]}>
                  <Text style={styles.copyBtnText}>{copied ? 'Скопійовано!' : '📋 Копіювати'}</Text>
                </Pressable>
              </View>
              <Pressable onPress={handleShare} style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.85 }]}>
                <Text style={styles.shareBtnText}>🔗 Поділитися посиланням</Text>
              </Pressable>
            </View>

            {referrals.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>Ще немає запрошених гравців.{'\n'}Поділись посиланням!</Text>
              </View>
            ) : (
              <>
                <Text style={styles.sectionTitle}>Запрошені гравці</Text>
                {referrals.map((entry) => (
                  <ReferralCard key={entry.id} entry={entry} />
                ))}
              </>
            )}
          </ScrollView>
        )}
      </ImageBackground>
    );
  }

  const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 56,
      paddingHorizontal: 20,
      paddingBottom: 8,
      gap: 8,
    },
    backBtn: { padding: 4, marginRight: 4 },
    backArrow: { fontSize: 32, color: '#27331F', lineHeight: 36 },
    headerTitle: { fontFamily: 'Fredoka_700Bold', fontSize: 26, color: '#27331F' },
    scroll: { paddingHorizontal: 20, paddingBottom: 120, gap: 12, paddingTop: 8 },
    codeCard: {
      backgroundColor: '#fff',
      borderRadius: 20,
      padding: 20,
      gap: 12,
      shadowColor: 'rgba(60,80,45,1)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
    },
    codeLabel: { fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: '#7C8A6E', textTransform: 'uppercase', letterSpacing: 0.5 },
    codeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    codeText: { fontFamily: 'Fredoka_700Bold', fontSize: 28, color: '#1A3D6B', letterSpacing: 4, flex: 1 },
    copyBtn: { backgroundColor: '#F0F7FF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
    copyBtnText: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: '#2592AB' },
    shareBtn: {
      backgroundColor: '#2592AB',
      borderRadius: 14,
      paddingVertical: 13,
      alignItems: 'center',
    },
    shareBtnText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16, color: '#fff' },
    sectionTitle: { fontFamily: 'Fredoka_600SemiBold', fontSize: 18, color: '#27331F', marginTop: 4 },
    referralCard: {
      backgroundColor: '#fff',
      borderRadius: 16,
      padding: 16,
      gap: 8,
      shadowColor: 'rgba(60,80,45,1)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    referralName: { fontFamily: 'Fredoka_600SemiBold', fontSize: 16, color: '#27331F', marginBottom: 4 },
    milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    milestoneDot: { fontSize: 14 },
    milestoneLabel: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: '#3E4A35' },
    milestoneEarned: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: '#3FA535' },
    milestonePending: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: '#9BA3B0' },
    emptyCard: {
      backgroundColor: '#fff',
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
      shadowColor: 'rgba(60,80,45,1)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    emptyText: { fontFamily: 'Nunito_600SemiBold', fontSize: 14, color: '#9BA3B0', textAlign: 'center', lineHeight: 22 },
  });
  ```

- [ ] **Step 3: Create expo-router entry `app/referrals.tsx`**

  Create `app/referrals.tsx`:

  ```tsx
  import ReferralScreen from '../src/screens/ReferralScreen';
  export default ReferralScreen;
  ```

- [ ] **Step 4: Register the route in `_layout.tsx`**

  In `app/_layout.tsx`, in the `<Stack>` element, add a new `Stack.Screen` entry:
  ```tsx
  <Stack.Screen name="referrals" options={{ animation: 'slide_from_right' }} />
  ```

- [ ] **Step 5: Verify TypeScript compiles**

  Run: `cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -30`
  Expected: no errors

- [ ] **Step 6: Commit**

  ```bash
  git add src/stores/referralStore.ts src/screens/ReferralScreen.tsx app/referrals.tsx app/_layout.tsx
  git commit -m "feat(referrals): add referral store, screen, and route"
  ```

---

### Task 7: Add Referrals button to profile screen

**Files:**
- Modify: `app/(tabs)/profile.tsx`

**Interfaces:**
- Consumes: `router.push('/referrals')` from expo-router

- [ ] **Step 1: Add Referrals button after Achievements button**

  In `app/(tabs)/profile.tsx`, find the `<Pressable>` that renders the achievements button (around line 302). Add a new Pressable directly after its closing tag:

  ```tsx
  <Pressable
    onPress={() => router.push('/referrals')}
    style={({ pressed }) => [styles.achievementsButton, pressed && styles.achievementsButtonPressed]}
  >
    <Text style={styles.referralsIcon}>🔗</Text>
    <Text style={styles.achievementsButtonText}>Реферали</Text>
  </Pressable>
  ```

  In `styles` (at the bottom of the file), add:
  ```ts
  referralsIcon: {
    width: 36,
    height: 36,
    fontSize: 24,
    textAlign: 'center',
    lineHeight: 36,
  },
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  Run: `cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -30`
  Expected: no errors

- [ ] **Step 3: Commit**

  ```bash
  git add app/(tabs)/profile.tsx
  git commit -m "feat(referrals): add referrals entry point to profile screen"
  ```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Register trigger → claim modal with Отримати button (Task 3)
- ✅ Level 30 trigger → claim modal (Task 3, same component)
- ✅ Gem purchase trigger → info modal with Чудово button (Task 3)
- ✅ Batch multiple purchase bonuses into single modal (Task 1, `enqueueReferralNotifications`)
- ✅ Error state on claim failure — button stays tappable (Task 3)
- ✅ Deep link parsing and MMKV storage (Task 4)
- ✅ Manual code entry at registration (Task 5)
- ✅ Auto-fill code from MMKV on register tab (Task 5)
- ✅ Clear MMKV code after registration (Task 5)
- ✅ Referrals screen: code display + copy + share (Task 6)
- ✅ Referred players list with milestone status (Task 6)
- ✅ Referrals button in profile (Task 7)
- ✅ Gems updated via triggering sync after claim (Task 3, `syncService.triggerSync()`)

**Type consistency:**
- `ReferralNotification` type defined in Task 1, consumed in Task 3 ✅
- `ReferralEntry` type defined in Task 6 referralStore, consumed only in ReferralScreen ✅
- `enqueueReferralNotifications` signature defined in Task 1, called in Task 2 ✅
- `dismissReferralNotification` defined in Task 1, consumed in Task 3 ✅
- `syncService.triggerSync()` added in Task 3 Step 1, used in Task 3 Step 2 ✅
