import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, HttpException, NotFoundException } from '@nestjs/common';
import { ForumService } from '../forum.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ForumService', () => {
  let service: ForumService;
  let prisma: Record<string, any>;

  const player = { playerName: 'Alice', playerLevel: 10 };
  const basePost = {
    id: 'post-1', playerId: 'p1', playerName: 'Alice', playerLevel: 10,
    category: 'GENERAL', title: 'Hello', body: 'World',
    isPinned: false, isClosed: false, commentCount: 0,
    createdAt: new Date(), updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      player: { findUnique: jest.fn().mockResolvedValue(player) },
      forumPost: {
        findMany: jest.fn().mockResolvedValue([basePost]),
        findUnique: jest.fn().mockResolvedValue(basePost),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(basePost),
        update: jest.fn().mockResolvedValue(basePost),
        count: jest.fn().mockResolvedValue(1),
      },
      forumComment: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'c1', body: 'nice', postId: 'post-1', playerId: 'p1', playerName: 'Alice', playerLevel: 10, createdAt: new Date(), updatedAt: new Date() }),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
      forumPostRead: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn().mockImplementation(async (ops: any[]) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ForumService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<ForumService>(ForumService);
  });

  describe('getUnreadCounts', () => {
    it('returns zero counts when player has no read records', async () => {
      prisma.forumPost.findMany.mockResolvedValue([
        { id: 'p1', category: 'GENERAL', commentCount: 2 },
        { id: 'p2', category: 'NEWS', commentCount: 1 },
      ]);
      prisma.forumPostRead.findMany.mockResolvedValue([]);
      const result = await service.getUnreadCounts('player-1');
      expect(result.GENERAL).toBe(1);
      expect(result.NEWS).toBe(1);
      expect(result.HELP).toBe(0);
    });

    it('marks post as read when lastSeenCommentCount equals commentCount', async () => {
      prisma.forumPost.findMany.mockResolvedValue([{ id: 'p1', category: 'GENERAL', commentCount: 3 }]);
      prisma.forumPostRead.findMany.mockResolvedValue([{ postId: 'p1', lastSeenCommentCount: 3 }]);
      const result = await service.getUnreadCounts('player-1');
      expect(result.GENERAL).toBe(0);
    });
  });

  describe('getPosts', () => {
    it('returns posts with isUnread=true when no read record exists', async () => {
      prisma.forumPost.count.mockResolvedValue(1);
      prisma.forumPost.findMany.mockResolvedValue([{ ...basePost, commentCount: 1 }]);
      prisma.forumPostRead.findMany.mockResolvedValue([]);
      const result = await service.getPosts('GENERAL', 1, 20, 'player-1');
      expect(result.posts[0].isUnread).toBe(true);
      expect(result.hasMore).toBe(false);
    });

    it('returns posts with isUnread=false when all comments seen', async () => {
      prisma.forumPost.findMany.mockResolvedValue([{ ...basePost, id: 'p1', commentCount: 5 }]);
      prisma.forumPostRead.findMany.mockResolvedValue([{ postId: 'p1', lastSeenCommentCount: 5 }]);
      const result = await service.getPosts('GENERAL', 1, 20, 'player-1');
      expect(result.posts[0].isUnread).toBe(false);
    });
  });

  describe('createPost', () => {
    it('creates a post and returns it with isUnread=false', async () => {
      const result = await service.createPost('p1', 'GENERAL', 'Title', 'Body text', false);
      expect(prisma.forumPost.create).toHaveBeenCalled();
      expect(result.isUnread).toBe(false);
    });

    it('throws 403 when non-admin tries to post in NEWS', async () => {
      await expect(service.createPost('p1', 'NEWS', 'T', 'B', false))
        .rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.forumPost.create).not.toHaveBeenCalled();
    });

    it('allows admin to post in NEWS', async () => {
      await expect(service.createPost('p1', 'NEWS', 'T', 'B', true)).resolves.toBeDefined();
    });

    it('throws BadRequestException when title exceeds 200 chars', async () => {
      await expect(service.createPost('p1', 'GENERAL', 'x'.repeat(201), 'B', false))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws 429 when player posts within 60 seconds', async () => {
      prisma.forumPost.findFirst.mockResolvedValue({ id: 'prev', createdAt: new Date(Date.now() - 5000) });
      const err = await service.createPost('p1', 'GENERAL', 'T', 'B', false).catch(e => e);
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(429);
    });

    it('throws NotFoundException when player not found', async () => {
      prisma.player.findUnique.mockResolvedValue(null);
      await expect(service.createPost('ghost', 'GENERAL', 'T', 'B', false))
        .rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updatePost', () => {
    it('owner can update their post and gets actual isUnread state', async () => {
      prisma.forumPost.findFirst.mockResolvedValue({ playerId: 'p1' });
      prisma.forumPost.update.mockResolvedValue({ ...basePost, title: 'New Title' });
      prisma.forumPostRead.findUnique.mockResolvedValue({ lastSeenCommentCount: 0 });
      const result = await service.updatePost('post-1', 'New Title', 'Body text', 'p1', false);
      expect(result.title).toBe('New Title');
      expect(result.isUnread).toBe(false);
    });

    it('returns isUnread=true when no read record exists', async () => {
      prisma.forumPost.findFirst.mockResolvedValue({ playerId: 'p1' });
      prisma.forumPost.update.mockResolvedValue({ ...basePost, commentCount: 1 });
      prisma.forumPostRead.findUnique.mockResolvedValue(null);
      const result = await service.updatePost('post-1', 'T', 'B', 'p1', false);
      expect(result.isUnread).toBe(true);
    });

    it('throws ForbiddenException when non-owner tries to update', async () => {
      prisma.forumPost.findFirst.mockResolvedValue({ playerId: 'other' });
      await expect(service.updatePost('post-1', 'T', 'B', 'attacker', false))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException when post not found', async () => {
      prisma.forumPost.findFirst.mockResolvedValue(null);
      await expect(service.updatePost('missing', 'T', 'B', 'p1', false))
        .rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deletePost', () => {
    it('owner can soft-delete their own post', async () => {
      prisma.forumPost.findFirst.mockResolvedValue({ playerId: 'p1' });
      const result = await service.deletePost('post-1', 'p1', false);
      expect(result).toEqual({ success: true });
      expect(prisma.forumPost.update).toHaveBeenCalledWith({
        where: { id: 'post-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('admin can delete any post', async () => {
      prisma.forumPost.findFirst.mockResolvedValue({ playerId: 'other' });
      await expect(service.deletePost('post-1', 'admin', true)).resolves.toEqual({ success: true });
    });

    it('throws ForbiddenException when non-owner tries to delete', async () => {
      prisma.forumPost.findFirst.mockResolvedValue({ playerId: 'p1' });
      await expect(service.deletePost('post-1', 'attacker', false)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('pinPost', () => {
    it('pins a post and returns actual isUnread state (read record exists)', async () => {
      prisma.forumPost.findFirst.mockResolvedValue({ id: 'post-1' });
      prisma.forumPost.update.mockResolvedValue({ ...basePost, isPinned: true });
      prisma.forumPostRead.findUnique.mockResolvedValue({ lastSeenCommentCount: 0 });
      const result = await service.pinPost('post-1', true, 'p1');
      expect(result.isPinned).toBe(true);
      expect(result.isUnread).toBe(false);
    });

    it('returns isUnread=true when no read record exists and commentCount > 0', async () => {
      prisma.forumPost.findFirst.mockResolvedValue({ id: 'post-1' });
      prisma.forumPost.update.mockResolvedValue({ ...basePost, isPinned: true, commentCount: 1 });
      prisma.forumPostRead.findUnique.mockResolvedValue(null);
      const result = await service.pinPost('post-1', true, 'p1');
      expect(result.isUnread).toBe(true);
    });

    it('throws NotFoundException when post not found', async () => {
      prisma.forumPost.findFirst.mockResolvedValue(null);
      await expect(service.pinPost('missing', true, 'p1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('closePost', () => {
    it('closes a post and returns actual isUnread state (read record exists)', async () => {
      prisma.forumPost.findFirst.mockResolvedValue({ id: 'post-1' });
      prisma.forumPost.update.mockResolvedValue({ ...basePost, isClosed: true });
      prisma.forumPostRead.findUnique.mockResolvedValue({ lastSeenCommentCount: 0 });
      const result = await service.closePost('post-1', true, 'p1');
      expect(result.isClosed).toBe(true);
      expect(result.isUnread).toBe(false);
    });

    it('returns isUnread=true when no read record and commentCount > 0', async () => {
      prisma.forumPost.findFirst.mockResolvedValue({ id: 'post-1' });
      prisma.forumPost.update.mockResolvedValue({ ...basePost, isClosed: true, commentCount: 3 });
      prisma.forumPostRead.findUnique.mockResolvedValue(null);
      const result = await service.closePost('post-1', true, 'p1');
      expect(result.isUnread).toBe(true);
    });

    it('throws NotFoundException when post not found', async () => {
      prisma.forumPost.findFirst.mockResolvedValue(null);
      await expect(service.closePost('missing', true, 'p1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('markRead', () => {
    it('upserts ForumPostRead with current commentCount', async () => {
      prisma.forumPost.findFirst.mockResolvedValue({ commentCount: 7 });
      await service.markRead('player-1', 'post-1');
      expect(prisma.forumPostRead.upsert).toHaveBeenCalledWith({
        where: { playerId_postId: { playerId: 'player-1', postId: 'post-1' } },
        create: { playerId: 'player-1', postId: 'post-1', lastSeenCommentCount: 7 },
        update: { lastSeenCommentCount: 7 },
      });
    });
  });

  describe('createComment', () => {
    it('creates comment and increments commentCount in transaction', async () => {
      prisma.forumPost.findFirst.mockResolvedValue({ isClosed: false });
      await service.createComment('p1', 'post-1', 'Great post!');
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('throws ForbiddenException when post is closed', async () => {
      prisma.forumPost.findFirst.mockResolvedValue({ isClosed: true });
      await expect(service.createComment('p1', 'post-1', 'oops'))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws 429 when player comments within 10 seconds', async () => {
      prisma.forumPost.findFirst.mockResolvedValue({ isClosed: false });
      prisma.forumComment.findFirst.mockResolvedValue({ id: 'prev', createdAt: new Date() });
      const err = await service.createComment('p1', 'post-1', 'spam').catch(e => e);
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(429);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when comment exceeds 1000 chars', async () => {
      prisma.forumPost.findFirst.mockResolvedValue({ isClosed: false });
      await expect(service.createComment('p1', 'post-1', 'x'.repeat(1001)))
        .rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('deleteComment', () => {
    it('owner can soft-delete and decrements commentCount', async () => {
      prisma.forumComment.findFirst.mockResolvedValue({ playerId: 'p1', postId: 'post-1' });
      await service.deleteComment('c1', 'p1', false);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('throws ForbiddenException when non-owner tries to delete', async () => {
      prisma.forumComment.findFirst.mockResolvedValue({ playerId: 'p1', postId: 'post-1' });
      await expect(service.deleteComment('c1', 'attacker', false)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
