import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { ChatService } from '../chat.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ChatService', () => {
  let chatService: ChatService;
  let prisma: Record<string, any>;

  const mockMessages = [
    { id: 'msg-1', playerId: 'p1', playerName: 'Alice', body: 'Hello', createdAt: new Date('2026-07-21T10:00:00Z'), deletedAt: null },
    { id: 'msg-2', playerId: 'p2', playerName: 'Bob',   body: 'Hi',    createdAt: new Date('2026-07-21T10:01:00Z'), deletedAt: null },
  ];

  beforeEach(async () => {
    prisma = {
      player: {
        findUnique: jest.fn().mockResolvedValue({ playerName: 'Alice' }),
      },
      chatMessage: {
        findMany: jest.fn().mockResolvedValue(mockMessages),
        create:   jest.fn(),
        findFirst: jest.fn(),
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
    it('returns messages from prisma ordered by createdAt asc', async () => {
      const result = await chatService.fetchMessages();
      expect(result).toEqual(mockMessages);
      expect(prisma.chatMessage.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        take: 100,
        select: {
          id: true,
          playerId: true,
          playerName: true,
          body: true,
          createdAt: true,
        },
      });
    });
  });

  describe('sendMessage', () => {
    const playerId = 'player-1';

    it('creates and returns the message', async () => {
      const created = { id: 'new-id', playerId, playerName: 'Alice', body: 'Hello world', createdAt: new Date() };
      prisma.chatMessage.findFirst.mockResolvedValue(null);
      prisma.chatMessage.create.mockResolvedValue(created);

      const result = await chatService.sendMessage(playerId, 'Hello world');
      expect(result).toEqual(created);
      expect(prisma.chatMessage.create).toHaveBeenCalledWith({
        data: { playerId, playerName: 'Alice', body: 'Hello world' },
        select: { id: true, playerId: true, playerName: true, body: true, createdAt: true },
      });
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
      expect(err.getResponse()).toBe('Chat cooldown: please wait before sending another message');
    });
  });

  describe('deleteMessage', () => {
    it('soft-deletes the message and returns success', async () => {
      const result = await chatService.deleteMessage('msg-1');
      expect(result).toEqual({ success: true });
      expect(prisma.chatMessage.updateMany).toHaveBeenCalledWith({
        where: { id: 'msg-1', deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('throws NotFoundException when message does not exist or already deleted', async () => {
      prisma.chatMessage.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        chatService.deleteMessage('nonexistent-id'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('cleanupOldMessages', () => {
    it('hard-deletes messages older than 24 hours', async () => {
      prisma.chatMessage.deleteMany.mockResolvedValue({ count: 3 });
      await chatService.cleanupOldMessages();
      expect(prisma.chatMessage.deleteMany).toHaveBeenCalledWith({
        where: {
          createdAt: { lt: expect.any(Date) },
        },
      });
      const callArg = prisma.chatMessage.deleteMany.mock.calls[0][0] as {
        where: { createdAt: { lt: Date } };
      };
      const cutoff = callArg.where.createdAt.lt;
      const diffMs = Date.now() - cutoff.getTime();
      expect(diffMs).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 1000);
      expect(diffMs).toBeLessThan(24 * 60 * 60 * 1000 + 1000);
    });
  });
});
