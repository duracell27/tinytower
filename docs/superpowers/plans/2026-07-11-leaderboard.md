# Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Leaderboard bottom sheet to the menu with 3 tabs (Level / Floors / Revenue/min), server-side pagination (20/page), and persistent all-time peak revenue tracking per player.

**Architecture:** Two new denormalized columns on `Player` (`maxRevenuePerMin`, `openedFloorsCount`) are updated every sync. A new `LeaderboardModule` exposes `GET /leaderboard?tab&page` (JWT-protected). The client renders a `LeaderboardSheet` that fetches on open/tab/page change.

**Tech Stack:** NestJS + Prisma + PostgreSQL (server); React Native + Reanimated v3 + Zustand (client).

## Global Constraints

- Page size is exactly 20 entries.
- `openedFloorsCount` counts only dynamically opened floors (entries in `PlayerFloorType` table — static starting floors are excluded because all players have the same base).
- `maxRevenuePerMin` is only updated upward (never decremented).
- Font families available: `Fredoka_400Regular`, `Fredoka_500Medium`, `Fredoka_600SemiBold`, `Fredoka_700Bold`.
- Menu rating icon: `assets/img/menu/rating.png` (already exists).
- Run server tests from `server/` directory: `cd server && npx jest`.

---

## File Map

| File | Status | Responsibility |
|------|--------|---------------|
| `server/prisma/schema.prisma` | Modify | Add `maxRevenuePerMin`, `openedFloorsCount` to `Player` |
| `server/src/sync/sync.service.ts` | Modify | Compute + persist leaderboard fields each sync |
| `server/src/sync/__tests__/sync.service.spec.ts` | Modify | Add fields to mockPlayer; add 2 new tests |
| `server/src/leaderboard/leaderboard.service.ts` | Create | Query logic for all 3 tabs with pagination |
| `server/src/leaderboard/__tests__/leaderboard.service.spec.ts` | Create | Unit tests for leaderboard service |
| `server/src/leaderboard/leaderboard.controller.ts` | Create | `GET /leaderboard` endpoint |
| `server/src/leaderboard/leaderboard.module.ts` | Create | NestJS module wiring |
| `server/src/app.module.ts` | Modify | Register `LeaderboardModule` |
| `src/services/api.ts` | Modify | Add `LeaderboardResponse` type + api call |
| `src/i18n/locales/en/tabs.json` | Modify | Add leaderboard translation keys |
| `src/components/LeaderboardSheet.tsx` | Create | Animated bottom sheet with tabs + pagination |
| `app/(tabs)/menu.tsx` | Modify | Add "Рейтинг" menu entry |

---

### Task 1: DB Schema — add leaderboard fields

**Files:**
- Modify: `server/prisma/schema.prisma`

**Interfaces:**
- Produces: `Player.maxRevenuePerMin: Int @default(0)`, `Player.openedFloorsCount: Int @default(0)` — used by Tasks 2 and 3.

- [ ] **Step 1: Add two fields to the Player model**

In `server/prisma/schema.prisma`, find the `Player` model. After the `totalSold` line, add:

```prisma
  maxRevenuePerMin   Int                 @default(0)
  openedFloorsCount  Int                 @default(0)
```

The Player model block should look like:
```prisma
model Player {
  id                 String              @id @default(uuid())
  email              String              @unique
  passwordHash       String
  playerName         String
  balance            Int                 @default(100)
  stateVersion       Int                 @default(0)
  playerLevel        Int                 @default(1)
  playerXp           Int                 @default(0)
  totalBought        Int                 @default(0)
  totalListed        Int                 @default(0)
  totalSold          Int                 @default(0)
  maxRevenuePerMin   Int                 @default(0)
  openedFloorsCount  Int                 @default(0)
  lastSeenAt         DateTime            @default(now())
  createdAt          DateTime            @default(now())
  floors             Floor[]
  workers            Worker[]
  state              PlayerState?
  floorConstructions FloorConstruction[]
  floorTypes         PlayerFloorType[]
  achievements       PlayerAchievement[]
}
```

- [ ] **Step 2: Run migration**

```bash
cd server && npx prisma migrate dev --name add_leaderboard_fields
```

Expected output ends with: `The following migration(s) have been applied: .../add_leaderboard_fields/migration.sql`

- [ ] **Step 3: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/
git commit -m "feat(db): add maxRevenuePerMin and openedFloorsCount to Player"
```

---

### Task 2: Sync Service — persist leaderboard fields each sync

**Files:**
- Modify: `server/src/sync/sync.service.ts`
- Modify: `server/src/sync/__tests__/sync.service.spec.ts`

**Interfaces:**
- Consumes: `calcRevenuePerMin` from `@shared/engine/ratingUtils`; `Player.maxRevenuePerMin` and `Player.openedFloorsCount` from Task 1.
- Produces: `tx.player.update` now writes `openedFloorsCount` every sync and conditionally updates `maxRevenuePerMin` when current > stored.

- [ ] **Step 1: Write the first failing test**

In `server/src/sync/__tests__/sync.service.spec.ts`, add `maxRevenuePerMin: 0` and `openedFloorsCount: 0` to `mockPlayer` (around line 91), and add a new test at the end of the `processSync` describe block:

```ts
// In mockPlayer object, add after totalSold:
maxRevenuePerMin: 0,
openedFloorsCount: 0,
```

Add this test inside `describe('processSync', ...)`:
```ts
it('should set openedFloorsCount from player floor types on sync', async () => {
  const playerWithFloorTypes = {
    ...mockPlayer,
    openedFloorsCount: 0,
    floorTypes: [
      { playerId: 'player-uuid', floorId: 10, floorType: 'food' },
      { playerId: 'player-uuid', floorId: 11, floorType: 'tech' },
    ],
  };

  prisma.player.findUnique
    .mockResolvedValueOnce(playerWithFloorTypes)
    .mockResolvedValueOnce({ ...playerWithFloorTypes, openedFloorsCount: 2 });

  await syncService.processSync('player-uuid', [], 0);

  expect(txMock.player.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ openedFloorsCount: 2 }),
    }),
  );
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd server && npx jest sync.service.spec --no-coverage
```

Expected: FAIL — `openedFloorsCount` not present in update call.

- [ ] **Step 3: Implement the sync service changes**

In `server/src/sync/sync.service.ts`:

**3a.** Add import at the top of the file (after the existing imports):
```ts
import { calcRevenuePerMin } from '@shared/engine/ratingUtils';
```

**3b.** Find the block right before `await this.prisma.$transaction(...)` (around line 103). Add these two lines immediately before the `$transaction` call:
```ts
const currentRevenue = calcRevenuePerMin(
  gameState.floors,
  gameState.workers,
  gameState.openedFloorTypes ?? {},
  gameConfig,
  serverNow,
);
const currentOpenedFloors = Object.keys(gameState.openedFloorTypes ?? {}).length;
```

**3c.** Inside the transaction, update the `$queryRaw` generic type and SELECT to include `maxRevenuePerMin`. Find:
```ts
const [locked] = await tx.$queryRaw<{ playerLevel: number; playerXp: number; totalBought: number; totalListed: number; totalSold: number }[]>`
  SELECT "playerLevel", "playerXp", "totalBought", "totalListed", "totalSold" FROM "Player" WHERE id = ${playerId} FOR UPDATE
`;
```
Replace with:
```ts
const [locked] = await tx.$queryRaw<{ playerLevel: number; playerXp: number; totalBought: number; totalListed: number; totalSold: number; maxRevenuePerMin: number }[]>`
  SELECT "playerLevel", "playerXp", "totalBought", "totalListed", "totalSold", "maxRevenuePerMin" FROM "Player" WHERE id = ${playerId} FOR UPDATE
`;
```

**3d.** Inside `tx.player.update({ where: ..., data: { ... } })`, add two new lines at the end of `data` (before the closing `}`):
```ts
    openedFloorsCount: currentOpenedFloors,
    ...(currentRevenue > (locked?.maxRevenuePerMin ?? player.maxRevenuePerMin ?? 0)
      ? { maxRevenuePerMin: currentRevenue }
      : {}),
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
cd server && npx jest sync.service.spec --no-coverage
```

Expected: all existing tests PASS + new `openedFloorsCount` test PASS.

- [ ] **Step 5: Add test for maxRevenuePerMin update logic**

Add a second new test to `sync.service.spec.ts`:

```ts
it('should not overwrite maxRevenuePerMin when current revenue is lower than stored', async () => {
  const playerWithHighMaxRevenue = {
    ...mockPlayer,
    maxRevenuePerMin: 999,
    openedFloorsCount: 0,
  };

  prisma.player.findUnique
    .mockResolvedValueOnce(playerWithHighMaxRevenue)
    .mockResolvedValueOnce({ ...playerWithHighMaxRevenue });

  await syncService.processSync('player-uuid', [], 0);

  const updateCall = txMock.player.update.mock.calls[0][0];
  // All productions are IDLE so calcRevenuePerMin returns 0 < 999
  expect(updateCall.data).not.toHaveProperty('maxRevenuePerMin');
});
```

- [ ] **Step 6: Run all tests**

```bash
cd server && npx jest sync.service.spec --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add server/src/sync/sync.service.ts server/src/sync/__tests__/sync.service.spec.ts
git commit -m "feat(sync): track maxRevenuePerMin and openedFloorsCount per player"
```

---

### Task 3: Leaderboard API Module

**Files:**
- Create: `server/src/leaderboard/__tests__/leaderboard.service.spec.ts`
- Create: `server/src/leaderboard/leaderboard.service.ts`
- Create: `server/src/leaderboard/leaderboard.controller.ts`
- Create: `server/src/leaderboard/leaderboard.module.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Consumes: `Player.playerLevel`, `Player.openedFloorsCount`, `Player.maxRevenuePerMin` from Task 1.
- Produces: `GET /leaderboard?tab=level|floors|revenue&page=<n>` → `{ entries: LeaderboardEntry[], total: number, currentPlayer: { rank: number, value: number } }`.

- [ ] **Step 1: Write failing tests**

Create `server/src/leaderboard/__tests__/leaderboard.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { LeaderboardService } from '../leaderboard.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('LeaderboardService', () => {
  let service: LeaderboardService;
  let prisma: Record<string, any>;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaderboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<LeaderboardService>(LeaderboardService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should return level leaderboard with correct ranks and currentPlayer', async () => {
    prisma.player.findMany.mockResolvedValue(mockRows);
    prisma.player.count
      .mockResolvedValueOnce(50)  // total
      .mockResolvedValueOnce(5);  // players with playerLevel > myValue (7)
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

  it('should use openedFloorsCount as value for floors tab', async () => {
    prisma.player.findMany.mockResolvedValue([mockRows[0]]);
    prisma.player.count.mockResolvedValueOnce(10).mockResolvedValueOnce(0);
    prisma.player.findUnique.mockResolvedValue({
      playerLevel: 10, openedFloorsCount: 5, maxRevenuePerMin: 1000,
    });

    const result = await service.getLeaderboard('floors', 1, 'p1');

    expect(result.entries[0].value).toBe(5);
    expect(result.currentPlayer.rank).toBe(1);
  });

  it('should use maxRevenuePerMin as value for revenue tab', async () => {
    prisma.player.findMany.mockResolvedValue([mockRows[0]]);
    prisma.player.count.mockResolvedValueOnce(10).mockResolvedValueOnce(3);
    prisma.player.findUnique.mockResolvedValue({
      playerLevel: 7, openedFloorsCount: 2, maxRevenuePerMin: 500,
    });

    const result = await service.getLeaderboard('revenue', 1, 'my-id');

    expect(result.entries[0].value).toBe(1000);
    expect(result.currentPlayer).toEqual({ rank: 4, value: 500 });
  });

  it('should offset ranks correctly on page 2', async () => {
    prisma.player.findMany.mockResolvedValue([
      { id: 'p21', playerName: 'Charlie', playerLevel: 3, openedFloorsCount: 1, maxRevenuePerMin: 300 },
    ]);
    prisma.player.count.mockResolvedValueOnce(50).mockResolvedValueOnce(49);
    prisma.player.findUnique.mockResolvedValue({
      playerLevel: 1, openedFloorsCount: 0, maxRevenuePerMin: 0,
    });

    const result = await service.getLeaderboard('level', 2, 'my-id');

    expect(result.entries[0].rank).toBe(21);
    expect(result.currentPlayer.rank).toBe(50);
  });

  it('should pass correct orderBy and pagination to prisma', async () => {
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

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd server && npx jest leaderboard.service.spec --no-coverage
```

Expected: FAIL — cannot find module `'../leaderboard.service'`.

- [ ] **Step 3: Create leaderboard.service.ts**

Create `server/src/leaderboard/leaderboard.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const PAGE_SIZE = 20;

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

@Injectable()
export class LeaderboardService {
  constructor(private prisma: PrismaService) {}

  async getLeaderboard(tab: LeaderboardTab, page: number, playerId: string): Promise<LeaderboardResult> {
    const skip = (page - 1) * PAGE_SIZE;

    const orderBy =
      tab === 'level'   ? [{ playerLevel: 'desc' as const },       { createdAt: 'asc' as const }]
      : tab === 'floors' ? [{ openedFloorsCount: 'desc' as const }, { createdAt: 'asc' as const }]
      :                    [{ maxRevenuePerMin: 'desc' as const },   { createdAt: 'asc' as const }];

    const select = {
      id: true,
      playerName: true,
      playerLevel: true,
      openedFloorsCount: true,
      maxRevenuePerMin: true,
    };

    const [rows, total, me] = await Promise.all([
      this.prisma.player.findMany({ select, orderBy, skip, take: PAGE_SIZE }),
      this.prisma.player.count(),
      this.prisma.player.findUnique({ where: { id: playerId }, select }),
    ]);

    const myValue = me
      ? (tab === 'level' ? me.playerLevel : tab === 'floors' ? me.openedFloorsCount : me.maxRevenuePerMin)
      : 0;

    const aboveMe =
      tab === 'level'    ? { playerLevel: { gt: myValue } }
      : tab === 'floors' ? { openedFloorsCount: { gt: myValue } }
      :                    { maxRevenuePerMin: { gt: myValue } };

    const rank = await this.prisma.player.count({ where: aboveMe }) + 1;

    return {
      entries: rows.map((p, i) => ({
        rank: skip + i + 1,
        playerId: p.id,
        playerName: p.playerName,
        value: tab === 'level' ? p.playerLevel : tab === 'floors' ? p.openedFloorsCount : p.maxRevenuePerMin,
      })),
      total,
      currentPlayer: { rank, value: myValue },
    };
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd server && npx jest leaderboard.service.spec --no-coverage
```

Expected: 5 tests PASS.

- [ ] **Step 5: Create leaderboard.controller.ts**

Create `server/src/leaderboard/leaderboard.controller.ts`:

```ts
import { Controller, Get, Query, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LeaderboardService } from './leaderboard.service';

const QuerySchema = z.object({
  tab: z.enum(['level', 'floors', 'revenue']),
  page: z.coerce.number().int().min(1).default(1),
});

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private leaderboardService: LeaderboardService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getLeaderboard(
    @Req() req: { user: { playerId: string } },
    @Query() query: unknown,
  ) {
    const parsed = QuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return this.leaderboardService.getLeaderboard(parsed.data.tab, parsed.data.page, req.user.playerId);
  }
}
```

- [ ] **Step 6: Create leaderboard.module.ts**

Create `server/src/leaderboard/leaderboard.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';

@Module({
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
})
export class LeaderboardModule {}
```

- [ ] **Step 7: Register in AppModule**

In `server/src/app.module.ts`, add the import and register the module:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PlayerModule } from './player/player.module';
import { SyncModule } from './sync/sync.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    PlayerModule,
    SyncModule,
    LeaderboardModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 8: Run the full server test suite**

```bash
cd server && npx jest --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 9: Commit**

```bash
git add server/src/leaderboard/ server/src/app.module.ts
git commit -m "feat(api): add LeaderboardModule with GET /leaderboard endpoint"
```

---

### Task 4: Client — API types + LeaderboardSheet component

**Files:**
- Modify: `src/services/api.ts`
- Modify: `src/i18n/locales/en/tabs.json`
- Create: `src/components/LeaderboardSheet.tsx`

**Interfaces:**
- Consumes: `GET /leaderboard?tab&page` from Task 3; `useAuthStore` for `player.id`.
- Produces: `LeaderboardSheet` component with `visible` and `onClose` props; exports `LeaderboardResponse` and `LeaderboardEntry` types from `api.ts`.

- [ ] **Step 1: Add types and API call to api.ts**

In `src/services/api.ts`, add these type exports after the existing imports (before the `API_BASE_URL` line):

```ts
export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  value: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  total: number;
  currentPlayer: { rank: number; value: number };
}
```

Then in the exported `api` object, add a `leaderboard` method:

```ts
export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  leaderboard: (tab: 'level' | 'floors' | 'revenue', page: number) =>
    request<LeaderboardResponse>('GET', `/leaderboard?tab=${tab}&page=${page}`),
  setTokens,
  clearTokens,
  getAccessToken,
};
```

- [ ] **Step 2: Add i18n keys**

In `src/i18n/locales/en/tabs.json`, add a `leaderboard` block inside the root object (e.g. after `"game"`):

```json
"leaderboard": {
  "title": "Leaderboard",
  "tabLevel": "Level",
  "tabFloors": "Floors",
  "tabRevenue": "Revenue/min",
  "you": "You",
  "errorLoad": "Failed to load",
  "retry": "Retry"
}
```

- [ ] **Step 3: Create LeaderboardSheet.tsx**

Create `src/components/LeaderboardSheet.tsx`:

```tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, Pressable, FlatList, StyleSheet, Dimensions, ActivityIndicator, Modal,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS, Easing,
} from 'react-native-reanimated';
import { useAuthStore } from '../stores/authStore';
import { api, type LeaderboardResponse, type LeaderboardEntry } from '../services/api';
import { formatNum } from '../utils/format';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT - 56;

type Tab = 'level' | 'floors' | 'revenue';

const TABS: { key: Tab; label: string }[] = [
  { key: 'level',   label: 'Рівень' },
  { key: 'floors',  label: 'Поверхи' },
  { key: 'revenue', label: 'Виручка/хв' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function LeaderboardSheet({ visible, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>('level');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myId = useAuthStore(s => s.player?.id);

  const slideY = useSharedValue(SHEET_HEIGHT);
  const scrimOpacity = useSharedValue(0);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: slideY.value }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrimOpacity.value }));

  useEffect(() => {
    if (visible) {
      setMounted(true);
      slideY.value = withSpring(0, { damping: 20, stiffness: 200 });
      scrimOpacity.value = withTiming(0.5, { duration: 300, easing: Easing.linear });
    } else if (mounted) {
      scrimOpacity.value = withTiming(0, { duration: 280, easing: Easing.linear });
      slideY.value = withTiming(SHEET_HEIGHT, { duration: 300, easing: Easing.bezier(0.4, 0, 1, 1) }, () => {
        runOnJS(setMounted)(false);
      });
    }
  }, [visible]);

  useEffect(() => { setPage(1); }, [tab]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.leaderboard(tab, page)
      .then(d => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setError('Помилка завантаження'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visible, tab, page]);

  const totalPages = data ? Math.ceil(data.total / 20) : 1;
  const isOnPage = data?.entries.some(e => e.playerId === myId) ?? false;

  function formatValue(v: number) {
    return tab === 'revenue' ? `${formatNum(v)}/хв` : String(v);
  }

  function renderEntry({ item }: { item: LeaderboardEntry }) {
    const isMe = item.playerId === myId;
    return (
      <View style={[styles.row, isMe && styles.rowHighlight]}>
        <Text style={[styles.rank, isMe && styles.rankHighlight]}>#{item.rank}</Text>
        <Text style={[styles.name, isMe && styles.textHighlight]} numberOfLines={1}>
          {item.playerName}
        </Text>
        <Text style={[styles.value, isMe && styles.textHighlight]}>{formatValue(item.value)}</Text>
      </View>
    );
  }

  if (!mounted) return null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      {/* Scrim + tap to close */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} />
      </Pressable>

      {/* Sheet */}
      <Animated.View style={[styles.sheet, sheetStyle]}>
        <View style={styles.header}>
          <Text style={styles.title}>Рейтинг</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.closeIcon}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.tabs}>
          {TABS.map(t => (
            <Pressable
              key={t.key}
              style={[styles.tab, tab === t.key && styles.tabActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading && <ActivityIndicator style={styles.loader} color="#5B6CF8" size="large" />}

        {error && !loading && (
          <View style={styles.errorWrap}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => setPage(p => p)} style={styles.retryBtn}>
              <Text style={styles.retryText}>Повторити</Text>
            </Pressable>
          </View>
        )}

        {!loading && !error && data && (
          <FlatList
            data={data.entries}
            keyExtractor={e => e.playerId}
            renderItem={renderEntry}
            contentContainerStyle={styles.list}
            style={{ flex: 1 }}
          />
        )}

        {/* Pinned row: current player is not visible on this page */}
        {!loading && !error && data && !isOnPage && (
          <View style={[styles.row, styles.rowHighlight, styles.pinnedRow]}>
            <Text style={[styles.rank, styles.rankHighlight]}>#{data.currentPlayer.rank}</Text>
            <Text style={[styles.name, styles.textHighlight]}>Ви</Text>
            <Text style={[styles.value, styles.textHighlight]}>
              {formatValue(data.currentPlayer.value)}
            </Text>
          </View>
        )}

        {/* Pagination */}
        {!loading && !error && data && (
          <View style={styles.pagination}>
            <Pressable
              style={[styles.pageBtn, page === 1 && styles.pageBtnDisabled]}
              onPress={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <Text style={styles.pageBtnText}>◀</Text>
            </Pressable>
            <Text style={styles.pageLabel}>{page} / {totalPages}</Text>
            <Pressable
              style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
              onPress={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <Text style={styles.pageBtnText}>▶</Text>
            </Pressable>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: '#000' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: '#F4F6FB',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: { fontFamily: 'Fredoka_700Bold', fontSize: 22, color: '#2A3344' },
  closeIcon: { fontSize: 18, color: '#8A95A3' },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#E8EAF0',
  },
  tabActive: { backgroundColor: '#5B6CF8' },
  tabText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14, color: '#6B7280' },
  tabTextActive: { color: '#fff' },
  loader: { flex: 1 },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontFamily: 'Fredoka_400Regular', fontSize: 15, color: '#E05A4A' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#5B6CF8', borderRadius: 10 },
  retryText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 14, color: '#fff' },
  list: { paddingHorizontal: 16, paddingBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 4,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  rowHighlight: { backgroundColor: '#FFF7E0' },
  rank: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    color: '#6B7280',
    width: 46,
  },
  rankHighlight: { color: '#B8860B' },
  name: { fontFamily: 'Fredoka_400Regular', fontSize: 15, color: '#2A3344', flex: 1 },
  value: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15, color: '#2A3344', textAlign: 'right' },
  textHighlight: { color: '#B8860B' },
  pinnedRow: { marginHorizontal: 16, marginBottom: 4, borderRadius: 12 },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8EAF0',
  },
  pageBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#5B6CF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBtnDisabled: { backgroundColor: '#D1D5DB' },
  pageBtnText: { fontSize: 16, color: '#fff' },
  pageLabel: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15, color: '#2A3344' },
});
```

- [ ] **Step 4: Commit**

```bash
git add src/services/api.ts src/i18n/locales/en/tabs.json src/components/LeaderboardSheet.tsx
git commit -m "feat(ui): add LeaderboardSheet component"
```

---

### Task 5: Menu entry

**Files:**
- Modify: `app/(tabs)/menu.tsx`

**Interfaces:**
- Consumes: `LeaderboardSheet` from Task 4.
- Produces: "Рейтинг" pressable in menu that opens the leaderboard sheet.

- [ ] **Step 1: Update menu.tsx**

Replace the entire content of `app/(tabs)/menu.tsx` with:

```tsx
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ImageBackground } from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import WarehouseSheet from '../../src/components/WarehouseSheet';
import WorkersPanel from '../../src/components/WorkersPanel';
import LeaderboardSheet from '../../src/components/LeaderboardSheet';

export default function MenuScreen() {
  const { t } = useTranslation('tabs');
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [workersOpen, setWorkersOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);

  return (
    <ImageBackground
      source={require('../../assets/welcome-bg.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.content}>
        <Text style={styles.heading}>{t('menu.heading')}</Text>

        <Pressable style={styles.menuItem} onPress={() => setInventoryOpen(true)}>
          <Image
            source={require('../../assets/img/menu/werehouse.png')}
            style={{ width: 56, height: 56 }}
            contentFit="contain"
          />
          <Text style={styles.menuLabel}>{t('menu.inventory')}</Text>
        </Pressable>

        <Pressable style={styles.menuItem} onPress={() => setWorkersOpen(true)}>
          <Image
            source={require('../../assets/img/menu/workers.png')}
            style={{ width: 56, height: 56 }}
            contentFit="contain"
          />
          <Text style={styles.menuLabel}>{t('menu.workers')}</Text>
        </Pressable>

        <Pressable style={styles.menuItem} onPress={() => setLeaderboardOpen(true)}>
          <Image
            source={require('../../assets/img/menu/rating.png')}
            style={{ width: 56, height: 56 }}
            contentFit="contain"
          />
          <Text style={styles.menuLabel}>{t('menu.leaderboard')}</Text>
        </Pressable>
      </View>

      <WarehouseSheet visible={inventoryOpen} onClose={() => setInventoryOpen(false)} />
      <WorkersPanel visible={workersOpen} onClose={() => setWorkersOpen(false)} />
      <LeaderboardSheet visible={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    paddingTop: 72,
    paddingHorizontal: 20,
    gap: 12,
  },
  heading: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 26,
    color: '#2A3344',
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  menuLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
    color: '#2A3344',
  },
});
```

- [ ] **Step 2: Add translation key**

In `src/i18n/locales/en/tabs.json`, add `"leaderboard": "Leaderboard"` inside the `"menu"` block:

```json
"menu": {
  "heading": "Menu",
  "inventory": "Inventory",
  "warehouseTitle": "Warehouse",
  "workers": "My Workers",
  "leaderboard": "Leaderboard"
}
```

- [ ] **Step 3: Smoke test manually**

Start the app (`npx expo start`) and:
1. Navigate to Menu tab — confirm "Leaderboard" row appears with trophy icon.
2. Tap "Leaderboard" — confirm sheet slides up.
3. Tap each tab — confirm loading spinner, then entries appear.
4. Tap outside the sheet — confirm it slides down and closes.
5. Navigate to page 2 with ▶ — confirm ranks start at #21.
6. If your player is not on page 1, confirm a pinned "Ви" row appears at the bottom.

- [ ] **Step 4: Commit**

```bash
git add app/(tabs)/menu.tsx src/i18n/locales/en/tabs.json
git commit -m "feat(menu): add Leaderboard entry"
```
