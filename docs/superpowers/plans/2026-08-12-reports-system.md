# Reports System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a moderation system letting players report chat messages, forum posts, and comments, with an admin panel to review and act on reports.

**Architecture:** Single polymorphic `Report` table + `reportCount`/`isHidden` fields on content models. A new NestJS `ReportModule` handles both the player `POST /report` endpoint and admin queries; admin controller imports ReportService via module export. Mobile uses a Zustand store + reusable bottom sheet modal.

**Tech Stack:** NestJS + Prisma (PostgreSQL), Zod validation, Jest (server tests), React Native + Expo Router + Zustand (mobile), React + Vite + TanStack Query (admin).

## Global Constraints

- All new server endpoints validate input with Zod before passing to service
- Player endpoints require `JwtAuthGuard`; admin endpoints require `JwtAuthGuard + AdminGuard`
- Prisma: use `$transaction(async tx => ...)` callback form for atomic multi-step ops
- Mobile i18n: all user-visible strings go through `useTranslation('tabs')`
- Follow existing code patterns in each layer (styles, module structure, test setup)
- Auto-hide threshold: `reportCount >= 5`

---

## File Map

**Create:**
- `server/src/report/report.service.ts` — all report logic
- `server/src/report/report.module.ts` — NestJS module, exports ReportService
- `server/src/report/report.controller.ts` — `POST /report` player endpoint
- `server/src/report/__tests__/report.service.spec.ts` — unit tests
- `admin/src/pages/ReportsPage.tsx` — admin reports UI
- `src/stores/reportStore.ts` — Zustand store for mobile
- `src/components/ReportSheet.tsx` — bottom sheet modal

**Modify:**
- `server/prisma/schema.prisma` — add enums, Report model, fields on 3 content models
- `server/src/admin/admin.controller.ts` — add 4 admin report endpoints
- `server/src/admin/admin.module.ts` — import ReportModule
- `server/src/app.module.ts` — import ReportModule
- `server/src/chat/chat.service.ts` — add `isHidden: false` to fetchMessages
- `server/src/forum/forum.service.ts` — add `isHidden: false` to getPosts + getComments
- `server/src/chat/__tests__/chat.service.spec.ts` — cover isHidden filter
- `server/src/forum/__tests__/forum.service.spec.ts` — cover isHidden filter
- `admin/src/App.tsx` — add `/reports` route
- `admin/src/components/Layout.tsx` — add Reports nav link
- `src/i18n/locales/en/tabs.json` — add `report.*` keys
- `app/chat-screen.tsx` — add Report action to long-press sheet
- `src/components/ChatMessage.tsx` — add `canReport` prop
- `app/forum-post.tsx` — add Report to comment sheet + post report button
- `src/components/ForumPostRow.tsx` — add optional `onReport` prop + ⋯ button
- `app/forum-category.tsx` — pass `onReport` to ForumPostRow + render ReportSheet

---

## Task 1: Prisma Schema Migration

**Files:**
- Modify: `server/prisma/schema.prisma`

**Interfaces:**
- Produces: `Report` model, `ReportTargetType` enum, `ReportCategory` enum; `reportCount Int`, `isHidden Boolean` fields on `ChatMessage`, `ForumPost`, `ForumComment`; `reports Report[]` relation on `Player`

- [ ] **Step 1: Edit schema.prisma — add enums before the ChatMessage model**

Add these two enums after the `FriendRequestStatus` enum (around line 283):

```prisma
enum ReportTargetType {
  CHAT_MESSAGE
  FORUM_POST
  FORUM_COMMENT
}

enum ReportCategory {
  SPAM
  INSULT
  ADVERTISEMENT
  PROFANITY
  THREAT
  OTHER
}
```

- [ ] **Step 2: Edit schema.prisma — add Report model at the end of the file**

```prisma
model Report {
  id         String           @id @default(uuid())
  reporterId String
  targetType ReportTargetType
  targetId   String
  category   ReportCategory
  createdAt  DateTime         @default(now())
  reporter   Player           @relation(fields: [reporterId], references: [id], onDelete: Cascade)

  @@unique([reporterId, targetType, targetId])
  @@index([targetType, targetId])
  @@index([createdAt])
}
```

- [ ] **Step 3: Edit schema.prisma — add fields to ChatMessage (after the `deletedAt` line)**

```prisma
  reportCount Int     @default(0)
  isHidden    Boolean @default(false)
```

- [ ] **Step 4: Edit schema.prisma — add same two fields to ForumPost (after the `deletedAt` line)**

```prisma
  reportCount Int     @default(0)
  isHidden    Boolean @default(false)
```

- [ ] **Step 5: Edit schema.prisma — add same two fields to ForumComment (after the `deletedAt` line)**

```prisma
  reportCount Int     @default(0)
  isHidden    Boolean @default(false)
```

- [ ] **Step 6: Edit schema.prisma — add `reports` relation to Player model (after `forumPostReads` line)**

```prisma
  reports         Report[]
```

- [ ] **Step 7: Run migration from the server directory**

```bash
cd server && npx prisma migrate dev --name add_reports_system
```

Expected: migration file created, `npx prisma generate` runs automatically.

- [ ] **Step 8: Verify Prisma client updated**

```bash
cd server && npx prisma studio --browser none &
sleep 3 && kill %1
```

Or simply: `cd server && node -e "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); console.log(typeof p.report);"` — should print `object`.

- [ ] **Step 9: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/
git commit -m "feat(db): add Report model and reportCount/isHidden fields"
```

---

## Task 2: ReportService + Module + Tests

**Files:**
- Create: `server/src/report/report.service.ts`
- Create: `server/src/report/report.module.ts`
- Create: `server/src/report/__tests__/report.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (injected)
- Produces:
  - `createReport(reporterId: string, targetType: ReportTargetType, targetId: string, category: ReportCategory): Promise<{ ok: true }>`
  - `getReports(page: number, limit: number): Promise<{ data: ReportListItem[], total: number, page: number, totalPages: number }>`
  - `getReportDetail(targetType: ReportTargetType, targetId: string): Promise<{ targetType, targetId, content, reports }>`
  - `dismissReports(targetType: ReportTargetType, targetId: string): Promise<{ ok: true }>`
  - `deleteReportedContent(targetType: ReportTargetType, targetId: string): Promise<{ ok: true }>`

- [ ] **Step 1: Write the failing tests**

Create `server/src/report/__tests__/report.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ReportService } from '../report.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ReportService', () => {
  let service: ReportService;
  let prisma: Record<string, any>;

  beforeEach(async () => {
    prisma = {
      chatMessage: {
        findFirst: jest.fn().mockResolvedValue({ id: 'msg-1' }),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ reportCount: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      forumPost: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ reportCount: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      forumComment: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ reportCount: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      report: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn().mockImplementation((cb: any) =>
        typeof cb === 'function' ? cb(prisma) : Promise.all(cb),
      ),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<ReportService>(ReportService);
  });

  describe('createReport', () => {
    it('creates report and increments reportCount for chat message', async () => {
      prisma.chatMessage.update.mockResolvedValue({ reportCount: 1 });

      const result = await service.createReport('p1', 'CHAT_MESSAGE', 'msg-1', 'SPAM');

      expect(result).toEqual({ ok: true });
      expect(prisma.report.create).toHaveBeenCalledWith({
        data: { reporterId: 'p1', targetType: 'CHAT_MESSAGE', targetId: 'msg-1', category: 'SPAM' },
      });
      expect(prisma.chatMessage.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: { reportCount: { increment: 1 } },
        select: { reportCount: true },
      });
    });

    it('sets isHidden=true when reportCount reaches 5', async () => {
      prisma.chatMessage.update
        .mockResolvedValueOnce({ reportCount: 5 })
        .mockResolvedValueOnce({});

      await service.createReport('p1', 'CHAT_MESSAGE', 'msg-1', 'SPAM');

      expect(prisma.chatMessage.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: { isHidden: true },
      });
    });

    it('does NOT set isHidden when reportCount is below 5', async () => {
      prisma.chatMessage.update.mockResolvedValue({ reportCount: 4 });

      await service.createReport('p1', 'CHAT_MESSAGE', 'msg-1', 'SPAM');

      expect(prisma.chatMessage.update).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException when chat message does not exist', async () => {
      prisma.chatMessage.findFirst.mockResolvedValue(null);

      await expect(service.createReport('p1', 'CHAT_MESSAGE', 'msg-1', 'SPAM'))
        .rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws ConflictException on duplicate report (P2002)', async () => {
      prisma.$transaction.mockRejectedValue({ code: 'P2002' });

      await expect(service.createReport('p1', 'CHAT_MESSAGE', 'msg-1', 'SPAM'))
        .rejects.toThrow(ConflictException);
    });

    it('works for FORUM_POST target type', async () => {
      prisma.forumPost.findFirst.mockResolvedValue({ id: 'post-1' });
      prisma.forumPost.update.mockResolvedValue({ reportCount: 2 });

      const result = await service.createReport('p1', 'FORUM_POST', 'post-1', 'INSULT');
      expect(result).toEqual({ ok: true });
      expect(prisma.forumPost.update).toHaveBeenCalled();
    });

    it('works for FORUM_COMMENT target type', async () => {
      prisma.forumComment.findFirst.mockResolvedValue({ id: 'comment-1' });
      prisma.forumComment.update.mockResolvedValue({ reportCount: 1 });

      const result = await service.createReport('p1', 'FORUM_COMMENT', 'comment-1', 'THREAT');
      expect(result).toEqual({ ok: true });
    });
  });

  describe('getReports', () => {
    it('returns empty list when no reports', async () => {
      const result = await service.getReports(1, 50);
      expect(result).toEqual({ data: [], total: 0, page: 1, totalPages: 0 });
    });

    it('merges and sorts all three content types by reportCount desc', async () => {
      prisma.chatMessage.findMany.mockResolvedValue([
        { id: 'msg-1', playerName: 'Alice', body: 'hello world', reportCount: 3, createdAt: new Date() },
      ]);
      prisma.forumPost.findMany.mockResolvedValue([
        { id: 'post-1', playerName: 'Bob', title: 'My Post', body: 'some content', reportCount: 7, createdAt: new Date() },
      ]);

      const result = await service.getReports(1, 50);

      expect(result.total).toBe(2);
      expect(result.data[0].reportCount).toBe(7);
      expect(result.data[0].targetType).toBe('FORUM_POST');
      expect(result.data[1].reportCount).toBe(3);
      expect(result.data[1].targetType).toBe('CHAT_MESSAGE');
    });

    it('paginates correctly', async () => {
      const manyPosts = Array.from({ length: 60 }, (_, i) => ({
        id: `post-${i}`, playerName: 'X', title: 'T', body: 'B', reportCount: 60 - i, createdAt: new Date(),
      }));
      prisma.forumPost.findMany.mockResolvedValue(manyPosts);

      const result = await service.getReports(2, 50);

      expect(result.total).toBe(60);
      expect(result.data.length).toBe(10);
      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(2);
    });
  });

  describe('dismissReports', () => {
    it('resets reportCount and isHidden, deletes all reports for target', async () => {
      prisma.chatMessage.update.mockResolvedValue({});

      const result = await service.dismissReports('CHAT_MESSAGE', 'msg-1');

      expect(result).toEqual({ ok: true });
      expect(prisma.chatMessage.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: { reportCount: 0, isHidden: false },
      });
      expect(prisma.report.deleteMany).toHaveBeenCalledWith({
        where: { targetType: 'CHAT_MESSAGE', targetId: 'msg-1' },
      });
    });
  });

  describe('deleteReportedContent', () => {
    it('soft-deletes forum post and resets report fields', async () => {
      prisma.forumPost.update.mockResolvedValue({});

      const result = await service.deleteReportedContent('FORUM_POST', 'post-1');

      expect(result).toEqual({ ok: true });
      expect(prisma.forumPost.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'post-1' },
          data: expect.objectContaining({ reportCount: 0, isHidden: false }),
        }),
      );
      expect(prisma.report.deleteMany).toHaveBeenCalledWith({
        where: { targetType: 'FORUM_POST', targetId: 'post-1' },
      });
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd server && npx jest --testPathPattern="report.service" --no-coverage
```

Expected: FAIL — `Cannot find module '../report.service'`

- [ ] **Step 3: Create `server/src/report/report.service.ts`**

```typescript
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma, ReportCategory, ReportTargetType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService) {}

  private async findTarget(tx: Prisma.TransactionClient | PrismaService, targetType: ReportTargetType, targetId: string) {
    if (targetType === 'CHAT_MESSAGE') {
      return tx.chatMessage.findFirst({ where: { id: targetId, deletedAt: null }, select: { id: true } });
    }
    if (targetType === 'FORUM_POST') {
      return tx.forumPost.findFirst({ where: { id: targetId, deletedAt: null }, select: { id: true } });
    }
    return tx.forumComment.findFirst({ where: { id: targetId, deletedAt: null }, select: { id: true } });
  }

  private async incrementCount(tx: Prisma.TransactionClient, targetType: ReportTargetType, targetId: string) {
    const data = { reportCount: { increment: 1 } };
    const select = { reportCount: true };
    if (targetType === 'CHAT_MESSAGE') return tx.chatMessage.update({ where: { id: targetId }, data, select });
    if (targetType === 'FORUM_POST') return tx.forumPost.update({ where: { id: targetId }, data, select });
    return tx.forumComment.update({ where: { id: targetId }, data, select });
  }

  private async setHidden(tx: Prisma.TransactionClient, targetType: ReportTargetType, targetId: string) {
    const data = { isHidden: true };
    if (targetType === 'CHAT_MESSAGE') return tx.chatMessage.update({ where: { id: targetId }, data });
    if (targetType === 'FORUM_POST') return tx.forumPost.update({ where: { id: targetId }, data });
    return tx.forumComment.update({ where: { id: targetId }, data });
  }

  async createReport(reporterId: string, targetType: ReportTargetType, targetId: string, category: ReportCategory) {
    const target = await this.findTarget(this.prisma, targetType, targetId);
    if (!target) throw new NotFoundException('Content not found');

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.report.create({ data: { reporterId, targetType, targetId, category } });
        const updated = await this.incrementCount(tx, targetType, targetId);
        if (updated.reportCount >= 5) {
          await this.setHidden(tx, targetType, targetId);
        }
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Already reported');
      throw e;
    }
    return { ok: true as const };
  }

  async getReports(page: number, limit: number) {
    const [chatMsgs, forumPosts, forumComments] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where: { reportCount: { gt: 0 }, deletedAt: null },
        select: { id: true, playerName: true, body: true, reportCount: true, createdAt: true },
      }),
      this.prisma.forumPost.findMany({
        where: { reportCount: { gt: 0 }, deletedAt: null },
        select: { id: true, playerName: true, title: true, body: true, reportCount: true, createdAt: true },
      }),
      this.prisma.forumComment.findMany({
        where: { reportCount: { gt: 0 }, deletedAt: null },
        select: { id: true, playerName: true, body: true, reportCount: true, createdAt: true },
      }),
    ]);

    const all = [
      ...chatMsgs.map(m => ({
        targetType: 'CHAT_MESSAGE' as const, targetId: m.id,
        playerName: m.playerName, preview: m.body.slice(0, 80),
        reportCount: m.reportCount, createdAt: m.createdAt,
      })),
      ...forumPosts.map(p => ({
        targetType: 'FORUM_POST' as const, targetId: p.id,
        playerName: p.playerName, preview: `${p.title}: ${p.body}`.slice(0, 80),
        reportCount: p.reportCount, createdAt: p.createdAt,
      })),
      ...forumComments.map(c => ({
        targetType: 'FORUM_COMMENT' as const, targetId: c.id,
        playerName: c.playerName, preview: c.body.slice(0, 80),
        reportCount: c.reportCount, createdAt: c.createdAt,
      })),
    ];

    all.sort((a, b) => b.reportCount - a.reportCount);
    const total = all.length;
    const skip = (page - 1) * limit;
    const pageData = all.slice(skip, skip + limit);

    if (pageData.length === 0) {
      return { data: [], total, page, totalPages: Math.ceil(total / limit) };
    }

    const targetIds = pageData.map(item => item.targetId);
    const reports = await this.prisma.report.findMany({
      where: { targetId: { in: targetIds } },
      select: { targetId: true, category: true },
    });

    const categoryMap = new Map<string, Record<string, number>>();
    for (const r of reports) {
      if (!categoryMap.has(r.targetId)) categoryMap.set(r.targetId, {});
      const cats = categoryMap.get(r.targetId)!;
      cats[r.category] = (cats[r.category] ?? 0) + 1;
    }

    return {
      data: pageData.map(item => ({ ...item, categories: categoryMap.get(item.targetId) ?? {} })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getReportDetail(targetType: ReportTargetType, targetId: string) {
    let content: { playerName: string; body: string; title?: string } | null = null;
    if (targetType === 'CHAT_MESSAGE') {
      content = await this.prisma.chatMessage.findUnique({ where: { id: targetId }, select: { playerName: true, body: true } });
    } else if (targetType === 'FORUM_POST') {
      content = await this.prisma.forumPost.findUnique({ where: { id: targetId }, select: { playerName: true, title: true, body: true } });
    } else {
      content = await this.prisma.forumComment.findUnique({ where: { id: targetId }, select: { playerName: true, body: true } });
    }
    if (!content) throw new NotFoundException('Content not found');

    const reports = await this.prisma.report.findMany({
      where: { targetType, targetId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, category: true, createdAt: true, reporter: { select: { playerName: true } } },
    });

    return { targetType, targetId, content, reports };
  }

  async dismissReports(targetType: ReportTargetType, targetId: string) {
    const data = { reportCount: 0, isHidden: false };
    await this.prisma.$transaction(async (tx) => {
      if (targetType === 'CHAT_MESSAGE') await tx.chatMessage.update({ where: { id: targetId }, data });
      else if (targetType === 'FORUM_POST') await tx.forumPost.update({ where: { id: targetId }, data });
      else await tx.forumComment.update({ where: { id: targetId }, data });
      await tx.report.deleteMany({ where: { targetType, targetId } });
    });
    return { ok: true as const };
  }

  async deleteReportedContent(targetType: ReportTargetType, targetId: string) {
    const deletedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const data = { deletedAt, reportCount: 0, isHidden: false };
      if (targetType === 'CHAT_MESSAGE') await tx.chatMessage.update({ where: { id: targetId }, data });
      else if (targetType === 'FORUM_POST') await tx.forumPost.update({ where: { id: targetId }, data });
      else await tx.forumComment.update({ where: { id: targetId }, data });
      await tx.report.deleteMany({ where: { targetType, targetId } });
    });
    return { ok: true as const };
  }
}
```

- [ ] **Step 4: Create `server/src/report/report.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

@Module({
  imports: [PrismaModule],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
```

- [ ] **Step 5: Create a stub `server/src/report/report.controller.ts` (just enough to satisfy module compile)**

```typescript
import { Controller } from '@nestjs/common';
import { ReportService } from './report.service';

@Controller('report')
export class ReportController {
  constructor(private reportService: ReportService) {}
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd server && npx jest --testPathPattern="report.service" --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add server/src/report/
git commit -m "feat(report): add ReportService and ReportModule with tests"
```

---

## Task 3: Report Endpoints — Player Controller + Admin

**Files:**
- Modify: `server/src/report/report.controller.ts` — implement `POST /report`
- Modify: `server/src/admin/admin.controller.ts` — add 4 admin report endpoints
- Modify: `server/src/admin/admin.module.ts` — import ReportModule
- Modify: `server/src/app.module.ts` — import ReportModule

**Interfaces:**
- Consumes: `ReportService` (from Task 2)
- Produces:
  - `POST /report` → `{ ok: true }` | 404 | 409 | 400
  - `GET /admin/reports?page&limit` → `{ data, total, page, totalPages }`
  - `GET /admin/reports/:targetType/:targetId` → `{ targetType, targetId, content, reports }`
  - `DELETE /admin/reports/:targetType/:targetId/content` → `{ ok: true }`
  - `POST /admin/reports/:targetType/:targetId/dismiss` → `{ ok: true }`

- [ ] **Step 1: Implement `server/src/report/report.controller.ts`**

```typescript
import { Controller, Post, Body, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportService } from './report.service';
import { ReportTargetType, ReportCategory } from '@prisma/client';

const REPORT_TYPES = ['CHAT_MESSAGE', 'FORUM_POST', 'FORUM_COMMENT'] as const;
const REPORT_CATEGORIES = ['SPAM', 'INSULT', 'ADVERTISEMENT', 'PROFANITY', 'THREAT', 'OTHER'] as const;

const CreateReportSchema = z.object({
  targetType: z.enum(REPORT_TYPES),
  targetId: z.string().min(1),
  category: z.enum(REPORT_CATEGORIES),
});

type AuthReq = { user: { playerId: string } };

@Controller('report')
export class ReportController {
  constructor(private reportService: ReportService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createReport(@Req() req: AuthReq, @Body() body: unknown) {
    const parsed = CreateReportSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return this.reportService.createReport(
      req.user.playerId,
      parsed.data.targetType as ReportTargetType,
      parsed.data.targetId,
      parsed.data.category as ReportCategory,
    );
  }
}
```

- [ ] **Step 2: Add admin report endpoints to `server/src/admin/admin.controller.ts`**

Add import at the top (alongside existing imports):
```typescript
import { ReportService } from '../report/report.service';
import { ReportTargetType } from '@prisma/client';
```

Add `REPORT_TARGET_TYPES` constant before the class:
```typescript
const REPORT_TARGET_TYPES = ['CHAT_MESSAGE', 'FORUM_POST', 'FORUM_COMMENT'] as const;
```

Change the constructor to inject both services:
```typescript
constructor(private adminService: AdminService, private reportService: ReportService) {}
```

Add these four endpoints inside the class, after the existing `deleteForumComment` endpoint:

```typescript
  @Get('reports')
  getReports(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.reportService.getReports(
      Math.max(1, +page || 1),
      Math.min(Math.max(1, +limit || 50), 100),
    );
  }

  @Get('reports/:targetType/:targetId')
  getReportDetail(
    @Param('targetType') targetType: string,
    @Param('targetId') targetId: string,
  ) {
    if (!REPORT_TARGET_TYPES.includes(targetType as any)) throw new BadRequestException('Invalid target type');
    return this.reportService.getReportDetail(targetType as ReportTargetType, targetId);
  }

  @Delete('reports/:targetType/:targetId/content')
  deleteReportedContent(
    @Param('targetType') targetType: string,
    @Param('targetId') targetId: string,
  ) {
    if (!REPORT_TARGET_TYPES.includes(targetType as any)) throw new BadRequestException('Invalid target type');
    return this.reportService.deleteReportedContent(targetType as ReportTargetType, targetId);
  }

  @Post('reports/:targetType/:targetId/dismiss')
  dismissReports(
    @Param('targetType') targetType: string,
    @Param('targetId') targetId: string,
  ) {
    if (!REPORT_TARGET_TYPES.includes(targetType as any)) throw new BadRequestException('Invalid target type');
    return this.reportService.dismissReports(targetType as ReportTargetType, targetId);
  }
```

- [ ] **Step 3: Update `server/src/admin/admin.module.ts` to import ReportModule**

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ReportModule } from '../report/report.module';

@Module({
  imports: [PrismaModule, ReportModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
```

- [ ] **Step 4: Update `server/src/app.module.ts` to import ReportModule**

Add `import { ReportModule } from './report/report.module';` to the imports at the top, then add `ReportModule` to the `imports` array inside `@Module`.

- [ ] **Step 5: Build to confirm no TypeScript errors**

```bash
cd server && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add server/src/report/report.controller.ts server/src/admin/admin.controller.ts server/src/admin/admin.module.ts server/src/app.module.ts
git commit -m "feat(report): wire player and admin endpoints"
```

---

## Task 4: Filter isHidden in Existing Services

**Files:**
- Modify: `server/src/chat/chat.service.ts`
- Modify: `server/src/forum/forum.service.ts`
- Modify: `server/src/chat/__tests__/chat.service.spec.ts`
- Modify: `server/src/forum/__tests__/forum.service.spec.ts`

**Interfaces:**
- Consumes: existing services
- Produces: `fetchMessages`, `getPosts`, `getComments` now filter out `isHidden: true` content

- [ ] **Step 1: Write a failing test in `chat.service.spec.ts`**

Add this test inside the existing `describe('fetchMessages')` block:

```typescript
it('excludes hidden messages', async () => {
  await chatService.fetchMessages();
  expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ isHidden: false }),
    }),
  );
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd server && npx jest --testPathPattern="chat.service" --no-coverage
```

Expected: FAIL — `isHidden` not in where clause.

- [ ] **Step 3: Edit `server/src/chat/chat.service.ts` — add `isHidden: false` to fetchMessages**

In `fetchMessages`, change:
```typescript
where: { deletedAt: null, country: country ?? null },
```
to:
```typescript
where: { deletedAt: null, isHidden: false, country: country ?? null },
```

- [ ] **Step 4: Run chat tests**

```bash
cd server && npx jest --testPathPattern="chat.service" --no-coverage
```

Expected: All PASS.

- [ ] **Step 5: Write failing tests in `forum.service.spec.ts`**

Add these two tests inside the existing `describe('getPosts')` block:

```typescript
it('excludes hidden posts', async () => {
  await service.getPosts('GENERAL', 1, 20, 'p1');
  expect(prisma.forumPost.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ isHidden: false }),
    }),
  );
  expect(prisma.forumPost.count).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ isHidden: false }),
    }),
  );
});
```

Add inside the existing `describe('getComments')` block (create it if it doesn't exist):

```typescript
it('excludes hidden comments', async () => {
  prisma.forumPost.findFirst.mockResolvedValue({ id: 'post-1' });
  await service.getComments('post-1', 1, 50);
  expect(prisma.forumComment.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ isHidden: false }),
    }),
  );
});
```

- [ ] **Step 6: Run to confirm they fail**

```bash
cd server && npx jest --testPathPattern="forum.service" --no-coverage
```

Expected: The two new tests FAIL.

- [ ] **Step 7: Edit `server/src/forum/forum.service.ts` — add `isHidden: false` to getPosts**

In `getPosts`, change both `where` clauses (the `count` and the `findMany`) from:
```typescript
where: { category, deletedAt: null }
```
to:
```typescript
where: { category, deletedAt: null, isHidden: false }
```

- [ ] **Step 8: Edit `server/src/forum/forum.service.ts` — add `isHidden: false` to getComments**

In `getComments`, change both `where` clauses (the `count` and the `findMany`) from:
```typescript
where: { postId, deletedAt: null }
```
to:
```typescript
where: { postId, deletedAt: null, isHidden: false }
```

- [ ] **Step 9: Run all server tests**

```bash
cd server && npx jest --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 10: Commit**

```bash
git add server/src/chat/chat.service.ts server/src/forum/forum.service.ts server/src/chat/__tests__/chat.service.spec.ts server/src/forum/__tests__/forum.service.spec.ts
git commit -m "feat(report): filter isHidden content from public fetch endpoints"
```

---

## Task 5: Admin ReportsPage

**Files:**
- Create: `admin/src/pages/ReportsPage.tsx`
- Modify: `admin/src/App.tsx` — add `/reports` route
- Modify: `admin/src/components/Layout.tsx` — add Reports nav link

**Interfaces:**
- Consumes:
  - `GET /admin/reports?page&limit` → `{ data: ReportListItem[], total, page, totalPages }`
  - `GET /admin/reports/:targetType/:targetId` → `{ content, reports }`
  - `DELETE /admin/reports/:targetType/:targetId/content` → `{ ok: true }`
  - `POST /admin/reports/:targetType/:targetId/dismiss` → `{ ok: true }`

- [ ] **Step 1: Create `admin/src/pages/ReportsPage.tsx`**

```typescript
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Layout } from '../components/Layout';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { api } from '../lib/api';

type TargetType = 'CHAT_MESSAGE' | 'FORUM_POST' | 'FORUM_COMMENT';

interface ReportListItem {
  targetType: TargetType;
  targetId: string;
  playerName: string;
  preview: string;
  reportCount: number;
  createdAt: string;
  categories: Record<string, number>;
}

interface ReportDetail {
  targetType: TargetType;
  targetId: string;
  content: { playerName: string; body: string; title?: string };
  reports: { id: string; category: string; createdAt: string; reporter: { playerName: string } }[];
}

interface ReportsResponse {
  data: ReportListItem[];
  total: number;
  page: number;
  totalPages: number;
}

const TYPE_LABELS: Record<TargetType, string> = {
  CHAT_MESSAGE: 'CHAT',
  FORUM_POST: 'POST',
  FORUM_COMMENT: 'COMMENT',
};

const TYPE_COLORS: Record<TargetType, string> = {
  CHAT_MESSAGE: 'bg-blue-100 text-blue-700',
  FORUM_POST: 'bg-purple-100 text-purple-700',
  FORUM_COMMENT: 'bg-green-100 text-green-700',
};

function formatCategories(cats: Record<string, number>): string {
  return Object.entries(cats)
    .map(([k, v]) => `${k.toLowerCase()}×${v}`)
    .join(' ');
}

export function ReportsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-reports', page],
    queryFn: () => api.get<ReportsResponse>(`/admin/reports?page=${page}&limit=50`),
  });

  const detailKey = expandedKey;
  const { data: detail } = useQuery({
    queryKey: ['admin-report-detail', detailKey],
    queryFn: () => {
      if (!detailKey) return null;
      const [type, id] = detailKey.split('::');
      return api.get<ReportDetail>(`/admin/reports/${type}/${id}`);
    },
    enabled: !!detailKey,
  });

  const deleteMutation = useMutation({
    mutationFn: ({ targetType, targetId }: { targetType: TargetType; targetId: string }) =>
      api.delete<{ ok: true }>(`/admin/reports/${targetType}/${targetId}/content`),
    onSuccess: () => {
      toast.success('Content deleted');
      setExpandedKey(null);
      qc.invalidateQueries({ queryKey: ['admin-reports'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dismissMutation = useMutation({
    mutationFn: ({ targetType, targetId }: { targetType: TargetType; targetId: string }) =>
      api.post<{ ok: true }>(`/admin/reports/${targetType}/${targetId}/dismiss`),
    onSuccess: () => {
      toast.success('Reports dismissed');
      setExpandedKey(null);
      qc.invalidateQueries({ queryKey: ['admin-reports'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">Reports</h1>
          <span className="text-sm text-gray-500">{total} item{total !== 1 ? 's' : ''} with reports</span>
        </div>

        {isLoading && <div className="text-sm text-gray-500">Loading…</div>}

        {!isLoading && data?.data.length === 0 && (
          <div className="text-sm text-gray-500 py-8 text-center">No reported content.</div>
        )}

        <div className="space-y-2">
          {data?.data.map((item) => {
            const key = `${item.targetType}::${item.targetId}`;
            const isExpanded = expandedKey === key;

            return (
              <div key={key} className="border rounded-lg bg-white overflow-hidden">
                {/* Row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedKey(isExpanded ? null : key)}
                >
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${TYPE_COLORS[item.targetType]}`}>
                    {TYPE_LABELS[item.targetType]}
                  </span>
                  <span className="text-sm text-gray-600 shrink-0">{item.playerName}</span>
                  <span className="text-sm text-gray-400 flex-1 truncate">{item.preview}</span>
                  <span className="text-sm font-bold text-red-600 shrink-0">{item.reportCount}</span>
                  <span className="text-xs text-gray-400 shrink-0">{formatCategories(item.categories)}</span>
                  <div className="flex gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100"
                      onClick={() => setConfirmAction({
                        title: 'Delete content?',
                        description: `This ${TYPE_LABELS[item.targetType].toLowerCase()} will be permanently deleted.`,
                        onConfirm: () => deleteMutation.mutate({ targetType: item.targetType, targetId: item.targetId }),
                      })}
                    >
                      Видалити
                    </button>
                    <button
                      className="text-xs px-2 py-1 bg-gray-50 text-gray-600 rounded hover:bg-gray-100"
                      onClick={() => setConfirmAction({
                        title: 'Dismiss reports?',
                        description: 'The content will be kept and all reports cleared.',
                        onConfirm: () => dismissMutation.mutate({ targetType: item.targetType, targetId: item.targetId }),
                      })}
                    >
                      Залишити
                    </button>
                  </div>
                  <span className="text-gray-400 text-sm">{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t px-4 py-3 bg-gray-50 space-y-3">
                    {detail && detail.targetId === item.targetId ? (
                      <>
                        <div className="bg-white border rounded p-3">
                          {detail.content.title && (
                            <p className="font-semibold text-sm mb-1">{detail.content.title}</p>
                          )}
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{detail.content.body}</p>
                          <p className="text-xs text-gray-400 mt-1">by {detail.content.playerName}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500">Individual reports ({detail.reports.length})</p>
                          {detail.reports.map(r => (
                            <div key={r.id} className="flex gap-3 text-xs text-gray-500">
                              <span className="font-medium text-gray-700">{r.reporter.playerName}</span>
                              <span className="uppercase">{r.category}</span>
                              <span>{new Date(r.createdAt).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-gray-400">Loading details…</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex gap-2 justify-center pt-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-40"
            >
              ‹ Prev
            </button>
            <span className="px-3 py-1 text-sm text-gray-500">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-40"
            >
              Next ›
            </button>
          </div>
        )}
      </div>

      {confirmAction && (
        <ConfirmDialog
          open={!!confirmAction}
          onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
          title={confirmAction.title}
          description={confirmAction.description}
          onConfirm={() => { confirmAction.onConfirm(); setConfirmAction(null); }}
        />
      )}
    </Layout>
  );
}
```

- [ ] **Step 2: Confirm `ConfirmDialog` props match**

`ConfirmDialog` (`admin/src/components/ConfirmDialog.tsx`) expects: `open`, `onOpenChange`, `title`, `description`, `onConfirm`, `loading?`. The code above uses these correctly — no adjustment needed.

- [ ] **Step 3: Add route to `admin/src/App.tsx`**

Add `import { ReportsPage } from './pages/ReportsPage';` to the imports.

Add this route inside the `<Routes>` block, after the `/forum` route:

```tsx
<Route
  path="/reports"
  element={
    <ProtectedRoute>
      <ReportsPage />
    </ProtectedRoute>
  }
/>
```

- [ ] **Step 4: Add nav link to `admin/src/components/Layout.tsx`**

In the `navLinks` array, add:
```typescript
{ to: '/reports', label: 'Reports' },
```

- [ ] **Step 5: Run admin dev server and verify**

```bash
cd admin && npm run dev
```

Navigate to `/reports`. Confirm the page loads, nav link appears, and the table renders (empty state expected unless test data exists).

- [ ] **Step 6: Commit**

```bash
git add admin/src/pages/ReportsPage.tsx admin/src/App.tsx admin/src/components/Layout.tsx
git commit -m "feat(admin): add Reports page with dismiss and delete actions"
```

---

## Task 6: Mobile ReportStore + i18n Keys

**Files:**
- Create: `src/stores/reportStore.ts`
- Modify: `src/i18n/locales/en/tabs.json`

**Interfaces:**
- Produces:
  - `useReportStore()` with:
    - `submitReport(targetType, targetId, category): Promise<void>` — calls `POST /report`, marks as reported
    - `hasReported(targetType, targetId): boolean` — checks in-memory Set
    - `isSubmitting: boolean`
  - i18n keys: `report.title`, `report.submit`, `report.cancel`, `report.success`, `report.alreadyReported`, `report.error`, `report.category.{spam,insult,advertisement,profanity,threat,other}`

- [ ] **Step 1: Create `src/stores/reportStore.ts`**

```typescript
import { create } from 'zustand';
import { api } from '../services/api';

export type ReportTargetType = 'CHAT_MESSAGE' | 'FORUM_POST' | 'FORUM_COMMENT';
export type ReportCategory = 'SPAM' | 'INSULT' | 'ADVERTISEMENT' | 'PROFANITY' | 'THREAT' | 'OTHER';

interface ReportState {
  reportedKeys: Set<string>;
  isSubmitting: boolean;
}

interface ReportActions {
  submitReport(targetType: ReportTargetType, targetId: string, category: ReportCategory): Promise<void>;
  hasReported(targetType: ReportTargetType, targetId: string): boolean;
}

export const useReportStore = create<ReportState & ReportActions>((set, get) => ({
  reportedKeys: new Set(),
  isSubmitting: false,

  hasReported: (targetType, targetId) =>
    get().reportedKeys.has(`${targetType}:${targetId}`),

  submitReport: async (targetType, targetId, category) => {
    set({ isSubmitting: true });
    try {
      await api.post('/report', { targetType, targetId, category });
      const key = `${targetType}:${targetId}`;
      set(state => ({ reportedKeys: new Set([...state.reportedKeys, key]) }));
    } finally {
      set({ isSubmitting: false });
    }
  },
}));
```

- [ ] **Step 2: Add report keys to `src/i18n/locales/en/tabs.json`**

Add a new `"report"` section at the root level of the JSON, before the closing `}`:

```json
"report": {
  "title": "Report Content",
  "submit": "Send Report",
  "cancel": "Cancel",
  "success": "Report submitted",
  "alreadyReported": "You already reported this",
  "error": "Failed to submit report",
  "category": {
    "spam": "Spam",
    "insult": "Insult",
    "advertisement": "Advertisement",
    "profanity": "Profanity",
    "threat": "Threat",
    "other": "Other"
  }
}
```

Also add to the `"chat"` section:
```json
"actionReport": "Report"
```

Also add to the `"forum"` section:
```json
"actionReport": "Report"
```

- [ ] **Step 3: Commit**

```bash
git add src/stores/reportStore.ts src/i18n/locales/en/tabs.json
git commit -m "feat(mobile): add ReportStore and i18n keys"
```

---

## Task 7: Mobile ReportSheet + Chat Wiring

**Files:**
- Create: `src/components/ReportSheet.tsx`
- Modify: `src/components/ChatMessage.tsx` — add `canReport` prop
- Modify: `app/chat-screen.tsx` — add Report option to action sheet

**Interfaces:**
- Consumes: `useReportStore` (Task 6), `useTranslation('tabs')`
- Produces:
  - `<ReportSheet visible targetType targetId onClose onSuccess onAlreadyReported />`
  - `ChatMessage` now accepts `canReport?: boolean` prop; fires `onLongPress` when `canReport` is true even if not own

- [ ] **Step 1: Create `src/components/ReportSheet.tsx`**

```typescript
import React, { useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useReportStore, type ReportTargetType, type ReportCategory } from '../stores/reportStore';

interface Props {
  visible: boolean;
  targetType: ReportTargetType;
  targetId: string;
  onClose: () => void;
  onSuccess: () => void;
  onAlreadyReported: () => void;
}

const CATEGORIES: ReportCategory[] = ['SPAM', 'INSULT', 'ADVERTISEMENT', 'PROFANITY', 'THREAT', 'OTHER'];

export default function ReportSheet({ visible, targetType, targetId, onClose, onSuccess, onAlreadyReported }: Props) {
  const { t } = useTranslation('tabs');
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const [selected, setSelected] = useState<ReportCategory | null>(null);
  const { submitReport, isSubmitting } = useReportStore();

  const handleSubmit = async () => {
    if (!selected || isSubmitting) return;
    try {
      await submitReport(targetType, targetId, selected);
      setSelected(null);
      onClose();
      onSuccess();
    } catch (e: any) {
      onClose();
      if (e?.message?.includes('Already reported') || e?.message?.includes('already')) {
        onAlreadyReported();
      }
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }, isDark && { backgroundColor: '#2A2F38' }]}
          onStartShouldSetResponder={() => true}
        >
          <Text style={[styles.title, isDark && { color: '#DDE8D8' }]}>{t('report.title')}</Text>
          {CATEGORIES.map(cat => (
            <Pressable key={cat} style={styles.option} onPress={() => setSelected(cat)}>
              <View style={[styles.radio, selected === cat && styles.radioSelected, isDark && { borderColor: '#5A6470' }]} />
              <Text style={[styles.optionText, isDark && { color: '#DDE8D8' }]}>
                {t(`report.category.${cat.toLowerCase()}`)}
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={[styles.submitBtn, (!selected || isSubmitting) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!selected || isSubmitting}
          >
            <Text style={styles.submitBtnText}>{t('report.submit')}</Text>
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={[styles.cancelBtnText, isDark && { color: '#8A9A80' }]}>{t('report.cancel')}</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 4,
  },
  title: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
    color: '#2A3344',
    marginBottom: 12,
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ccc',
  },
  radioSelected: {
    borderColor: '#3C9A34',
    backgroundColor: '#3C9A34',
  },
  optionText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: '#2A3344',
  },
  submitBtn: {
    backgroundColor: '#3C9A34',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
    color: '#fff',
  },
  cancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: '#999',
  },
});
```

- [ ] **Step 2: Edit `src/components/ChatMessage.tsx` — add `canReport` prop**

Add `canReport?: boolean` to the `Props` interface:
```typescript
interface Props {
  message: ChatMessageType;
  isOwn: boolean;
  isAdmin: boolean;
  canReport?: boolean;
  onLongPress?: (id: string, body: string, isOwn: boolean) => void;
  onAvatarPress?: () => void;
}
```

In the component body, change `canInteract` from:
```typescript
const canInteract = isOwn || isAdmin;
```
to:
```typescript
const canInteract = isOwn || isAdmin || !!canReport;
```

Destructure `canReport` from props:
```typescript
export default function ChatMessage({ message, isOwn, isAdmin, canReport, onLongPress, onAvatarPress }: Props) {
```

- [ ] **Step 3: Edit `app/chat-screen.tsx` — add report state and handler**

Add import at the top:
```typescript
import ReportSheet from '../src/components/ReportSheet';
import type { ReportTargetType } from '../src/stores/reportStore';
```

Add state (alongside existing state declarations):
```typescript
const [reportTarget, setReportTarget] = useState<{ type: ReportTargetType; id: string } | null>(null);
```

Add handler (alongside `handleActionEdit` and `handleActionDelete`):
```typescript
const handleActionReport = () => {
  if (!selectedMessage) return;
  const { id } = selectedMessage;
  setSelectedMessage(null);
  setReportTarget({ type: 'CHAT_MESSAGE', id });
};
```

- [ ] **Step 4: Edit `app/chat-screen.tsx` — update ChatMessage render call to pass `canReport`**

In the `FlatList` `renderItem`, change:
```tsx
<ChatMessage
  message={item}
  isOwn={item.playerId === player?.id}
  isAdmin={player?.isAdmin === true}
  onLongPress={handleLongPress}
  onAvatarPress={() => handleAvatarPress(item.playerId)}
/>
```
to:
```tsx
<ChatMessage
  message={item}
  isOwn={item.playerId === player?.id}
  isAdmin={player?.isAdmin === true}
  canReport={item.playerId !== player?.id && isAuthenticated}
  onLongPress={handleLongPress}
  onAvatarPress={() => handleAvatarPress(item.playerId)}
/>
```

- [ ] **Step 5: Edit `app/chat-screen.tsx` — add Report button to action sheet Modal**

Inside the action sheet `<View>` (inside the `<Modal>`), add the Report option after the Edit option and before the Delete option:

```tsx
{!selectedMessage?.isOwn && isAuthenticated && (
  <Pressable style={styles.sheetItem} onPress={handleActionReport}>
    <Text style={[styles.sheetItemText, isDark && { color: '#DDE8D8' }]}>⚑ {t('chat.actionReport')}</Text>
  </Pressable>
)}
```

- [ ] **Step 6: Edit `app/chat-screen.tsx` — render ReportSheet at the bottom of the screen**

Add just before the closing `</View>` of the root container (after the existing action sheet `<Modal>`):

```tsx
{reportTarget && (
  <ReportSheet
    visible={!!reportTarget}
    targetType={reportTarget.type}
    targetId={reportTarget.id}
    onClose={() => setReportTarget(null)}
    onSuccess={() => Alert.alert(t('report.success'))}
    onAlreadyReported={() => Alert.alert(t('report.alreadyReported'))}
  />
)}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit --project tsconfig.json 2>&1 | head -30
```

Fix any type errors before continuing.

- [ ] **Step 8: Commit**

```bash
git add src/components/ReportSheet.tsx src/components/ChatMessage.tsx app/chat-screen.tsx
git commit -m "feat(mobile): add ReportSheet and chat message reporting"
```

---

## Task 8: Mobile Forum Wiring

**Files:**
- Modify: `src/components/ForumPostRow.tsx` — add optional `onReport` prop + ⋯ button
- Modify: `app/forum-category.tsx` — pass `onReport` + render ReportSheet
- Modify: `app/forum-post.tsx` — report button for post header + Report in comment action sheet

**Interfaces:**
- Consumes: `ReportSheet` (Task 7), `useReportStore` (Task 6), `useAuthStore`
- Produces: All three forum entry points (post list row, post detail, comment long-press) support reporting

- [ ] **Step 1: Edit `src/components/ForumPostRow.tsx` — add `onReport` prop and ⋯ button**

Add `onReport?: () => void` to the `Props` interface:
```typescript
interface Props {
  post: ForumPost;
  onPress: () => void;
  onReport?: () => void;
}
```

Destructure `onReport` in the component signature:
```typescript
export default function ForumPostRow({ post, onPress, onReport }: Props) {
```

Replace the existing `<Text style={[styles.chevron, ...]}>›</Text>` at the end of the JSX with:
```tsx
{onReport ? (
  <Pressable onPress={onReport} hitSlop={12} style={styles.moreBtn}>
    <Text style={[styles.moreIcon, isDark && { color: '#5A6470' }]}>•••</Text>
  </Pressable>
) : (
  <Text style={[styles.chevron, isDark && { color: '#5A6470' }]}>›</Text>
)}
```

Add the new styles at the end of the `StyleSheet.create` call:
```typescript
moreBtn: { padding: 4 },
moreIcon: { fontSize: 14, color: '#ccc', letterSpacing: 1 },
```

- [ ] **Step 2: Edit `app/forum-category.tsx` — add report state and pass `onReport` to rows**

Add imports:
```typescript
import ReportSheet from '../src/components/ReportSheet';
import type { ReportTargetType } from '../src/stores/reportStore';
```

Add `player` from `useAuthStore` (it's already imported — check if `player` is already destructured; if not, add it):
```typescript
const player = useAuthStore(s => s.player);
```

Add state (alongside existing state):
```typescript
const [reportTarget, setReportTarget] = useState<{ type: ReportTargetType; id: string } | null>(null);
```

In the `FlatList` `renderItem`, find the `ForumPostRow` usage and add `onReport`:
```tsx
<ForumPostRow
  post={item}
  onPress={() => router.push(`/forum-post?postId=${item.id}&category=${cat}`)}
  onReport={
    isAuthenticated && item.playerId !== player?.id
      ? () => setReportTarget({ type: 'FORUM_POST', id: item.id })
      : undefined
  }
/>
```

Add `ReportSheet` before the closing `</View>` of the return:
```tsx
{reportTarget && (
  <ReportSheet
    visible={!!reportTarget}
    targetType={reportTarget.type}
    targetId={reportTarget.id}
    onClose={() => setReportTarget(null)}
    onSuccess={() => Alert.alert(t('report.success'))}
    onAlreadyReported={() => Alert.alert(t('report.alreadyReported'))}
  />
)}
```

Add `Alert` to the React Native import if it's not already there.

- [ ] **Step 3: Edit `app/forum-post.tsx` — add report state**

Add imports:
```typescript
import ReportSheet from '../src/components/ReportSheet';
import type { ReportTargetType } from '../src/stores/reportStore';
```

Add state (alongside existing state):
```typescript
const [reportTarget, setReportTarget] = useState<{ type: ReportTargetType; id: string } | null>(null);
```

- [ ] **Step 4: Edit `app/forum-post.tsx` — add report button for non-owner posts**

In the `ListHeader` JSX, find the post meta section. After the existing `{canModifyPost && (...)}` block, add:

```tsx
{!isPostOwn && !isAdmin && isAuthenticated && (
  <Pressable
    onPress={() => setReportTarget({ type: 'FORUM_POST', id: postId })}
    style={styles.postMenuBtn}
    hitSlop={8}
  >
    <Text style={[styles.postMenuIcon, isDark && { color: '#8A9A80' }]}>⚑</Text>
  </Pressable>
)}
```

- [ ] **Step 5: Edit `app/forum-post.tsx` — add Report to comment action sheet**

In the comment action sheet `<Modal>`, inside the `<View>` with `sheetItem` items, add after the Edit item and before the Delete item:

```tsx
{!selectedItem?.isOwn && isAuthenticated && (
  <Pressable
    style={styles.sheetItem}
    onPress={() => {
      if (!selectedItem) return;
      const id = selectedItem.id;
      setSelectedItem(null);
      setReportTarget({ type: 'FORUM_COMMENT', id });
    }}
  >
    <Text style={[styles.sheetText, isDark && { color: '#DDE8D8' }]}>⚑ {t('forum.actionReport')}</Text>
  </Pressable>
)}
```

- [ ] **Step 6: Edit `app/forum-post.tsx` — render ReportSheet**

Add just before the closing `</View>` of the root return (after the edit post Modal):

```tsx
{reportTarget && (
  <ReportSheet
    visible={!!reportTarget}
    targetType={reportTarget.type}
    targetId={reportTarget.id}
    onClose={() => setReportTarget(null)}
    onSuccess={() => Alert.alert(t('report.success'))}
    onAlreadyReported={() => Alert.alert(t('report.alreadyReported'))}
  />
)}
```

- [ ] **Step 7: Run all server tests one final time**

```bash
cd server && npx jest --no-coverage
```

Expected: All PASS.

- [ ] **Step 8: Verify TypeScript compiles for mobile**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit --project tsconfig.json 2>&1 | head -30
```

Fix any type errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/ForumPostRow.tsx app/forum-category.tsx app/forum-post.tsx
git commit -m "feat(mobile): wire forum post and comment reporting"
```
