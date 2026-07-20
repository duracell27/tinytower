# Referred User Reward — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a player applies a referral code they immediately receive `playerLevel * 1000` coins and `max(playerLevel, 20)` gems, granted atomically on the server and shown in a non-blocking green modal.

**Architecture:** Server wraps referral creation + balance/gems increments in a single `$transaction` and returns `{ ok, coins, gems }`. Client dispatches a `referred_bonus` notification into the existing `gameStore.pendingReferralNotifications` queue which is rendered by the existing `ReferralNotificationModal`.

**Tech Stack:** NestJS / Prisma (server), Zustand + React Native (client), `expo-linear-gradient` for the modal card.

## Global Constraints

- Gems floor: `Math.max(playerLevel, 20)` — never below 20 even at level 1
- No new DB columns — reward is applied at apply time via existing `player.balance` and `playerState.gems` fields
- Modal is non-blocking: backdrop tap and "Awesome!" button both dismiss
- Green gradient `['#E8FFF0', '#D0F5DC']` distinguishes this modal from the blue referrer-claim modal
- Confetti icon: `assets/img/confetti.png` (already exists)

---

## File Map

| File | Change |
|------|--------|
| `server/src/referral/referral-constants.ts` | Add `REFERRED_COINS_PER_LEVEL` and `REFERRED_GEMS_MIN` |
| `server/src/referral/referral.service.ts` | `applyReferralCode` — wrap in `$transaction`, grant reward, return `{ ok, coins, gems }` |
| `server/src/referral/__tests__/referral.service.spec.ts` | Add `txMock.referral.create`, update success test, add gems-floor test, fix P2002 test |
| `src/stores/gameStore.ts` | Add `referred_bonus` to `ReferralNotification` union; add `pushReferralNotification` action |
| `src/stores/referralStore.ts` | Type `api.post` response; dispatch `referred_bonus` to gameStore after success |
| `src/components/ReferralNotificationModal.tsx` | Add `referred_bonus` branch with green gradient, confetti icon, two reward pills |

---

### Task 1: Server — constants + `applyReferralCode` reward

**Files:**
- Modify: `server/src/referral/referral-constants.ts`
- Modify: `server/src/referral/referral.service.ts`
- Modify: `server/src/referral/__tests__/referral.service.spec.ts`

**Interfaces:**
- Produces: `applyReferralCode()` now returns `Promise<{ ok: true; coins: number; gems: number }>`

- [ ] **Step 1: Add `txMock.referral.create` to the test setup**

In `server/src/referral/__tests__/referral.service.spec.ts`, locate the `txMock` block (inside `beforeEach`) and add `create` to `txMock.referral`:

```ts
txMock = {
  referral: {
    findUnique: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockResolvedValue({}),   // ADD THIS LINE
  },
  player: { update: jest.fn().mockResolvedValue({}) },
  playerState: { update: jest.fn().mockResolvedValue({}) },
};
```

- [ ] **Step 2: Replace the existing `applyReferralCode` success test with two new tests**

Delete the test named `'creates a referral record and returns { ok: true }'` and the P2002 test, and replace with:

```ts
it('creates referral in tx, grants reward, returns { ok, coins, gems }', async () => {
  const LEVEL = 15;
  prisma.player.findUnique
    .mockResolvedValueOnce({ id: REFERRER_ID })
    .mockResolvedValueOnce({ playerName: 'TestPlayer', playerLevel: LEVEL });
  prisma.referral.findUnique.mockResolvedValue(null);

  const result = await service.applyReferralCode(PLAYER_ID, CODE);

  expect(result).toEqual({ ok: true, coins: 15_000, gems: 15 });
  expect(txMock.referral.create).toHaveBeenCalledWith({
    data: { referrerId: REFERRER_ID, referredId: PLAYER_ID, referredName: 'TestPlayer' },
  });
  expect(txMock.player.update).toHaveBeenCalledWith({
    where: { id: PLAYER_ID },
    data: { balance: { increment: 15_000 } },
  });
  expect(txMock.playerState.update).toHaveBeenCalledWith({
    where: { playerId: PLAYER_ID },
    data: { gems: { increment: 15 } },
  });
});

it('applies gems floor of 20 for low-level players', async () => {
  prisma.player.findUnique
    .mockResolvedValueOnce({ id: REFERRER_ID })
    .mockResolvedValueOnce({ playerName: 'Newbie', playerLevel: 5 });
  prisma.referral.findUnique.mockResolvedValue(null);

  const result = await service.applyReferralCode(PLAYER_ID, CODE);

  expect(result).toEqual({ ok: true, coins: 5_000, gems: 20 });
});

it('throws BadRequestException if DB unique constraint fires (race condition)', async () => {
  prisma.player.findUnique
    .mockResolvedValueOnce({ id: REFERRER_ID })
    .mockResolvedValueOnce({ playerName: 'TestPlayer', playerLevel: 10 });
  prisma.referral.findUnique.mockResolvedValue(null);
  txMock.referral.create.mockRejectedValue({ code: 'P2002' });

  await expect(service.applyReferralCode(PLAYER_ID, CODE)).rejects.toThrow(BadRequestException);
});
```

- [ ] **Step 3: Run the new tests to confirm they fail**

```bash
cd /Users/Apple/IT/tinytower/server
npx jest referral.service.spec --no-coverage
```

Expected: the two new success tests FAIL (service still returns `{ ok: true }` with no coins/gems).

- [ ] **Step 4: Add constants to `referral-constants.ts`**

```ts
export const REGISTERED_COINS = 10_000;
export const LEVEL10_GEMS = 20;
export const LEVEL30_GEMS = 50;
export const PURCHASE_BONUS_PERCENT = 10;
export const REFERRED_COINS_PER_LEVEL = 1_000;
export const REFERRED_GEMS_MIN = 20;
```

- [ ] **Step 5: Update `applyReferralCode` in `referral.service.ts`**

Replace the entire `applyReferralCode` method:

```ts
async applyReferralCode(playerId: string, code: string) {
  const referrer = await this.prisma.player.findUnique({
    where: { referralCode: code },
    select: { id: true },
  });
  if (!referrer) throw new BadRequestException('Invalid referral code');
  if (referrer.id === playerId) throw new BadRequestException('Cannot use your own referral code');

  const existing = await this.prisma.referral.findUnique({ where: { referredId: playerId } });
  if (existing) throw new BadRequestException('Referral code already used');

  const player = await this.prisma.player.findUnique({
    where: { id: playerId },
    select: { playerName: true, playerLevel: true },
  });
  if (!player) throw new NotFoundException('Player not found');

  const coins = player.playerLevel * REFERRED_COINS_PER_LEVEL;
  const gems = Math.max(player.playerLevel, REFERRED_GEMS_MIN);

  await this.prisma.$transaction(async (tx) => {
    try {
      await tx.referral.create({
        data: {
          referrerId: referrer.id,
          referredId: playerId,
          referredName: player.playerName,
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new BadRequestException('Referral code already used');
      throw e;
    }
    await tx.player.update({
      where: { id: playerId },
      data: { balance: { increment: coins } },
    });
    await tx.playerState.update({
      where: { playerId },
      data: { gems: { increment: gems } },
    });
  });

  return { ok: true as const, coins, gems };
}
```

Make sure `REFERRED_COINS_PER_LEVEL` and `REFERRED_GEMS_MIN` are imported from `./referral-constants`.

- [ ] **Step 6: Run all referral service tests**

```bash
cd /Users/Apple/IT/tinytower/server
npx jest referral.service.spec --no-coverage
```

Expected: all tests in `describe('applyReferralCode')` PASS, rest of file unchanged.

- [ ] **Step 7: Commit**

```bash
git add server/src/referral/referral-constants.ts \
        server/src/referral/referral.service.ts \
        server/src/referral/__tests__/referral.service.spec.ts
git commit -m "feat: grant coins+gems to referred user when applying referral code"
```

---

### Task 2: Client — `referred_bonus` notification type + `pushReferralNotification` action

**Files:**
- Modify: `src/stores/gameStore.ts`

**Interfaces:**
- Produces: `useGameStore.getState().pushReferralNotification(n: ReferralNotification)` — appends one notification to the queue

- [ ] **Step 1: Add `referred_bonus` to the `ReferralNotification` union**

Locate the `ReferralNotification` type (around line 55) and add the new variant:

```ts
export type ReferralNotification =
  | { type: 'claim'; referralId: string; referredName: string; milestone: 'registered'; coins: number }
  | { type: 'claim'; referralId: string; referredName: string; milestone: 'level10' | 'level30'; gems: number }
  | { type: 'purchase_bonus'; names: string[]; totalBonus: number }
  | { type: 'referred_bonus'; coins: number; gems: number };
```

- [ ] **Step 2: Add `pushReferralNotification` to the `GameActions` interface**

Locate `dismissReferralNotification: () => void;` (around line 124) and add the new action above it:

```ts
pushReferralNotification: (notification: ReferralNotification) => void;
dismissReferralNotification: () => void;
```

- [ ] **Step 3: Implement `pushReferralNotification` in the store**

Locate `dismissReferralNotification: () => set(...)` (around line 344) and add the new implementation above it:

```ts
pushReferralNotification: (notification) => set((cur) => ({
  pendingReferralNotifications: [...cur.pendingReferralNotifications, notification],
})),
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower
npx tsc --noEmit 2>&1 | grep gameStore
```

Expected: no errors mentioning `gameStore.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat: add referred_bonus notification type and pushReferralNotification to gameStore"
```

---

### Task 3: `referralStore` — dispatch reward notification after apply

**Files:**
- Modify: `src/stores/referralStore.ts`

**Interfaces:**
- Consumes: `useGameStore.getState().pushReferralNotification` from Task 2
- Consumes: `api.post` now typed to return `{ ok: true; coins: number; gems: number }`

- [ ] **Step 1: Import `useGameStore` at the top of `referralStore.ts`**

Add below the existing imports:

```ts
import { useGameStore } from './gameStore';
```

- [ ] **Step 2: Replace `applyReferralCode` in the store**

```ts
applyReferralCode: async (code) => {
  set({ isApplying: true });
  try {
    const data = await api.post<{ ok: true; coins: number; gems: number }>(
      '/referrals/apply-code',
      { code },
    );
    authStorage.remove('referral.pendingCode');
    useGameStore.getState().pushReferralNotification({
      type: 'referred_bonus',
      coins: data.coins,
      gems: data.gems,
    });
    set({ hasUsedCode: true, isApplying: false });
  } catch (e) {
    set({ isApplying: false });
    throw e;
  }
},
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower
npx tsc --noEmit 2>&1 | grep referralStore
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/stores/referralStore.ts
git commit -m "feat: dispatch referred_bonus notification to gameStore after applying referral code"
```

---

### Task 4: Modal UI — `referred_bonus` branch

**Files:**
- Modify: `src/components/ReferralNotificationModal.tsx`

**Interfaces:**
- Consumes: `notification.type === 'referred_bonus'` with `coins: number` and `gems: number`
- Consumes: `assets/img/confetti.png` (already exists)

- [ ] **Step 1: Add `isReferredBonusModal` and conditional gradient**

At the top of `ReferralNotificationModal`, after the existing `isPurchaseModal` line, add:

```ts
const isReferredBonusModal = notification?.type === 'referred_bonus';
```

Then locate `<LinearGradient colors={['#E8F4FF', '#D0E8FF']} style={styles.cardGradient}>` and make the colors conditional:

```tsx
<LinearGradient
  colors={isReferredBonusModal ? ['#E8FFF0', '#D0F5DC'] : ['#E8F4FF', '#D0E8FF']}
  style={styles.cardGradient}
>
```

- [ ] **Step 2: Add the `referred_bonus` card content**

Add a new branch at the end of `cardGradient`'s children, after the `{isPurchaseModal && (...)}` block:

```tsx
{notification?.type === 'referred_bonus' && (
  <>
    <Image
      source={require('../../assets/img/confetti.png')}
      style={styles.confettiIcon}
      resizeMode="contain"
    />
    <Text style={styles.title}>Welcome Bonus!</Text>
    <Text style={styles.body}>You used a referral code</Text>
    <View style={styles.referredRewardRow}>
      <View style={styles.rewardRow}>
        <Image
          source={require('../../assets/img/coin.png')}
          style={{ width: 18, height: 18 }}
        />
        <Text style={styles.rewardText}>+{notification.coins.toLocaleString()}</Text>
      </View>
      <View style={styles.rewardRow}>
        <GemIcon size={18} />
        <Text style={styles.rewardText}>+{notification.gems}</Text>
      </View>
    </View>
    <Pressable
      onPress={dismiss}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <LinearGradient colors={['#3FA535', '#2D7A25']} style={styles.buttonGradient}>
        <Text style={styles.buttonText}>Awesome!</Text>
      </LinearGradient>
      <View style={styles.buttonShadow} />
    </Pressable>
  </>
)}
```

- [ ] **Step 3: Add `confettiIcon` and `referredRewardRow` styles**

Inside `StyleSheet.create({...})`, add after `purchaseIllustration`:

```ts
confettiIcon: {
  width: 72,
  height: 72,
},
referredRewardRow: {
  flexDirection: 'row',
  gap: 10,
},
```

- [ ] **Step 4: Verify TypeScript compiles cleanly**

```bash
cd /Users/Apple/IT/tinytower
npx tsc --noEmit 2>&1 | grep ReferralNotificationModal
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ReferralNotificationModal.tsx
git commit -m "feat: add referred_bonus modal with green gradient, confetti icon, and coin+gem pills"
```
