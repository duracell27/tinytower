import { Test, TestingModule } from '@nestjs/testing';
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
});
