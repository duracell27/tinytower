import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, HttpException } from '@nestjs/common';
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
      chatMessage: {
        findMany: jest.fn().mockResolvedValue(mockMessages),
        create:   jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
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
    const playerName = 'Alice';

    it('creates and returns the message', async () => {
      const created = { id: 'new-id', playerId, playerName, body: 'Hello world', createdAt: new Date() };
      prisma.chatMessage.findFirst.mockResolvedValue(null);
      prisma.chatMessage.create.mockResolvedValue(created);

      const result = await chatService.sendMessage(playerId, playerName, 'Hello world');
      expect(result).toEqual(created);
      expect(prisma.chatMessage.create).toHaveBeenCalledWith({
        data: { playerId, playerName, body: 'Hello world' },
      });
    });

    it('throws BadRequestException when body exceeds 300 chars', async () => {
      await expect(
        chatService.sendMessage(playerId, playerName, 'a'.repeat(301)),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.chatMessage.create).not.toHaveBeenCalled();
    });

    it('throws 429 when player posts within 3 seconds', async () => {
      prisma.chatMessage.findFirst.mockResolvedValue({
        id: 'prev', createdAt: new Date(Date.now() - 1000), // 1 s ago
      });
      await expect(
        chatService.sendMessage(playerId, playerName, 'spam'),
      ).rejects.toBeInstanceOf(HttpException);
    });
  });

  describe('deleteMessage', () => {
    it('soft-deletes the message and returns success', async () => {
      prisma.chatMessage.updateMany.mockResolvedValue({ count: 1 });
      const result = await chatService.deleteMessage('msg-1');
      expect(result).toEqual({ success: true });
      expect(prisma.chatMessage.updateMany).toHaveBeenCalledWith({
        where: { id: 'msg-1', deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });
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
