# Token Tournament Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Weekly Mon–Fri token collection tournament — tracks per-player token counts, admin publishes results on Saturday, top-10 get gems + bonus tokens, everyone gets coins via in-game mail.

**Architecture:** Lightweight parallel to the city tasks weekly ranking pattern. `PlayerWeeklyTokens` tracks counts in real-time during sync (when `claim_daily_task` accepted commands are detected). A new `TournamentService` handles leaderboard preview and publish (admin-only). Publish writes rewards directly to DB and sends in-game mail using the admin's playerId as sender.

**Tech Stack:** NestJS + Prisma (PostgreSQL), React (admin panel), React Native (client UI), Zustand.

**Spec:** `docs/superpowers/specs/2026-10-15-token-tournament-design.md`

## Global Constraints

- `weekStart` is always Monday 00:00 UTC — use `currentWeekStart()` from `server/src/city/city-task.constants.ts`
- Tournament is active Mon–Fri only — no token tracking on Sat/Sun (`isWeekdayUTC()` guard)
- Gems formula: `(11 - rank) * 100` for rank 1–10
- Bonus tokens formula: `(11 - rank) * 10` for rank 1–10, random color split
- Coins formula: `tokenCount × levelBracket × 1000`, where `levelBracket = Math.floor((playerLevel - 1) / 10) + 1`
- Mail `fromId` = admin's playerId (no system player concept exists)
- Publish is idempotent-guarded: second call throws if `PlayerTokenTournament` for that `weekStart` already exists
- Players with `tokenCount = 0` receive no mail and no rewards

## Review Focus

- **Sat/Sun claim edge case:** a player claims a daily task on Saturday — `isWeekdayUTC()` must return false and no `PlayerWeeklyTokens` row is created; test in Task 2.
- **Duplicate publish guard:** admin calls publish twice for same weekStart — second call must throw `BadRequestException`; test in Task 3.
- **Zero-token players excluded:** players who synced but collected 0 tokens must not receive mail; test in Task 3.
- **Level bracket boundary:** player at level 10 → bracket 1 (×1000 coins); player at level 11 → bracket 2 (×2000 coins); test in Task 2.
- **Bonus token random distribution:** `generateRandomTokens(100)` must sum to exactly 100 and produce non-negative values for all 5 colors; test in Task 2.

---

## File Map

**Create:**
- `server/src/tournament/tournament.constants.ts` — reward formulas, `isWeekdayUTC`, `generateRandomTokens`
- `server/src/tournament/tournament.service.ts` — `getLeaderboard`, `publishResults`
- `server/src/tournament/tournament.controller.ts` — admin endpoints
- `server/src/tournament/tournament.module.ts` — NestJS module
- `server/src/tournament/__tests__/tournament.constants.spec.ts`
- `server/src/tournament/__tests__/tournament.service.spec.ts`
- `admin/src/pages/TokenTournamentPage.tsx`

**Modify:**
- `server/prisma/schema.prisma` — add `PlayerWeeklyTokens`, `PlayerTokenTournament`, `PlayerTokenTournamentEntry`
- `server/src/sync/sync.service.ts` — track weekly tokens from accepted `claim_daily_task` commands; add `weeklyTokenCount` to `SyncResult` and final return
- `server/src/sync/sync.module.ts` — no change needed (PrismaService already injected)
- `server/src/admin/admin.module.ts` — add `TournamentService` as provider
- `server/src/admin/admin.controller.ts` — add two tournament endpoints
- `server/src/app.module.ts` — add `TournamentModule`
- `src/services/sync.ts` — add `weeklyTokenCount` to `SyncResponse` type; call `setWeeklyTokenCount` after reconcile
- `src/stores/gameStore.ts` — add `weeklyTokenCount: number` field + `setWeeklyTokenCount` action
- `app/daily-tasks.tsx` — add tournament section below task list
- `admin/src/App.tsx` — add `/token-tournament` route

---

### Task 1: DB Schema — three new Prisma models

**Files:**
- Modify: `server/prisma/schema.prisma`

**Interfaces:**
- Produces: `PlayerWeeklyTokens`, `PlayerTokenTournament`, `PlayerTokenTournamentEntry` Prisma models

- [ ] **Step 1: Add the three models to `server/prisma/schema.prisma`**

Open `server/prisma/schema.prisma`. Add these models at the end of the file (after the last existing model):

```prisma
model PlayerWeeklyTokens {
  id        String   @id @default(cuid())
  playerId  String
  weekStart DateTime
  count     Int      @default(0)

  player    Player   @relation(fields: [playerId], references: [id])

  @@unique([playerId, weekStart])
}

model PlayerTokenTournament {
  id        String   @id @default(cuid())
  weekStart DateTime @unique
  createdBy String
  createdAt DateTime @default(now())

  entries   PlayerTokenTournamentEntry[]
}

model PlayerTokenTournamentEntry {
  id           String  @id @default(cuid())
  tournamentId String
  playerId     String
  rank         Int?
  tokenCount   Int
  gemsReward   Int
  bonusTokens  Int
  coinsReward  Int

  tournament   PlayerTokenTournament @relation(fields: [tournamentId], references: [id])
  player       Player                @relation(fields: [playerId], references: [id])

  @@unique([tournamentId, playerId])
}
```

Also add the back-relations to the `Player` model. Find the `Player` model block and add inside it:

```prisma
  weeklyTokens          PlayerWeeklyTokens[]
  tokenTournamentEntries PlayerTokenTournamentEntry[]
```

- [ ] **Step 2: Run migration**

```bash
cd server
npx prisma migrate dev --name add_token_tournament
```

Expected: migration file created under `server/prisma/migrations/`, Prisma client regenerated with new types.

- [ ] **Step 3: Verify generated types compile**

```bash
cd server
npx tsc --noEmit
```

Expected: no errors related to the new models.

- [ ] **Step 4: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/
git commit -m "feat(tournament): add PlayerWeeklyTokens and PlayerTokenTournament DB models"
```

---

### Task 2: Tournament constants and helpers

**Files:**
- Create: `server/src/tournament/tournament.constants.ts`
- Create: `server/src/tournament/__tests__/tournament.constants.spec.ts`

**Interfaces:**
- Produces:
  - `isWeekdayUTC(): boolean` — true Mon–Fri
  - `GEMS_BY_RANK: Record<number, number>` — rank 1→1000, rank 2→900, …rank 10→100
  - `BONUS_TOKENS_BY_RANK: Record<number, number>` — rank 1→100, rank 2→90, …rank 10→10
  - `levelBracket(playerLevel: number): number` — `Math.floor((playerLevel - 1) / 10) + 1`
  - `coinsReward(tokenCount: number, playerLevel: number): number`
  - `generateRandomTokens(total: number): { green: number; blue: number; yellow: number; purple: number; red: number }`

- [ ] **Step 1: Write the failing tests**

Create `server/src/tournament/__tests__/tournament.constants.spec.ts`:

```ts
import {
  isWeekdayUTC,
  GEMS_BY_RANK,
  BONUS_TOKENS_BY_RANK,
  levelBracket,
  coinsReward,
  generateRandomTokens,
} from '../tournament.constants';

describe('isWeekdayUTC', () => {
  it('returns true on Monday (day 1)', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-12T10:00:00Z')); // Monday
    expect(isWeekdayUTC()).toBe(true);
  });
  it('returns true on Friday (day 5)', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-16T10:00:00Z')); // Friday
    expect(isWeekdayUTC()).toBe(true);
  });
  it('returns false on Saturday (day 6)', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-17T10:00:00Z')); // Saturday
    expect(isWeekdayUTC()).toBe(false);
  });
  it('returns false on Sunday (day 0)', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-18T10:00:00Z')); // Sunday
    expect(isWeekdayUTC()).toBe(false);
  });
  afterEach(() => jest.useRealTimers());
});

describe('GEMS_BY_RANK', () => {
  it('rank 1 = 1000, rank 10 = 100', () => {
    expect(GEMS_BY_RANK[1]).toBe(1000);
    expect(GEMS_BY_RANK[10]).toBe(100);
  });
  it('rank 5 = 600', () => {
    expect(GEMS_BY_RANK[5]).toBe(600);
  });
  it('has no entry for rank 11', () => {
    expect(GEMS_BY_RANK[11]).toBeUndefined();
  });
});

describe('BONUS_TOKENS_BY_RANK', () => {
  it('rank 1 = 100, rank 10 = 10', () => {
    expect(BONUS_TOKENS_BY_RANK[1]).toBe(100);
    expect(BONUS_TOKENS_BY_RANK[10]).toBe(10);
  });
});

describe('levelBracket', () => {
  it('level 1 → bracket 1', () => expect(levelBracket(1)).toBe(1));
  it('level 10 → bracket 1', () => expect(levelBracket(10)).toBe(1));
  it('level 11 → bracket 2', () => expect(levelBracket(11)).toBe(2));
  it('level 20 → bracket 2', () => expect(levelBracket(20)).toBe(2));
  it('level 21 → bracket 3', () => expect(levelBracket(21)).toBe(3));
});

describe('coinsReward', () => {
  it('10 tokens at level 5 → 10_000', () => expect(coinsReward(10, 5)).toBe(10_000));
  it('10 tokens at level 15 → 20_000', () => expect(coinsReward(10, 15)).toBe(20_000));
  it('0 tokens → 0', () => expect(coinsReward(0, 50)).toBe(0));
});

describe('generateRandomTokens', () => {
  it('sums to the requested total', () => {
    for (const total of [0, 10, 50, 100]) {
      const result = generateRandomTokens(total);
      const sum = Object.values(result).reduce((a, b) => a + b, 0);
      expect(sum).toBe(total);
    }
  });
  it('all values are non-negative', () => {
    const result = generateRandomTokens(30);
    Object.values(result).forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
cd server && npx jest tournament.constants.spec --no-coverage
```

Expected: FAIL — `cannot find module '../tournament.constants'`

- [ ] **Step 3: Implement `tournament.constants.ts`**

Create `server/src/tournament/tournament.constants.ts`:

```ts
export function isWeekdayUTC(): boolean {
  const day = new Date().getUTCDay(); // 0=Sun, 6=Sat
  return day >= 1 && day <= 5;
}

export const GEMS_BY_RANK: Record<number, number> = {
  1: 1000, 2: 900, 3: 800,
  4: 700,  5: 600, 6: 500,
  7: 400,  8: 300, 9: 200, 10: 100,
};

export const BONUS_TOKENS_BY_RANK: Record<number, number> = {
  1: 100, 2: 90, 3: 80,
  4: 70,  5: 60, 6: 50,
  7: 40,  8: 30, 9: 20, 10: 10,
};

export function levelBracket(playerLevel: number): number {
  return Math.floor((playerLevel - 1) / 10) + 1;
}

export function coinsReward(tokenCount: number, playerLevel: number): number {
  return tokenCount * levelBracket(playerLevel) * 1000;
}

const TOKEN_COLOR_KEYS = ['green', 'blue', 'yellow', 'purple', 'red'] as const;
export type TokenColor = typeof TOKEN_COLOR_KEYS[number];

export function generateRandomTokens(total: number): Record<TokenColor, number> {
  const result: Record<TokenColor, number> = { green: 0, blue: 0, yellow: 0, purple: 0, red: 0 };
  if (total <= 0) return result;
  let remaining = total;
  for (let i = 0; i < TOKEN_COLOR_KEYS.length - 1; i++) {
    const maxShare = remaining - (TOKEN_COLOR_KEYS.length - 1 - i);
    const share = Math.floor(Math.random() * (maxShare + 1));
    result[TOKEN_COLOR_KEYS[i]] = share;
    remaining -= share;
  }
  result[TOKEN_COLOR_KEYS[TOKEN_COLOR_KEYS.length - 1]] = remaining;
  return result;
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
cd server && npx jest tournament.constants.spec --no-coverage
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/tournament/
git commit -m "feat(tournament): add tournament.constants with reward formulas and helpers"
```

---

### Task 3: TournamentService — leaderboard and publish

**Files:**
- Create: `server/src/tournament/tournament.service.ts`
- Create: `server/src/tournament/__tests__/tournament.service.spec.ts`

**Interfaces:**
- Consumes: `currentWeekStart()` from `../city/city-task.constants`, all helpers from `./tournament.constants`
- Produces:
  - `TournamentService.getLeaderboard(weekStartIso: string): Promise<LeaderboardDto>`
  - `TournamentService.publishResults(adminPlayerId: string, weekStartIso: string): Promise<{ published: number }>`

Where:
```ts
interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  playerLevel: number;
  tokenCount: number;
  gemsReward: number;
  bonusTokens: number;
  coinsReward: number;
}
interface LeaderboardDto {
  weekStart: string;
  alreadyPublished: boolean;
  totalParticipants: number;
  entries: LeaderboardEntry[];
}
```

- [ ] **Step 1: Write failing tests**

Create `server/src/tournament/__tests__/tournament.service.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import { TournamentService } from '../tournament.service';

function makeService(overrides: Record<string, any> = {}) {
  const weekStart = new Date('2026-10-12T00:00:00.000Z'); // Monday
  jest.useFakeTimers().setSystemTime(new Date('2026-10-18T10:00:00Z')); // Saturday (week closed)

  const prisma = {
    playerWeeklyTokens: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    playerTokenTournament: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'tour1' }),
    },
    playerTokenTournamentEntry: {
      create: jest.fn().mockResolvedValue({}),
    },
    playerState: {
      update: jest.fn().mockResolvedValue({}),
    },
    player: {
      findUnique: jest.fn().mockResolvedValue({ playerLevel: 5, playerName: 'Alice' }),
      update: jest.fn().mockResolvedValue({}),
    },
    mailMessage: {
      create: jest.fn().mockResolvedValue({ id: 'm1' }),
    },
    $transaction: jest.fn().mockImplementation((fn) => fn({ ...prisma, ...overrides })),
    ...overrides,
  };
  const merged = { ...prisma, ...overrides };
  return { svc: new TournamentService(merged as any), prisma: merged };
}

describe('getLeaderboard', () => {
  afterEach(() => jest.useRealTimers());

  it('returns empty entries when no tokens collected', async () => {
    const { svc } = makeService();
    const result = await svc.getLeaderboard('2026-10-12T00:00:00.000Z');
    expect(result.totalParticipants).toBe(0);
    expect(result.entries).toHaveLength(0);
    expect(result.alreadyPublished).toBe(false);
  });

  it('marks alreadyPublished when tournament exists', async () => {
    const { svc } = makeService({
      playerTokenTournament: {
        findUnique: jest.fn().mockResolvedValue({ id: 'tour1' }),
      },
      playerWeeklyTokens: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    });
    const result = await svc.getLeaderboard('2026-10-12T00:00:00.000Z');
    expect(result.alreadyPublished).toBe(true);
  });

  it('ranks entries by tokenCount descending', async () => {
    const { svc } = makeService({
      playerWeeklyTokens: {
        findMany: jest.fn().mockResolvedValue([
          { playerId: 'p1', count: 50, player: { playerName: 'Alice', playerLevel: 5 } },
          { playerId: 'p2', count: 80, player: { playerName: 'Bob',   playerLevel: 15 } },
        ]),
      },
      playerTokenTournament: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const result = await svc.getLeaderboard('2026-10-12T00:00:00.000Z');
    expect(result.entries[0].playerName).toBe('Bob');
    expect(result.entries[0].rank).toBe(1);
    expect(result.entries[1].rank).toBe(2);
    expect(result.totalParticipants).toBe(2);
  });

  it('coins reward uses level bracket', async () => {
    const { svc } = makeService({
      playerWeeklyTokens: {
        findMany: jest.fn().mockResolvedValue([
          { playerId: 'p1', count: 10, player: { playerName: 'Alice', playerLevel: 11 } },
        ]),
      },
      playerTokenTournament: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const result = await svc.getLeaderboard('2026-10-12T00:00:00.000Z');
    expect(result.entries[0].coinsReward).toBe(20_000); // 10 × 2 × 1000
  });
});

describe('publishResults', () => {
  afterEach(() => jest.useRealTimers());

  it('throws BadRequestException if already published', async () => {
    const { svc } = makeService({
      playerTokenTournament: {
        findUnique: jest.fn().mockResolvedValue({ id: 'existing' }),
      },
      playerWeeklyTokens: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    });
    await expect(svc.publishResults('admin1', '2026-10-12T00:00:00.000Z'))
      .rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException if week is not closed yet', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-14T10:00:00Z')); // Wednesday
    const { svc } = makeService({
      playerTokenTournament: { findUnique: jest.fn().mockResolvedValue(null) },
      playerWeeklyTokens: { findMany: jest.fn().mockResolvedValue([]) },
    });
    await expect(svc.publishResults('admin1', '2026-10-12T00:00:00.000Z'))
      .rejects.toThrow(BadRequestException);
  });

  it('does not send mail to players with 0 tokens', async () => {
    const mailCreate = jest.fn().mockResolvedValue({ id: 'm1' });
    const { svc } = makeService({
      playerTokenTournament: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'tour1' }),
      },
      playerWeeklyTokens: {
        findMany: jest.fn().mockResolvedValue([
          { playerId: 'p1', count: 0, player: { playerName: 'Ghost', playerLevel: 5 } },
        ]),
      },
      mailMessage: { create: mailCreate },
    });
    await svc.publishResults('admin1', '2026-10-12T00:00:00.000Z');
    expect(mailCreate).not.toHaveBeenCalled();
  });

  it('publishes with correct gem reward for rank 1', async () => {
    const playerUpdate = jest.fn().mockResolvedValue({});
    const { svc } = makeService({
      playerTokenTournament: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'tour1' }),
      },
      playerWeeklyTokens: {
        findMany: jest.fn().mockResolvedValue([
          { playerId: 'p1', count: 20, player: { playerName: 'Alice', playerLevel: 5 } },
        ]),
      },
      playerState: { update: playerUpdate },
      player: {
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({ playerLevel: 5, playerName: 'Alice' }),
      },
      mailMessage: { create: jest.fn().mockResolvedValue({ id: 'm1' }) },
      playerTokenTournamentEntry: { create: jest.fn().mockResolvedValue({}) },
    });
    await svc.publishResults('admin1', '2026-10-12T00:00:00.000Z');
    // rank 1 = 1000 gems
    expect(playerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ gems: expect.objectContaining({ increment: 1000 }) }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
cd server && npx jest tournament.service.spec --no-coverage
```

Expected: FAIL — `cannot find module '../tournament.service'`

- [ ] **Step 3: Implement `tournament.service.ts`**

Create `server/src/tournament/tournament.service.ts`:

```ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { currentWeekStart } from '../city/city-task.constants';
import {
  GEMS_BY_RANK, BONUS_TOKENS_BY_RANK,
  levelBracket, coinsReward, generateRandomTokens,
} from './tournament.constants';

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  playerLevel: number;
  tokenCount: number;
  gemsReward: number;
  bonusTokens: number;
  coinsReward: number;
}

export interface LeaderboardDto {
  weekStart: string;
  alreadyPublished: boolean;
  totalParticipants: number;
  entries: LeaderboardEntry[];
}

function isWeekClosed(weekStart: Date): boolean {
  const saturdayStart = new Date(weekStart.getTime() + 5 * 86_400_000);
  return new Date() >= saturdayStart;
}

@Injectable()
export class TournamentService {
  constructor(private prisma: PrismaService) {}

  async getLeaderboard(weekStartIso: string): Promise<LeaderboardDto> {
    const weekStart = new Date(weekStartIso);
    if (isNaN(weekStart.getTime())) throw new BadRequestException('Invalid weekStart');

    const [rows, existing] = await Promise.all([
      this.prisma.playerWeeklyTokens.findMany({
        where: { weekStart },
        include: { player: { select: { playerName: true, playerLevel: true } } },
        orderBy: { count: 'desc' },
      }),
      this.prisma.playerTokenTournament.findUnique({ where: { weekStart } }),
    ]);

    const entries: LeaderboardEntry[] = rows.map((row, idx) => {
      const rank = idx + 1;
      return {
        rank,
        playerId: row.playerId,
        playerName: row.player.playerName,
        playerLevel: row.player.playerLevel,
        tokenCount: row.count,
        gemsReward: GEMS_BY_RANK[rank] ?? 0,
        bonusTokens: BONUS_TOKENS_BY_RANK[rank] ?? 0,
        coinsReward: coinsReward(row.count, row.player.playerLevel),
      };
    });

    return {
      weekStart: weekStart.toISOString(),
      alreadyPublished: !!existing,
      totalParticipants: rows.length,
      entries,
    };
  }

  async publishResults(adminPlayerId: string, weekStartIso: string): Promise<{ published: number }> {
    const weekStart = new Date(weekStartIso);
    if (isNaN(weekStart.getTime())) throw new BadRequestException('Invalid weekStart');
    if (!isWeekClosed(weekStart)) throw new BadRequestException('Week is not closed yet (Sat must have begun)');

    const existing = await this.prisma.playerTokenTournament.findUnique({ where: { weekStart } });
    if (existing) throw new BadRequestException('Results already published for this week');

    const rows = await this.prisma.playerWeeklyTokens.findMany({
      where: { weekStart },
      include: { player: { select: { playerName: true, playerLevel: true } } },
      orderBy: { count: 'desc' },
    });

    const participants = rows.filter((r) => r.count > 0);
    if (participants.length === 0) throw new BadRequestException('No token data for this week');

    await this.prisma.$transaction(async (tx) => {
      const tournament = await tx.playerTokenTournament.create({
        data: { weekStart, createdBy: adminPlayerId },
      });

      for (let i = 0; i < participants.length; i++) {
        const row = participants[i];
        const rank = i + 1;
        const gems = GEMS_BY_RANK[rank] ?? 0;
        const bonus = BONUS_TOKENS_BY_RANK[rank] ?? 0;
        const coins = coinsReward(row.count, row.player.playerLevel);

        await tx.playerTokenTournamentEntry.create({
          data: {
            tournamentId: tournament.id,
            playerId: row.playerId,
            rank: rank <= 10 ? rank : null,
            tokenCount: row.count,
            gemsReward: gems,
            bonusTokens: bonus,
            coinsReward: coins,
          },
        });

        // Award coins (all participants)
        await tx.player.update({
          where: { id: row.playerId },
          data: { balance: { increment: coins } },
        });

        // Award gems + bonus tokens (top 10 only)
        if (rank <= 10) {
          const tokenDistribution = generateRandomTokens(bonus);
          await tx.playerState.update({
            where: { playerId: row.playerId },
            data: {
              gems: { increment: gems },
              tokenGreen:  { increment: tokenDistribution.green },
              tokenBlue:   { increment: tokenDistribution.blue },
              tokenYellow: { increment: tokenDistribution.yellow },
              tokenPurple: { increment: tokenDistribution.purple },
              tokenRed:    { increment: tokenDistribution.red },
            },
          });
        }

        // Send in-game mail
        const isTop10 = rank <= 10;
        const subject = isTop10 ? '🏆 Token Tournament Results' : 'Token Tournament Results';
        const body = isTop10
          ? `Congratulations! You placed #${rank} in this week's tournament.\n\nTokens collected: ${row.count}\nRewards:\n  • ${gems} 💎 gems\n  • ${bonus} 🔑 random tokens\n  • ${coins.toLocaleString()} 🪙 coins\n\nRewards have been added to your account.`
          : `Thanks for participating in this week's tournament!\n\nTokens collected: ${row.count}\nRewards:\n  • ${coins.toLocaleString()} 🪙 coins\n\nRewards have been added to your account.`;

        await tx.mailMessage.create({
          data: { fromId: adminPlayerId, toId: row.playerId, subject, body },
        });
      }
    });

    return { published: participants.length };
  }
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
cd server && npx jest tournament.service.spec --no-coverage
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/tournament/
git commit -m "feat(tournament): TournamentService with leaderboard and publish"
```

---

### Task 4: Tournament controller + module + admin wiring

**Files:**
- Create: `server/src/tournament/tournament.controller.ts`
- Create: `server/src/tournament/tournament.module.ts`
- Modify: `server/src/admin/admin.module.ts`
- Modify: `server/src/admin/admin.controller.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Consumes: `TournamentService.getLeaderboard`, `TournamentService.publishResults`
- Produces:
  - `GET /admin/tournament/tokens/leaderboard?weekStart=<ISO>` → `LeaderboardDto`
  - `POST /admin/tournament/tokens/result` body `{ weekStart: string }` → `{ published: number }`

- [ ] **Step 1: Create `tournament.controller.ts`**

Create `server/src/tournament/tournament.controller.ts`:

```ts
import { Controller, Get, Post, Query, Body, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../admin/admin.guard';
import { TournamentService } from './tournament.service';

const PublishBodySchema = { weekStart: (v: unknown) => typeof v === 'string' && v.length > 0 };

@Controller('admin/tournament/tokens')
@UseGuards(JwtAuthGuard, AdminGuard)
export class TournamentController {
  constructor(private tournamentService: TournamentService) {}

  @Get('leaderboard')
  getLeaderboard(@Query('weekStart') weekStart: string) {
    if (!weekStart) throw new BadRequestException('weekStart is required');
    return this.tournamentService.getLeaderboard(weekStart);
  }

  @Post('result')
  publishResults(@Req() req: { user: { playerId: string } }, @Body() body: { weekStart: string }) {
    if (!body?.weekStart) throw new BadRequestException('weekStart is required');
    return this.tournamentService.publishResults(req.user.playerId, body.weekStart);
  }
}
```

- [ ] **Step 2: Create `tournament.module.ts`**

Create `server/src/tournament/tournament.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TournamentController } from './tournament.controller';
import { TournamentService } from './tournament.service';

@Module({
  imports: [PrismaModule],
  controllers: [TournamentController],
  providers: [TournamentService],
  exports: [TournamentService],
})
export class TournamentModule {}
```

- [ ] **Step 3: Register TournamentModule in `app.module.ts`**

In `server/src/app.module.ts`, add `TournamentModule` to imports:

```ts
import { TournamentModule } from './tournament/tournament.module';
```

Add `TournamentModule` to the `imports` array in `@Module`.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Smoke test the endpoints**

Start the server locally and confirm:
- `GET /admin/tournament/tokens/leaderboard?weekStart=2026-10-12T00:00:00.000Z` returns `{ weekStart, alreadyPublished, totalParticipants, entries }` (with empty entries if no data).

- [ ] **Step 6: Commit**

```bash
git add server/src/tournament/ server/src/app.module.ts
git commit -m "feat(tournament): TournamentController, module, registered in AppModule"
```

---

### Task 5: Sync service — track weekly tokens + weeklyTokenCount in response

**Files:**
- Modify: `server/src/sync/sync.service.ts`

**Interfaces:**
- Consumes: `currentWeekStart()` from `../city/city-task.constants`; `isWeekdayUTC()` from `../tournament/tournament.constants`; `this.prisma.playerWeeklyTokens`
- Produces: `SyncResult.weeklyTokenCount: number` added to the interface and returned value

- [ ] **Step 1: Add `weeklyTokenCount` to `SyncResult` interface**

In `server/src/sync/sync.service.ts`, find the `SyncResult` interface (line ~22) and add:

```ts
weeklyTokenCount: number;
```

- [ ] **Step 2: Count claimed tokens from accepted commands**

After the command loop (around line 204, after `const accumulatedTaskDelta = ...`), add:

```ts
const claimedTokenCount = acceptedCommands
  .filter((c) => c.type === 'claim_daily_task')
  .reduce((sum, c) => sum + ((c as any).tokenCount ?? 0), 0);
```

- [ ] **Step 3: Increment PlayerWeeklyTokens inside the transaction**

Inside `this.prisma.$transaction(async (tx) => { ... })` (around line 278), add after the city task progress update block (after `if (player.cityMembership) { await this.cityTaskService... }`):

```ts
// Track weekly tournament tokens (Mon–Fri only)
if (claimedTokenCount > 0) {
  const { isWeekdayUTC: _isWeekday } = await import('../tournament/tournament.constants');
  if (_isWeekday()) {
    const weekStart = currentWeekStart();
    await tx.playerWeeklyTokens.upsert({
      where: { playerId_weekStart: { playerId, weekStart } },
      create: { playerId, weekStart, count: claimedTokenCount },
      update: { count: { increment: claimedTokenCount } },
    });
  }
}
```

> Note: use a static import at the top of the file instead of a dynamic import. Add to the imports section at the top of sync.service.ts:
> ```ts
> import { isWeekdayUTC } from '../tournament/tournament.constants';
> ```
> Then replace the dynamic import with `isWeekdayUTC()`.

- [ ] **Step 4: Query weeklyTokenCount and add to return value**

After the `cityTasks` block (around line 750, after the `if (player.cityMembership)` block), add:

```ts
const weeklyTokenRow = await this.prisma.playerWeeklyTokens.findUnique({
  where: { playerId_weekStart: { playerId, weekStart: currentWeekStart() } },
  select: { count: true },
});
const weeklyTokenCount = weeklyTokenRow?.count ?? 0;
```

In the `return { ... }` block at the end of `processSync`, add:

```ts
weeklyTokenCount,
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Run existing sync tests to check no regressions**

```bash
cd server && npx jest sync.service.spec --no-coverage
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add server/src/sync/sync.service.ts
git commit -m "feat(tournament): track weekly token count in sync, return weeklyTokenCount"
```

---

### Task 6: Admin panel — TokenTournamentPage

**Files:**
- Create: `admin/src/pages/TokenTournamentPage.tsx`
- Modify: `admin/src/App.tsx`

**Interfaces:**
- Consumes: `GET /admin/tournament/tokens/leaderboard?weekStart=<ISO>`, `POST /admin/tournament/tokens/result`
- The page follows the same pattern as `CityTaskRankingsPage.tsx` (week selector + table + publish button)

- [ ] **Step 1: Create `TokenTournamentPage.tsx`**

Create `admin/src/pages/TokenTournamentPage.tsx`:

```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { api } from '../lib/api';
import { cn } from '../lib/utils';

interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  playerLevel: number;
  tokenCount: number;
  gemsReward: number;
  bonusTokens: number;
  coinsReward: number;
}

interface LeaderboardDto {
  weekStart: string;
  alreadyPublished: boolean;
  totalParticipants: number;
  entries: LeaderboardEntry[];
}

function fmtWeek(iso: string) {
  const d = new Date(iso);
  const fri = new Date(d.getTime() + 4 * 86_400_000);
  const fmt = (x: Date) => x.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  return `${fmt(d)} – ${fmt(fri)}`;
}

function recentMondays(n = 8): string[] {
  const mondays: string[] = [];
  const now = new Date();
  const day = now.getUTCDay();
  const daysToMonday = day === 0 ? 6 : day - 1;
  const thisMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysToMonday));
  for (let i = 0; i < n; i++) {
    mondays.push(new Date(thisMonday.getTime() - i * 7 * 86_400_000).toISOString());
  }
  return mondays;
}

export function TokenTournamentPage() {
  const mondays = recentMondays();
  const [selectedWeek, setSelectedWeek] = useState<string>(mondays[0]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<LeaderboardDto>({
    queryKey: ['token-tournament-leaderboard', selectedWeek],
    queryFn: () => api.get(`/admin/tournament/tokens/leaderboard?weekStart=${encodeURIComponent(selectedWeek)}`),
    enabled: !!selectedWeek,
  });

  const publishMutation = useMutation({
    mutationFn: (weekStart: string) => api.post('/admin/tournament/tokens/result', { weekStart }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['token-tournament-leaderboard', selectedWeek] });
      setConfirmOpen(false);
    },
  });

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Token Tournament</h1>

        <div className="mb-4 flex items-center gap-3">
          <label className="text-sm font-medium">Week:</label>
          <select
            className="border rounded px-3 py-1.5 text-sm"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
          >
            {mondays.map((m) => (
              <option key={m} value={m}>{fmtWeek(m)}</option>
            ))}
          </select>
        </div>

        {isLoading && <p className="text-sm text-gray-500">Loading…</p>}

        {data && (
          <>
            <div className="mb-3 text-sm text-gray-600">
              Total participants: <strong>{data.totalParticipants}</strong>
            </div>

            <div className="overflow-x-auto rounded border mb-4">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    {['Rank', 'Player', 'Lv', 'Tokens', 'Gems', 'Bonus Tokens', 'Coins'].map((h) => (
                      <th key={h} className="px-3 py-2 font-medium text-gray-700">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.entries.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-4 text-center text-gray-400">No data</td>
                    </tr>
                  )}
                  {data.entries.map((e) => (
                    <tr key={e.playerId} className={cn('border-t', e.rank <= 3 ? 'bg-yellow-50' : '')}>
                      <td className="px-3 py-2 font-bold">{e.rank}</td>
                      <td className="px-3 py-2">{e.playerName}</td>
                      <td className="px-3 py-2 text-gray-500">{e.playerLevel}</td>
                      <td className="px-3 py-2">{e.tokenCount}</td>
                      <td className="px-3 py-2 text-blue-600">{e.gemsReward || '–'}</td>
                      <td className="px-3 py-2 text-purple-600">{e.bonusTokens || '–'}</td>
                      <td className="px-3 py-2 text-yellow-700">{e.coinsReward.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.alreadyPublished ? (
              <span className="inline-flex items-center gap-1.5 text-sm text-green-700 font-medium">
                ✓ Published
              </span>
            ) : (
              <>
                {!confirmOpen ? (
                  <button
                    className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    disabled={data.totalParticipants === 0}
                    onClick={() => setConfirmOpen(true)}
                  >
                    Publish Results
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-gray-700">
                      Publish results for <strong>{fmtWeek(selectedWeek)}</strong>? Send rewards to <strong>{data.totalParticipants}</strong> players.
                    </p>
                    <button
                      className="px-3 py-1.5 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                      disabled={publishMutation.isPending}
                      onClick={() => publishMutation.mutate(selectedWeek)}
                    >
                      {publishMutation.isPending ? 'Publishing…' : 'Confirm'}
                    </button>
                    <button
                      className="px-3 py-1.5 bg-gray-200 rounded text-sm"
                      onClick={() => setConfirmOpen(false)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {publishMutation.isError && (
                  <p className="mt-2 text-sm text-red-600">
                    Error: {(publishMutation.error as any)?.message ?? 'Unknown error'}
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
```

- [ ] **Step 2: Add route in `admin/src/App.tsx`**

In `admin/src/App.tsx`, add the import:

```ts
import { TokenTournamentPage } from './pages/TokenTournamentPage';
```

Add the route before `<Route path="*" ...>`:

```tsx
<Route
  path="/token-tournament"
  element={
    <ProtectedRoute>
      <TokenTournamentPage />
    </ProtectedRoute>
  }
/>
```

- [ ] **Step 3: Verify admin panel builds**

```bash
cd admin && npm run build
```

Expected: build succeeds, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add admin/src/pages/TokenTournamentPage.tsx admin/src/App.tsx
git commit -m "feat(tournament): admin TokenTournamentPage with leaderboard and publish"
```

---

### Task 7: Client — weeklyTokenCount in gameStore + tournament section in daily-tasks

**Files:**
- Modify: `src/services/sync.ts`
- Modify: `src/stores/gameStore.ts`
- Modify: `app/daily-tasks.tsx`

**Interfaces:**
- Consumes: `SyncResult.weeklyTokenCount` from server
- Produces: `useGameStore(s => s.weeklyTokenCount)` — current week's token count for the player

- [ ] **Step 1: Add `weeklyTokenCount` to `SyncResponse` in `src/services/sync.ts`**

In `src/services/sync.ts`, find the `SyncResponse` type (around line 25–50). Add:

```ts
weeklyTokenCount?: number;
```

Then after the `if (response.cityTasks) { ... }` block (around line 185), add:

```ts
if (response.weeklyTokenCount !== undefined) {
  useGameStore.getState().setWeeklyTokenCount(response.weeklyTokenCount);
}
```

- [ ] **Step 2: Add `weeklyTokenCount` + `setWeeklyTokenCount` to `src/stores/gameStore.ts`**

Find the state interface declaration in `gameStore.ts` (around line 98) and add:

```ts
weeklyTokenCount: number;
```

Find the actions interface (around line 244) and add:

```ts
setWeeklyTokenCount: (count: number) => void;
```

Find the initial state values (around line 486) and add:

```ts
weeklyTokenCount: 0,
```

Find the actions implementations section and add the `setWeeklyTokenCount` action:

```ts
setWeeklyTokenCount: (count) => set({ weeklyTokenCount: count }),
```

- [ ] **Step 3: Add tournament section to `app/daily-tasks.tsx`**

In `app/daily-tasks.tsx`, add this import near the top:

```ts
import { isWeekend } from '../src/utils/dateUtils'; // or compute inline
```

Since there's no `isWeekend` utility yet, compute it inline. At the top of the `DailyTasksScreen` component, after `const playerLevel = ...`, add:

```ts
const weeklyTokenCount = useGameStore((s) => s.weeklyTokenCount);
const nowDay = new Date().getUTCDay(); // 0=Sun, 6=Sat
const isTournamentWeekend = nowDay === 0 || nowDay === 6;
const levelBracketMultiplier = Math.floor((playerLevel - 1) / 10) + 1;
const estimatedCoins = weeklyTokenCount * levelBracketMultiplier * 1000;
```

At the bottom of the `ScrollView` content, before the closing `</ScrollView>`, add the tournament section:

```tsx
<View style={[styles.tournamentCard, { backgroundColor: theme.surface }]}>
  <LocaleText style={[styles.tournamentTitle, { color: theme.text }]}>
    🏆 {t('tournament.title', 'Weekly Tournament')}
  </LocaleText>
  <LocaleText style={[styles.tournamentSub, { color: theme.textSecondary }]}>
    {t('tournament.period', 'Mon – Fri')}
  </LocaleText>
  {isTournamentWeekend ? (
    <LocaleText style={[styles.tournamentInfo, { color: theme.textSecondary }]}>
      {t('tournament.closed', 'Tournament finished — results coming soon')}
    </LocaleText>
  ) : (
    <>
      <LocaleText style={[styles.tournamentScore, { color: theme.text }]}>
        {t('tournament.score', 'Your score')}{': '}
        <LocaleText style={{ color: '#3376E5' }}>{weeklyTokenCount}</LocaleText>
        {' 🔑'}
      </LocaleText>
      {weeklyTokenCount > 0 && (
        <LocaleText style={[styles.tournamentReward, { color: theme.textSecondary }]}>
          {t('tournament.reward', 'Reward')}{': '}
          <LocaleText style={{ color: theme.text }}>{formatNum(estimatedCoins)}</LocaleText>
          {' 🪙'}
        </LocaleText>
      )}
    </>
  )}
</View>
```

Add styles to `StyleSheet.create(...)` at the bottom of the file:

```ts
tournamentCard: {
  marginTop: 20,
  borderRadius: 12,
  padding: 16,
},
tournamentTitle: {
  fontSize: 16,
  fontWeight: '700',
  marginBottom: 2,
},
tournamentSub: {
  fontSize: 12,
  marginBottom: 10,
},
tournamentInfo: {
  fontSize: 14,
},
tournamentScore: {
  fontSize: 14,
  marginBottom: 4,
},
tournamentReward: {
  fontSize: 14,
},
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit
```

Expected: no errors related to the new fields.

- [ ] **Step 5: Commit**

```bash
git add src/services/sync.ts src/stores/gameStore.ts app/daily-tasks.tsx
git commit -m "feat(tournament): client weeklyTokenCount state + tournament section in daily-tasks"
```

---

## Done

After all tasks are complete, the token tournament system is live:
- Server tracks tokens every sync during Mon–Fri
- Admin publishes results at `/token-tournament` in the admin panel
- Players receive in-game mail with their rank and rewards on publish
- Daily tasks screen shows the player's current week score Mon–Fri
