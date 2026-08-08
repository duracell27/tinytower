import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FriendsService } from '../friends.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('FriendsService', () => {
  let service: FriendsService;
  let prisma: Record<string, any>;

  const baseRequest = {
    id: 'req-1', fromId: 'p1', toId: 'p2',
    status: 'PENDING', createdAt: new Date(), updatedAt: new Date(),
  };
  const player1 = { id: 'p1', playerName: 'Alice', playerLevel: 5, city: null, lastSeenAt: new Date() };
  const player2 = { id: 'p2', playerName: 'Bob', playerLevel: 7, city: 'Kyiv', lastSeenAt: new Date() };

  beforeEach(async () => {
    prisma = {
      friendRequest: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue(baseRequest),
        update: jest.fn().mockResolvedValue({ ...baseRequest, status: 'ACCEPTED' }),
        delete: jest.fn().mockResolvedValue(baseRequest),
      },
      player: {
        findMany: jest.fn().mockResolvedValue([player1, player2]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [FriendsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<FriendsService>(FriendsService);
  });

  describe('getStatus', () => {
    it('returns none when no request exists', async () => {
      const result = await service.getStatus('p1', 'p2');
      expect(result.status).toBe('none');
      expect(result.requestId).toBeUndefined();
    });

    it('returns none when same player', async () => {
      const result = await service.getStatus('p1', 'p1');
      expect(result.status).toBe('none');
    });

    it('returns pending_sent when I sent the request', async () => {
      prisma.friendRequest.findFirst.mockResolvedValue({ ...baseRequest, fromId: 'p1', toId: 'p2', status: 'PENDING' });
      const result = await service.getStatus('p1', 'p2');
      expect(result.status).toBe('pending_sent');
      expect(result.requestId).toBe('req-1');
    });

    it('returns pending_received when other player sent the request to me', async () => {
      prisma.friendRequest.findFirst.mockResolvedValue({ ...baseRequest, fromId: 'p2', toId: 'p1', status: 'PENDING' });
      const result = await service.getStatus('p1', 'p2');
      expect(result.status).toBe('pending_received');
      expect(result.requestId).toBe('req-1');
    });

    it('returns friends when request is ACCEPTED', async () => {
      prisma.friendRequest.findFirst.mockResolvedValue({ ...baseRequest, status: 'ACCEPTED' });
      const result = await service.getStatus('p1', 'p2');
      expect(result.status).toBe('friends');
      expect(result.requestId).toBe('req-1');
    });

    it('returns none when request is REJECTED', async () => {
      prisma.friendRequest.findFirst.mockResolvedValue({ ...baseRequest, status: 'REJECTED' });
      const result = await service.getStatus('p1', 'p2');
      expect(result.status).toBe('none');
    });
  });

  describe('sendRequest', () => {
    it('creates a new pending request', async () => {
      const result = await service.sendRequest('p1', 'p2');
      expect(prisma.friendRequest.create).toHaveBeenCalledWith({
        data: { fromId: 'p1', toId: 'p2', status: 'PENDING' },
      });
      expect(result.requestId).toBe('req-1');
    });

    it('throws when sending to yourself', async () => {
      await expect(service.sendRequest('p1', 'p1')).rejects.toThrow(BadRequestException);
    });

    it('throws when already friends', async () => {
      prisma.friendRequest.findFirst.mockResolvedValue({ ...baseRequest, status: 'ACCEPTED' });
      await expect(service.sendRequest('p1', 'p2')).rejects.toThrow(BadRequestException);
    });

    it('throws when pending request already exists', async () => {
      prisma.friendRequest.findFirst.mockResolvedValue({ ...baseRequest, status: 'PENDING' });
      await expect(service.sendRequest('p1', 'p2')).rejects.toThrow(BadRequestException);
    });

    it('resets REJECTED request to PENDING for same direction', async () => {
      prisma.friendRequest.findFirst.mockResolvedValue({ ...baseRequest, fromId: 'p1', toId: 'p2', status: 'REJECTED' });
      prisma.friendRequest.update.mockResolvedValue({ ...baseRequest, status: 'PENDING' });
      const result = await service.sendRequest('p1', 'p2');
      expect(prisma.friendRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { status: 'PENDING' },
      });
      expect(result.requestId).toBe('req-1');
    });
  });

  describe('cancelRequest', () => {
    it('deletes a pending request owned by caller', async () => {
      prisma.friendRequest.findUnique.mockResolvedValue({ ...baseRequest, fromId: 'p1', status: 'PENDING' });
      await service.cancelRequest('req-1', 'p1');
      expect(prisma.friendRequest.delete).toHaveBeenCalledWith({ where: { id: 'req-1' } });
    });

    it('throws NotFoundException when request not found', async () => {
      await expect(service.cancelRequest('bad-id', 'p1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when caller is not the sender', async () => {
      prisma.friendRequest.findUnique.mockResolvedValue({ ...baseRequest, fromId: 'p2', status: 'PENDING' });
      await expect(service.cancelRequest('req-1', 'p1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('acceptRequest', () => {
    it('sets status to ACCEPTED when caller is recipient', async () => {
      prisma.friendRequest.findUnique.mockResolvedValue({ ...baseRequest, toId: 'p2', status: 'PENDING' });
      await service.acceptRequest('req-1', 'p2');
      expect(prisma.friendRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { status: 'ACCEPTED' },
      });
    });

    it('throws ForbiddenException when caller is not the recipient', async () => {
      prisma.friendRequest.findUnique.mockResolvedValue({ ...baseRequest, toId: 'p2', status: 'PENDING' });
      await expect(service.acceptRequest('req-1', 'p1')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when request does not exist', async () => {
      await expect(service.acceptRequest('bad-id', 'p2')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when request is not PENDING', async () => {
      prisma.friendRequest.findUnique.mockResolvedValue({ ...baseRequest, toId: 'p2', status: 'ACCEPTED' });
      await expect(service.acceptRequest('req-1', 'p2')).rejects.toThrow(BadRequestException);
    });
  });

  describe('rejectRequest', () => {
    it('sets status to REJECTED when caller is recipient', async () => {
      prisma.friendRequest.findUnique.mockResolvedValue({ ...baseRequest, toId: 'p2', status: 'PENDING' });
      await service.rejectRequest('req-1', 'p2');
      expect(prisma.friendRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { status: 'REJECTED' },
      });
    });

    it('throws NotFoundException when request does not exist', async () => {
      await expect(service.rejectRequest('bad-id', 'p2')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when caller is not the recipient', async () => {
      prisma.friendRequest.findUnique.mockResolvedValue({ ...baseRequest, toId: 'p2', status: 'PENDING' });
      await expect(service.rejectRequest('req-1', 'p1')).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when request is not PENDING', async () => {
      prisma.friendRequest.findUnique.mockResolvedValue({ ...baseRequest, toId: 'p2', status: 'REJECTED' });
      await expect(service.rejectRequest('req-1', 'p2')).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeFriend', () => {
    it('deletes an ACCEPTED request when caller is a participant', async () => {
      prisma.friendRequest.findUnique.mockResolvedValue({ ...baseRequest, fromId: 'p1', toId: 'p2', status: 'ACCEPTED' });
      await service.removeFriend('req-1', 'p1');
      expect(prisma.friendRequest.delete).toHaveBeenCalledWith({ where: { id: 'req-1' } });
    });

    it('throws ForbiddenException when caller is not a participant', async () => {
      prisma.friendRequest.findUnique.mockResolvedValue({ ...baseRequest, fromId: 'p1', toId: 'p2', status: 'ACCEPTED' });
      await expect(service.removeFriend('req-1', 'p3')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getFriends', () => {
    it('returns friends with requestId and player data', async () => {
      prisma.friendRequest.findMany.mockResolvedValue([
        { id: 'req-1', fromId: 'p1', toId: 'p2', status: 'ACCEPTED' },
      ]);
      prisma.player.findMany.mockResolvedValue([player2]);
      const result = await service.getFriends('p1');
      expect(result).toHaveLength(1);
      expect(result[0].requestId).toBe('req-1');
      expect(result[0].playerId).toBe('p2');
      expect(result[0].playerName).toBe('Bob');
    });

    it('returns empty array when caller has no friends', async () => {
      // friendRequest.findMany already returns [] from beforeEach
      prisma.player.findMany.mockResolvedValue([]);
      const result = await service.getFriends('p1');
      expect(result).toEqual([]);
      expect(prisma.player.findMany).toHaveBeenCalledWith({ where: { id: { in: [] } }, select: expect.any(Object) });
    });

    it('correctly extracts friendId when caller is the toId (reverse direction)', async () => {
      prisma.friendRequest.findMany.mockResolvedValue([
        { id: 'req-1', fromId: 'p1', toId: 'p2', status: 'ACCEPTED' },
      ]);
      prisma.player.findMany.mockResolvedValue([player1]);
      // p2 is the caller — friend is p1 (fromId)
      const result = await service.getFriends('p2');
      expect(result).toHaveLength(1);
      expect(result[0].requestId).toBe('req-1');
      expect(result[0].playerId).toBe('p1');
      expect(result[0].playerName).toBe('Alice');
    });
  });

  describe('getIncomingRequests', () => {
    it('returns incoming pending requests with sender details', async () => {
      prisma.friendRequest.findMany.mockResolvedValue([
        { id: 'req-1', fromId: 'p1', toId: 'p2', status: 'PENDING', createdAt: new Date(),
          from: { id: 'p1', playerName: 'Alice', playerLevel: 5, city: null } },
      ]);
      const result = await service.getIncomingRequests('p2');
      expect(result).toHaveLength(1);
      expect(result[0].requestId).toBe('req-1');
      expect(result[0].fromId).toBe('p1');
      expect(result[0].playerName).toBe('Alice');
    });

    it('returns empty array when there are no incoming requests', async () => {
      const result = await service.getIncomingRequests('p2');
      expect(result).toEqual([]);
    });
  });
});
