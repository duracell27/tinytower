import { Test, TestingModule } from '@nestjs/testing';
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
});
