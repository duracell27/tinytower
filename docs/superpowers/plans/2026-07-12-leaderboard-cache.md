# Leaderboard Redis Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cache the shared part of leaderboard responses in Redis for 5 minutes, and show a "Updates every 5 min" notice in the UI.

**Architecture:** `LeaderboardService` checks Redis before hitting the DB. Cache key `lb:{tab}:{page}` stores `{ entries, total }` with TTL 300 s. `currentPlayer` is always computed live (two cheap COUNT queries). Frontend adds a single localised line under the tab bar.

**Tech Stack:** NestJS, ioredis (`REDIS_CLIENT` token from `server/src/auth/redis.provider.ts`), React Native, i18next.

## Global Constraints

- Redis provider token: `REDIS_CLIENT` (from `server/src/auth/redis.provider.ts`)
- Cache TTL: exactly 300 seconds
- Cache key format: `lb:{tab}:{page}` — e.g. `lb:level:1`, `lb:floors:3`
- Only `entries` + `total` are cached; `currentPlayer` is always live
- i18n namespace: `tabs`, key: `leaderboard.cacheNotice`
- Only English locale file exists: `src/i18n/locales/en/tabs.json`

---

### Task 1: Backend — Redis cache in LeaderboardService

**Files:**
- Modify: `server/src/leaderboard/leaderboard.service.ts`
- Modify: `server/src/leaderboard/leaderboard.module.ts`
- Modify: `server/src/leaderboard/__tests__/leaderboard.service.spec.ts`

**Interfaces:**
- Produces: `LeaderboardService.getLeaderboard(tab, page, playerId)` — same signature, same return type, now cache-backed

- [ ] **Step 1: Write failing tests for cache behaviour**

Replace the contents of `server/src/leaderboard/__tests__/leaderboard.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { LeaderboardService } from '../leaderboard.service';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../auth/redis.provider';

describe('LeaderboardService', () => {
  let service: LeaderboardService;
  let prisma: Record<string, any>;
  let redis: Record<string, any>;

  const mockRows = [
    { id: 'p1', playerName: 'Alice', playerLevel: 10, openedFloorsCount: 5, maxRevenuePerMin: 1000 },
    { id: 'p2', playerName: 'Bob',   playerLevel: 8,  openedFloorsCount: 3, maxRevenuePerMin: 800 },
  ];

  beforeEach(async () => {
    prisma = {
      player: {
        findMany:   jest.fn(),
        count:      jest.fn(),
        findUnique: jest.fn(),
      },
    };
    redis = {
      get:    jest.fn(),
      setex:  jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaderboardService,
        { provide: PrismaService,  useValue: prisma },
        { provide: REDIS_CLIENT,   useValue: redis  },
      ],
    }).compile();

    service = module.get<LeaderboardService>(LeaderboardService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should return level leaderboard with correct ranks and currentPlayer (cache miss)', async () => {
    redis.get.mockResolvedValue(null);
    redis.setex.mockResolvedValue('OK');
    prisma.player.findMany.mockResolvedValue(mockRows);
    prisma.player.count
      .mockResolvedValueOnce(50)  // total
      .mockResolvedValueOnce(5);  // players above me
    prisma.player.findUnique.mockResolvedValue({
      playerLevel: 7, openedFloorsCount: 2, maxRevenuePerMin: 700,
    });

    const result = await service.getLeaderboard('level', 1, 'my-id');

    expect(result.total).toBe(50);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toEqual({ rank: 1, playerId: 'p1', playerName: 'Alice', value: 10 });
    expect(result.entries[1]).toEqual({ rank: 2, playerId: 'p2', playerName: 'Bob', value: 8 });
    expect(result.currentPlayer).toEqual({ rank: 6, value: 7 });
  });

  it('should store entries+total in Redis on cache miss', async () => {
    redis.get.mockResolvedValue(null);
    redis.setex.mockResolvedValue('OK');
    prisma.player.findMany.mockResolvedValue([mockRows[0]]);
    prisma.player.count.mockResolvedValueOnce(10).mockResolvedValueOnce(0);
    prisma.player.findUnique.mockResolvedValue({ playerLevel: 10, openedFloorsCount: 5, maxRevenuePerMin: 1000 });

    await service.getLeaderboard('level', 1, 'p1');

    expect(redis.setex).toHaveBeenCalledWith(
      'lb:level:1',
      300,
      expect.stringContaining('"entries"'),
    );
    const storedPayload = JSON.parse(redis.setex.mock.calls[0][2]);
    expect(storedPayload).toHaveProperty('entries');
    expect(storedPayload).toHaveProperty('total', 10);
  });

  it('should return cached entries and skip DB findMany on cache hit', async () => {
    const cached = {
      entries: [{ rank: 1, playerId: 'p1', playerName: 'Alice', value: 10 }],
      total: 50,
    };
    redis.get.mockResolvedValue(JSON.stringify(cached));
    prisma.player.count.mockResolvedValueOnce(5); // players above me for currentPlayer
    prisma.player.findUnique.mockResolvedValue({ playerLevel: 7, openedFloorsCount: 2, maxRevenuePerMin: 700 });

    const result = await service.getLeaderboard('level', 1, 'my-id');

    expect(prisma.player.findMany).not.toHaveBeenCalled();
    expect(redis.setex).not.toHaveBeenCalled();
    expect(result.entries).toEqual(cached.entries);
    expect(result.total).toBe(50);
    expect(result.currentPlayer.rank).toBe(6);
  });

  it('should use openedFloorsCount as value for floors tab', async () => {
    redis.get.mockResolvedValue(null);
    redis.setex.mockResolvedValue('OK');
    prisma.player.findMany.mockResolvedValue([mockRows[0]]);
    prisma.player.count.mockResolvedValueOnce(10).mockResolvedValueOnce(0);
    prisma.player.findUnique.mockResolvedValue({ playerLevel: 10, openedFloorsCount: 5, maxRevenuePerMin: 1000 });

    const result = await service.getLeaderboard('floors', 1, 'p1');

    expect(result.entries[0].value).toBe(5);
    expect(result.currentPlayer.rank).toBe(1);
  });

  it('should use maxRevenuePerMin as value for revenue tab', async () => {
    redis.get.mockResolvedValue(null);
    redis.setex.mockResolvedValue('OK');
    prisma.player.findMany.mockResolvedValue([mockRows[0]]);
    prisma.player.count.mockResolvedValueOnce(10).mockResolvedValueOnce(3);
    prisma.player.findUnique.mockResolvedValue({ playerLevel: 7, openedFloorsCount: 2, maxRevenuePerMin: 500 });

    const result = await service.getLeaderboard('revenue', 1, 'my-id');

    expect(result.entries[0].value).toBe(1000);
    expect(result.currentPlayer).toEqual({ rank: 4, value: 500 });
  });

  it('should offset ranks correctly on page 2', async () => {
    redis.get.mockResolvedValue(null);
    redis.setex.mockResolvedValue('OK');
    prisma.player.findMany.mockResolvedValue([
      { id: 'p21', playerName: 'Charlie', playerLevel: 3, openedFloorsCount: 1, maxRevenuePerMin: 300 },
    ]);
    prisma.player.count.mockResolvedValueOnce(50).mockResolvedValueOnce(49);
    prisma.player.findUnique.mockResolvedValue({ playerLevel: 1, openedFloorsCount: 0, maxRevenuePerMin: 0 });

    const result = await service.getLeaderboard('level', 2, 'my-id');

    expect(result.entries[0].rank).toBe(21);
    expect(result.currentPlayer.rank).toBe(50);
  });

  it('should pass correct orderBy and pagination to prisma', async () => {
    redis.get.mockResolvedValue(null);
    redis.setex.mockResolvedValue('OK');
    prisma.player.findMany.mockResolvedValue([]);
    prisma.player.count.mockResolvedValue(0);
    prisma.player.findUnique.mockResolvedValue({ playerLevel: 1, openedFloorsCount: 0, maxRevenuePerMin: 0 });

    await service.getLeaderboard('revenue', 3, 'my-id');

    expect(prisma.player.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ maxRevenuePerMin: 'desc' }, { createdAt: 'asc' }],
        skip: 40,
        take: 20,
      }),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/Apple/IT/tinytower/server && npx jest leaderboard.service.spec --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `REDIS_CLIENT` not injected into service yet.

- [ ] **Step 3: Rewrite LeaderboardService with Redis cache**

Replace `server/src/leaderboard/leaderboard.service.ts`:

```ts
import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../auth/redis.provider';
import type Redis from 'ioredis';

const PAGE_SIZE = 20;
const CACHE_TTL = 300;

export type LeaderboardTab = 'level' | 'floors' | 'revenue';

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  value: number;
}

export interface LeaderboardResult {
  entries: LeaderboardEntry[];
  total: number;
  currentPlayer: { rank: number; value: number };
}

interface CachedPage {
  entries: LeaderboardEntry[];
  total: number;
}

@Injectable()
export class LeaderboardService {
  constructor(
    private prisma: PrismaService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  async getLeaderboard(tab: LeaderboardTab, page: number, playerId: string): Promise<LeaderboardResult> {
    const cacheKey = `lb:${tab}:${page}`;

    const [cached, me] = await Promise.all([
      this.redis.get(cacheKey),
      this.prisma.player.findUnique({
        where: { id: playerId },
        select: { playerLevel: true, openedFloorsCount: true, maxRevenuePerMin: true },
      }),
    ]);

    const myValue = me
      ? (tab === 'level' ? me.playerLevel : tab === 'floors' ? me.openedFloorsCount : me.maxRevenuePerMin)
      : 0;

    const aboveMe =
      tab === 'level'    ? { playerLevel:        { gt: myValue } }
      : tab === 'floors' ? { openedFloorsCount:   { gt: myValue } }
      :                    { maxRevenuePerMin:     { gt: myValue } };

    const rank = await this.prisma.player.count({ where: aboveMe }) + 1;
    const currentPlayer = { rank, value: myValue };

    if (cached) {
      const { entries, total } = JSON.parse(cached) as CachedPage;
      return { entries, total, currentPlayer };
    }

    const skip = (page - 1) * PAGE_SIZE;
    const orderBy =
      tab === 'level'    ? [{ playerLevel:       'desc' as const }, { createdAt: 'asc' as const }]
      : tab === 'floors' ? [{ openedFloorsCount:  'desc' as const }, { createdAt: 'asc' as const }]
      :                    [{ maxRevenuePerMin:    'desc' as const }, { createdAt: 'asc' as const }];

    const select = {
      id: true,
      playerName: true,
      playerLevel: true,
      openedFloorsCount: true,
      maxRevenuePerMin: true,
    };

    const [rows, total] = await Promise.all([
      this.prisma.player.findMany({ select, orderBy, skip, take: PAGE_SIZE }),
      this.prisma.player.count(),
    ]);

    const entries: LeaderboardEntry[] = rows.map((p, i) => ({
      rank: skip + i + 1,
      playerId: p.id,
      playerName: p.playerName,
      value: tab === 'level' ? p.playerLevel : tab === 'floors' ? p.openedFloorsCount : p.maxRevenuePerMin,
    }));

    await this.redis.setex(cacheKey, CACHE_TTL, JSON.stringify({ entries, total } satisfies CachedPage));

    return { entries, total, currentPlayer };
  }
}
```

- [ ] **Step 4: Add redisProvider to LeaderboardModule**

Replace `server/src/leaderboard/leaderboard.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';
import { redisProvider } from '../auth/redis.provider';

@Module({
  controllers: [LeaderboardController],
  providers: [LeaderboardService, redisProvider],
})
export class LeaderboardModule {}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Users/Apple/IT/tinytower/server && npx jest leaderboard.service.spec --no-coverage 2>&1 | tail -20
```

Expected: all 7 tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/Apple/IT/tinytower
git add server/src/leaderboard/leaderboard.service.ts \
        server/src/leaderboard/leaderboard.module.ts \
        server/src/leaderboard/__tests__/leaderboard.service.spec.ts
git commit -m "feat(leaderboard): cache shared page in Redis for 5 min"
```

---

### Task 2: Frontend — cache notice text

**Files:**
- Modify: `src/i18n/locales/en/tabs.json`
- Modify: `src/components/LeaderboardSheet.tsx`

**Interfaces:**
- Consumes: `t('leaderboard.cacheNotice')` from `useTranslation('tabs')`

- [ ] **Step 1: Add i18n key**

In `src/i18n/locales/en/tabs.json`, add `"cacheNotice"` inside the `"leaderboard"` object:

```json
"leaderboard": {
  "title": "Leaderboard",
  "tabLevel": "Level",
  "tabFloors": "Floors",
  "tabRevenue": "Revenue/min",
  "you": "You",
  "errorLoad": "Failed to load",
  "retry": "Retry",
  "revenueSuffix": "/min",
  "cacheNotice": "Updates every 5 min"
}
```

- [ ] **Step 2: Add notice text in LeaderboardSheet**

In `src/components/LeaderboardSheet.tsx`, add the notice line after the closing `</View>` of the tabs row (line ~167), still inside `<LinearGradient>`:

```tsx
          </View>

          <Text style={styles.cacheNotice}>{t('leaderboard.cacheNotice')}</Text>
        </LinearGradient>
```

Add the style to the `StyleSheet.create` block:

```ts
  cacheNotice: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    paddingBottom: 8,
  },
```

- [ ] **Step 3: Verify visually**

Start the app and open the leaderboard sheet. Confirm the text "Updates every 5 min" appears in small faded text below the tabs, above the list.

- [ ] **Step 4: Commit**

```bash
cd /Users/Apple/IT/tinytower
git add src/i18n/locales/en/tabs.json src/components/LeaderboardSheet.tsx
git commit -m "feat(leaderboard): show cache notice under tabs"
```
