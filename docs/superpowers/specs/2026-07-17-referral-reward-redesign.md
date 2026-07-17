# Referral Reward Redesign

**Date:** 2026-07-17  
**Status:** Approved

## Overview

Replace the two-milestone gem-only referral reward system with a three-milestone system that mixes coins and gems.

### Before → After

| Milestone | Before | After |
|-----------|--------|-------|
| Registration | +5 💎 | +10,000 🪙 |
| Level 10 | — | +20 💎 |
| Level 30 | +50 💎 | +50 💎 (unchanged) |

Existing unclaimed `registered` milestones will pay out coins (not preserved as gems).

---

## Database

Add two nullable columns to the `Referral` model:

```prisma
level10ReachedAt  DateTime?
level10ClaimedAt  DateTime?
```

Create a Prisma migration. Existing rows get `NULL` for both columns.

---

## Server

### `referral.service.ts`

- Remove `REGISTERED_GEMS = 5`
- Add `REGISTERED_COINS = 10_000`
- Add `LEVEL10_GEMS = 20`
- Keep `LEVEL30_GEMS = 50`

`claimMilestone` changes:
- `registered`: increment `balance` (coins) by `REGISTERED_COINS`, return `{ coins: REGISTERED_COINS }`
- `level10` (new): guard on `level10ReachedAt`, guard on `level10ClaimedAt`, increment `gems` by `LEVEL10_GEMS`, return `{ gems: LEVEL10_GEMS }`
- `level30`: unchanged

`getPlayerReferral` response — add `level10` to milestones shape:
```ts
milestones: {
  registered: { claimedAt },
  level10: { reachedAt, claimedAt },
  level30: { reachedAt, claimedAt },
}
```

### `referral.controller.ts`

Update Zod schema: `milestone: z.enum(['registered', 'level10', 'level30'])`

### `sync.service.ts`

**Level detection** — add level 10 check alongside the existing level 30 check:
```ts
if (player.playerLevel < 10 && xpResult.playerLevel >= 10) {
  await prisma.referral.updateMany({
    where: { referredId: playerId, level10ReachedAt: null },
    data: { level10ReachedAt: new Date() },
  });
}
```

**Pending claims query** — extend the `OR` filter:
```ts
{ registeredClaimedAt: null }
{ level10ReachedAt: { not: null }, level10ClaimedAt: null }
{ level30ReachedAt: { not: null }, level30ClaimedAt: null }
```

**Claim payload** — change shape to carry either `coins` or `gems`:
- `registered` → `{ ..., milestone: 'registered', coins: 10_000 }`
- `level10`    → `{ ..., milestone: 'level10', gems: 20 }`
- `level30`    → `{ ..., milestone: 'level30', gems: 50 }`

Update `SyncResult` type accordingly.

---

## Client

### `src/services/sync.ts`

Update `SyncResponse.pendingReferralClaims` item shape:
```ts
{ id: string; referredName: string; milestone: 'registered' | 'level10' | 'level30'; gems?: number; coins?: number }
```

### `src/stores/gameStore.ts`

Update `ReferralNotification` to discriminated union:
```ts
| { type: 'claim'; referralId: string; referredName: string; milestone: 'registered'; coins: number }
| { type: 'claim'; referralId: string; referredName: string; milestone: 'level10' | 'level30'; gems: number }
| { type: 'purchase_bonus'; names: string[]; totalBonus: number }
```

Update `enqueueReferralNotifications` signature to match.

### `src/stores/referralStore.ts`

Add `level10` to `ReferralEntry.milestones`:
```ts
milestones: {
  registered: { claimedAt: string | null };
  level10: { reachedAt: string | null; claimedAt: string | null };
  level30: { reachedAt: string | null; claimedAt: string | null };
}
```

### `src/screens/ReferralScreen.tsx`

`ReferralCard` shows 3 rows:
1. Registration — coins icon, `+10,000 🪙`
2. Level 10 — gem icon, `+20 💎`
3. Level 30 — gem icon, `+50 💎`

`MilestoneRow` gains a `rewardType: 'gems' | 'coins'` prop to switch icon and formatting.

### `src/components/ReferralNotificationModal.tsx`

- `registered` milestone: coin icon, body "joined via your link", button "Claim 10,000 🪙"
- `level10` milestone: gem icon, body "reached level 10", button "Claim 20 💎"
- `level30` milestone: gem icon, body "reached level 30", button "Claim 50 💎" (unchanged text, same as before)
