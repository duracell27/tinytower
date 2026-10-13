# City Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 9 daily city tasks that track progress via sync commands and reward style stars to the city.

**Architecture:** Server-side progress tracking as a side-effect of the existing command processing loop — after each accepted command, the delta in `GameState.dailyTasks.progress` and `dailyGemsCollected` is compared before/after to determine city task progress. Tasks are lazy-created at first access each day; progress is accumulated in memory during the sync loop and flushed inside the existing Prisma transaction. Client receives task state in `SyncResult.cityTasks`.

**Tech Stack:** NestJS + Prisma (server), Zustand + Expo Router (client), React Native SVG (FAB ring)

**Spec:** `docs/superpowers/specs/2026-10-13-city-tasks-design.md`

## Global Constraints

- City tasks are only available when `cityLevel >= 10` (formula input `Y` is clamped to `[10, 50]`)
- Max 2 participants per task instance; one player may be active in at most 1 task per day
- Daily reset is midnight UTC — `date` field stored as `new Date(Date.UTC(y, m, d))`
- Style stars go to the city only; individual players earn nothing
- Only `VICE_MAYOR`, `ACTING_MAYOR`, and `MAYOR` may collect or cancel tasks
- `rewardStars` is random 1–10 assigned at collect time; multiplier `×2` if `now − takenAt < 36_000_000 ms`
- Difficulty caps at city level 50 — use `Math.max(10, Math.min(50, cityLevel))` in `calcRequiredCount`
- All tests use the `makeService(prismaOverrides)` pattern from `city-building.service.spec.ts`

## Review Focus

- **Concurrent joins:** two players join the same task simultaneously → only one should succeed; task must not exceed 2 participants. Test: mock `cityTaskParticipant.count` returning `1` for both concurrent calls.
- **Cross-task lock:** player already in task A tries to join task B → must receive `BadRequestException`. Test: mock `findFirst` on `CityTaskParticipant` to return an existing participant row.
- **Delta guard:** a command runs during a daily reset (GameState resets `dailyTasks.progress` to 0 inside `processCommand`) causing a negative delta → clamp delta at `0`. Test: `computeTaskDelta` with `before.goodsBought = 5`, `after.goodsBought = 0`.
- **Expiry at midnight:** tasks from yesterday with status `IN_PROGRESS` or `COMPLETED` must be set to `EXPIRED` before new ones are created. Test: `getOrCreateDailyTasks` with existing rows from yesterday.
- **Collect window:** `×2` multiplier cut-off is exactly `takenAt + 36_000_000 ms`; boundary at exactly 10h should still grant `×2`. Test: `collectTask` with `now = takenAt + 35_999_999` vs `now = takenAt + 36_000_001`.

---

## Task 1: DB Schema — Prisma Migration

**Files:**
- Modify: `server/prisma/schema.prisma`
- Run migration

**Interfaces:**
- Produces: `CityDailyTask`, `CityTaskParticipant` Prisma models; `City.styleStars` field; `CityTaskType`, `CityTaskStatus` enums

- [ ] **Step 1: Add enums and models to schema.prisma**

Open `server/prisma/schema.prisma`. After the `CityBuildingState` enum, insert:

```prisma
enum CityTaskType {
  WHOLESALE_PURCHASES
  GOODS_ON_DISPLAY
  CASH_COLLECTOR
  CARRIER
  VIP_CARRIER
  EVICT_RESIDENTS
  NEW_RESIDENTS
  BUILD_FLOOR
  EASY_MONEY
}

enum CityTaskStatus {
  AVAILABLE
  IN_PROGRESS
  COMPLETED
  COLLECTED
  EXPIRED
}
```

After the `CityBuilding` model, insert:

```prisma
model CityDailyTask {
  id              String               @id @default(cuid())
  cityId          String
  city            City                 @relation(fields: [cityId], references: [id], onDelete: Cascade)
  taskType        CityTaskType
  date            DateTime
  status          CityTaskStatus       @default(AVAILABLE)
  requiredCount   Int
  currentProgress Int                  @default(0)
  takenAt         DateTime?
  completedAt     DateTime?
  collectedAt     DateTime?
  rewardStars     Int?
  finalStars      Int?
  participants    CityTaskParticipant[]

  @@unique([cityId, taskType, date])
  @@index([cityId, date])
}

model CityTaskParticipant {
  id        String        @id @default(cuid())
  taskId    String
  task      CityDailyTask @relation(fields: [taskId], references: [id], onDelete: Cascade)
  playerId  String
  progress  Int           @default(0)
  joinedAt  DateTime      @default(now())

  @@unique([taskId, playerId])
  @@index([playerId])
}
```

Add `styleStars Int @default(0)` to the `City` model, and add `dailyTasks CityDailyTask[]` relation to `City`.

- [ ] **Step 2: Run migration**

```bash
cd server && npx prisma migrate dev --name add_city_tasks
```

Expected: migration file created, DB updated, Prisma client regenerated.

- [ ] **Step 3: Verify Prisma client has new types**

```bash
cd server && npx prisma generate
```

Run `grep -r "CityTaskType" node_modules/.prisma/client/index.d.ts | head -3` — should show the enum.

---

## Task 2: Constants + Delta Helper

**Files:**
- Create: `server/src/city/city-task.constants.ts`
- Create: `server/src/city/__tests__/city-task.constants.spec.ts`

**Interfaces:**
- Produces:
  - `calcRequiredCount(taskType: CityTaskType, cityLevel: number): number`
  - `ALL_TASK_TYPES: CityTaskType[]` — ordered list of all 9 types
  - `computeTaskDelta(beforeProgress, afterProgress, beforeGems, afterGems): Record<CityTaskType, number>`
  - `todayUtcMidnight(): Date`

- [ ] **Step 1: Write failing tests**

Create `server/src/city/__tests__/city-task.constants.spec.ts`:

```typescript
import { CityTaskType } from '@prisma/client';
import { calcRequiredCount, computeTaskDelta, ALL_TASK_TYPES } from '../city-task.constants';

describe('calcRequiredCount', () => {
  it('returns BASE at city level 10', () => {
    expect(calcRequiredCount(CityTaskType.WHOLESALE_PURCHASES, 10)).toBe(50);
    expect(calcRequiredCount(CityTaskType.GOODS_ON_DISPLAY, 10)).toBe(100);
    expect(calcRequiredCount(CityTaskType.CASH_COLLECTOR, 10)).toBe(150);
    expect(calcRequiredCount(CityTaskType.CARRIER, 10)).toBe(100);
    expect(calcRequiredCount(CityTaskType.VIP_CARRIER, 10)).toBe(10);
    expect(calcRequiredCount(CityTaskType.EVICT_RESIDENTS, 10)).toBe(15);
    expect(calcRequiredCount(CityTaskType.NEW_RESIDENTS, 10)).toBe(25);
    expect(calcRequiredCount(CityTaskType.BUILD_FLOOR, 10)).toBe(1);
    expect(calcRequiredCount(CityTaskType.EASY_MONEY, 10)).toBe(30);
  });

  it('clamps below level 10 to level 10 BASE', () => {
    expect(calcRequiredCount(CityTaskType.WHOLESALE_PURCHASES, 5)).toBe(50);
  });

  it('caps at level 50 for variable tasks', () => {
    expect(calcRequiredCount(CityTaskType.WHOLESALE_PURCHASES, 50)).toBe(650);
    expect(calcRequiredCount(CityTaskType.WHOLESALE_PURCHASES, 99)).toBe(650);
  });

  it('stable tasks ignore city level', () => {
    expect(calcRequiredCount(CityTaskType.BUILD_FLOOR, 99)).toBe(1);
    expect(calcRequiredCount(CityTaskType.EASY_MONEY, 99)).toBe(30);
  });
});

describe('computeTaskDelta', () => {
  const zero = { visitorsLifted: 0, vipsLifted: 0, goodsBought: 0, residentsAdded: 0,
                  gemsPurchased: 0, goodsCollected: 0, floorsBuilt: 0, residentsEvicted: 0, goodsListed: 0 };

  it('computes correct increments', () => {
    const before = { ...zero, goodsBought: 3, visitorsLifted: 2, vipsLifted: 1 };
    const after  = { ...zero, goodsBought: 4, visitorsLifted: 5, vipsLifted: 2 };
    const delta = computeTaskDelta(before, after, 0, 2);
    expect(delta[CityTaskType.WHOLESALE_PURCHASES]).toBe(1);
    expect(delta[CityTaskType.CARRIER]).toBe(3);
    expect(delta[CityTaskType.VIP_CARRIER]).toBe(1);
    expect(delta[CityTaskType.EASY_MONEY]).toBe(2);
  });

  it('clamps negative deltas to 0 (daily reset edge case)', () => {
    const before = { ...zero, goodsBought: 5 };
    const after  = { ...zero, goodsBought: 0 };
    const delta = computeTaskDelta(before, after, 0, 0);
    expect(delta[CityTaskType.WHOLESALE_PURCHASES]).toBe(0);
  });

  it('ALL_TASK_TYPES contains exactly 9 entries', () => {
    expect(ALL_TASK_TYPES.length).toBe(9);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd server && npx jest city-task.constants --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create city-task.constants.ts**

```typescript
import { CityTaskType } from '@prisma/client';
import type { DailyTaskProgress } from '../../../shared/types';

export const ALL_TASK_TYPES: CityTaskType[] = [
  CityTaskType.WHOLESALE_PURCHASES,
  CityTaskType.GOODS_ON_DISPLAY,
  CityTaskType.CASH_COLLECTOR,
  CityTaskType.CARRIER,
  CityTaskType.VIP_CARRIER,
  CityTaskType.EVICT_RESIDENTS,
  CityTaskType.NEW_RESIDENTS,
  CityTaskType.BUILD_FLOOR,
  CityTaskType.EASY_MONEY,
];

export function calcRequiredCount(taskType: CityTaskType, cityLevel: number): number {
  const y = Math.max(10, Math.min(50, cityLevel));
  switch (taskType) {
    case CityTaskType.WHOLESALE_PURCHASES: return (y - 10) * 15 + 50;
    case CityTaskType.GOODS_ON_DISPLAY:    return (y - 10) * 30 + 100;
    case CityTaskType.CASH_COLLECTOR:      return (y - 10) * 50 + 150;
    case CityTaskType.CARRIER:             return (y - 10) * 25 + 100;
    case CityTaskType.VIP_CARRIER:         return (y - 10) * 5 + 10;
    case CityTaskType.EVICT_RESIDENTS:     return (y - 10) * 5 + 15;
    case CityTaskType.NEW_RESIDENTS:       return (y - 10) * 5 + 25;
    case CityTaskType.BUILD_FLOOR:         return 1;
    case CityTaskType.EASY_MONEY:          return 30;
  }
}

export function computeTaskDelta(
  before: DailyTaskProgress,
  after: DailyTaskProgress,
  beforeGems: number,
  afterGems: number,
): Record<CityTaskType, number> {
  const d = (a: number, b: number) => Math.max(0, a - b);
  return {
    [CityTaskType.WHOLESALE_PURCHASES]: d(after.goodsBought,      before.goodsBought),
    [CityTaskType.GOODS_ON_DISPLAY]:    d(after.goodsListed,      before.goodsListed),
    [CityTaskType.CASH_COLLECTOR]:      d(after.goodsCollected,   before.goodsCollected),
    [CityTaskType.CARRIER]:             d(after.visitorsLifted,   before.visitorsLifted),
    [CityTaskType.VIP_CARRIER]:         d(after.vipsLifted,       before.vipsLifted),
    [CityTaskType.EVICT_RESIDENTS]:     d(after.residentsEvicted, before.residentsEvicted),
    [CityTaskType.NEW_RESIDENTS]:       d(after.residentsAdded,   before.residentsAdded),
    [CityTaskType.BUILD_FLOOR]:         d(after.floorsBuilt,      before.floorsBuilt),
    [CityTaskType.EASY_MONEY]:          d(afterGems,              beforeGems),
  };
}

export function todayUtcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
```

- [ ] **Step 4: Run tests**

```bash
cd server && npx jest city-task.constants --no-coverage
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/city/city-task.constants.ts server/src/city/__tests__/city-task.constants.spec.ts
git commit -m "feat(city-tasks): add task constants + delta helper"
```

---

## Task 3: CityTaskService

**Files:**
- Create: `server/src/city/city-task.service.ts`
- Create: `server/src/city/__tests__/city-task.service.spec.ts`

**Interfaces:**
- Consumes: `calcRequiredCount`, `ALL_TASK_TYPES`, `todayUtcMidnight` from `city-task.constants.ts`; `CityRole` from `@prisma/client`; `PrismaService` / any Prisma transaction client
- Produces:
  - `CityTaskService` injectable class with:
    - `getOrCreateDailyTasks(cityId: string, cityLevel: number): Promise<CityDailyTask[]>`
    - `joinTask(playerId: string, taskId: string): Promise<CityDailyTask>`
    - `collectTask(actorId: string, taskId: string): Promise<{ finalStars: number }>`
    - `cancelTask(actorId: string, taskId: string): Promise<void>`
    - `updateProgressFromDelta(playerId: string, delta: Record<CityTaskType, number>, tx: PrismaTransactionClient): Promise<void>`
  - `CityTaskSummaryDto` interface (what endpoints return)

- [ ] **Step 1: Write failing tests**

Create `server/src/city/__tests__/city-task.service.spec.ts`:

```typescript
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CityTaskType, CityTaskStatus, CityRole } from '@prisma/client';
import { CityTaskService } from '../city-task.service';

function makeService(overrides: Record<string, any> = {}) {
  const today = new Date(Date.UTC(2026, 9, 13));
  jest.useFakeTimers().setSystemTime(today);

  const prisma = {
    cityDailyTask: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockResolvedValue({ count: 9 }),
      findUnique: jest.fn(),
      update: jest.fn().mockImplementation((args) => Promise.resolve({ ...args.data, id: args.where.id })),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    cityTaskParticipant: {
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'p1', ...args.data })),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    cityMembership: {
      findUnique: jest.fn(),
    },
    city: {
      update: jest.fn().mockResolvedValue({}),
    },
    ...overrides,
  };
  return { svc: new CityTaskService(prisma as any), prisma };
}

describe('getOrCreateDailyTasks', () => {
  it('returns existing tasks when they exist for today', async () => {
    const tasks = Array.from({ length: 9 }, (_, i) => ({ id: `t${i}`, taskType: 'CARRIER', status: 'AVAILABLE' }));
    const { svc, prisma } = makeService({ cityDailyTask: { findMany: jest.fn().mockResolvedValue(tasks), createMany: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 0 }) } });
    const result = await svc.getOrCreateDailyTasks('city1', 15);
    expect(result.length).toBe(9);
    expect(prisma.cityDailyTask.createMany).not.toHaveBeenCalled();
  });

  it('creates 9 tasks when none exist', async () => {
    const { svc, prisma } = makeService();
    prisma.cityDailyTask.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(Array.from({ length: 9 }, (_, i) => ({ id: `t${i}` })));
    await svc.getOrCreateDailyTasks('city1', 15);
    expect(prisma.cityDailyTask.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
  });

  it('expires yesterday IN_PROGRESS/COMPLETED tasks before creating new ones', async () => {
    const { svc, prisma } = makeService();
    prisma.cityDailyTask.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await svc.getOrCreateDailyTasks('city1', 15);
    expect(prisma.cityDailyTask.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: { in: ['IN_PROGRESS', 'COMPLETED'] } }),
      data: { status: 'EXPIRED' },
    }));
  });
});

describe('joinTask', () => {
  it('throws if player already in a task today', async () => {
    const { svc, prisma } = makeService();
    prisma.cityTaskParticipant.findFirst.mockResolvedValue({ id: 'p1', taskId: 't1', playerId: 'player1' });
    prisma.cityDailyTask.findUnique.mockResolvedValue({ id: 't2', status: 'AVAILABLE', participants: [] });
    await expect(svc.joinTask('player1', 't2')).rejects.toThrow(BadRequestException);
  });

  it('throws if task already has 2 participants', async () => {
    const { svc, prisma } = makeService();
    prisma.cityTaskParticipant.findFirst.mockResolvedValue(null);
    prisma.cityDailyTask.findUnique.mockResolvedValue({
      id: 't1', status: 'IN_PROGRESS',
      participants: [{ playerId: 'a' }, { playerId: 'b' }],
    });
    await expect(svc.joinTask('player1', 't1')).rejects.toThrow(BadRequestException);
  });

  it('sets takenAt and status IN_PROGRESS when first participant joins', async () => {
    const { svc, prisma } = makeService();
    prisma.cityTaskParticipant.findFirst.mockResolvedValue(null);
    prisma.cityDailyTask.findUnique.mockResolvedValue({
      id: 't1', status: 'AVAILABLE', participants: [],
    });
    prisma.cityDailyTask.update.mockResolvedValue({ id: 't1', status: 'IN_PROGRESS', takenAt: new Date() });
    await svc.joinTask('player1', 't1');
    expect(prisma.cityDailyTask.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'IN_PROGRESS', takenAt: expect.any(Date) }),
    }));
  });
});

describe('collectTask', () => {
  it('throws ForbiddenException for NEWBIE role', async () => {
    const { svc, prisma } = makeService();
    prisma.cityMembership.findUnique.mockResolvedValue({ role: 'NEWBIE' });
    prisma.cityDailyTask.findUnique.mockResolvedValue({ id: 't1', status: 'COMPLETED', cityId: 'c1', takenAt: new Date(Date.now() - 1000) });
    await expect(svc.collectTask('actor1', 't1')).rejects.toThrow(ForbiddenException);
  });

  it('applies ×2 multiplier when within 10 hours', async () => {
    const { svc, prisma } = makeService();
    prisma.cityMembership.findUnique.mockResolvedValue({ role: 'MAYOR', cityId: 'c1' });
    const takenAt = new Date(Date.now() - 5 * 3600 * 1000); // 5h ago
    prisma.cityDailyTask.findUnique.mockResolvedValue({ id: 't1', status: 'COMPLETED', cityId: 'c1', takenAt });
    jest.spyOn(global.Math, 'random').mockReturnValue(0.5); // returns 6 stars (floor(0.5*10)+1)
    const result = await svc.collectTask('actor1', 't1');
    expect(result.finalStars).toBe(12); // 6 × 2
    jest.spyOn(global.Math, 'random').mockRestore();
  });

  it('no multiplier after 10 hours', async () => {
    const { svc, prisma } = makeService();
    prisma.cityMembership.findUnique.mockResolvedValue({ role: 'MAYOR', cityId: 'c1' });
    const takenAt = new Date(Date.now() - 11 * 3600 * 1000); // 11h ago
    prisma.cityDailyTask.findUnique.mockResolvedValue({ id: 't1', status: 'COMPLETED', cityId: 'c1', takenAt });
    jest.spyOn(global.Math, 'random').mockReturnValue(0.5);
    const result = await svc.collectTask('actor1', 't1');
    expect(result.finalStars).toBe(6);
    jest.spyOn(global.Math, 'random').mockRestore();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd server && npx jest city-task.service --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create city-task.service.ts**

```typescript
import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CityTaskType, CityTaskStatus, CityRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ALL_TASK_TYPES, calcRequiredCount, todayUtcMidnight } from './city-task.constants';

const LEADERSHIP_ROLES: CityRole[] = [CityRole.VICE_MAYOR, CityRole.ACTING_MAYOR, CityRole.MAYOR];

export interface CityTaskSummaryDto {
  id: string;
  taskType: CityTaskType;
  status: CityTaskStatus;
  requiredCount: number;
  currentProgress: number;
  participants: { playerId: string; progress: number }[];
  takenAt: string | null;
  canDoubleUntil: string | null;
  rewardStars: number | null;
  finalStars: number | null;
}

type PrismaTx = Omit<PrismaService, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

@Injectable()
export class CityTaskService {
  constructor(private prisma: PrismaService) {}

  async getOrCreateDailyTasks(cityId: string, cityLevel: number): Promise<CityTaskSummaryDto[]> {
    const today = todayUtcMidnight();

    // Expire stale tasks from previous days
    await this.prisma.cityDailyTask.updateMany({
      where: {
        cityId,
        date: { lt: today },
        status: { in: [CityTaskStatus.IN_PROGRESS, CityTaskStatus.COMPLETED] },
      },
      data: { status: CityTaskStatus.EXPIRED },
    });

    // Find today's tasks
    const existing = await this.prisma.cityDailyTask.findMany({
      where: { cityId, date: today },
      include: { participants: { select: { playerId: true, progress: true } } },
    });

    if (existing.length === 9) return existing.map(this.toDto);

    // Lazy create missing tasks
    await this.prisma.cityDailyTask.createMany({
      data: ALL_TASK_TYPES.map((taskType) => ({
        cityId,
        taskType,
        date: today,
        requiredCount: calcRequiredCount(taskType, cityLevel),
      })),
      skipDuplicates: true,
    });

    const created = await this.prisma.cityDailyTask.findMany({
      where: { cityId, date: today },
      include: { participants: { select: { playerId: true, progress: true } } },
    });
    return created.map(this.toDto);
  }

  async joinTask(playerId: string, taskId: string): Promise<CityTaskSummaryDto> {
    const today = todayUtcMidnight();

    // Check player not already in a task today
    const activeParticipation = await this.prisma.cityTaskParticipant.findFirst({
      where: { playerId, task: { date: today, status: { in: [CityTaskStatus.IN_PROGRESS, CityTaskStatus.AVAILABLE] } } },
    });
    if (activeParticipation) throw new BadRequestException('Already participating in another task today');

    const task = await this.prisma.cityDailyTask.findUnique({
      where: { id: taskId },
      include: { participants: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (task.status !== CityTaskStatus.AVAILABLE && task.status !== CityTaskStatus.IN_PROGRESS) {
      throw new BadRequestException('Task is not open for joining');
    }
    if (task.participants.length >= 2) throw new BadRequestException('Task already has 2 participants');

    const isFirst = task.participants.length === 0;
    await this.prisma.cityTaskParticipant.create({ data: { taskId, playerId, progress: 0 } });
    const updated = await this.prisma.cityDailyTask.update({
      where: { id: taskId },
      data: {
        status: CityTaskStatus.IN_PROGRESS,
        ...(isFirst && { takenAt: new Date() }),
      },
      include: { participants: { select: { playerId: true, progress: true } } },
    });
    return this.toDto(updated);
  }

  async collectTask(actorId: string, taskId: string): Promise<{ finalStars: number }> {
    const task = await this.prisma.cityDailyTask.findUnique({
      where: { id: taskId },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (task.status !== CityTaskStatus.COMPLETED) throw new BadRequestException('Task not completed');

    const membership = await this.prisma.cityMembership.findUnique({
      where: { playerId: actorId },
    });
    if (!membership || !LEADERSHIP_ROLES.includes(membership.role as CityRole)) {
      throw new ForbiddenException('Only Vice Mayor, Acting Mayor, or Mayor can collect');
    }
    if (membership.cityId !== task.cityId) throw new ForbiddenException('Not a member of this city');

    const now = Date.now();
    const multiplier = task.takenAt && (now - task.takenAt.getTime()) < 36_000_000 ? 2 : 1;
    const rewardStars = Math.floor(Math.random() * 10) + 1;
    const finalStars = rewardStars * multiplier;

    await this.prisma.$transaction([
      this.prisma.cityDailyTask.update({
        where: { id: taskId },
        data: { status: CityTaskStatus.COLLECTED, collectedAt: new Date(), rewardStars, finalStars },
      }),
      this.prisma.city.update({
        where: { id: task.cityId },
        data: { styleStars: { increment: finalStars } },
      }),
    ]);
    return { finalStars };
  }

  async cancelTask(actorId: string, taskId: string): Promise<void> {
    const task = await this.prisma.cityDailyTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.status !== CityTaskStatus.IN_PROGRESS && task.status !== CityTaskStatus.COMPLETED) {
      throw new BadRequestException('Task cannot be cancelled');
    }
    const membership = await this.prisma.cityMembership.findUnique({ where: { playerId: actorId } });
    if (!membership || !LEADERSHIP_ROLES.includes(membership.role as CityRole)) {
      throw new ForbiddenException('Only Vice Mayor, Acting Mayor, or Mayor can cancel');
    }
    if (membership.cityId !== task.cityId) throw new ForbiddenException('Not a member of this city');

    await this.prisma.$transaction([
      this.prisma.cityTaskParticipant.deleteMany({ where: { taskId } }),
      this.prisma.cityDailyTask.update({
        where: { id: taskId },
        data: { status: CityTaskStatus.AVAILABLE, currentProgress: 0, takenAt: null, completedAt: null },
      }),
    ]);
  }

  async updateProgressFromDelta(
    playerId: string,
    delta: Record<CityTaskType, number>,
    tx: PrismaTx,
  ): Promise<void> {
    const today = todayUtcMidnight();
    const participant = await tx.cityTaskParticipant.findFirst({
      where: { playerId, task: { date: today, status: CityTaskStatus.IN_PROGRESS } },
      include: { task: true },
    });
    if (!participant) return;

    const increment = delta[participant.task.taskType] ?? 0;
    if (increment === 0) return;

    await tx.cityTaskParticipant.update({
      where: { id: participant.id },
      data: { progress: { increment } },
    });

    const newTotal = Math.min(participant.task.currentProgress + increment, participant.task.requiredCount);
    const isCompleted = newTotal >= participant.task.requiredCount;

    await tx.cityDailyTask.update({
      where: { id: participant.task.id },
      data: {
        currentProgress: newTotal,
        ...(isCompleted && { status: CityTaskStatus.COMPLETED, completedAt: new Date() }),
      },
    });
  }

  private toDto(task: any): CityTaskSummaryDto {
    return {
      id: task.id,
      taskType: task.taskType,
      status: task.status,
      requiredCount: task.requiredCount,
      currentProgress: task.currentProgress,
      participants: task.participants ?? [],
      takenAt: task.takenAt?.toISOString() ?? null,
      canDoubleUntil: task.takenAt
        ? new Date(task.takenAt.getTime() + 36_000_000).toISOString()
        : null,
      rewardStars: task.rewardStars ?? null,
      finalStars: task.finalStars ?? null,
    };
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd server && npx jest city-task.service --no-coverage
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/city/city-task.service.ts server/src/city/__tests__/city-task.service.spec.ts
git commit -m "feat(city-tasks): add CityTaskService with join/collect/cancel/progress"
```

---

## Task 4: Controller + Module Wiring

**Files:**
- Create: `server/src/city/city-task.controller.ts`
- Modify: `server/src/city/city.module.ts`
- Note: `CityTaskController` needs `PrismaService` injected for `styleStars` fetch — add to constructor

**Interfaces:**
- Consumes: `CityTaskService` from Task 3
- Produces: REST endpoints `GET /city/tasks`, `POST /city/tasks/:id/join`, `POST /city/tasks/:id/collect`, `POST /city/tasks/:id/cancel`; `CityTaskService` exported from `CityModule`

- [ ] **Step 1: Create city-task.controller.ts**

```typescript
import { Controller, Get, Post, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CityTaskService } from './city-task.service';
import { CityService } from './city.service';
import { PrismaService } from '../prisma/prisma.service';

type AuthReq = { user: { playerId: string } };

@Controller('city/tasks')
export class CityTaskController {
  constructor(
    private cityTaskService: CityTaskService,
    private cityService: CityService,
    private prisma: PrismaService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getTasks(@Req() req: AuthReq) {
    const bonus = await this.cityService.getCityBonusForPlayer(req.user.playerId);
    if (!bonus) return { tasks: [], myActiveTaskId: null, cityStyleStars: 0 };
    const [tasks, city] = await Promise.all([
      this.cityTaskService.getOrCreateDailyTasks(bonus.cityId, bonus.level),
      this.prisma.city.findUnique({ where: { id: bonus.cityId }, select: { styleStars: true } }),
    ]);
    const myActive = tasks.find((t) =>
      t.participants.some((p) => p.playerId === req.user.playerId) &&
      (t.status === 'IN_PROGRESS' || t.status === 'COMPLETED'),
    );
    return { tasks, myActiveTaskId: myActive?.id ?? null, cityStyleStars: city?.styleStars ?? 0 };
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  joinTask(@Req() req: AuthReq, @Param('id') taskId: string) {
    return this.cityTaskService.joinTask(req.user.playerId, taskId);
  }

  @Post(':id/collect')
  @UseGuards(JwtAuthGuard)
  collectTask(@Req() req: AuthReq, @Param('id') taskId: string) {
    return this.cityTaskService.collectTask(req.user.playerId, taskId);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  cancelTask(@Req() req: AuthReq, @Param('id') taskId: string) {
    return this.cityTaskService.cancelTask(req.user.playerId, taskId);
  }
}
```

- [ ] **Step 2: Update city.module.ts**

Open `server/src/city/city.module.ts` and add `CityTaskService` and `CityTaskController`:

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CityService } from './city.service';
import { CityBuildingService } from './city-building.service';
import { CityTaskService } from './city-task.service';
import { CityController } from './city.controller';
import { CityTaskController } from './city-task.controller';

@Module({
  imports: [PrismaModule],
  providers: [CityService, CityBuildingService, CityTaskService],
  controllers: [CityController, CityTaskController],
  exports: [CityService, CityBuildingService, CityTaskService],
})
export class CityModule {}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/city/city-task.controller.ts server/src/city/city.module.ts
git commit -m "feat(city-tasks): add CityTaskController + wire into CityModule"
```

---

## Task 5: Sync Integration — Progress Tracking + SyncResult

**Files:**
- Modify: `server/src/sync/sync.service.ts`

**Interfaces:**
- Consumes: `CityTaskService.updateProgressFromDelta`, `computeTaskDelta` from `city-task.constants.ts`
- Produces: `SyncResult.cityTasks?: { tasks: CityTaskSummaryDto[], myActiveTaskId: string | null, cityStyleStars: number }`

- [ ] **Step 1: Import and inject CityTaskService in sync.service.ts**

Find the top of `sync.service.ts`. Add import:

```typescript
import { CityTaskService, CityTaskSummaryDto } from '../city/city-task.service';
import { computeTaskDelta } from '../city/city-task.constants';
```

In the `SyncService` constructor, add `CityTaskService` as a parameter:

```typescript
constructor(
  private prisma: PrismaService,
  private achievementService: AchievementService,
  private cityService: CityService,
  private cityBuildingService: CityBuildingService,
  private cityTaskService: CityTaskService,
) {}
```

Also add `SyncModule` (or just the `CityModule` provider) — see Step 3 for module wiring.

- [ ] **Step 2: Add `cityTasks` to `SyncResult` interface**

Find the `SyncResult` interface (around line 20 of `sync.service.ts`) and add:

```typescript
cityTasks?: {
  tasks: CityTaskSummaryDto[];
  myActiveTaskId: string | null;
  cityStyleStars: number;
};
```

- [ ] **Step 3: Accumulate task deltas in the command loop**

Before the `for (const command of newCommands)` loop, add:

```typescript
const accumulatedDelta: Record<string, number> = {};
```

Inside the loop, after `if (result.success)` and before `gameState = result.state;`, insert:

```typescript
const delta = computeTaskDelta(
  gameStateBefore_cmd.dailyTasks.progress,
  result.state.dailyTasks.progress,
  gameStateBefore_cmd.dailyGemsCollected,
  result.state.dailyGemsCollected,
);
for (const [key, val] of Object.entries(delta)) {
  accumulatedDelta[key] = (accumulatedDelta[key] ?? 0) + val;
}
```

Where `gameStateBefore_cmd` is the `gameState` captured before `processCommand` runs for that iteration. Rename the existing `prevBalance` capture area to also capture `gameStateBefore_cmd = gameState` at the start of each loop iteration.

Change the per-iteration capture to:

```typescript
const prevBalance = gameState.balance;
const gameStateBefore_cmd = gameState;
```

- [ ] **Step 4: Flush delta + build cityTasks inside the Prisma transaction**

Inside the `await this.prisma.$transaction(async (tx) => { ... })` block, after the existing writes, add:

```typescript
// City task progress
if (_cityMembershipId && Object.values(accumulatedDelta).some((v) => v > 0)) {
  await this.cityTaskService.updateProgressFromDelta(
    playerId,
    accumulatedDelta as any,
    tx as any,
  );
}
```

After the transaction, before building the final return object, add:

```typescript
let cityTasksResult: SyncResult['cityTasks'] | undefined;
if (_cityMembershipId) {
  const cityBonus = await this.cityService.getCityBonusForPlayer(playerId);
  if (cityBonus) {
    const tasks = await this.cityTaskService.getOrCreateDailyTasks(cityBonus.cityId, cityBonus.level);
    const myActive = tasks.find(
      (t) => t.participants.some((p) => p.playerId === playerId) &&
             (t.status === 'IN_PROGRESS' || t.status === 'COMPLETED'),
    );
    const city = await this.prisma.city.findUnique({ where: { id: cityBonus.cityId }, select: { styleStars: true } });
    cityTasksResult = {
      tasks,
      myActiveTaskId: myActive?.id ?? null,
      cityStyleStars: city?.styleStars ?? 0,
    };
  }
}
```

And in the return statement at the end of `processSync`, add `cityTasks: cityTasksResult`.

- [ ] **Step 5: Wire CityTaskService into SyncModule**

Find `server/src/sync/sync.module.ts`. Add `CityModule` to imports and ensure `CityTaskService` is reachable:

```typescript
import { CityModule } from '../city/city.module';

@Module({
  imports: [PrismaModule, AchievementModule, CityModule],
  ...
})
```

- [ ] **Step 6: TypeScript check**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add server/src/sync/sync.service.ts server/src/sync/sync.module.ts
git commit -m "feat(city-tasks): integrate progress tracking into sync pipeline"
```

---

## Task 6: Client — Types + Sync Handler

**Files:**
- Modify: `src/services/api.ts`
- Modify: `src/services/sync.ts`

**Interfaces:**
- Produces: `CityTaskSummary`, `CityTaskStatus`, `CityTaskType` TypeScript types in `api.ts`; `SyncResult.cityTasks` in `sync.ts`; call to `useCityTaskStore.getState().setFromSync()` in sync handler

- [ ] **Step 1: Add types to api.ts**

At the bottom of `src/services/api.ts`, add:

```typescript
export type CityTaskStatus = 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED' | 'COLLECTED' | 'EXPIRED';
export type CityTaskType =
  | 'WHOLESALE_PURCHASES' | 'GOODS_ON_DISPLAY' | 'CASH_COLLECTOR'
  | 'CARRIER' | 'VIP_CARRIER' | 'EVICT_RESIDENTS' | 'NEW_RESIDENTS'
  | 'BUILD_FLOOR' | 'EASY_MONEY';

export interface CityTaskSummary {
  id: string;
  taskType: CityTaskType;
  status: CityTaskStatus;
  requiredCount: number;
  currentProgress: number;
  participants: { playerId: string; progress: number }[];
  takenAt: string | null;
  canDoubleUntil: string | null;
  rewardStars: number | null;
  finalStars: number | null;
}

export async function joinCityTask(taskId: string): Promise<CityTaskSummary> {
  const res = await apiPost<CityTaskSummary>(`/city/tasks/${taskId}/join`);
  return res;
}

export async function collectCityTask(taskId: string): Promise<{ finalStars: number }> {
  return apiPost<{ finalStars: number }>(`/city/tasks/${taskId}/collect`);
}

export async function cancelCityTask(taskId: string): Promise<void> {
  await apiPost(`/city/tasks/${taskId}/cancel`);
}

export async function fetchCityTasks(): Promise<{
  tasks: CityTaskSummary[];
  myActiveTaskId: string | null;
  cityStyleStars: number;
}> {
  return apiGet('/city/tasks');
}
```

(Use the same `apiPost`/`apiGet` helpers already used in `api.ts`.)

- [ ] **Step 2: Add cityTasks to sync SyncResult type in sync.ts**

Find the `interface` or type for sync response in `src/services/sync.ts` (around line 22). Add:

```typescript
cityTasks?: {
  tasks: CityTaskSummary[];
  myActiveTaskId: string | null;
  cityStyleStars: number;
};
```

Add the import: `import type { CityTaskSummary } from './api';`

- [ ] **Step 3: Call setFromSync in the sync response handler**

In `src/services/sync.ts`, find where `useGameStore.setState({ coinBonusPercent: ... })` is called (around line 152). After that block, add:

```typescript
if (response.cityTasks) {
  const { useCityTaskStore } = await import('../stores/cityTaskStore');
  useCityTaskStore.getState().setFromSync(response.cityTasks);
}
```

(Dynamic import avoids circular dependency at module load time.)

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit
```

Expected: no errors (cityTaskStore doesn't exist yet — use `// @ts-ignore` temporarily if needed; remove in Task 7).

- [ ] **Step 5: Commit**

```bash
git add src/services/api.ts src/services/sync.ts
git commit -m "feat(city-tasks): add client types + wire cityTasks into sync handler"
```

---

## Task 7: cityTaskStore.ts

**Files:**
- Create: `src/stores/cityTaskStore.ts`
- Create: `src/stores/__tests__/cityTaskStore.test.ts`

**Interfaces:**
- Consumes: `CityTaskSummary`, `joinCityTask`, `collectCityTask`, `cancelCityTask` from `api.ts`
- Produces: `useCityTaskStore` Zustand store with:
  - `tasks: CityTaskSummary[]`
  - `myActiveTaskId: string | null`
  - `cityStyleStars: number`
  - `setFromSync(data): void`
  - `joinTask(taskId: string): Promise<void>`
  - `collectTask(taskId: string): Promise<void>`
  - `cancelTask(taskId: string): Promise<void>`

- [ ] **Step 1: Write failing tests**

Create `src/stores/__tests__/cityTaskStore.test.ts`:

```typescript
import { act } from '@testing-library/react-native';
import { useCityTaskStore } from '../cityTaskStore';

const makeTask = (overrides = {}) => ({
  id: 't1', taskType: 'CARRIER' as const, status: 'AVAILABLE' as const,
  requiredCount: 100, currentProgress: 0, participants: [],
  takenAt: null, canDoubleUntil: null, rewardStars: null, finalStars: null,
  ...overrides,
});

describe('cityTaskStore', () => {
  beforeEach(() => useCityTaskStore.setState({ tasks: [], myActiveTaskId: null, cityStyleStars: 0 }));

  it('setFromSync updates tasks, myActiveTaskId, and cityStyleStars', () => {
    act(() => {
      useCityTaskStore.getState().setFromSync({
        tasks: [makeTask()],
        myActiveTaskId: 't1',
        cityStyleStars: 42,
      });
    });
    const state = useCityTaskStore.getState();
    expect(state.tasks.length).toBe(1);
    expect(state.myActiveTaskId).toBe('t1');
    expect(state.cityStyleStars).toBe(42);
  });

  it('setFromSync with null myActiveTaskId clears activeTask', () => {
    act(() => {
      useCityTaskStore.setState({ myActiveTaskId: 't1' });
      useCityTaskStore.getState().setFromSync({ tasks: [], myActiveTaskId: null, cityStyleStars: 0 });
    });
    expect(useCityTaskStore.getState().myActiveTaskId).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /Users/Apple/IT/tinytower && npx jest cityTaskStore --no-coverage
```

Expected: FAIL.

- [ ] **Step 3: Create cityTaskStore.ts**

```typescript
import { create } from 'zustand';
import type { CityTaskSummary } from '../services/api';
import { joinCityTask, collectCityTask, cancelCityTask } from '../services/api';

interface CityTaskState {
  tasks: CityTaskSummary[];
  myActiveTaskId: string | null;
  cityStyleStars: number;
  setFromSync: (data: { tasks: CityTaskSummary[]; myActiveTaskId: string | null; cityStyleStars: number }) => void;
  joinTask: (taskId: string) => Promise<void>;
  collectTask: (taskId: string) => Promise<{ finalStars: number }>;
  cancelTask: (taskId: string) => Promise<void>;
}

export const useCityTaskStore = create<CityTaskState>((set, get) => ({
  tasks: [],
  myActiveTaskId: null,
  cityStyleStars: 0,

  setFromSync(data) {
    set({ tasks: data.tasks, myActiveTaskId: data.myActiveTaskId, cityStyleStars: data.cityStyleStars });
  },

  async joinTask(taskId) {
    const updated = await joinCityTask(taskId);
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? updated : t)),
      myActiveTaskId: taskId,
    }));
  },

  async collectTask(taskId) {
    const result = await collectCityTask(taskId);
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, status: 'COLLECTED' as const } : t)),
      cityStyleStars: s.cityStyleStars + result.finalStars,
    }));
    return result;
  },

  async cancelTask(taskId) {
    await cancelCityTask(taskId);
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? { ...t, status: 'AVAILABLE' as const, currentProgress: 0, participants: [], takenAt: null }
          : t,
      ),
      myActiveTaskId: s.myActiveTaskId === taskId ? null : s.myActiveTaskId,
    }));
  },
}));
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/Apple/IT/tinytower && npx jest cityTaskStore --no-coverage
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/cityTaskStore.ts src/stores/__tests__/cityTaskStore.test.ts
git commit -m "feat(city-tasks): add cityTaskStore"
```

---

## Task 8: CityTaskFAB Component

**Files:**
- Create: `src/components/CityTaskFAB.tsx`

**Interfaces:**
- Consumes: `useCityTaskStore` from `cityTaskStore.ts`; `TutorialTaskFAB` SVG ring pattern (Svg, Circle from `react-native-svg`, same BTN/WRAP/STROKE/CX/R/CIRCUMFERENCE constants)
- Produces: `<CityTaskFAB slot={number} />` — left-side FAB with circular progress ring; returns `null` when `myActiveTaskId === null`

- [ ] **Step 1: Create CityTaskFAB.tsx**

```typescript
import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../hooks/useAppTheme';
import { useCityTaskStore } from '../stores/cityTaskStore';

const TASKS_ICON = require('../../assets/img/checklist.png'); // reuse checklist or add a city-task icon

const BTN = 54;
const WRAP = 58;
const STROKE = 3;
const CX = WRAP / 2;
const R = 25;
const CIRCUMFERENCE = 2 * Math.PI * R;

interface Props {
  slot: number;
}

export default function CityTaskFAB({ slot }: Props) {
  const theme = useAppTheme();
  const router = useRouter();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const { tasks, myActiveTaskId } = useCityTaskStore();

  if (!myActiveTaskId) return null;

  const activeTask = tasks.find((t) => t.id === myActiveTaskId);
  const ratio = activeTask
    ? Math.min(1, activeTask.currentProgress / activeTask.requiredCount)
    : 0;

  const FAB_BASE = Platform.OS === 'android' ? 84 + bottomInset : 96;
  const bottomPos = FAB_BASE + slot * 62;

  const isComplete = ratio >= 1;
  const ringColor = isComplete ? '#3FA535' : '#F2AC40';
  const filledLength = CIRCUMFERENCE * ratio;

  return (
    <View style={[styles.wrapper, { bottom: bottomPos }]}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push('/city/tasks');
        }}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: theme.surface,
            borderColor: theme.isDark ? theme.divider : 'rgba(255,255,255,0.9)',
          },
          pressed && { opacity: 0.82 },
        ]}
      >
        <Image source={TASKS_ICON} style={{ width: 34, height: 34 }} contentFit="contain" />
        {isComplete && <View style={[styles.badge, { borderColor: theme.surface }]} />}
      </Pressable>

      <Svg
        width={WRAP}
        height={WRAP}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Circle
          cx={CX} cy={CX} r={R}
          stroke={theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}
          strokeWidth={STROKE}
          fill="none"
        />
        {ratio > 0 && (
          <Circle
            cx={CX} cy={CX} r={R}
            stroke={ringColor}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${filledLength} ${CIRCUMFERENCE - filledLength}`}
            strokeDashoffset={CIRCUMFERENCE / 4}
            strokeLinecap="round"
          />
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    width: WRAP,
    height: WRAP,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3FA535',
    borderWidth: 1.5,
  },
});
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/CityTaskFAB.tsx
git commit -m "feat(city-tasks): add CityTaskFAB left-side component"
```

---

## Task 9: app/city/tasks.tsx Screen

**Files:**
- Create: `app/city/tasks.tsx`

**Interfaces:**
- Consumes: `useCityTaskStore`, `CityTaskSummary`, `CityTaskStatus`, `CityRole` from `cityStore`
- Produces: screen displaying 9 task cards with progress bars, participant slots, x2 marker, action buttons

- [ ] **Step 1: Create app/city/tasks.tsx**

```typescript
import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { useCityTaskStore } from '../../src/stores/cityTaskStore';
import { useCityStore } from '../../src/stores/cityStore';
import { fetchCityTasks } from '../../src/services/api';
import type { CityTaskSummary } from '../../src/services/api';

const TASK_LABELS: Record<string, string> = {
  WHOLESALE_PURCHASES: 'Оптові закупки',
  GOODS_ON_DISPLAY:    'Товар на вітрині',
  CASH_COLLECTOR:      'Інкасатор',
  CARRIER:             'Перевізник',
  VIP_CARRIER:         'ВІП-перевізник',
  EVICT_RESIDENTS:     'Давай досвіданья',
  NEW_RESIDENTS:       'Нові жителі',
  BUILD_FLOOR:         'Все вище і вище',
  EASY_MONEY:          'Легкі гроші',
};

export default function CityTasksScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { top, bottom } = useSafeAreaInsets();
  const { tasks, myActiveTaskId, cityStyleStars, setFromSync, joinTask, collectTask, cancelTask } = useCityTaskStore();
  const { myRole } = useCityStore();
  const [loading, setLoading] = useState(tasks.length === 0);

  const canManage = myRole === 'MAYOR' || myRole === 'ACTING_MAYOR' || myRole === 'VICE_MAYOR';

  useEffect(() => {
    fetchCityTasks()
      .then(setFromSync)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={[styles.backText, { color: theme.primary }]}>←</Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>City Tasks</Text>
        <View style={[styles.starsBadge, { backgroundColor: theme.surface }]}>
          <Text style={[styles.starsText, { color: theme.text }]}>⭐ {cityStyleStars}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottom + 24 }}>
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            myPlayerId={useCityStore.getState().playerId ?? ''}
            myActiveTaskId={myActiveTaskId}
            canManage={canManage}
            onJoin={() => joinTask(task.id)}
            onCollect={() => collectTask(task.id)}
            onCancel={() => cancelTask(task.id)}
            theme={theme}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function TaskCard({
  task, myPlayerId, myActiveTaskId, canManage, onJoin, onCollect, onCancel, theme,
}: {
  task: CityTaskSummary;
  myPlayerId: string;
  myActiveTaskId: string | null;
  canManage: boolean;
  onJoin: () => Promise<void>;
  onCollect: () => Promise<{ finalStars: number }>;
  onCancel: () => Promise<void>;
  theme: any;
}) {
  const [busy, setBusy] = useState(false);
  const isParticipant = task.participants.some((p) => p.playerId === myPlayerId);
  const isInAnotherTask = myActiveTaskId !== null && myActiveTaskId !== task.id;
  const canJoin =
    (task.status === 'AVAILABLE' || (task.status === 'IN_PROGRESS' && task.participants.length < 2)) &&
    !isParticipant &&
    !isInAnotherTask;
  const canDouble = task.canDoubleUntil && new Date() < new Date(task.canDoubleUntil);
  const progress = task.requiredCount > 0 ? task.currentProgress / task.requiredCount : 0;

  const handle = async (fn: () => Promise<any>) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>{TASK_LABELS[task.taskType]}</Text>
        {canDouble && task.status === 'IN_PROGRESS' && (
          <View style={styles.x2badge}>
            <Text style={styles.x2text}>×2</Text>
          </View>
        )}
      </View>

      {/* Progress bar */}
      <View style={[styles.progressBg, { backgroundColor: theme.divider }]}>
        <View style={[styles.progressFill, { width: `${Math.min(100, progress * 100)}%`, backgroundColor: progress >= 1 ? '#3FA535' : theme.primary }]} />
      </View>
      <Text style={[styles.progressText, { color: theme.textSecondary }]}>
        {task.currentProgress} / {task.requiredCount}
      </Text>

      {/* Participant slots */}
      <View style={styles.participants}>
        {[0, 1].map((i) => {
          const p = task.participants[i];
          return (
            <View key={i} style={[styles.participantSlot, { borderColor: theme.divider, backgroundColor: p ? theme.primary + '22' : 'transparent' }]}>
              <Text style={{ color: p ? theme.primary : theme.textSecondary, fontSize: 11 }}>
                {p ? p.playerId.slice(0, 6) : '—'}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {task.status === 'AVAILABLE' && canJoin && (
          <ActionButton label="Взяти" onPress={() => handle(onJoin)} busy={busy} color={theme.primary} />
        )}
        {task.status === 'IN_PROGRESS' && canJoin && (
          <ActionButton label="Приєднатись" onPress={() => handle(onJoin)} busy={busy} color={theme.primary} />
        )}
        {task.status === 'IN_PROGRESS' && isParticipant && (
          <View style={[styles.activeTag, { borderColor: theme.primary }]}>
            <Text style={[styles.activeTagText, { color: theme.primary }]}>Активне</Text>
          </View>
        )}
        {task.status === 'COMPLETED' && canManage && (
          <ActionButton label="Зібрати" onPress={() => handle(onCollect)} busy={busy} color="#3FA535" />
        )}
        {task.status === 'COLLECTED' && (
          <Text style={[styles.doneText, { color: '#3FA535' }]}>✓ Виконано (+{task.finalStars}⭐)</Text>
        )}
        {canManage && (task.status === 'IN_PROGRESS' || task.status === 'COMPLETED') && (
          <Pressable onPress={() => handle(onCancel)} disabled={busy} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Скасувати</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function ActionButton({ label, onPress, busy, color }: { label: string; onPress: () => void; busy: boolean; color: string }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={[styles.actionBtn, { backgroundColor: color }]}
    >
      {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.actionBtnText}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  back: { padding: 4 },
  backText: { fontSize: 22 },
  title: { flex: 1, fontSize: 18, fontWeight: '700' },
  starsBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  starsText: { fontSize: 14, fontWeight: '600' },
  card: { borderRadius: 14, padding: 14, marginBottom: 12, gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  x2badge: { backgroundColor: '#F2AC40', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  x2text: { color: '#fff', fontWeight: '800', fontSize: 12 },
  progressBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  progressText: { fontSize: 12 },
  participants: { flexDirection: 'row', gap: 8 },
  participantSlot: { flex: 1, height: 28, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  actionBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  activeTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1.5 },
  activeTagText: { fontWeight: '700', fontSize: 13 },
  cancelBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  cancelText: { color: '#E05555', fontSize: 13 },
  doneText: { fontWeight: '700', fontSize: 14 },
});
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit
```

Expected: no errors (fix any type issues, e.g. `useCityStore.getState().playerId` — check the actual field name in `cityStore.ts`).

- [ ] **Step 3: Commit**

```bash
git add app/city/tasks.tsx
git commit -m "feat(city-tasks): add city tasks screen"
```

---

## Task 10: Navigation + FAB Hookup

**Files:**
- Modify: `app/(tabs)/game.tsx`
- Modify: `app/city/[id].tsx` or `app/(tabs)/city.tsx` (add entry point to tasks)

**Interfaces:**
- Consumes: `CityTaskFAB` from Task 8; `useCityTaskStore` for myActiveTaskId; existing FAB slot system
- Produces: `CityTaskFAB` rendered on left side of main game screen; navigation link to `/city/tasks` from city main screen

- [ ] **Step 1: Import and render CityTaskFAB in game.tsx**

In `app/(tabs)/game.tsx`, add:

```typescript
import CityTaskFAB from '../../src/components/CityTaskFAB';
import { useCityTaskStore } from '../../src/stores/cityTaskStore';
```

In the component body, add:

```typescript
const cityTaskActiveId = useCityTaskStore((s) => s.myActiveTaskId);
```

Find the FAB rendering block (around line 1176 where `TutorialTaskFAB` and `DailyTasksFAB` are rendered). Add `CityTaskFAB` to the left of the screen (it uses `left: 16` internally, so no wrapper needed):

```tsx
{cityTaskActiveId && <CityTaskFAB slot={0} />}
```

Place this inside the same conditional block that wraps the right-side FABs (the `{!isTemporary && ...}` block).

- [ ] **Step 2: Add "Tasks" link in city main tab**

Open `app/(tabs)/city.tsx`. Find the section that shows "my city" view. Add a pressable/button that navigates to `/city/tasks`:

```tsx
import { useRouter } from 'expo-router';
// inside the "my city" view:
const router = useRouter();
// ...
<Pressable onPress={() => router.push('/city/tasks')} style={styles.tasksButton}>
  <Text style={styles.tasksButtonText}>City Tasks</Text>
</Pressable>
```

(Style to match existing card buttons on that screen.)

- [ ] **Step 3: TypeScript check + dev build**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/game.tsx" "app/(tabs)/city.tsx"
git commit -m "feat(city-tasks): wire FAB and navigation entry point"
```

---

## Task 11: i18n Keys

**Files:**
- Modify: `src/i18n/en.json` (and `uk.json` / other locales)

**Interfaces:**
- Produces: all `cityTasks.*` keys present in all locale files

- [ ] **Step 1: Add keys to all locale files**

Find locale files: `find src/i18n -name "*.json" | head -10`

Add to each locale's JSON under `"cityTasks"`:

```json
"cityTasks": {
  "title": "City Tasks",
  "styleStars": "Style Stars",
  "take": "Take",
  "join": "Join",
  "active": "Active",
  "collect": "Collect",
  "cancel": "Cancel",
  "done": "Done",
  "doubleBonus": "×2",
  "task": {
    "wholesalePurchases": "Wholesale Purchases",
    "goodsOnDisplay": "Goods on Display",
    "cashCollector": "Cash Collector",
    "carrier": "Carrier",
    "vipCarrier": "VIP Carrier",
    "evictResidents": "Evict Residents",
    "newResidents": "New Residents",
    "buildFloor": "New Floor",
    "easyMoney": "Easy Money"
  }
}
```

For `uk.json`, use Ukrainian strings from the spec (Оптові закупки, Товар на вітрині, etc.).

Then update `tasks.tsx` to use `useTranslation` with these keys instead of the hardcoded `TASK_LABELS` map.

- [ ] **Step 2: Commit**

```bash
git add src/i18n/
git commit -m "feat(city-tasks): add i18n keys for city tasks"
```
