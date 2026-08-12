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

  describe('getReportDetail', () => {
    it('returns content and individual reports on success', async () => {
      const createdAt = new Date('2026-08-01T10:00:00Z');
      prisma.chatMessage.findUnique.mockResolvedValue({ playerName: 'Alice', body: 'Hello world' });
      prisma.report.findMany.mockResolvedValue([
        { id: 'r-1', category: 'SPAM', createdAt, reporter: { playerName: 'Bob' } },
      ]);

      const result = await service.getReportDetail('CHAT_MESSAGE', 'msg-1');

      expect(result).toEqual({
        targetType: 'CHAT_MESSAGE',
        targetId: 'msg-1',
        content: { playerName: 'Alice', body: 'Hello world' },
        reports: [{ id: 'r-1', category: 'SPAM', createdAt, reporter: { playerName: 'Bob' } }],
      });
      expect(prisma.report.findMany).toHaveBeenCalledWith({
        where: { targetType: 'CHAT_MESSAGE', targetId: 'msg-1' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, category: true, createdAt: true, reporter: { select: { playerName: true } } },
      });
    });

    it('throws NotFoundException when target does not exist', async () => {
      prisma.chatMessage.findUnique.mockResolvedValue(null);

      await expect(service.getReportDetail('CHAT_MESSAGE', 'msg-999'))
        .rejects.toThrow(NotFoundException);
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
      prisma.forumPost.findFirst.mockResolvedValue({ id: 'post-1' });
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
