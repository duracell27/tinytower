# Referral Reward Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-milestone gem-only referral system with registration→10k coins, level 10→20 gems, level 30→50 gems.

**Architecture:** DB gains two new nullable columns; the server referral service and sync service are updated in tandem; client types and UI follow. No breaking API changes — the `/referrals/claim` endpoint gains a new valid enum value and the `/player/referral` response gains a new `level10` milestone block.

**Tech Stack:** NestJS + Prisma (server), Zustand + React Native / Expo (client), Jest (tests).

## Global Constraints

- Keep `LEVEL30_GEMS = 50` unchanged.
- Existing unclaimed `registered` milestones pay out coins (no legacy gem path).
- Run `npm test` from `server/` after every server task; all tests must pass before committing.
- Never skip the Prisma migration — schema changes must be matched with a migration file.

---

### Task 1: DB Schema + Migration

**Files:**
- Modify: `server/prisma/schema.prisma` (Referral model)
- Create: `server/prisma/migrations/<timestamp>_add_level10_referral_milestone/migration.sql` (auto-generated)

**Interfaces:**
- Produces: `Referral` model with `level10ReachedAt DateTime?` and `level10ClaimedAt DateTime?` columns available to all later tasks.

- [ ] **Step 1: Add columns to schema**

In `server/prisma/schema.prisma`, find the `Referral` model and add two lines after `level30ClaimedAt`:

```prisma
model Referral {
  id                   String    @id @default(uuid())
  referrerId           String
  referredId           String    @unique
  referredName         String
  createdAt            DateTime  @default(now())
  registeredClaimedAt  DateTime?
  level10ReachedAt     DateTime?   // ← add
  level10ClaimedAt     DateTime?   // ← add
  level30ReachedAt     DateTime?
  level30ClaimedAt     DateTime?
  gemBonusEarned       Int       @default(0)
  referrer             Player    @relation("ReferrerReferrals", fields: [referrerId], references: [id], onDelete: Cascade)
  referred             Player    @relation("ReferredReferral", fields: [referredId], references: [id], onDelete: Cascade)

  @@index([referrerId])
}
```

- [ ] **Step 2: Generate migration**

```bash
cd server && npx prisma migrate dev --name add_level10_referral_milestone
```

Expected: `✔ Generated Prisma Client`, migration SQL file created under `prisma/migrations/`.

- [ ] **Step 3: Verify Prisma client regenerated**

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client` (no errors).

- [ ] **Step 4: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/
git commit -m "feat(db): add level10 milestone columns to Referral"
```

---

### Task 2: Server — Referral Service + Controller

**Files:**
- Modify: `server/src/referral/referral.service.ts`
- Modify: `server/src/referral/referral.controller.ts`
- Create: `server/src/referral/__tests__/referral.service.spec.ts`

**Interfaces:**
- Consumes: Prisma `Referral` model with `level10ReachedAt` / `level10ClaimedAt` (Task 1).
- Produces:
  - `claimMilestone(playerId, referralId, 'registered')` → `{ coins: 10000 }`, increments `playerState.balance`
  - `claimMilestone(playerId, referralId, 'level10')` → `{ gems: 20 }`, increments `playerState.gems`
  - `claimMilestone(playerId, referralId, 'level30')` → `{ gems: 50 }`, increments `playerState.gems` (unchanged)
  - `getPlayerReferral(playerId)` response includes `milestones.level10: { reachedAt, claimedAt }`

- [ ] **Step 1: Update referral.service.ts**

Replace the full contents of `server/src/referral/referral.service.ts`:

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const REGISTERED_COINS = 10_000;
const LEVEL10_GEMS = 20;
const LEVEL30_GEMS = 50;
const PURCHASE_BONUS_PERCENT = 10;

function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = randomBytes(6);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

@Injectable()
export class ReferralService {
  constructor(private prisma: PrismaService) {}

  async getPlayerReferral(playerId: string) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: { referralCode: true },
    });
    if (!player) throw new NotFoundException('Player not found');

    let referralCode = player.referralCode;
    if (!referralCode) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateReferralCode();
        const existing = await this.prisma.player.findUnique({ where: { referralCode: candidate } });
        if (!existing) { referralCode = candidate; break; }
      }
      if (referralCode) {
        await this.prisma.player.update({
          where: { id: playerId },
          data: { referralCode },
        });
      }
    }

    const referrals = await this.prisma.referral.findMany({
      where: { referrerId: playerId },
      include: { referred: { select: { playerLevel: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return {
      code: referralCode ?? null,
      referrals: referrals.map((r) => ({
        id: r.id,
        referredName: r.referredName,
        referredLevel: r.referred.playerLevel,
        milestones: {
          registered: { claimedAt: r.registeredClaimedAt?.toISOString() ?? null },
          level10: {
            reachedAt: r.level10ReachedAt?.toISOString() ?? null,
            claimedAt: r.level10ClaimedAt?.toISOString() ?? null,
          },
          level30: {
            reachedAt: r.level30ReachedAt?.toISOString() ?? null,
            claimedAt: r.level30ClaimedAt?.toISOString() ?? null,
          },
        },
        gemBonusEarned: r.gemBonusEarned,
      })),
    };
  }

  async claimMilestone(
    playerId: string,
    referralId: string,
    milestone: 'registered' | 'level10' | 'level30',
  ) {
    return this.prisma.$transaction(async (tx) => {
      const referral = await tx.referral.findUnique({ where: { id: referralId } });

      if (!referral || referral.referrerId !== playerId) {
        throw new NotFoundException('Referral not found');
      }

      if (milestone === 'registered') {
        if (referral.registeredClaimedAt) throw new BadRequestException('Already claimed');
        await tx.referral.update({
          where: { id: referralId },
          data: { registeredClaimedAt: new Date() },
        });
        await tx.playerState.update({
          where: { playerId },
          data: { balance: { increment: REGISTERED_COINS } },
        });
        return { coins: REGISTERED_COINS };
      }

      if (milestone === 'level10') {
        if (!referral.level10ReachedAt) throw new BadRequestException('Milestone not yet reached');
        if (referral.level10ClaimedAt) throw new BadRequestException('Already claimed');
        await tx.referral.update({
          where: { id: referralId },
          data: { level10ClaimedAt: new Date() },
        });
        await tx.playerState.update({
          where: { playerId },
          data: { gems: { increment: LEVEL10_GEMS } },
        });
        return { gems: LEVEL10_GEMS };
      }

      if (milestone === 'level30') {
        if (!referral.level30ReachedAt) throw new BadRequestException('Milestone not yet reached');
        if (referral.level30ClaimedAt) throw new BadRequestException('Already claimed');
        await tx.referral.update({
          where: { id: referralId },
          data: { level30ClaimedAt: new Date() },
        });
        await tx.playerState.update({
          where: { playerId },
          data: { gems: { increment: LEVEL30_GEMS } },
        });
        return { gems: LEVEL30_GEMS };
      }

      throw new BadRequestException('Unknown milestone');
    });
  }

  async processPurchaseBonus(buyerId: string, purchaseAmount: number) {
    const referral = await this.prisma.referral.findUnique({
      where: { referredId: buyerId },
    });
    if (!referral) return;

    const bonus = Math.floor(purchaseAmount * PURCHASE_BONUS_PERCENT / 100);
    if (bonus <= 0) return;

    await this.prisma.$transaction([
      this.prisma.referral.update({
        where: { id: referral.id },
        data: { gemBonusEarned: { increment: bonus } },
      }),
      this.prisma.playerState.update({
        where: { playerId: referral.referrerId },
        data: { gems: { increment: bonus } },
      }),
      this.prisma.referralPurchaseNotification.create({
        data: {
          referrerId: referral.referrerId,
          referredName: referral.referredName,
          bonus,
          purchaseAmount,
        },
      }),
    ]);
  }
}
```

- [ ] **Step 2: Update referral.controller.ts**

Change the Zod enum on line 10:

```typescript
const ClaimSchema = z.object({
  referralId: z.string().uuid(),
  milestone: z.enum(['registered', 'level10', 'level30']),
});
```

- [ ] **Step 3: Write tests**

Create `server/src/referral/__tests__/referral.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReferralService } from '../referral.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ReferralService', () => {
  let service: ReferralService;
  let prisma: Record<string, any>;
  let txMock: Record<string, any>;

  const REFERRAL_ID = 'ref-uuid';
  const PLAYER_ID = 'player-uuid';
  const REFERRED_ID = 'referred-uuid';

  const makeReferral = (overrides = {}) => ({
    id: REFERRAL_ID,
    referrerId: PLAYER_ID,
    referredId: REFERRED_ID,
    referredName: 'Alice',
    createdAt: new Date(),
    registeredClaimedAt: null,
    level10ReachedAt: null,
    level10ClaimedAt: null,
    level30ReachedAt: null,
    level30ClaimedAt: null,
    gemBonusEarned: 0,
    ...overrides,
  });

  beforeEach(async () => {
    txMock = {
      referral: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      playerState: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    prisma = {
      player: { findUnique: jest.fn(), update: jest.fn() },
      referral: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (fn: (tx: any) => Promise<any>) => fn(txMock)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ReferralService>(ReferralService);
  });

  describe('claimMilestone registered', () => {
    it('gives 10000 coins and marks registeredClaimedAt', async () => {
      txMock.referral.findUnique.mockResolvedValue(makeReferral());

      const result = await service.claimMilestone(PLAYER_ID, REFERRAL_ID, 'registered');

      expect(result).toEqual({ coins: 10000 });
      expect(txMock.playerState.update).toHaveBeenCalledWith({
        where: { playerId: PLAYER_ID },
        data: { balance: { increment: 10000 } },
      });
      expect(txMock.referral.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ registeredClaimedAt: expect.any(Date) }) }),
      );
    });

    it('throws if already claimed', async () => {
      txMock.referral.findUnique.mockResolvedValue(makeReferral({ registeredClaimedAt: new Date() }));

      await expect(
        service.claimMilestone(PLAYER_ID, REFERRAL_ID, 'registered'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('claimMilestone level10', () => {
    it('gives 20 gems when level10ReachedAt is set', async () => {
      txMock.referral.findUnique.mockResolvedValue(makeReferral({ level10ReachedAt: new Date() }));

      const result = await service.claimMilestone(PLAYER_ID, REFERRAL_ID, 'level10');

      expect(result).toEqual({ gems: 20 });
      expect(txMock.playerState.update).toHaveBeenCalledWith({
        where: { playerId: PLAYER_ID },
        data: { gems: { increment: 20 } },
      });
    });

    it('throws if milestone not yet reached', async () => {
      txMock.referral.findUnique.mockResolvedValue(makeReferral({ level10ReachedAt: null }));

      await expect(
        service.claimMilestone(PLAYER_ID, REFERRAL_ID, 'level10'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws if already claimed', async () => {
      txMock.referral.findUnique.mockResolvedValue(
        makeReferral({ level10ReachedAt: new Date(), level10ClaimedAt: new Date() }),
      );

      await expect(
        service.claimMilestone(PLAYER_ID, REFERRAL_ID, 'level10'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('claimMilestone level30', () => {
    it('gives 50 gems when level30ReachedAt is set', async () => {
      txMock.referral.findUnique.mockResolvedValue(makeReferral({ level30ReachedAt: new Date() }));

      const result = await service.claimMilestone(PLAYER_ID, REFERRAL_ID, 'level30');

      expect(result).toEqual({ gems: 50 });
      expect(txMock.playerState.update).toHaveBeenCalledWith({
        where: { playerId: PLAYER_ID },
        data: { gems: { increment: 50 } },
      });
    });

    it('throws if milestone not yet reached', async () => {
      txMock.referral.findUnique.mockResolvedValue(makeReferral({ level30ReachedAt: null }));

      await expect(
        service.claimMilestone(PLAYER_ID, REFERRAL_ID, 'level30'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('claimMilestone auth', () => {
    it('throws NotFoundException if referral belongs to different player', async () => {
      txMock.referral.findUnique.mockResolvedValue(makeReferral({ referrerId: 'other-player' }));

      await expect(
        service.claimMilestone(PLAYER_ID, REFERRAL_ID, 'registered'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd server && npm test -- --testPathPattern="referral.service" --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/referral/referral.service.ts server/src/referral/referral.controller.ts server/src/referral/__tests__/referral.service.spec.ts
git commit -m "feat(server): referral rewards — coins on register, add level10 milestone"
```

---

### Task 3: Server — Sync Service

**Files:**
- Modify: `server/src/sync/sync.service.ts`
- Modify: `server/src/sync/__tests__/sync.service.spec.ts`

**Interfaces:**
- Consumes: Prisma `Referral` model with `level10ReachedAt` / `level10ClaimedAt` (Task 1).
- Produces: `SyncResult.pendingReferralClaims` items with shape:
  ```typescript
  { id: string; referredName: string; milestone: 'registered' | 'level10' | 'level30'; gems?: number; coins?: number }
  ```
  - `registered` item carries `coins: 10000` (no `gems`)
  - `level10` item carries `gems: 20` (no `coins`)
  - `level30` item carries `gems: 50` (no `coins`)

- [ ] **Step 1: Update SyncResult type and constants in sync.service.ts**

Replace lines 12–34 (the `SyncResult` interface) with:

```typescript
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

- [ ] **Step 2: Add level10 detection**

In `sync.service.ts`, find the level30 detection block (around line 132):

```typescript
    if (player.playerLevel < 30 && xpResult.playerLevel >= 30) {
      await this.prisma.referral.updateMany({
        where: { referredId: playerId, level30ReachedAt: null },
        data: { level30ReachedAt: new Date() },
      });
    }
```

Add the level10 check immediately after it:

```typescript
    if (player.playerLevel < 10 && xpResult.playerLevel >= 10) {
      await this.prisma.referral.updateMany({
        where: { referredId: playerId, level10ReachedAt: null },
        data: { level10ReachedAt: new Date() },
      });
    }
```

- [ ] **Step 3: Update pending claims constants and query**

Find the block starting at `const REGISTERED_GEMS = 5;` (around line 425) and replace everything from there through the end of the `pendingReferralClaims` loop:

```typescript
    const REGISTERED_COINS = 10_000;
    const LEVEL10_GEMS = 20;
    const LEVEL30_GEMS = 50;

    const pendingReferrals = await this.prisma.referral.findMany({
      where: {
        referrerId: playerId,
        OR: [
          { registeredClaimedAt: null },
          { level10ReachedAt: { not: null }, level10ClaimedAt: null },
          { level30ReachedAt: { not: null }, level30ClaimedAt: null },
        ],
      },
    });

    const pendingReferralClaims: SyncResult['pendingReferralClaims'] = [];
    for (const r of pendingReferrals) {
      if (!r.registeredClaimedAt) {
        pendingReferralClaims.push({
          id: r.id,
          referredName: r.referredName,
          milestone: 'registered',
          coins: REGISTERED_COINS,
        });
      }
      if (r.level10ReachedAt && !r.level10ClaimedAt) {
        pendingReferralClaims.push({
          id: r.id,
          referredName: r.referredName,
          milestone: 'level10',
          gems: LEVEL10_GEMS,
        });
      }
      if (r.level30ReachedAt && !r.level30ClaimedAt) {
        pendingReferralClaims.push({
          id: r.id,
          referredName: r.referredName,
          milestone: 'level30',
          gems: LEVEL30_GEMS,
        });
      }
    }
```

- [ ] **Step 4: Fix the sync test mock**

In `server/src/sync/__tests__/sync.service.spec.ts`, find the `prisma = { ... }` object in `beforeEach` (around line 136) and add `referral` and `referralPurchaseNotification` entries:

```typescript
    prisma = {
      player: {
        findUnique: jest.fn(),
      },
      commandLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      playerCategoryProgress: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      referral: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      referralPurchaseNotification: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn(async (fn: (tx: any) => Promise<void>) => {
        await fn(txMock);
      }),
    };
```

- [ ] **Step 5: Add level10 detection test to sync spec**

Background: `xpForLevel(9) = 5000` (from the XP table). A `buy 'buns'` at mock level 1 costs 9 coins, giving 9 XP. Starting playerXp at 4991 means 4991+9=5000 triggers a level-up to 10.

At the end of the `describe('processSync', ...)` block in `sync.service.spec.ts`, add:

```typescript
    it('sets level10ReachedAt when player crosses level 10', async () => {
      const level9Player = { ...mockPlayer, playerLevel: 9, playerXp: 4991 };
      prisma.player.findUnique
        .mockResolvedValueOnce(level9Player)
        .mockResolvedValueOnce({ ...level9Player, playerLevel: 10 });

      const buyCmd: Command = {
        id: 'cmd-level10',
        type: 'buy',
        floorId: 2,
        slotIdx: 0,
        typeId: 'buns',
        timestamp: Date.now(),
      };

      await syncService.processSync('player-uuid', [buyCmd], 0);

      expect(prisma.referral.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ referredId: 'player-uuid', level10ReachedAt: null }),
          data: expect.objectContaining({ level10ReachedAt: expect.any(Date) }),
        }),
      );
    });
```

- [ ] **Step 6: Run all server tests**

```bash
cd server && npm test --no-coverage
```

Expected: all tests PASS (including the 15 previously failing sync tests).

- [ ] **Step 7: Commit**

```bash
git add server/src/sync/sync.service.ts server/src/sync/__tests__/sync.service.spec.ts
git commit -m "feat(server): detect level10 milestone in sync, fix test mocks, update claim payload shape"
```

---

### Task 4: Client Types

**Files:**
- Modify: `src/services/sync.ts`
- Modify: `src/stores/gameStore.ts`
- Modify: `src/stores/referralStore.ts`

**Interfaces:**
- Consumes: Updated server response shapes from Tasks 2 & 3.
- Produces:
  - `SyncResponse.pendingReferralClaims` items typed with `milestone: 'registered' | 'level10' | 'level30'` and optional `gems?`/`coins?`
  - `ReferralNotification` discriminated union: `registered` carries `coins`, `level10`/`level30` carry `gems`
  - `ReferralEntry.milestones` includes `level10: { reachedAt, claimedAt }`

- [ ] **Step 1: Update SyncResponse in src/services/sync.ts**

Replace lines 20–25 (the `pendingReferralClaims` type inside `SyncResponse`):

```typescript
  pendingReferralClaims?: Array<{
    id: string;
    referredName: string;
    milestone: 'registered' | 'level10' | 'level30';
    gems?: number;
    coins?: number;
  }>;
```

- [ ] **Step 2: Update ReferralNotification in src/stores/gameStore.ts**

Replace lines 55–57 (the `ReferralNotification` type):

```typescript
export type ReferralNotification =
  | { type: 'claim'; referralId: string; referredName: string; milestone: 'registered'; coins: number }
  | { type: 'claim'; referralId: string; referredName: string; milestone: 'level10' | 'level30'; gems: number }
  | { type: 'purchase_bonus'; names: string[]; totalBonus: number };
```

- [ ] **Step 3: Update enqueueReferralNotifications signature and implementation in gameStore.ts**

Find lines 119–122 (the function signature in the interface):

```typescript
  enqueueReferralNotifications: (
    claims: Array<{ id: string; referredName: string; milestone: 'registered' | 'level10' | 'level30'; gems?: number; coins?: number }>,
    bonuses: Array<{ referredName: string; bonus: number; purchaseAmount: number }>,
  ) => void;
```

Find lines 314–329 (the implementation) and replace with:

```typescript
  enqueueReferralNotifications: (claims, bonuses) => set((cur) => {
    const newNotifs: ReferralNotification[] = [
      ...claims.map((c): ReferralNotification => {
        if (c.milestone === 'registered') {
          return {
            type: 'claim',
            referralId: c.id,
            referredName: c.referredName,
            milestone: 'registered',
            coins: c.coins ?? 0,
          };
        }
        return {
          type: 'claim',
          referralId: c.id,
          referredName: c.referredName,
          milestone: c.milestone as 'level10' | 'level30',
          gems: c.gems ?? 0,
        };
      }),
    ];
    if (bonuses.length > 0) {
      const names = bonuses.map((b) => b.referredName);
      const totalBonus = bonuses.reduce((sum, b) => sum + b.bonus, 0);
      newNotifs.push({ type: 'purchase_bonus', names, totalBonus });
    }
    return { pendingReferralNotifications: [...cur.pendingReferralNotifications, ...newNotifs] };
  }),
```

- [ ] **Step 4: Update ReferralEntry in src/stores/referralStore.ts**

Replace lines 4–12 (the `ReferralEntry` interface):

```typescript
export interface ReferralEntry {
  id: string;
  referredName: string;
  referredLevel: number;
  milestones: {
    registered: { claimedAt: string | null };
    level10: { reachedAt: string | null; claimedAt: string | null };
    level30: { reachedAt: string | null; claimedAt: string | null };
  };
  gemBonusEarned: number;
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to referral types (ignore pre-existing unrelated warnings if any).

- [ ] **Step 6: Commit**

```bash
git add src/services/sync.ts src/stores/gameStore.ts src/stores/referralStore.ts
git commit -m "feat(client): update referral types — level10 milestone, coins for registered"
```

---

### Task 5: Client UI

**Files:**
- Modify: `src/screens/ReferralScreen.tsx`
- Modify: `src/components/ReferralNotificationModal.tsx`

**Interfaces:**
- Consumes: `ReferralEntry` with `milestones.level10` (Task 4), `ReferralNotification` discriminated union (Task 4).

- [ ] **Step 1: Update ReferralScreen.tsx**

Replace the `MilestoneRow` component (lines 19–56) with a version that accepts `rewardType`:

```typescript
function MilestoneRow({
  label,
  rewardAmount,
  rewardType,
  claimed,
  reachable,
  currentLevel,
}: {
  label: string;
  rewardAmount: number;
  rewardType: 'gems' | 'coins';
  claimed: boolean;
  reachable: boolean;
  currentLevel?: number;
}) {
  const rewardIcon =
    rewardType === 'coins'
      ? require('../../assets/img/coin.png')
      : require('../../assets/img/diamond.png');
  const rewardLabel =
    rewardType === 'coins'
      ? `+${rewardAmount.toLocaleString()}`
      : `+${rewardAmount}`;

  return (
    <View style={styles.milestoneRow}>
      <Image source={claimed ? ICON_OK : ICON_CLOCK} style={styles.milestoneIcon} contentFit="contain" />
      <Text style={styles.milestoneLabel}>{label}</Text>
      <View style={{ flex: 1 }} />
      {claimed ? (
        <View style={styles.milestoneValueRow}>
          <Text style={styles.milestoneEarned}>{rewardLabel} </Text>
          <Image source={rewardIcon} style={styles.diamondIcon} contentFit="contain" />
          <Text style={styles.milestoneEarned}> Claimed</Text>
        </View>
      ) : reachable ? (
        <View style={styles.milestoneValueRow}>
          <Text style={styles.milestonePending}>{rewardLabel} </Text>
          <Image source={rewardIcon} style={styles.diamondIcon} contentFit="contain" />
          <Text style={styles.milestonePending}> Pending</Text>
        </View>
      ) : currentLevel !== undefined ? (
        <Text style={styles.milestonePending}>lv {currentLevel}</Text>
      ) : (
        <Text style={styles.milestonePending}>Not reached</Text>
      )}
    </View>
  );
}
```

Replace the `ReferralCard` component (lines 58–88) to show three milestones:

```typescript
function ReferralCard({ entry }: { entry: ReferralEntry }) {
  return (
    <View style={styles.referralCard}>
      <View style={styles.referralNameRow}>
        <Image source={getUserIcon(entry.referredLevel)} style={styles.referralAvatar} contentFit="cover" />
        <Text style={styles.referralName}>{entry.referredName}</Text>
      </View>
      <MilestoneRow
        label="Registration"
        rewardAmount={10000}
        rewardType="coins"
        claimed={!!entry.milestones.registered.claimedAt}
        reachable={false}
      />
      <MilestoneRow
        label="Level 10"
        rewardAmount={20}
        rewardType="gems"
        claimed={!!entry.milestones.level10.claimedAt}
        reachable={!!entry.milestones.level10.reachedAt}
        currentLevel={entry.milestones.level10.reachedAt ? undefined : entry.referredLevel}
      />
      <MilestoneRow
        label="Level 30"
        rewardAmount={50}
        rewardType="gems"
        claimed={!!entry.milestones.level30.claimedAt}
        reachable={!!entry.milestones.level30.reachedAt}
        currentLevel={entry.milestones.level30.reachedAt ? undefined : entry.referredLevel}
      />
      {entry.gemBonusEarned > 0 && (
        <View style={styles.milestoneRow}>
          <Image source={ICON_GEM_BONUS} style={styles.milestoneIcon} contentFit="contain" />
          <Text style={styles.milestoneLabel}>Purchase bonus</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.milestoneEarned}>+{entry.gemBonusEarned} 💎</Text>
        </View>
      )}
    </View>
  );
}
```

> `assets/img/coin.png` exists and is the correct path for both files.

- [ ] **Step 2: Update ReferralNotificationModal.tsx**

Replace the `handleClaim` function (lines 28–44) — the API response type can now be `{ gems: number } | { coins: number }` so remove the generic constraint:

```typescript
  const handleClaim = async () => {
    if (notification?.type !== 'claim') return;
    setLoading(true);
    setError('');
    try {
      await api.post('/referrals/claim', {
        referralId: notification.referralId,
        milestone: notification.milestone,
      });
      dismiss();
      syncService.triggerSync();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };
```

Replace the claim modal body (lines 64–93) to branch on milestone:

```typescript
              {isClaimModal && (
                <>
                  <Text style={styles.emoji}>🎉</Text>
                  <Text style={styles.title}>Referral Reward!</Text>
                  <Text style={styles.body}>
                    {notification.referredName}{' '}
                    {notification.milestone === 'registered'
                      ? 'joined via your link'
                      : notification.milestone === 'level10'
                      ? 'reached level 10'
                      : 'reached level 30'}
                  </Text>
                  <View style={styles.rewardRow}>
                    {notification.milestone === 'registered' ? (
                      <>
                        <Image
                          source={require('../../assets/img/coin.png')}
                          style={{ width: 18, height: 18 }}
                        />
                        <Text style={styles.rewardText}>+{(notification as any).coins.toLocaleString()}</Text>
                      </>
                    ) : (
                      <>
                        <GemIcon size={18} />
                        <Text style={styles.rewardText}>+{(notification as any).gems}</Text>
                      </>
                    )}
                  </View>
                  {error ? <Text style={styles.errorText}>{error}</Text> : null}
                  <Pressable
                    onPress={handleClaim}
                    disabled={loading}
                    style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                  >
                    <LinearGradient colors={['#4A9FE0', '#2F7BC0']} style={styles.buttonGradient}>
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : notification.milestone === 'registered' ? (
                        <Text style={styles.buttonText}>Claim 10,000 🪙</Text>
                      ) : notification.milestone === 'level10' ? (
                        <Text style={styles.buttonText}>Claim 20 💎</Text>
                      ) : (
                        <Text style={styles.buttonText}>Claim 50 💎</Text>
                      )}
                    </LinearGradient>
                    <View style={styles.buttonShadow} />
                  </Pressable>
                </>
              )}
```

> Note: the `(notification as any).coins` / `.gems` casts are needed because TypeScript narrows `notification.milestone` but the discriminated union lives on the `ReferralNotification` type — alternatively access via type guard, but the cast is simpler here.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/screens/ReferralScreen.tsx src/components/ReferralNotificationModal.tsx
git commit -m "feat(ui): referral screen — 3 milestones, coins for registration, level10 row"
```
