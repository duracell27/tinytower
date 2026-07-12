import { Test, TestingModule } from '@nestjs/testing';
import { LeaderboardService } from '../leaderboard.service';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../auth/redis.provider';

describe('LeaderboardService', () => {
  let service: LeaderboardService;
  let prisma: Record<string, any>;
  let redis: Record<string, any>;

  const mockRows = [
    { id: 'p1', playerName: 'Alice', playerLevel: 10, openedFloorsCount: 5, maxRevenuePerMin: 1000 },
    { id: 'p2', playerName: 'Bob',   playerLevel: 8,  openedFloorsCount: 3, maxRevenuePerMin: 800 },
  ];

  beforeEach(async () => {
    prisma = {
      player: {
        findMany:   jest.fn(),
        count:      jest.fn(),
        findUnique: jest.fn(),
      },
    };
    redis = {
      get:    jest.fn(),
      setex:  jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaderboardService,
        { provide: PrismaService,  useValue: prisma },
        { provide: REDIS_CLIENT,   useValue: redis  },
      ],
    }).compile();

    service = module.get<LeaderboardService>(LeaderboardService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should return level leaderboard with correct ranks and currentPlayer (cache miss)', async () => {
    redis.get.mockResolvedValue(null);
    redis.setex.mockResolvedValue('OK');
    prisma.player.findMany.mockResolvedValue(mockRows);
    prisma.player.count
      .mockResolvedValueOnce(50)  // total
      .mockResolvedValueOnce(5);  // players above me
    prisma.player.findUnique.mockResolvedValue({
      playerLevel: 7, openedFloorsCount: 2, maxRevenuePerMin: 700,
    });

    const result = await service.getLeaderboard('level', 1, 'my-id');

    expect(result.total).toBe(50);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toEqual({ rank: 1, playerId: 'p1', playerName: 'Alice', value: 10 });
    expect(result.entries[1]).toEqual({ rank: 2, playerId: 'p2', playerName: 'Bob', value: 8 });
    expect(result.currentPlayer).toEqual({ rank: 6, value: 7 });
  });

  it('should store entries+total in Redis on cache miss', async () => {
    redis.get.mockResolvedValue(null);
    redis.setex.mockResolvedValue('OK');
    prisma.player.findMany.mockResolvedValue([mockRows[0]]);
    prisma.player.count.mockResolvedValueOnce(10).mockResolvedValueOnce(0);
    prisma.player.findUnique.mockResolvedValue({ playerLevel: 10, openedFloorsCount: 5, maxRevenuePerMin: 1000 });

    await service.getLeaderboard('level', 1, 'p1');

    expect(redis.setex).toHaveBeenCalledWith(
      'lb:level:1',
      300,
      expect.stringContaining('"entries"'),
    );
    const storedPayload = JSON.parse(redis.setex.mock.calls[0][2]);
    expect(storedPayload).toHaveProperty('entries');
    expect(storedPayload).toHaveProperty('total', 10);
  });

  it('should return cached entries and skip DB findMany on cache hit', async () => {
    const cached = {
      entries: [{ rank: 1, playerId: 'p1', playerName: 'Alice', value: 10 }],
      total: 50,
    };
    redis.get.mockResolvedValue(JSON.stringify(cached));
    prisma.player.count.mockResolvedValueOnce(5); // players above me for currentPlayer
    prisma.player.findUnique.mockResolvedValue({ playerLevel: 7, openedFloorsCount: 2, maxRevenuePerMin: 700 });

    const result = await service.getLeaderboard('level', 1, 'my-id');

    expect(prisma.player.findMany).not.toHaveBeenCalled();
    expect(redis.setex).not.toHaveBeenCalled();
    expect(result.entries).toEqual(cached.entries);
    expect(result.total).toBe(50);
    expect(result.currentPlayer.rank).toBe(6);
  });

  it('should use openedFloorsCount as value for floors tab', async () => {
    redis.get.mockResolvedValue(null);
    redis.setex.mockResolvedValue('OK');
    prisma.player.findMany.mockResolvedValue([mockRows[0]]);
    prisma.player.count.mockResolvedValueOnce(10).mockResolvedValueOnce(0);
    prisma.player.findUnique.mockResolvedValue({ playerLevel: 10, openedFloorsCount: 5, maxRevenuePerMin: 1000 });

    const result = await service.getLeaderboard('floors', 1, 'p1');

    expect(result.entries[0].value).toBe(5);
    expect(result.currentPlayer.rank).toBe(1);
  });

  it('should use maxRevenuePerMin as value for revenue tab', async () => {
    redis.get.mockResolvedValue(null);
    redis.setex.mockResolvedValue('OK');
    prisma.player.findMany.mockResolvedValue([mockRows[0]]);
    prisma.player.count.mockResolvedValueOnce(10).mockResolvedValueOnce(3);
    prisma.player.findUnique.mockResolvedValue({ playerLevel: 7, openedFloorsCount: 2, maxRevenuePerMin: 500 });

    const result = await service.getLeaderboard('revenue', 1, 'my-id');

    expect(result.entries[0].value).toBe(1000);
    expect(result.currentPlayer).toEqual({ rank: 4, value: 500 });
  });

  it('should offset ranks correctly on page 2', async () => {
    redis.get.mockResolvedValue(null);
    redis.setex.mockResolvedValue('OK');
    prisma.player.findMany.mockResolvedValue([
      { id: 'p21', playerName: 'Charlie', playerLevel: 3, openedFloorsCount: 1, maxRevenuePerMin: 300 },
    ]);
    prisma.player.count.mockResolvedValueOnce(50).mockResolvedValueOnce(49);
    prisma.player.findUnique.mockResolvedValue({ playerLevel: 1, openedFloorsCount: 0, maxRevenuePerMin: 0 });

    const result = await service.getLeaderboard('level', 2, 'my-id');

    expect(result.entries[0].rank).toBe(21);
    expect(result.currentPlayer.rank).toBe(50);
  });

  it('should pass correct orderBy and pagination to prisma', async () => {
    redis.get.mockResolvedValue(null);
    redis.setex.mockResolvedValue('OK');
    prisma.player.findMany.mockResolvedValue([]);
    prisma.player.count.mockResolvedValue(0);
    prisma.player.findUnique.mockResolvedValue({ playerLevel: 1, openedFloorsCount: 0, maxRevenuePerMin: 0 });

    await service.getLeaderboard('revenue', 3, 'my-id');

    expect(prisma.player.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ maxRevenuePerMin: 'desc' }, { createdAt: 'asc' }],
        skip: 40,
        take: 20,
      }),
    );
  });
});
