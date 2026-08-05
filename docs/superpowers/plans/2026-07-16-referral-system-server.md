# Referral System — Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the server-side of the referral system: Prisma schema, referral module (GET /player/referral, POST /referrals/claim), auth registration with referral code, level-30 milestone detection in sync, and pending claim delivery via sync response.

**Architecture:** NestJS + Prisma + PostgreSQL. New `ReferralModule` handles referral endpoints. `AuthService.register()` creates the `Referral` record if a valid `referralCode` is supplied. `SyncService` detects level-30 crossing and appends `pendingReferralClaims` / `referralPurchaseBonuses` to each sync response. Gem purchase bonus wiring is left as a stub (`ReferralService.processPurchaseBonus()`) since there is no IAP endpoint yet.

**Tech Stack:** NestJS, Prisma ORM, PostgreSQL, Zod (for DTOs), crypto (for referral code generation)

## Global Constraints

- Referral code format: 6 uppercase alphanumeric characters (A-Z0-9), generated with `crypto.randomBytes`, unique per player
- Reward gems: 5 for `registered` milestone, 50 for `level30` milestone (constants in `referral.service.ts`)
- Each player can only be referred once (`referredId` is `@unique` on `Referral`)
- `pendingReferralClaims` delivered once per sync until claimed — checked by querying unclaimed milestones
- `referralPurchaseBonuses` delivered once — `ReferralPurchaseNotification.syncedAt` set when included in sync response
- All server files in `server/src/`, all imports use `@shared/` alias for shared code
- Zod used for DTO validation (matching existing pattern in `auth.controller.ts`)
- No `class-validator` decorators — project uses Zod + `safeParse` pattern

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `server/prisma/schema.prisma` | Modify | Add `referralCode` to `Player`, add `Referral` and `ReferralPurchaseNotification` models |
| `server/src/auth/dto/register.dto.ts` | Modify | Add optional `referralCode` field |
| `server/src/player/player.service.ts` | Modify | Generate unique `referralCode` in `createWithInitialState` |
| `server/src/auth/auth.service.ts` | Modify | Handle `referralCode` in `register()` — create `Referral` record and credit registered-milestone claim |
| `server/src/referral/referral.service.ts` | Create | `getPlayerReferral()`, `claimMilestone()`, `processPurchaseBonus()` |
| `server/src/referral/referral.controller.ts` | Create | `GET /player/referral`, `POST /referrals/claim` |
| `server/src/referral/referral.module.ts` | Create | NestJS module wiring |
| `server/src/sync/sync.service.ts` | Modify | Level-30 detection, append `pendingReferralClaims` + `referralPurchaseBonuses` to `SyncResult` |
| `server/src/app.module.ts` | Modify | Import `ReferralModule` |

---

### Task 1: Prisma schema and migration

**Files:**
- Modify: `server/prisma/schema.prisma`

**Interfaces:**
- Produces: `Referral` and `ReferralPurchaseNotification` Prisma models, `referralCode` field on `Player`

- [ ] **Step 1: Add `referralCode` to `Player` and add new models to `schema.prisma`**

  In `server/prisma/schema.prisma`:

  1. Add to `Player` model (after `createdAt` line):
     ```prisma
     referralCode  String?  @unique
     referrals     Referral[] @relation("ReferrerReferrals")
     referredBy    Referral?  @relation("ReferredReferral")
     purchaseNotifications ReferralPurchaseNotification[]
     ```

  2. Add new models at the end of the file:
     ```prisma
     model Referral {
       id                   String    @id @default(uuid())
       referrerId           String
       referredId           String    @unique
       referredName         String
       createdAt            DateTime  @default(now())
       registeredClaimedAt  DateTime?
       level30ReachedAt     DateTime?
       level30ClaimedAt     DateTime?
       gemBonusEarned       Int       @default(0)
       referrer             Player    @relation("ReferrerReferrals", fields: [referrerId], references: [id], onDelete: Cascade)
       referred             Player    @relation("ReferredReferral", fields: [referredId], references: [id], onDelete: Cascade)

       @@index([referrerId])
     }

     model ReferralPurchaseNotification {
       id             String    @id @default(uuid())
       referrerId     String
       referredName   String
       bonus          Int
       purchaseAmount Int
       createdAt      DateTime  @default(now())
       syncedAt       DateTime?
       referrer       Player    @relation(fields: [referrerId], references: [id], onDelete: Cascade)

       @@index([referrerId, syncedAt])
     }
     ```

- [ ] **Step 2: Run migration**

  ```bash
  cd /Users/Apple/IT/tinytower/server && npx prisma migrate dev --name add_referral_system
  ```
  Expected: migration created and applied successfully, Prisma client regenerated.

- [ ] **Step 3: Verify Prisma client compiles**

  ```bash
  cd /Users/Apple/IT/tinytower/server && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
  ```
  Expected: no errors related to Prisma types.

- [ ] **Step 4: Commit**

  ```bash
  cd /Users/Apple/IT/tinytower/server && git add prisma/schema.prisma prisma/migrations/
  git commit -m "feat(referrals): add Referral and ReferralPurchaseNotification schema"
  ```

---

### Task 2: Auth — register DTO + player service referral code generation

**Files:**
- Modify: `server/src/auth/dto/register.dto.ts`
- Modify: `server/src/player/player.service.ts`

**Interfaces:**
- Produces:
  ```ts
  // register.dto.ts
  RegisterDto: { email: string; password: string; playerName: string; referralCode?: string }

  // player.service.ts
  createWithInitialState(email, passwordHash, playerName): Player  // now writes referralCode
  findByReferralCode(code: string): Player | null
  ```

- [ ] **Step 1: Update `register.dto.ts`**

  Replace the current `RegisterSchema` with:
  ```ts
  import { z } from 'zod';

  export const RegisterSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    playerName: z.string().min(1).max(30),
    referralCode: z.string().length(6).toUpperCase().optional(),
  });

  export type RegisterDto = z.infer<typeof RegisterSchema>;
  ```

- [ ] **Step 2: Add referral code generator and `findByReferralCode` to `player.service.ts`**

  Add this helper function at the top of the file (after imports):
  ```ts
  import { randomBytes } from 'crypto';

  function generateReferralCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const bytes = randomBytes(6);
    return Array.from(bytes, (b) => chars[b % chars.length]).join('');
  }
  ```

  Add `findByReferralCode` method to `PlayerService`:
  ```ts
  async findByReferralCode(code: string) {
    return this.prisma.player.findUnique({ where: { referralCode: code } });
  }
  ```

  In `createWithInitialState`, generate a unique referral code and add it to the `player.create` data. Retry up to 5 times on unique constraint violation:
  ```ts
  async createWithInitialState(email: string, passwordHash: string, playerName: string) {
    const workers = generateRandomWorkers(5, gameConfig);

    // Generate unique referral code with retry
    let referralCode: string | undefined;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateReferralCode();
      const existing = await this.prisma.player.findUnique({ where: { referralCode: candidate } });
      if (!existing) { referralCode = candidate; break; }
    }

    return this.prisma.$transaction(async (tx) => {
      const player = await tx.player.create({
        data: {
          email,
          passwordHash,
          playerName,
          balance: gameConfig.startingBalance,
          openedFloorsCount: gameConfig.floors.length,
          referralCode,
        },
      });

      // ... rest of the transaction unchanged (floors, workers, playerState)
    });
  }
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  cd /Users/Apple/IT/tinytower/server && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
  ```
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add server/src/auth/dto/register.dto.ts server/src/player/player.service.ts
  git commit -m "feat(referrals): generate referral code at registration, add findByReferralCode"
  ```

---

### Task 3: Auth service — create Referral record on registration

**Files:**
- Modify: `server/src/auth/auth.service.ts`

**Interfaces:**
- Consumes: `PlayerService.findByReferralCode(code)` from Task 2, `PrismaService` for creating `Referral` record
- The `Referral` record is created inside the same `register()` method, after the player is created. `registeredClaimedAt` is left `null` — it becomes a pending claim for the referrer on next sync.

- [ ] **Step 1: Inject `PrismaService` into `AuthService`**

  In `auth.service.ts`, add `PrismaService` to the constructor:
  ```ts
  import { PrismaService } from '../prisma/prisma.service';

  constructor(
    private playerService: PlayerService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) { ... }
  ```

  In `auth.module.ts`, add `PrismaModule` to imports if not already present (check — `PrismaModule` is `@Global()` so it should be available).

- [ ] **Step 2: Handle `referralCode` in `register()`**

  Update the `register` method signature to accept `RegisterDto` (which now includes `referralCode?`). After creating the player, add:

  ```ts
  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.playerService.findByEmail(email);
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const player = await this.playerService.createWithInitialState(
      email, passwordHash, dto.playerName,
    );

    // If a valid referral code was provided, create the referral record
    if (dto.referralCode) {
      const referrer = await this.playerService.findByReferralCode(dto.referralCode);
      if (referrer && referrer.id !== player.id) {
        await this.prisma.referral.create({
          data: {
            referrerId: referrer.id,
            referredId: player.id,
            referredName: player.playerName,
            // registeredClaimedAt left null — becomes pending claim on referrer's next sync
          },
        });
      }
    }

    const tokens = await this.generateTokens(player.id, player.email);
    return {
      ...tokens,
      player: { id: player.id, email: player.email, playerName: player.playerName },
    };
  }
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  cd /Users/Apple/IT/tinytower/server && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add server/src/auth/auth.service.ts server/src/auth/auth.module.ts
  git commit -m "feat(referrals): create Referral record on registration with referral code"
  ```

---

### Task 4: Referral module (service + controller)

**Files:**
- Create: `server/src/referral/referral.service.ts`
- Create: `server/src/referral/referral.controller.ts`
- Create: `server/src/referral/referral.module.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Produces:
  - `GET /player/referral` → `{ code: string | null, referrals: ReferralEntry[] }`
  - `POST /referrals/claim` body: `{ referralId: string, milestone: 'registered' | 'level30' }` → `{ gems: number }`

- [ ] **Step 1: Create `referral.service.ts`**

  Create `server/src/referral/referral.service.ts`:

  ```ts
  import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
  import { PrismaService } from '../prisma/prisma.service';

  const REGISTERED_GEMS = 5;
  const LEVEL30_GEMS = 50;
  const PURCHASE_BONUS_PERCENT = 10;

  @Injectable()
  export class ReferralService {
    constructor(private prisma: PrismaService) {}

    async getPlayerReferral(playerId: string) {
      const player = await this.prisma.player.findUnique({
        where: { id: playerId },
        select: { referralCode: true },
      });
      if (!player) throw new NotFoundException('Player not found');

      const referrals = await this.prisma.referral.findMany({
        where: { referrerId: playerId },
        include: { referred: { select: { playerLevel: true } } },
        orderBy: { createdAt: 'asc' },
      });

      return {
        code: player.referralCode ?? null,
        referrals: referrals.map((r) => ({
          id: r.id,
          referredName: r.referredName,
          referredLevel: r.referred.playerLevel,
          milestones: {
            registered: { claimedAt: r.registeredClaimedAt?.toISOString() ?? null },
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
      milestone: 'registered' | 'level30',
    ) {
      const referral = await this.prisma.referral.findUnique({
        where: { id: referralId },
      });

      if (!referral || referral.referrerId !== playerId) {
        throw new NotFoundException('Referral not found');
      }

      if (milestone === 'registered') {
        if (referral.registeredClaimedAt) {
          throw new BadRequestException('Already claimed');
        }
        await this.prisma.$transaction([
          this.prisma.referral.update({
            where: { id: referralId },
            data: { registeredClaimedAt: new Date() },
          }),
          this.prisma.playerState.update({
            where: { playerId },
            data: { gems: { increment: REGISTERED_GEMS } },
          }),
        ]);
        return { gems: REGISTERED_GEMS };
      }

      if (milestone === 'level30') {
        if (!referral.level30ReachedAt) {
          throw new BadRequestException('Milestone not yet reached');
        }
        if (referral.level30ClaimedAt) {
          throw new BadRequestException('Already claimed');
        }
        await this.prisma.$transaction([
          this.prisma.referral.update({
            where: { id: referralId },
            data: { level30ClaimedAt: new Date() },
          }),
          this.prisma.playerState.update({
            where: { playerId },
            data: { gems: { increment: LEVEL30_GEMS } },
          }),
        ]);
        return { gems: LEVEL30_GEMS };
      }

      throw new BadRequestException('Unknown milestone');
    }

    // Called from gem purchase flow when implemented
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

- [ ] **Step 2: Create `referral.controller.ts`**

  Create `server/src/referral/referral.controller.ts`:

  ```ts
  import {
    Controller, Get, Post, Body, UseGuards, Req, BadRequestException,
  } from '@nestjs/common';
  import { z } from 'zod';
  import { JwtAuthGuard } from '../auth/jwt-auth.guard';
  import { ReferralService } from './referral.service';

  const ClaimSchema = z.object({
    referralId: z.string().uuid(),
    milestone: z.enum(['registered', 'level30']),
  });

  @Controller()
  export class ReferralController {
    constructor(private referralService: ReferralService) {}

    @Get('player/referral')
    @UseGuards(JwtAuthGuard)
    async getPlayerReferral(@Req() req: { user: { playerId: string } }) {
      return this.referralService.getPlayerReferral(req.user.playerId);
    }

    @Post('referrals/claim')
    @UseGuards(JwtAuthGuard)
    async claimMilestone(
      @Req() req: { user: { playerId: string } },
      @Body() body: unknown,
    ) {
      const result = ClaimSchema.safeParse(body);
      if (!result.success) throw new BadRequestException(result.error.issues);
      return this.referralService.claimMilestone(
        req.user.playerId,
        result.data.referralId,
        result.data.milestone,
      );
    }
  }
  ```

- [ ] **Step 3: Create `referral.module.ts`**

  Create `server/src/referral/referral.module.ts`:

  ```ts
  import { Module } from '@nestjs/common';
  import { ReferralService } from './referral.service';
  import { ReferralController } from './referral.controller';

  @Module({
    controllers: [ReferralController],
    providers: [ReferralService],
    exports: [ReferralService],
  })
  export class ReferralModule {}
  ```

- [ ] **Step 4: Register in `app.module.ts`**

  Add `ReferralModule` to `app.module.ts`:

  ```ts
  import { ReferralModule } from './referral/referral.module';

  @Module({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      PrismaModule,
      AuthModule,
      PlayerModule,
      SyncModule,
      LeaderboardModule,
      AchievementModule,
      ReferralModule,
    ],
  })
  export class AppModule {}
  ```

- [ ] **Step 5: Verify TypeScript compiles**

  ```bash
  cd /Users/Apple/IT/tinytower/server && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add server/src/referral/ server/src/app.module.ts
  git commit -m "feat(referrals): add referral module with GET /player/referral and POST /referrals/claim"
  ```

---

### Task 5: Sync service — level-30 detection and pending claims in response

**Files:**
- Modify: `server/src/sync/sync.service.ts`
- Modify: `server/src/sync/sync.module.ts`

**Interfaces:**
- Consumes: `ReferralService` from Task 4 (inject into SyncService)
- Produces: `SyncResult` extended with:
  ```ts
  pendingReferralClaims: Array<{ id: string; referredName: string; milestone: 'registered' | 'level30'; gems: number }>;
  referralPurchaseBonuses: Array<{ referredName: string; bonus: number; purchaseAmount: number }>;
  ```

- [ ] **Step 1: Extend `SyncResult` interface**

  In `sync.service.ts`, add to `SyncResult`:
  ```ts
  pendingReferralClaims: Array<{
    id: string;
    referredName: string;
    milestone: 'registered' | 'level30';
    gems: number;
  }>;
  referralPurchaseBonuses: Array<{
    referredName: string;
    bonus: number;
    purchaseAmount: number;
  }>;
  ```

- [ ] **Step 2: Inject `ReferralService` and `PrismaService` into `SyncService`**

  ```ts
  import { ReferralService } from '../referral/referral.service';

  constructor(
    private prisma: PrismaService,
    private achievementService: AchievementService,
    private referralService: ReferralService,
  ) {}
  ```

  In `sync.module.ts`, add `ReferralModule` to imports:
  ```ts
  import { ReferralModule } from '../referral/referral.module';

  @Module({
    imports: [PrismaModule, AchievementModule, ReferralModule],
    controllers: [SyncController],
    providers: [SyncService],
  })
  export class SyncModule {}
  ```

- [ ] **Step 3: Detect level-30 crossing and set `level30ReachedAt`**

  In `processSync`, after the XP/level-up block (after `xpResult = applyXpGain(...)`), add level-30 detection:

  ```ts
  // Level-30 referral milestone detection
  if (player.playerLevel < 30 && xpResult.playerLevel >= 30) {
    await this.prisma.referral.updateMany({
      where: { referredId: playerId, level30ReachedAt: null },
      data: { level30ReachedAt: new Date() },
    });
  }
  ```

  Place this before the main database write transaction.

- [ ] **Step 4: Query pending referral data and include in return value**

  At the end of `processSync`, before the `return` statement, add:

  ```ts
  // Pending referral claims for this player as referrer
  const REGISTERED_GEMS = 5;
  const LEVEL30_GEMS = 50;

  const pendingReferrals = await this.prisma.referral.findMany({
    where: {
      referrerId: playerId,
      OR: [
        { registeredClaimedAt: null },
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
        gems: REGISTERED_GEMS,
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

  // Unsynced purchase bonus notifications
  const unsyncedBonuses = await this.prisma.referralPurchaseNotification.findMany({
    where: { referrerId: playerId, syncedAt: null },
  });

  if (unsyncedBonuses.length > 0) {
    await this.prisma.referralPurchaseNotification.updateMany({
      where: { id: { in: unsyncedBonuses.map((n) => n.id) } },
      data: { syncedAt: new Date() },
    });
  }

  const referralPurchaseBonuses = unsyncedBonuses.map((n) => ({
    referredName: n.referredName,
    bonus: n.bonus,
    purchaseAmount: n.purchaseAmount,
  }));
  ```

  Then add to the `return` statement:
  ```ts
  return {
    state: gameState,
    stateVersion: ...,
    // ... all existing fields ...
    pendingReferralClaims,
    referralPurchaseBonuses,
  };
  ```

- [ ] **Step 5: Verify TypeScript compiles**

  ```bash
  cd /Users/Apple/IT/tinytower/server && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add server/src/sync/sync.service.ts server/src/sync/sync.module.ts
  git commit -m "feat(referrals): add level-30 detection and pending claims to sync response"
  ```

---

## Out of Scope

- Purchase bonus wiring (`processPurchaseBonus` is implemented but not called — no IAP endpoint exists yet)
- Admin analytics
- Fraud/abuse protection
