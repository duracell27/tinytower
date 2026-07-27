import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, HttpException, NotFoundException } from '@nestjs/common';
import { ChatService } from '../chat.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ChatService', () => {
  let chatService: ChatService;
  let prisma: Record<string, any>;

  const mockMessages = [
    { id: 'msg-1', playerId: 'p1', playerName: 'Alice', playerLevel: 5,  country: null, body: 'Hello', createdAt: new Date('2026-07-21T10:00:00Z'), deletedAt: null },
    { id: 'msg-2', playerId: 'p2', playerName: 'Bob',   playerLevel: 12, country: 'UA', body: 'Hi',    createdAt: new Date('2026-07-21T10:01:00Z'), deletedAt: null },
  ];

  beforeEach(async () => {
    prisma = {
      player: {
        findUnique: jest.fn().mockResolvedValue({ playerName: 'Alice' }),
      },
      chatMessage: {
        findMany:  jest.fn().mockResolvedValue(mockMessages),
        create:    jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ playerId: 'p1' }),
        update:    jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn(),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    chatService = module.get<ChatService>(ChatService);
  });

  describe('fetchMessages', () => {
    it('returns global messages (country IS NULL) when no country given', async () => {
      const result = await chatService.fetchMessages();
      expect(result).toEqual(mockMessages);
      expect(prisma.chatMessage.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null, country: null },
        orderBy: { createdAt: 'asc' },
        take: 100,
        select: {
          id: true,
          playerId: true,
          playerName: true,
          playerLevel: true,
          country: true,
          body: true,
          createdAt: true,
        },
      });
    });

    it('returns country messages when country given', async () => {
      await chatService.fetchMessages('UA');
      expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null, country: 'UA' } }),
      );
    });
  });

  describe('sendMessage', () => {
    const playerId = 'player-1';

    it('creates and returns the message', async () => {
      const created = { id: 'new-id', playerId, playerName: 'Alice', playerLevel: 1, country: null, body: 'Hello world', createdAt: new Date() };
      prisma.chatMessage.findFirst.mockResolvedValue(null);
      prisma.chatMessage.create.mockResolvedValue(created);

      const result = await chatService.sendMessage(playerId, 'Hello world');
      expect(result).toEqual(created);
      expect(prisma.chatMessage.create).toHaveBeenCalledWith({
        data: { playerId, playerName: 'Alice', playerLevel: 1, body: 'Hello world', country: null },
        select: { id: true, playerId: true, playerName: true, playerLevel: true, country: true, body: true, createdAt: true },
      });
    });

    it('includes country when provided', async () => {
      prisma.chatMessage.findFirst.mockResolvedValue(null);
      prisma.chatMessage.create.mockResolvedValue({});
      await chatService.sendMessage(playerId, 'Hi', 5, 'UA');
      expect(prisma.chatMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ country: 'UA' }) }),
      );
    });

    it('throws BadRequestException when body exceeds 300 chars', async () => {
      await expect(
        chatService.sendMessage(playerId, 'a'.repeat(301)),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.chatMessage.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when player does not exist', async () => {
      prisma.player.findUnique.mockResolvedValue(null);
      prisma.chatMessage.findFirst.mockResolvedValue(null);
      await expect(
        chatService.sendMessage(playerId, 'Hello'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.chatMessage.create).not.toHaveBeenCalled();
    });

    it('throws 429 when player posts within 3 seconds', async () => {
      prisma.chatMessage.findFirst.mockResolvedValue({
        id: 'prev', createdAt: new Date(Date.now() - 1000),
      });
      const err = await chatService.sendMessage(playerId, 'spam').catch(e => e);
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(429);
    });
  });

  describe('deleteMessage', () => {
    it('owner can soft-delete their own message', async () => {
      prisma.chatMessage.findUnique.mockResolvedValue({ playerId: 'p1' });
      const result = await chatService.deleteMessage('msg-1', 'p1', false);
      expect(result).toEqual({ success: true });
      expect(prisma.chatMessage.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('admin can delete any message', async () => {
      prisma.chatMessage.findUnique.mockResolvedValue({ playerId: 'p2' });
      const result = await chatService.deleteMessage('msg-2', 'admin-id', true);
      expect(result).toEqual({ success: true });
    });

    it('throws ForbiddenException when non-owner tries to delete', async () => {
      prisma.chatMessage.findUnique.mockResolvedValue({ playerId: 'p1' });
      await expect(
        chatService.deleteMessage('msg-1', 'other-player', false),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.chatMessage.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when message does not exist or already deleted', async () => {
      prisma.chatMessage.findUnique.mockResolvedValue(null);
      await expect(
        chatService.deleteMessage('nonexistent-id', 'p1', false),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateMessage', () => {
    it('owner can edit their own message', async () => {
      prisma.chatMessage.findUnique.mockResolvedValue({ playerId: 'p1' });
      const updated = { id: 'msg-1', body: 'Edited', playerId: 'p1', playerName: 'Alice', playerLevel: 5, country: null, createdAt: new Date() };
      prisma.chatMessage.update.mockResolvedValue(updated);
      const result = await chatService.updateMessage('msg-1', 'Edited', 'p1');
      expect(result).toEqual(updated);
      expect(prisma.chatMessage.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: { body: 'Edited' },
        select: { id: true, playerId: true, playerName: true, playerLevel: true, country: true, body: true, createdAt: true },
      });
    });

    it('throws ForbiddenException when non-owner tries to edit', async () => {
      prisma.chatMessage.findUnique.mockResolvedValue({ playerId: 'p1' });
      await expect(
        chatService.updateMessage('msg-1', 'Hacked', 'other-player'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException when message does not exist', async () => {
      prisma.chatMessage.findUnique.mockResolvedValue(null);
      await expect(
        chatService.updateMessage('ghost-id', 'text', 'p1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('cleanupOldMessages', () => {
    it('hard-deletes messages older than 24 hours', async () => {
      prisma.chatMessage.deleteMany.mockResolvedValue({ count: 3 });
      await chatService.cleanupOldMessages();
      expect(prisma.chatMessage.deleteMany).toHaveBeenCalledWith({
        where: { createdAt: { lt: expect.any(Date) } },
      });
      const cutoff = (prisma.chatMessage.deleteMany.mock.calls[0][0] as any).where.createdAt.lt as Date;
      expect(Date.now() - cutoff.getTime()).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 100);
    });
  });
});
