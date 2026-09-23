import { Test } from '@nestjs/testing';
import { CityChatService } from '../city-chat.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ForbiddenException, NotFoundException, HttpException } from '@nestjs/common';

const mockPrisma = {
  cityMembership: { findUnique: jest.fn(), update: jest.fn() },
  cityChatMessage: {
    count: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  player: { findUnique: jest.fn() },
};

describe('CityChatService', () => {
  let service: CityChatService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      providers: [
        CityChatService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = mod.get(CityChatService);
  });

  describe('getMessages', () => {
    it('throws ForbiddenException when player is not a member', async () => {
      mockPrisma.cityMembership.findUnique.mockResolvedValue(null);
      await expect(service.getMessages('city1', 'player1', 1)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when player is in a different city', async () => {
      mockPrisma.cityMembership.findUnique.mockResolvedValue({ cityId: 'other', role: 'CITIZEN', cityChatLastReadAt: new Date() });
      await expect(service.getMessages('city1', 'player1', 1)).rejects.toThrow(ForbiddenException);
    });

    it('returns paginated messages for a member', async () => {
      mockPrisma.cityMembership.findUnique.mockResolvedValue({ cityId: 'city1', role: 'CITIZEN', cityChatLastReadAt: new Date() });
      mockPrisma.cityChatMessage.count.mockResolvedValue(17);
      mockPrisma.cityChatMessage.findMany.mockResolvedValue([
        { id: 'm1', cityId: 'city1', playerId: 'p1', playerName: 'Alice', playerLevel: 5, playerRole: 'CITIZEN', body: 'hi', mentionedPlayerId: null, mentionedName: null, createdAt: new Date('2026-01-01T00:00:00Z') },
      ]);
      const result = await service.getMessages('city1', 'player1', 1);
      expect(result.total).toBe(17);
      expect(result.totalPages).toBe(2);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].createdAt).toBe(new Date('2026-01-01T00:00:00Z').toISOString());
    });
  });

  describe('sendMessage', () => {
    it('throws ForbiddenException when sender is not a member', async () => {
      mockPrisma.cityMembership.findUnique.mockResolvedValue(null);
      await expect(service.sendMessage('city1', 'player1', 'hello')).rejects.toThrow(ForbiddenException);
    });

    it('throws 429 when cooldown is active', async () => {
      mockPrisma.cityMembership.findUnique.mockResolvedValue({ cityId: 'city1', role: 'CITIZEN', cityChatLastReadAt: new Date() });
      mockPrisma.player.findUnique.mockResolvedValue({ playerName: 'Alice', playerLevel: 5 });
      mockPrisma.cityChatMessage.findFirst.mockResolvedValue({ id: 'recent' });
      await expect(service.sendMessage('city1', 'player1', 'hello')).rejects.toThrow(HttpException);
    });

    it('throws ForbiddenException when mentionedPlayer is not in same city', async () => {
      mockPrisma.cityMembership.findUnique
        .mockResolvedValueOnce({ cityId: 'city1', role: 'CITIZEN', cityChatLastReadAt: new Date() })
        .mockResolvedValueOnce(null);
      mockPrisma.player.findUnique.mockResolvedValue({ playerName: 'Alice', playerLevel: 5 });
      mockPrisma.cityChatMessage.findFirst.mockResolvedValue(null);
      await expect(service.sendMessage('city1', 'player1', 'hello', 'outsider')).rejects.toThrow(ForbiddenException);
    });

    it('creates a message successfully', async () => {
      mockPrisma.cityMembership.findUnique.mockResolvedValue({ cityId: 'city1', role: 'CITIZEN', cityChatLastReadAt: new Date() });
      mockPrisma.player.findUnique.mockResolvedValue({ playerName: 'Alice', playerLevel: 5 });
      mockPrisma.cityChatMessage.findFirst.mockResolvedValue(null);
      const created = { id: 'new', cityId: 'city1', playerId: 'player1', playerName: 'Alice', playerLevel: 5, playerRole: 'CITIZEN', body: 'hello', mentionedPlayerId: null, mentionedName: null, createdAt: new Date() };
      mockPrisma.cityChatMessage.create.mockResolvedValue(created);
      const result = await service.sendMessage('city1', 'player1', 'hello');
      expect(result.body).toBe('hello');
      expect(result.playerName).toBe('Alice');
      expect(result.playerRole).toBe('CITIZEN');
    });
  });

  describe('hasPendingMention', () => {
    it('returns false when player has no membership', async () => {
      mockPrisma.cityMembership.findUnique.mockResolvedValue(null);
      const result = await service.hasPendingMention('city1', 'player1');
      expect(result).toBe(false);
    });

    it('returns true when there is a new mention after lastReadAt', async () => {
      mockPrisma.cityMembership.findUnique.mockResolvedValue({ cityId: 'city1', cityChatLastReadAt: new Date('2026-01-01') });
      mockPrisma.cityChatMessage.findFirst.mockResolvedValue({ id: 'mention1' });
      const result = await service.hasPendingMention('city1', 'player1');
      expect(result).toBe(true);
    });

    it('returns false when there are no new mentions', async () => {
      mockPrisma.cityMembership.findUnique.mockResolvedValue({ cityId: 'city1', cityChatLastReadAt: new Date('2026-01-01') });
      mockPrisma.cityChatMessage.findFirst.mockResolvedValue(null);
      const result = await service.hasPendingMention('city1', 'player1');
      expect(result).toBe(false);
    });
  });

  describe('readMentions', () => {
    it('does nothing if player has no membership', async () => {
      mockPrisma.cityMembership.findUnique.mockResolvedValue(null);
      await expect(service.readMentions('city1', 'player1')).resolves.toBeUndefined();
      expect(mockPrisma.cityMembership.update).not.toHaveBeenCalled();
    });

    it('updates cityChatLastReadAt', async () => {
      mockPrisma.cityMembership.findUnique.mockResolvedValue({ cityId: 'city1', cityChatLastReadAt: new Date() });
      mockPrisma.cityMembership.update.mockResolvedValue({});
      await service.readMentions('city1', 'player1');
      expect(mockPrisma.cityMembership.update).toHaveBeenCalledWith({
        where: { playerId: 'player1' },
        data: { cityChatLastReadAt: expect.any(Date) },
      });
    });
  });
});
