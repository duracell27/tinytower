import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminService } from '../admin.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: Record<string, any>;

  const mockPlayer = {
    id: 'player-1',
    email: 'test@test.com',
    playerName: 'TestPlayer',
    playerLevel: 5,
    balance: 1000,
    isAdmin: false,
    lastSeenAt: new Date(),
    createdAt: new Date(),
    state: { gems: 20 },
  };

  beforeEach(async () => {
    prisma = {
      player: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      playerState: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      worker: {
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
      floor: {
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      playerFloorType: {
        deleteMany: jest.fn(),
      },
      commandLog: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  describe('getPlayers', () => {
    it('returns paginated players with gems from state', async () => {
      prisma.player.findMany.mockResolvedValue([mockPlayer]);
      prisma.player.count.mockResolvedValue(1);

      const result = await service.getPlayers(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].gems).toBe(20);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('applies search filter to playerName and email', async () => {
      prisma.player.findMany.mockResolvedValue([]);
      prisma.player.count.mockResolvedValue(0);

      await service.getPlayers(1, 20, 'test');

      expect(prisma.player.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { playerName: { contains: 'test', mode: 'insensitive' } },
              { email: { contains: 'test', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });
  });

  describe('getPlayer', () => {
    it('throws NotFoundException for unknown id', async () => {
      prisma.player.findUnique.mockResolvedValue(null);
      await expect(service.getPlayer('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('maps token fields from state', async () => {
      prisma.player.findUnique.mockResolvedValue({
        ...mockPlayer,
        playerXp: 0,
        state: {
          gems: 5, briks: 1, glass: 2, nails: 3, screw: 4,
          tokenGreen: 10, tokenBlue: 20, tokenYellow: 30, tokenPurple: 40, tokenRed: 50,
          lobbyCapacity: 10, hotelCapacity: 10, elevatorLevel: 1,
        },
        workers: [],
        floors: [],
        floorTypes: [],
      });
      const result = await service.getPlayer('player-1');
      expect(result.tokens).toEqual({ green: 10, blue: 20, yellow: 30, purple: 40, red: 50 });
    });
  });

  describe('deletePlayer', () => {
    it('throws NotFoundException when player does not exist', async () => {
      prisma.player.findUnique.mockResolvedValue(null);
      await expect(service.deletePlayer('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('calls prisma.player.delete with correct id', async () => {
      prisma.player.findUnique.mockResolvedValue(mockPlayer);
      prisma.player.delete.mockResolvedValue(mockPlayer);
      await service.deletePlayer('player-1');
      expect(prisma.player.delete).toHaveBeenCalledWith({ where: { id: 'player-1' } });
    });
  });

  describe('deleteWorker', () => {
    it('throws NotFoundException when worker not found for player', async () => {
      prisma.worker.findFirst.mockResolvedValue(null);
      await expect(service.deleteWorker('player-1', 'w-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCommandLogs', () => {
    it('returns paginated logs with playerName joined', async () => {
      prisma.commandLog.findMany.mockResolvedValue([
        {
          id: 'cmd-1',
          playerId: 'player-1',
          type: 'buy',
          floorId: 2,
          slotIdx: 0,
          typeId: 'coffee',
          workerId: null,
          timestamp: BigInt(1700000000000),
          processedAt: new Date(),
        },
      ]);
      prisma.commandLog.count.mockResolvedValue(1);
      prisma.player.findMany.mockResolvedValue([{ id: 'player-1', playerName: 'TestPlayer' }]);

      const result = await service.getCommandLogs(1, 50);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].playerName).toBe('TestPlayer');
      expect(result.data[0].timestamp).toBe('1700000000000');
    });

    it('filters by playerId and type when provided', async () => {
      prisma.commandLog.findMany.mockResolvedValue([]);
      prisma.commandLog.count.mockResolvedValue(0);
      prisma.player.findMany.mockResolvedValue([]);

      await service.getCommandLogs(1, 50, 'player-1', 'buy');

      expect(prisma.commandLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { playerId: 'player-1', type: 'buy' },
        }),
      );
    });
  });
});
