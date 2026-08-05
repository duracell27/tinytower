# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Vite + React admin SPA at `tinytower/admin/` backed by a new NestJS `AdminModule`, enabling player management, game state editing, and command log inspection.

**Architecture:** A new `server/src/admin/` NestJS module registers under `/admin/*` behind `JwtAuthGuard + AdminGuard`; all mutations write directly to Postgres via Prisma (no command queue). The frontend is a separate Vite project at `admin/` that proxies `/api/*` → `http://localhost:3000` in dev and uses TanStack Query for data fetching.

**Tech Stack:** NestJS + Prisma (backend) · Vite + React 18 + TypeScript + shadcn/ui + Tailwind CSS + TanStack Query v5 + React Router v6 + React Hook Form + zod (frontend)

## Global Constraints

- All `/admin/*` routes require `JwtAuthGuard` **and** `AdminGuard` (checks `req.user.isAdmin === true`).
- Direct Prisma mutations only — never go through the command queue.
- `CommandLog.timestamp` and `CommandLog.serverTime` are `BigInt` in Prisma; serialize to string in API responses.
- `docs/` is gitignored in this repo — skip committing plan/spec files; commit only source code.
- shadcn/ui components are added individually via CLI or copied manually; do **not** use `npx shadcn-ui init` in a way that overwrites `vite.config.ts`.
- Tailwind CSS v3 (not v4) — use `tailwind.config.js` with `content` array.
- Node path alias `@shared` → `../../shared` configured in both `vite.config.ts` and `tsconfig.json`.

---

## File Map

### Backend (server/src/admin/)
| File | Responsibility |
|---|---|
| `admin.guard.ts` | Re-declares AdminGuard locally (avoids cross-module import) |
| `admin.module.ts` | Registers controller + service + imports PrismaModule |
| `admin.controller.ts` | Route handlers with zod validation |
| `admin.service.ts` | All Prisma queries |
| `__tests__/admin.service.spec.ts` | Unit tests with mocked Prisma |

**Modified:** `server/src/app.module.ts` (add AdminModule import)

### Frontend (admin/src/)
| File | Responsibility |
|---|---|
| `lib/api.ts` | Typed fetch wrapper; handles auth header + 401 redirect |
| `lib/auth.ts` | Token get/set/clear in localStorage |
| `types.ts` | Shared TS interfaces for API responses |
| `components/ProtectedRoute.tsx` | Redirects to /login if no token |
| `components/DataTable.tsx` | Generic TanStack Table + shadcn wrapper |
| `components/ConfirmDialog.tsx` | shadcn Dialog for destructive confirmations |
| `pages/LoginPage.tsx` | Email/password form → POST /api/auth/login |
| `pages/PlayersPage.tsx` | Paginated player list with search + delete |
| `pages/PlayerDetailPage.tsx` | Tabbed player editor (6 tabs) |
| `pages/CommandLogsPage.tsx` | Paginated command log with filters |
| `App.tsx` | React Router routes |
| `main.tsx` | Entry point; QueryClientProvider + Toaster |

---

## Task 1: Backend — AdminModule scaffold + players list endpoint

**Files:**
- Create: `server/src/admin/admin.guard.ts`
- Create: `server/src/admin/admin.module.ts`
- Create: `server/src/admin/admin.controller.ts`
- Create: `server/src/admin/admin.service.ts`
- Create: `server/src/admin/__tests__/admin.service.spec.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Produces: `AdminService.getPlayers(page, limit, search?)` → `{ data: PlayerListItem[], total, page, totalPages }`
- Produces: `GET /admin/players?page&limit&search`

- [ ] **Step 1: Create admin.guard.ts**

```typescript
// server/src/admin/admin.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: { isAdmin?: boolean } }>();
    if (!req.user?.isAdmin) throw new ForbiddenException('Admin access required');
    return true;
  }
}
```

- [ ] **Step 2: Create admin.service.ts with getPlayers**

```typescript
// server/src/admin/admin.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getPlayers(page: number, limit: number, search?: string) {
    const where = search
      ? {
          OR: [
            { playerName: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [players, total] = await Promise.all([
      this.prisma.player.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: { state: { select: { gems: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.player.count({ where }),
    ]);

    return {
      data: players.map((p) => ({
        id: p.id,
        email: p.email,
        playerName: p.playerName,
        playerLevel: p.playerLevel,
        balance: p.balance,
        gems: p.state?.gems ?? 0,
        isAdmin: p.isAdmin,
        lastSeenAt: p.lastSeenAt,
        createdAt: p.createdAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}
```

- [ ] **Step 3: Write failing test for getPlayers**

```typescript
// server/src/admin/__tests__/admin.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from '../admin.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: Record<string, any>;

  const mockPlayer = {
    id: 'player-1',
    email: 'test@test.com',
    playerName: 'TestPlayer',
    playerLevel: 5,
    balance: 1000,
    isAdmin: false,
    lastSeenAt: new Date(),
    createdAt: new Date(),
    state: { gems: 20 },
  };

  beforeEach(async () => {
    prisma = {
      player: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      playerState: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      worker: {
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
      floor: {
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      playerFloorType: {
        deleteMany: jest.fn(),
      },
      commandLog: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  describe('getPlayers', () => {
    it('returns paginated players with gems from state', async () => {
      prisma.player.findMany.mockResolvedValue([mockPlayer]);
      prisma.player.count.mockResolvedValue(1);

      const result = await service.getPlayers(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].gems).toBe(20);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('applies search filter to playerName and email', async () => {
      prisma.player.findMany.mockResolvedValue([]);
      prisma.player.count.mockResolvedValue(0);

      await service.getPlayers(1, 20, 'test');

      expect(prisma.player.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { playerName: { contains: 'test', mode: 'insensitive' } },
              { email: { contains: 'test', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
cd server && npx jest admin.service.spec --no-coverage
```
Expected: FAIL — `AdminService` not found or method missing.

- [ ] **Step 5: Create admin.controller.ts**

```typescript
// server/src/admin/admin.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('players')
  getPlayers(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
  ) {
    return this.adminService.getPlayers(+page, +limit, search);
  }
}
```

- [ ] **Step 6: Create admin.module.ts**

```typescript
// server/src/admin/admin.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
```

- [ ] **Step 7: Register AdminModule in app.module.ts**

In `server/src/app.module.ts`, add to imports array:
```typescript
import { AdminModule } from './admin/admin.module';
// add AdminModule to the imports array after ForumModule
```

- [ ] **Step 8: Run test to verify it passes**

```bash
cd server && npx jest admin.service.spec --no-coverage
```
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add server/src/admin/ server/src/app.module.ts
git commit -m "feat(admin): add AdminModule scaffold with players list endpoint"
```

---

## Task 2: Backend — Player detail, edit, and delete endpoints

**Files:**
- Modify: `server/src/admin/admin.service.ts`
- Modify: `server/src/admin/admin.controller.ts`
- Modify: `server/src/admin/__tests__/admin.service.spec.ts`

**Interfaces:**
- Consumes: Prisma models `Player`, `PlayerState`, `Worker`, `Floor`, `Production`, `PlayerFloorType`
- Produces:
  - `AdminService.getPlayer(id)` → `PlayerDetail`
  - `AdminService.updatePlayerInfo(id, dto)`
  - `AdminService.updatePlayerEconomy(id, dto)`
  - `AdminService.updatePlayerMaterials(id, dto)`
  - `AdminService.updatePlayerTokens(id, dto)`
  - `AdminService.deleteWorker(playerId, workerId)`
  - `AdminService.deleteFloor(playerId, floorId)`
  - `AdminService.deletePlayer(id)`

- [ ] **Step 1: Add service methods**

Append to `server/src/admin/admin.service.ts`:

```typescript
  async getPlayer(id: string) {
    const player = await this.prisma.player.findUnique({
      where: { id },
      include: {
        state: true,
        workers: true,
        floors: {
          include: { productions: { orderBy: { slotIdx: 'asc' } } },
          orderBy: { floorId: 'asc' },
        },
        floorTypes: true,
      },
    });
    if (!player) throw new NotFoundException('Player not found');

    return {
      id: player.id,
      email: player.email,
      playerName: player.playerName,
      playerLevel: player.playerLevel,
      playerXp: player.playerXp,
      isAdmin: player.isAdmin,
      balance: player.balance,
      createdAt: player.createdAt,
      lastSeenAt: player.lastSeenAt,
      gems: player.state?.gems ?? 0,
      tools: {
        briks: player.state?.briks ?? 0,
        glass: player.state?.glass ?? 0,
        nails: player.state?.nails ?? 0,
        screw: player.state?.screw ?? 0,
      },
      tokens: {
        green: player.state?.tokenGreen ?? 0,
        blue: player.state?.tokenBlue ?? 0,
        yellow: player.state?.tokenYellow ?? 0,
        purple: player.state?.tokenPurple ?? 0,
        red: player.state?.tokenRed ?? 0,
      },
      lobbyCapacity: player.state?.lobbyCapacity ?? 10,
      hotelCapacity: player.state?.hotelCapacity ?? 10,
      elevatorLevel: player.state?.elevatorLevel ?? 1,
      workers: player.workers.map((w) => ({
        id: w.id,
        name: w.name,
        level: w.level,
        floorType: w.floorType,
        dreamJob: w.dreamJob,
        isSpecialist: w.isSpecialist,
        assignedFloorId: w.assignedFloorId,
        assignedSlotIdx: w.assignedSlotIdx,
      })),
      floors: player.floors.map((f) => {
        const ft = player.floorTypes.find((t) => t.floorId === f.floorId);
        return {
          floorId: f.floorId,
          floorType: ft?.floorType ?? null,
          productions: f.productions.map((p) => ({
            slotIdx: p.slotIdx,
            typeId: p.typeId,
            stage: p.stage,
          })),
        };
      }),
    };
  }

  async updatePlayerInfo(
    id: string,
    dto: { playerName?: string; email?: string; isAdmin?: boolean; playerLevel?: number; playerXp?: number },
  ) {
    const player = await this.prisma.player.findUnique({ where: { id } });
    if (!player) throw new NotFoundException('Player not found');
    return this.prisma.player.update({
      where: { id },
      data: dto,
      select: { id: true, playerName: true, email: true, isAdmin: true, playerLevel: true, playerXp: true },
    });
  }

  async updatePlayerEconomy(id: string, dto: { balance?: number; gems?: number }) {
    const player = await this.prisma.player.findUnique({ where: { id } });
    if (!player) throw new NotFoundException('Player not found');
    await Promise.all([
      dto.balance !== undefined
        ? this.prisma.player.update({ where: { id }, data: { balance: dto.balance } })
        : Promise.resolve(),
      dto.gems !== undefined
        ? this.prisma.playerState.update({ where: { playerId: id }, data: { gems: dto.gems } })
        : Promise.resolve(),
    ]);
    return { ok: true };
  }

  async updatePlayerMaterials(
    id: string,
    dto: { briks?: number; glass?: number; nails?: number; screw?: number },
  ) {
    const state = await this.prisma.playerState.findUnique({ where: { playerId: id } });
    if (!state) throw new NotFoundException('Player not found');
    await this.prisma.playerState.update({ where: { playerId: id }, data: dto });
    return { ok: true };
  }

  async updatePlayerTokens(
    id: string,
    dto: { green?: number; blue?: number; yellow?: number; purple?: number; red?: number },
  ) {
    const state = await this.prisma.playerState.findUnique({ where: { playerId: id } });
    if (!state) throw new NotFoundException('Player not found');
    await this.prisma.playerState.update({
      where: { playerId: id },
      data: {
        tokenGreen: dto.green,
        tokenBlue: dto.blue,
        tokenYellow: dto.yellow,
        tokenPurple: dto.purple,
        tokenRed: dto.red,
      },
    });
    return { ok: true };
  }

  async deleteWorker(playerId: string, workerId: string) {
    const worker = await this.prisma.worker.findFirst({ where: { id: workerId, playerId } });
    if (!worker) throw new NotFoundException('Worker not found');
    await this.prisma.worker.delete({ where: { id: workerId } });
    return { ok: true };
  }

  async deleteFloor(playerId: string, floorId: number) {
    const floor = await this.prisma.floor.findUnique({
      where: { playerId_floorId: { playerId, floorId } },
    });
    if (!floor) throw new NotFoundException('Floor not found');
    await this.prisma.floor.delete({ where: { playerId_floorId: { playerId, floorId } } });
    await this.prisma.playerFloorType.deleteMany({ where: { playerId, floorId } });
    return { ok: true };
  }

  async deletePlayer(id: string) {
    const player = await this.prisma.player.findUnique({ where: { id } });
    if (!player) throw new NotFoundException('Player not found');
    await this.prisma.player.delete({ where: { id } });
    return { ok: true };
  }
```

- [ ] **Step 2: Write failing tests for new service methods**

Append to the `describe('AdminService')` block in `server/src/admin/__tests__/admin.service.spec.ts`:

```typescript
  describe('getPlayer', () => {
    it('throws NotFoundException for unknown id', async () => {
      prisma.player.findUnique.mockResolvedValue(null);
      await expect(service.getPlayer('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('maps token fields from state', async () => {
      prisma.player.findUnique.mockResolvedValue({
        ...mockPlayer,
        playerXp: 0,
        state: {
          gems: 5, briks: 1, glass: 2, nails: 3, screw: 4,
          tokenGreen: 10, tokenBlue: 20, tokenYellow: 30, tokenPurple: 40, tokenRed: 50,
          lobbyCapacity: 10, hotelCapacity: 10, elevatorLevel: 1,
        },
        workers: [],
        floors: [],
        floorTypes: [],
      });
      const result = await service.getPlayer('player-1');
      expect(result.tokens).toEqual({ green: 10, blue: 20, yellow: 30, purple: 40, red: 50 });
    });
  });

  describe('deletePlayer', () => {
    it('throws NotFoundException when player does not exist', async () => {
      prisma.player.findUnique.mockResolvedValue(null);
      await expect(service.deletePlayer('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('calls prisma.player.delete with correct id', async () => {
      prisma.player.findUnique.mockResolvedValue(mockPlayer);
      prisma.player.delete.mockResolvedValue(mockPlayer);
      await service.deletePlayer('player-1');
      expect(prisma.player.delete).toHaveBeenCalledWith({ where: { id: 'player-1' } });
    });
  });

  describe('deleteWorker', () => {
    it('throws NotFoundException when worker not found for player', async () => {
      prisma.worker.findFirst.mockResolvedValue(null);
      await expect(service.deleteWorker('player-1', 'w-1')).rejects.toThrow(NotFoundException);
    });
  });
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd server && npx jest admin.service.spec --no-coverage
```
Expected: new tests FAIL — methods not yet added.

- [ ] **Step 4: Add controller routes**

In `server/src/admin/admin.controller.ts`, add these imports and routes:

```typescript
import {
  Controller, Get, Patch, Delete, Query, Param,
  UseGuards, Body, BadRequestException,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

const UpdateInfoSchema = z.object({
  playerName: z.string().min(3).max(30).optional(),
  email: z.string().email().optional(),
  isAdmin: z.boolean().optional(),
  playerLevel: z.number().int().positive().optional(),
  playerXp: z.number().int().nonnegative().optional(),
});

const UpdateEconomySchema = z.object({
  balance: z.number().int().nonnegative().optional(),
  gems: z.number().int().nonnegative().optional(),
});

const UpdateMaterialsSchema = z.object({
  briks: z.number().int().nonnegative().optional(),
  glass: z.number().int().nonnegative().optional(),
  nails: z.number().int().nonnegative().optional(),
  screw: z.number().int().nonnegative().optional(),
});

const UpdateTokensSchema = z.object({
  green: z.number().int().nonnegative().optional(),
  blue: z.number().int().nonnegative().optional(),
  yellow: z.number().int().nonnegative().optional(),
  purple: z.number().int().nonnegative().optional(),
  red: z.number().int().nonnegative().optional(),
});

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('players')
  getPlayers(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
  ) {
    return this.adminService.getPlayers(+page, +limit, search);
  }

  @Get('players/:id')
  getPlayer(@Param('id') id: string) {
    return this.adminService.getPlayer(id);
  }

  @Patch('players/:id/info')
  updateInfo(@Param('id') id: string, @Body() body: unknown) {
    const result = UpdateInfoSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.issues);
    return this.adminService.updatePlayerInfo(id, result.data);
  }

  @Patch('players/:id/economy')
  updateEconomy(@Param('id') id: string, @Body() body: unknown) {
    const result = UpdateEconomySchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.issues);
    return this.adminService.updatePlayerEconomy(id, result.data);
  }

  @Patch('players/:id/materials')
  updateMaterials(@Param('id') id: string, @Body() body: unknown) {
    const result = UpdateMaterialsSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.issues);
    return this.adminService.updatePlayerMaterials(id, result.data);
  }

  @Patch('players/:id/tokens')
  updateTokens(@Param('id') id: string, @Body() body: unknown) {
    const result = UpdateTokensSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.issues);
    return this.adminService.updatePlayerTokens(id, result.data);
  }

  @Delete('players/:id/workers/:workerId')
  deleteWorker(@Param('id') playerId: string, @Param('workerId') workerId: string) {
    return this.adminService.deleteWorker(playerId, workerId);
  }

  @Delete('players/:id/floors/:floorId')
  deleteFloor(@Param('id') playerId: string, @Param('floorId') floorId: string) {
    return this.adminService.deleteFloor(playerId, +floorId);
  }

  @Delete('players/:id')
  deletePlayer(@Param('id') id: string) {
    return this.adminService.deletePlayer(id);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd server && npx jest admin.service.spec --no-coverage
```
Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/admin/
git commit -m "feat(admin): add player detail, edit, and delete endpoints"
```

---

## Task 3: Backend — Command logs endpoint

**Files:**
- Modify: `server/src/admin/admin.service.ts`
- Modify: `server/src/admin/admin.controller.ts`
- Modify: `server/src/admin/__tests__/admin.service.spec.ts`

**Interfaces:**
- Produces: `AdminService.getCommandLogs(page, limit, playerId?, type?)` → `{ data: CommandLogItem[], total, page, totalPages }`
- Produces: `GET /admin/commands?page&limit&playerId&type`

- [ ] **Step 1: Write failing test**

Append to the `describe('AdminService')` block:

```typescript
  describe('getCommandLogs', () => {
    it('returns paginated logs with playerName joined', async () => {
      prisma.commandLog.findMany.mockResolvedValue([
        {
          id: 'cmd-1',
          playerId: 'player-1',
          type: 'buy',
          floorId: 2,
          slotIdx: 0,
          typeId: 'coffee',
          workerId: null,
          timestamp: BigInt(1700000000000),
          processedAt: new Date(),
        },
      ]);
      prisma.commandLog.count.mockResolvedValue(1);
      prisma.player.findMany.mockResolvedValue([{ id: 'player-1', playerName: 'TestPlayer' }]);

      const result = await service.getCommandLogs(1, 50);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].playerName).toBe('TestPlayer');
      expect(result.data[0].timestamp).toBe('1700000000000');
    });

    it('filters by playerId and type when provided', async () => {
      prisma.commandLog.findMany.mockResolvedValue([]);
      prisma.commandLog.count.mockResolvedValue(0);
      prisma.player.findMany.mockResolvedValue([]);

      await service.getCommandLogs(1, 50, 'player-1', 'buy');

      expect(prisma.commandLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { playerId: 'player-1', type: 'buy' },
        }),
      );
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npx jest admin.service.spec --no-coverage
```
Expected: FAIL — `getCommandLogs` not defined.

- [ ] **Step 3: Add getCommandLogs to admin.service.ts**

Append to `AdminService` class:

```typescript
  async getCommandLogs(page: number, limit: number, playerId?: string, type?: string) {
    const where = {
      ...(playerId ? { playerId } : {}),
      ...(type ? { type } : {}),
    };

    const [logs, total] = await Promise.all([
      this.prisma.commandLog.findMany({
        where,
        orderBy: { processedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.commandLog.count({ where }),
    ]);

    const playerIds = [...new Set(logs.map((l) => l.playerId))];
    const players = playerIds.length
      ? await this.prisma.player.findMany({
          where: { id: { in: playerIds } },
          select: { id: true, playerName: true },
        })
      : [];
    const playerMap = Object.fromEntries(players.map((p) => [p.id, p.playerName]));

    return {
      data: logs.map((l) => ({
        id: l.id,
        playerId: l.playerId,
        playerName: playerMap[l.playerId] ?? 'Unknown',
        type: l.type,
        floorId: l.floorId,
        slotIdx: l.slotIdx,
        typeId: l.typeId,
        workerId: l.workerId,
        timestamp: l.timestamp.toString(),
        processedAt: l.processedAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
```

- [ ] **Step 4: Add controller route**

In `server/src/admin/admin.controller.ts`, add after the `deletePlayer` route:

```typescript
  @Get('commands')
  getCommandLogs(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('playerId') playerId?: string,
    @Query('type') type?: string,
  ) {
    return this.adminService.getCommandLogs(+page, +limit, playerId, type);
  }
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd server && npx jest admin.service.spec --no-coverage
```
Expected: all tests PASS

- [ ] **Step 6: Manual smoke test**

```bash
cd server && npm run start:dev
# In another terminal:
# Login as admin user first to get token, then:
curl -H "Authorization: Bearer <token>" http://localhost:3000/admin/players?page=1&limit=5
curl -H "Authorization: Bearer <token>" http://localhost:3000/admin/commands?page=1&limit=10
```

- [ ] **Step 7: Commit**

```bash
git add server/src/admin/
git commit -m "feat(admin): add command logs endpoint with pagination and filters"
```

---

## Task 4: Frontend scaffold

**Files:**
- Create: `admin/package.json`
- Create: `admin/tsconfig.json`
- Create: `admin/vite.config.ts`
- Create: `admin/postcss.config.js`
- Create: `admin/tailwind.config.js`
- Create: `admin/index.html`
- Create: `admin/src/main.tsx`
- Create: `admin/src/App.tsx`
- Create: `admin/src/types.ts`
- Create: `admin/src/lib/api.ts`
- Create: `admin/src/lib/auth.ts`
- Create: `admin/src/components/ProtectedRoute.tsx`
- Create: `admin/src/components/ConfirmDialog.tsx`
- Create: `admin/src/index.css`

**Interfaces:**
- Produces: running Vite dev server at `:5173` that proxies `/api/*` to `:3000`
- Produces: `api.get/post/patch/delete` typed fetch helpers
- Produces: `isAuthenticated()`, `getToken()`, `setToken()`, `clearToken()` from `lib/auth.ts`

- [ ] **Step 1: Create package.json**

```json
// admin/package.json
{
  "name": "tinytower-admin",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.9.0",
    "@radix-ui/react-dialog": "^1.1.4",
    "@radix-ui/react-label": "^2.1.1",
    "@radix-ui/react-select": "^2.1.4",
    "@radix-ui/react-switch": "^1.1.2",
    "@radix-ui/react-tabs": "^1.1.2",
    "@tanstack/react-query": "^5.62.0",
    "@tanstack/react-table": "^8.20.5",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.468.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.54.0",
    "react-router-dom": "^6.28.0",
    "sonner": "^1.7.1",
    "tailwind-merge": "^2.5.5",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.16",
    "typescript": "^5.7.2",
    "vite": "^6.0.5"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
// admin/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "paths": {
      "@shared/*": ["../shared/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
// admin/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
});
```

- [ ] **Step 4: Create Tailwind config files**

```javascript
// admin/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

```javascript
// admin/postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5: Create index.html**

```html
<!-- admin/index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TinyTower Admin</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create src/index.css**

```css
/* admin/src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  font-family: system-ui, sans-serif;
}
```

- [ ] **Step 7: Create src/types.ts**

```typescript
// admin/src/types.ts
export interface PlayerListItem {
  id: string;
  email: string;
  playerName: string;
  playerLevel: number;
  balance: number;
  gems: number;
  isAdmin: boolean;
  lastSeenAt: string;
  createdAt: string;
}

export interface WorkerItem {
  id: string;
  name: string;
  level: number;
  floorType: string;
  dreamJob: string;
  isSpecialist: boolean;
  assignedFloorId: number | null;
  assignedSlotIdx: number | null;
}

export interface FloorItem {
  floorId: number;
  floorType: string | null;
  productions: Array<{ slotIdx: number; typeId: string | null; stage: string }>;
}

export interface PlayerDetail {
  id: string;
  email: string;
  playerName: string;
  playerLevel: number;
  playerXp: number;
  isAdmin: boolean;
  balance: number;
  createdAt: string;
  lastSeenAt: string;
  gems: number;
  tools: { briks: number; glass: number; nails: number; screw: number };
  tokens: { green: number; blue: number; yellow: number; purple: number; red: number };
  lobbyCapacity: number;
  hotelCapacity: number;
  elevatorLevel: number;
  workers: WorkerItem[];
  floors: FloorItem[];
}

export interface CommandLogItem {
  id: string;
  playerId: string;
  playerName: string;
  type: string;
  floorId: number | null;
  slotIdx: number | null;
  typeId: string | null;
  workerId: string | null;
  timestamp: string;
  processedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}
```

- [ ] **Step 8: Create src/lib/auth.ts**

```typescript
// admin/src/lib/auth.ts
const TOKEN_KEY = 'admin_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
```

- [ ] **Step 9: Create src/lib/api.ts**

```typescript
// admin/src/lib/api.ts
import { getToken, clearToken } from './auth';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error((err as { message?: string }).message ?? 'Request failed');
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
```

- [ ] **Step 10: Create src/lib/utils.ts (shadcn helper)**

```typescript
// admin/src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 11: Create ProtectedRoute**

```typescript
// admin/src/components/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { isAuthenticated } from '../lib/auth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
```

- [ ] **Step 12: Create ConfirmDialog**

```typescript
// admin/src/components/ConfirmDialog.tsx
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '../lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  loading?: boolean;
}

export function ConfirmDialog({ open, onOpenChange, title, description, onConfirm, loading }: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6 w-80 shadow-xl">
          <Dialog.Title className="text-lg font-semibold mb-2">{title}</Dialog.Title>
          <Dialog.Description className="text-sm text-gray-600 mb-4">{description}</Dialog.Description>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => onOpenChange(false)}
              className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={cn('px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700', loading && 'opacity-50')}
            >
              {loading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 13: Create App.tsx skeleton**

```typescript
// admin/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { PlayersPage } from './pages/PlayersPage';
import { PlayerDetailPage } from './pages/PlayerDetailPage';
import { CommandLogsPage } from './pages/CommandLogsPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/players"
          element={
            <ProtectedRoute>
              <PlayersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/players/:id"
          element={
            <ProtectedRoute>
              <PlayerDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/commands"
          element={
            <ProtectedRoute>
              <CommandLogsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/players" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 14: Create main.tsx**

```typescript
// admin/src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { App } from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster position="top-right" />
    </QueryClientProvider>
  </StrictMode>,
);
```

- [ ] **Step 15: Create placeholder page files so App.tsx compiles**

```typescript
// admin/src/pages/LoginPage.tsx
export function LoginPage() { return <div>Login</div>; }
```

```typescript
// admin/src/pages/PlayersPage.tsx
export function PlayersPage() { return <div>Players</div>; }
```

```typescript
// admin/src/pages/PlayerDetailPage.tsx
export function PlayerDetailPage() { return <div>Player Detail</div>; }
```

```typescript
// admin/src/pages/CommandLogsPage.tsx
export function CommandLogsPage() { return <div>Commands</div>; }
```

- [ ] **Step 16: Install dependencies and verify dev server starts**

```bash
cd admin && npm install
npm run dev
```
Expected: Vite server starts on `:5173`, browser shows blank page with no console errors.

- [ ] **Step 17: Commit**

```bash
cd ..
git add admin/
git commit -m "feat(admin): scaffold Vite + React + shadcn admin project"
```

---

## Task 5: Frontend — Login page

**Files:**
- Modify: `admin/src/pages/LoginPage.tsx`

**Interfaces:**
- Consumes: `api.post('/auth/login', { email, password })` → `{ accessToken: string; player: { isAdmin: boolean } }`
- Consumes: `setToken(token)` from `lib/auth.ts`

- [ ] **Step 1: Implement LoginPage**

```typescript
// admin/src/pages/LoginPage.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { setToken } from '../lib/auth';

const LoginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Required'),
});
type LoginForm = z.infer<typeof LoginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(LoginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      const res = await api.post<{ accessToken: string; player: { isAdmin: boolean } }>(
        '/auth/login',
        data,
      );
      if (!res.player.isAdmin) {
        toast.error('Access denied — admin only');
        return;
      }
      setToken(res.accessToken);
      navigate('/players');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white p-8 rounded-lg shadow w-80 space-y-4"
      >
        <h1 className="text-xl font-bold">TinyTower Admin</h1>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            {...register('email')}
            type="email"
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            {...register('password')}
            type="password"
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Manual test**

```bash
# Start dev server and backend if not running
cd admin && npm run dev
```
- Open `http://localhost:5173/login`
- Try wrong password → toast "Invalid credentials"
- Try non-admin user → toast "Access denied"
- Try admin credentials → redirects to `/players`

- [ ] **Step 3: Commit**

```bash
git add admin/src/pages/LoginPage.tsx
git commit -m "feat(admin): add login page with isAdmin check"
```

---

## Task 6: Frontend — Players list page

**Files:**
- Create: `admin/src/components/DataTable.tsx`
- Create: `admin/src/components/Layout.tsx`
- Modify: `admin/src/pages/PlayersPage.tsx`

**Interfaces:**
- Consumes: `api.get('/admin/players?page=&limit=&search=')` → `PaginatedResponse<PlayerListItem>`
- Consumes: `api.delete('/admin/players/:id')` → `{ ok: true }`
- Consumes: `PlayerListItem`, `PaginatedResponse<T>` from `types.ts`

- [ ] **Step 1: Create Layout component**

```typescript
// admin/src/components/Layout.tsx
import { Link, useLocation } from 'react-router-dom';
import { clearToken } from '../lib/auth';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  const navLinks = [
    { to: '/players', label: 'Players' },
    { to: '/commands', label: 'Command Logs' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-3 flex items-center gap-6">
        <span className="font-bold text-gray-800">TinyTower Admin</span>
        <div className="flex gap-4">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={cn(
                'text-sm hover:text-blue-600',
                location.pathname.startsWith(l.to) ? 'text-blue-600 font-medium' : 'text-gray-600',
              )}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <button
          onClick={() => { clearToken(); navigate('/login'); }}
          className="ml-auto text-sm text-gray-500 hover:text-red-600"
        >
          Logout
        </button>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Create DataTable component**

```typescript
// admin/src/components/DataTable.tsx
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { cn } from '../lib/utils';

interface DataTableProps<T> {
  columns: ColumnDef<T, any>[];
  data: T[];
}

export function DataTable<T>({ columns, data }: DataTableProps<T>) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="rounded-md border bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b bg-gray-50">
              {hg.headers.map((h) => (
                <th key={h.id} className="px-4 py-3 text-left font-medium text-gray-700">
                  {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                No records found
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0 hover:bg-gray-50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  return (
    <div className="flex items-center justify-between mt-4 text-sm">
      <span className="text-gray-500">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={cn('px-3 py-1 border rounded', page <= 1 ? 'opacity-40' : 'hover:bg-gray-100')}
        >
          Previous
        </button>
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className={cn('px-3 py-1 border rounded', page >= totalPages ? 'opacity-40' : 'hover:bg-gray-100')}
        >
          Next
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement PlayersPage**

```typescript
// admin/src/pages/PlayersPage.tsx
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { type ColumnDef } from '@tanstack/react-table';
import { Layout } from '../components/Layout';
import { DataTable, Pagination } from '../components/DataTable';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { api } from '../lib/api';
import type { PlayerListItem, PaginatedResponse } from '../types';

export function PlayersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<PlayerListItem | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    clearTimeout((handleSearchChange as any)._t);
    (handleSearchChange as any)._t = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 300);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-players', page, debouncedSearch],
    queryFn: () =>
      api.get<PaginatedResponse<PlayerListItem>>(
        `/admin/players?page=${page}&limit=20${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''}`,
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<{ ok: true }>(`/admin/players/${id}`),
    onSuccess: () => {
      toast.success('Player deleted');
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ['admin-players'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: ColumnDef<PlayerListItem, any>[] = [
    { accessorKey: 'playerName', header: 'Name' },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'playerLevel', header: 'Level' },
    { accessorKey: 'balance', header: 'Coins' },
    { accessorKey: 'gems', header: 'Gems' },
    {
      accessorKey: 'isAdmin',
      header: 'Admin',
      cell: ({ getValue }) => (getValue() ? '✓' : ''),
    },
    {
      accessorKey: 'lastSeenAt',
      header: 'Last Seen',
      cell: ({ getValue }) => new Date(getValue()).toLocaleDateString(),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/players/${row.original.id}`)}
            className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
          >
            View
          </button>
          <button
            onClick={() => setDeleteTarget(row.original)}
            className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Players</h1>
        <input
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search by name or email…"
          className="border rounded px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {isLoading ? (
        <p className="text-gray-400">Loading…</p>
      ) : (
        <>
          <DataTable columns={columns} data={data?.data ?? []} />
          <Pagination
            page={page}
            totalPages={data?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete player"
        description={`Permanently delete "${deleteTarget?.playerName}"? This cannot be undone.`}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
      />
    </Layout>
  );
}
```

- [ ] **Step 4: Manual test**

- Open `http://localhost:5173/players`
- Verify table loads with player data
- Type in search box → results filter after 300 ms
- Click Next/Previous → page changes
- Click View → navigates to `/players/:id`
- Click Delete → confirm dialog appears → confirm → player removed and list refreshes

- [ ] **Step 5: Commit**

```bash
git add admin/src/
git commit -m "feat(admin): add players list page with search, pagination, and delete"
```

---

## Task 7: Frontend — Player detail page (Info, Economy, Materials, Tokens tabs)

**Files:**
- Modify: `admin/src/pages/PlayerDetailPage.tsx`

**Interfaces:**
- Consumes: `api.get('/admin/players/:id')` → `PlayerDetail`
- Consumes: `api.patch('/admin/players/:id/info', dto)`
- Consumes: `api.patch('/admin/players/:id/economy', dto)`
- Consumes: `api.patch('/admin/players/:id/materials', dto)`
- Consumes: `api.patch('/admin/players/:id/tokens', dto)`

- [ ] **Step 1: Implement PlayerDetailPage with first 4 tabs**

```typescript
// admin/src/pages/PlayerDetailPage.tsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Tabs from '@radix-ui/react-tabs';
import { toast } from 'sonner';
import { Layout } from '../components/Layout';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import type { PlayerDetail, WorkerItem, FloorItem } from '../types';

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn('w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500', className)}
    />
  );
}

function SaveButton({ loading }: { loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
    >
      {loading ? 'Saving…' : 'Save'}
    </button>
  );
}

// --- Info Tab ---
const InfoSchema = z.object({
  playerName: z.string().min(3).max(30),
  email: z.string().email(),
  playerLevel: z.coerce.number().int().positive(),
  playerXp: z.coerce.number().int().nonnegative(),
  isAdmin: z.boolean(),
});
type InfoForm = z.infer<typeof InfoSchema>;

function InfoTab({ player, playerId }: { player: PlayerDetail; playerId: string }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<InfoForm>({
    resolver: zodResolver(InfoSchema),
    defaultValues: {
      playerName: player.playerName,
      email: player.email,
      playerLevel: player.playerLevel,
      playerXp: player.playerXp,
      isAdmin: player.isAdmin,
    },
  });

  const onSubmit = async (data: InfoForm) => {
    try {
      await api.patch(`/admin/players/${playerId}/info`, data);
      toast.success('Info updated');
      qc.invalidateQueries({ queryKey: ['admin-player', playerId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
      <Field label="Player Name" error={errors.playerName?.message}>
        <Input {...register('playerName')} />
      </Field>
      <Field label="Email" error={errors.email?.message}>
        <Input {...register('email')} type="email" />
      </Field>
      <Field label="Level" error={errors.playerLevel?.message}>
        <Input {...register('playerLevel')} type="number" />
      </Field>
      <Field label="XP" error={errors.playerXp?.message}>
        <Input {...register('playerXp')} type="number" />
      </Field>
      <div className="flex items-center gap-2">
        <input type="checkbox" {...register('isAdmin')} id="isAdmin" />
        <label htmlFor="isAdmin" className="text-sm">Admin</label>
      </div>
      <SaveButton loading={isSubmitting} />
    </form>
  );
}

// --- Economy Tab ---
const EconomySchema = z.object({
  balance: z.coerce.number().int().nonnegative(),
  gems: z.coerce.number().int().nonnegative(),
});
type EconomyForm = z.infer<typeof EconomySchema>;

function EconomyTab({ player, playerId }: { player: PlayerDetail; playerId: string }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<EconomyForm>({
    resolver: zodResolver(EconomySchema),
    defaultValues: { balance: player.balance, gems: player.gems },
  });

  const onSubmit = async (data: EconomyForm) => {
    try {
      await api.patch(`/admin/players/${playerId}/economy`, data);
      toast.success('Economy updated');
      qc.invalidateQueries({ queryKey: ['admin-player', playerId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
      <Field label="Balance (coins)" error={errors.balance?.message}>
        <Input {...register('balance')} type="number" />
      </Field>
      <Field label="Gems" error={errors.gems?.message}>
        <Input {...register('gems')} type="number" />
      </Field>
      <SaveButton loading={isSubmitting} />
    </form>
  );
}

// --- Materials Tab ---
const MaterialsSchema = z.object({
  briks: z.coerce.number().int().nonnegative(),
  glass: z.coerce.number().int().nonnegative(),
  nails: z.coerce.number().int().nonnegative(),
  screw: z.coerce.number().int().nonnegative(),
});
type MaterialsForm = z.infer<typeof MaterialsSchema>;

function MaterialsTab({ player, playerId }: { player: PlayerDetail; playerId: string }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<MaterialsForm>({
    resolver: zodResolver(MaterialsSchema),
    defaultValues: player.tools,
  });

  const onSubmit = async (data: MaterialsForm) => {
    try {
      await api.patch(`/admin/players/${playerId}/materials`, data);
      toast.success('Materials updated');
      qc.invalidateQueries({ queryKey: ['admin-player', playerId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
      {(['briks', 'glass', 'nails', 'screw'] as const).map((key) => (
        <Field key={key} label={key.charAt(0).toUpperCase() + key.slice(1)} error={errors[key]?.message}>
          <Input {...register(key)} type="number" />
        </Field>
      ))}
      <SaveButton loading={isSubmitting} />
    </form>
  );
}

// --- Tokens Tab ---
const TokensSchema = z.object({
  green: z.coerce.number().int().nonnegative(),
  blue: z.coerce.number().int().nonnegative(),
  yellow: z.coerce.number().int().nonnegative(),
  purple: z.coerce.number().int().nonnegative(),
  red: z.coerce.number().int().nonnegative(),
});
type TokensForm = z.infer<typeof TokensSchema>;

function TokensTab({ player, playerId }: { player: PlayerDetail; playerId: string }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<TokensForm>({
    resolver: zodResolver(TokensSchema),
    defaultValues: player.tokens,
  });

  const onSubmit = async (data: TokensForm) => {
    try {
      await api.patch(`/admin/players/${playerId}/tokens`, data);
      toast.success('Tokens updated');
      qc.invalidateQueries({ queryKey: ['admin-player', playerId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
      {(['green', 'blue', 'yellow', 'purple', 'red'] as const).map((color) => (
        <Field key={color} label={color.charAt(0).toUpperCase() + color.slice(1)} error={errors[color]?.message}>
          <Input {...register(color)} type="number" />
        </Field>
      ))}
      <SaveButton loading={isSubmitting} />
    </form>
  );
}

// --- Workers Tab (placeholder for Task 8) ---
function WorkersTab({ workers, playerId }: { workers: WorkerItem[]; playerId: string }) {
  return <p className="text-gray-400 text-sm">Workers tab — implemented in Task 8</p>;
}

// --- Floors Tab (placeholder for Task 8) ---
function FloorsTab({ floors, playerId }: { floors: FloorItem[]; playerId: string }) {
  return <p className="text-gray-400 text-sm">Floors tab — implemented in Task 8</p>;
}

// --- Main Page ---
const TAB_ITEMS = [
  { value: 'info', label: 'Info' },
  { value: 'economy', label: 'Economy' },
  { value: 'materials', label: 'Materials' },
  { value: 'tokens', label: 'Tokens' },
  { value: 'workers', label: 'Workers' },
  { value: 'floors', label: 'Floors' },
];

export function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: player, isLoading } = useQuery({
    queryKey: ['admin-player', id],
    queryFn: () => api.get<PlayerDetail>(`/admin/players/${id}`),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete<{ ok: true }>(`/admin/players/${id}`),
    onSuccess: () => {
      toast.success('Player deleted');
      qc.invalidateQueries({ queryKey: ['admin-players'] });
      navigate('/players');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <Layout><p className="text-gray-400">Loading…</p></Layout>;
  if (!player) return <Layout><p className="text-red-500">Player not found</p></Layout>;

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => navigate('/players')} className="text-sm text-gray-500 hover:text-blue-600 mb-1">
            ← Players
          </button>
          <h1 className="text-xl font-semibold">{player.playerName}</h1>
          <p className="text-sm text-gray-500">{player.email} · Level {player.playerLevel}</p>
        </div>
        <button
          onClick={() => setConfirmDelete(true)}
          className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700"
        >
          Delete Player
        </button>
      </div>

      <Tabs.Root defaultValue="info">
        <Tabs.List className="flex gap-1 border-b mb-6">
          {TAB_ITEMS.map((tab) => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              className="px-4 py-2 text-sm text-gray-600 hover:text-blue-600 data-[state=active]:text-blue-600 data-[state=active]:border-b-2 data-[state=active]:border-blue-600"
            >
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="info"><InfoTab player={player} playerId={id!} /></Tabs.Content>
        <Tabs.Content value="economy"><EconomyTab player={player} playerId={id!} /></Tabs.Content>
        <Tabs.Content value="materials"><MaterialsTab player={player} playerId={id!} /></Tabs.Content>
        <Tabs.Content value="tokens"><TokensTab player={player} playerId={id!} /></Tabs.Content>
        <Tabs.Content value="workers"><WorkersTab workers={player.workers} playerId={id!} /></Tabs.Content>
        <Tabs.Content value="floors"><FloorsTab floors={player.floors} playerId={id!} /></Tabs.Content>
      </Tabs.Root>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete player"
        description={`Permanently delete "${player.playerName}"? This cannot be undone.`}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
      />
    </Layout>
  );
}
```

- [ ] **Step 2: Manual test**

- Navigate to a player via `/players`
- Verify Info tab shows current values
- Edit player name → Save → toast "Info updated"
- Switch to Economy tab → edit balance → Save
- Switch to Materials tab → edit briks → Save
- Switch to Tokens tab → edit green → Save

- [ ] **Step 3: Commit**

```bash
git add admin/src/
git commit -m "feat(admin): add player detail page with info/economy/materials/tokens tabs"
```

---

## Task 8: Frontend — Workers and Floors tabs

**Files:**
- Modify: `admin/src/pages/PlayerDetailPage.tsx`

**Interfaces:**
- Consumes: `api.delete('/admin/players/:id/workers/:workerId')` → `{ ok: true }`
- Consumes: `api.delete('/admin/players/:id/floors/:floorId')` → `{ ok: true }`
- Consumes: `WorkerItem`, `FloorItem` from `types.ts`

- [ ] **Step 1: Replace WorkersTab placeholder**

Find the `WorkersTab` function in `admin/src/pages/PlayerDetailPage.tsx` and replace it:

```typescript
function WorkersTab({ workers, playerId }: { workers: WorkerItem[]; playerId: string }) {
  const qc = useQueryClient();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (workerId: string) =>
      api.delete<{ ok: true }>(`/admin/players/${playerId}/workers/${workerId}`),
    onSuccess: () => {
      toast.success('Worker removed');
      setConfirmId(null);
      qc.invalidateQueries({ queryKey: ['admin-player', playerId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (workers.length === 0) return <p className="text-gray-400 text-sm">No workers</p>;

  return (
    <>
      <div className="rounded-md border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-700">Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Level</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Floor Type</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Dream Job</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Specialist</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Assigned Floor</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((w) => (
              <tr key={w.id} className="border-b last:border-0">
                <td className="px-4 py-3">{w.name}</td>
                <td className="px-4 py-3">{w.level}</td>
                <td className="px-4 py-3">{w.floorType}</td>
                <td className="px-4 py-3">{w.dreamJob}</td>
                <td className="px-4 py-3">{w.isSpecialist ? '✓' : ''}</td>
                <td className="px-4 py-3">{w.assignedFloorId ?? '—'}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setConfirmId(w.id)}
                    className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(o) => !o && setConfirmId(null)}
        title="Remove worker"
        description="Permanently remove this worker?"
        onConfirm={() => confirmId && deleteMutation.mutate(confirmId)}
        loading={deleteMutation.isPending}
      />
    </>
  );
}
```

- [ ] **Step 2: Replace FloorsTab placeholder**

Find the `FloorsTab` function and replace it:

```typescript
function FloorsTab({ floors, playerId }: { floors: FloorItem[]; playerId: string }) {
  const qc = useQueryClient();
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (floorId: number) =>
      api.delete<{ ok: true }>(`/admin/players/${playerId}/floors/${floorId}`),
    onSuccess: () => {
      toast.success('Floor removed');
      setConfirmId(null);
      qc.invalidateQueries({ queryKey: ['admin-player', playerId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (floors.length === 0) return <p className="text-gray-400 text-sm">No floors</p>;

  return (
    <>
      <div className="rounded-md border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-700">Floor ID</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Type</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Productions</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Slots</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {floors.map((f) => (
              <tr key={f.floorId} className="border-b last:border-0">
                <td className="px-4 py-3">{f.floorId}</td>
                <td className="px-4 py-3">{f.floorType ?? '—'}</td>
                <td className="px-4 py-3">{f.productions.length}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {f.productions.map((p) => `${p.slotIdx}:${p.stage}`).join(', ')}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setConfirmId(f.floorId)}
                    className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={confirmId !== null}
        onOpenChange={(o) => !o && setConfirmId(null)}
        title="Remove floor"
        description={`Permanently remove floor ${confirmId}? This also removes all its productions and floor type.`}
        onConfirm={() => confirmId !== null && deleteMutation.mutate(confirmId)}
        loading={deleteMutation.isPending}
      />
    </>
  );
}
```

- [ ] **Step 3: Manual test**

- Open a player with workers → Workers tab shows list
- Click Remove on a worker → confirm → worker disappears from list
- Open Floors tab → list shows floors with type and slot info
- Click Remove on a floor → confirm → floor removed

- [ ] **Step 4: Commit**

```bash
git add admin/src/pages/PlayerDetailPage.tsx
git commit -m "feat(admin): add workers and floors tabs with delete"
```

---

## Task 9: Frontend — Command logs page

**Files:**
- Modify: `admin/src/pages/CommandLogsPage.tsx`

**Interfaces:**
- Consumes: `api.get('/admin/commands?page=&limit=&playerId=&type=')` → `PaginatedResponse<CommandLogItem>`
- Consumes: `api.get('/admin/players?limit=200')` → `PaginatedResponse<PlayerListItem>` (for player selector)
- Consumes: `CommandLogItem`, `PaginatedResponse<T>` from `types.ts`

**Note:** `CommandLog` is a rolling buffer — old entries are deleted as new sync commands arrive. The table shows only currently retained logs.

- [ ] **Step 1: Implement CommandLogsPage**

```typescript
// admin/src/pages/CommandLogsPage.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { Layout } from '../components/Layout';
import { DataTable, Pagination } from '../components/DataTable';
import { api } from '../lib/api';
import type { CommandLogItem, PlayerListItem, PaginatedResponse } from '../types';

const COMMAND_TYPES = [
  'buy', 'list', 'collect', 'assign_worker', 'fire_worker', 'evict_worker',
  'upgrade_to_specialist', 'fire_and_evict_worker', 'spawn_visitor', 'lift_visitor',
  'collect_tip', 'deliver_all', 'upgrade_elevator', 'upgrade_lobby', 'claim_daily_reward',
  'expand_hotel', 'fill_lobby', 'buy_floor', 'open_floor', 'exchange_gems',
  'speed_up_construction', 'speed_up_delivery', 'dev_add_gems', 'evict_low_level_workers',
  'collect_all', 'list_all', 'buy_all', 'claim_daily_task', 'upgrade_business_category',
];

export function CommandLogsPage() {
  const [page, setPage] = useState(1);
  const [playerId, setPlayerId] = useState('');
  const [type, setType] = useState('');

  const { data: playersData } = useQuery({
    queryKey: ['admin-players-all'],
    queryFn: () => api.get<PaginatedResponse<PlayerListItem>>('/admin/players?limit=200'),
    staleTime: 60_000,
  });

  const buildUrl = () => {
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (playerId) params.set('playerId', playerId);
    if (type) params.set('type', type);
    return `/admin/commands?${params.toString()}`;
  };

  const { data, isLoading } = useQuery({
    queryKey: ['admin-commands', page, playerId, type],
    queryFn: () => api.get<PaginatedResponse<CommandLogItem>>(buildUrl()),
  });

  const columns: ColumnDef<CommandLogItem, any>[] = [
    { accessorKey: 'playerName', header: 'Player' },
    { accessorKey: 'type', header: 'Type' },
    {
      accessorKey: 'floorId',
      header: 'Floor',
      cell: ({ getValue }) => getValue() ?? '—',
    },
    {
      accessorKey: 'typeId',
      header: 'TypeId',
      cell: ({ getValue }) => getValue() ?? '—',
    },
    {
      accessorKey: 'workerId',
      header: 'Worker',
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? v.slice(0, 8) + '…' : '—';
      },
    },
    {
      accessorKey: 'timestamp',
      header: 'Client Time',
      cell: ({ getValue }) => new Date(Number(getValue())).toLocaleString(),
    },
    {
      accessorKey: 'processedAt',
      header: 'Server Time',
      cell: ({ getValue }) => new Date(getValue()).toLocaleString(),
    },
  ];

  const selectClass = 'border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <Layout>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-xl font-semibold">Command Logs</h1>
        <div className="flex gap-3 flex-wrap">
          <select
            value={playerId}
            onChange={(e) => { setPlayerId(e.target.value); setPage(1); }}
            className={selectClass}
          >
            <option value="">All players</option>
            {playersData?.data.map((p) => (
              <option key={p.id} value={p.id}>{p.playerName}</option>
            ))}
          </select>
          <select
            value={type}
            onChange={(e) => { setType(e.target.value); setPage(1); }}
            className={selectClass}
          >
            <option value="">All types</option>
            {COMMAND_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-400">Loading…</p>
      ) : (
        <>
          <DataTable columns={columns} data={data?.data ?? []} />
          <Pagination
            page={page}
            totalPages={data?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </>
      )}
    </Layout>
  );
}
```

- [ ] **Step 2: Manual test**

- Open `http://localhost:5173/commands`
- Table shows command logs
- Select a player from dropdown → list filters to that player's commands
- Select a command type → list filters
- Navigate pages with Previous/Next

- [ ] **Step 3: Commit**

```bash
git add admin/src/pages/CommandLogsPage.tsx
git commit -m "feat(admin): add command logs page with player/type filters and pagination"
```

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - Players list + search + pagination → Task 6 ✓
  - Player detail → Task 7 ✓
  - Edit info/economy/materials/tokens → Task 7 ✓
  - Workers view + delete → Task 8 ✓
  - Floors view + delete → Task 8 ✓
  - Delete player → Tasks 6 + 7 ✓
  - Command logs with player/type filter + pagination → Task 9 ✓
  - Backend admin endpoints → Tasks 1–3 ✓
  - Auth (isAdmin check) → Task 5 ✓
  - JWT stored in localStorage → Task 4 ✓
  - Vite proxy → Task 4 ✓

- [x] **Placeholder scan:** No TBD/TODO in any step. All code blocks contain actual implementations.

- [x] **Type consistency:**
  - `PlayerListItem`, `PlayerDetail`, `WorkerItem`, `FloorItem`, `CommandLogItem`, `PaginatedResponse<T>` defined in Task 4 and used consistently in Tasks 5–9.
  - `api.get/post/patch/delete` defined in Task 4 `lib/api.ts`, consumed in Tasks 5–9.
  - `isAuthenticated()`, `setToken()`, `clearToken()` defined in Task 4 `lib/auth.ts`, consumed in Tasks 4–5.
  - `DataTable`, `Pagination` defined in Task 6, consumed in Tasks 6, 9.
  - `ConfirmDialog` defined in Task 4, consumed in Tasks 6, 7, 8.
  - `Layout` defined in Task 6, consumed in Tasks 6, 7, 9.
