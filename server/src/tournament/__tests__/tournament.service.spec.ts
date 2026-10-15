import { BadRequestException } from '@nestjs/common';
import { TournamentService } from '../tournament.service';

function makeService(overrides: Record<string, any> = {}) {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-18T10:00:00Z')); // Saturday (week closed)

  const prisma = {
    playerWeeklyTokens: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    playerTokenTournament: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'tour1' }),
    },
    playerTokenTournamentEntry: {
      create: jest.fn().mockResolvedValue({}),
    },
    playerState: {
      update: jest.fn().mockResolvedValue({}),
    },
    player: {
      findUnique: jest.fn().mockResolvedValue({ playerLevel: 5, playerName: 'Alice' }),
      update: jest.fn().mockResolvedValue({}),
    },
    mailMessage: {
      create: jest.fn().mockResolvedValue({ id: 'm1' }),
    },
    $transaction: jest.fn().mockImplementation((fn: any) => fn({ ...prisma, ...overrides })),
    ...overrides,
  };
  const merged = { ...prisma, ...overrides };
  return { svc: new TournamentService(merged as any), prisma: merged };
}

describe('getLeaderboard', () => {
  afterEach(() => jest.useRealTimers());

  it('returns empty entries when no tokens collected', async () => {
    const { svc } = makeService();
    const result = await svc.getLeaderboard('2026-10-12T00:00:00.000Z');
    expect(result.totalParticipants).toBe(0);
    expect(result.entries).toHaveLength(0);
    expect(result.alreadyPublished).toBe(false);
  });

  it('marks alreadyPublished when tournament exists', async () => {
    const { svc } = makeService({
      playerTokenTournament: {
        findUnique: jest.fn().mockResolvedValue({ id: 'tour1' }),
      },
      playerWeeklyTokens: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    });
    const result = await svc.getLeaderboard('2026-10-12T00:00:00.000Z');
    expect(result.alreadyPublished).toBe(true);
  });

  it('ranks entries by tokenCount descending', async () => {
    // Mock data must match orderBy: count desc (mock does not sort)
    const { svc } = makeService({
      playerWeeklyTokens: {
        findMany: jest.fn().mockResolvedValue([
          { playerId: 'p2', count: 80, player: { playerName: 'Bob',   playerLevel: 15 } },
          { playerId: 'p1', count: 50, player: { playerName: 'Alice', playerLevel: 5 } },
        ]),
      },
      playerTokenTournament: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const result = await svc.getLeaderboard('2026-10-12T00:00:00.000Z');
    expect(result.entries[0].playerName).toBe('Bob');
    expect(result.entries[0].rank).toBe(1);
    expect(result.entries[1].rank).toBe(2);
    expect(result.totalParticipants).toBe(2);
  });

  it('coins reward uses level bracket', async () => {
    const { svc } = makeService({
      playerWeeklyTokens: {
        findMany: jest.fn().mockResolvedValue([
          { playerId: 'p1', count: 10, player: { playerName: 'Alice', playerLevel: 11 } },
        ]),
      },
      playerTokenTournament: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const result = await svc.getLeaderboard('2026-10-12T00:00:00.000Z');
    expect(result.entries[0].coinsReward).toBe(20_000); // 10 × 2 × 1000
  });
});

describe('publishResults', () => {
  afterEach(() => jest.useRealTimers());

  it('throws BadRequestException if already published', async () => {
    const { svc } = makeService({
      playerTokenTournament: {
        findUnique: jest.fn().mockResolvedValue({ id: 'existing' }),
      },
      playerWeeklyTokens: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    });
    await expect(svc.publishResults('admin1', '2026-10-12T00:00:00.000Z'))
      .rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException if week is not closed yet', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-14T10:00:00Z')); // Wednesday
    const { svc } = makeService({
      playerTokenTournament: { findUnique: jest.fn().mockResolvedValue(null) },
      playerWeeklyTokens: { findMany: jest.fn().mockResolvedValue([]) },
    });
    await expect(svc.publishResults('admin1', '2026-10-12T00:00:00.000Z'))
      .rejects.toThrow(BadRequestException);
  });

  it('does not send mail to players with 0 tokens', async () => {
    const mailCreate = jest.fn().mockResolvedValue({ id: 'm1' });
    // One player with tokens (rank 1), one with 0 (excluded)
    const base = {
      playerTokenTournament: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'tour1' }),
      },
      playerWeeklyTokens: {
        findMany: jest.fn().mockResolvedValue([
          { playerId: 'p1', count: 10, player: { playerName: 'Alice', playerLevel: 5 } },
          { playerId: 'p2', count: 0,  player: { playerName: 'Ghost', playerLevel: 5 } },
        ]),
      },
      playerState: { update: jest.fn().mockResolvedValue({}) },
      player: { update: jest.fn().mockResolvedValue({}) },
      playerTokenTournamentEntry: { create: jest.fn().mockResolvedValue({}) },
      mailMessage: { create: mailCreate },
    };
    const { svc } = makeService(base);
    await svc.publishResults('admin1', '2026-10-12T00:00:00.000Z');
    // Only p1 (count=10) gets mail; p2 (count=0) is excluded
    expect(mailCreate).toHaveBeenCalledTimes(1);
    expect(mailCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ toId: 'p1' }) }),
    );
  });

  it('publishes with correct gem reward for rank 1', async () => {
    const playerStateUpdate = jest.fn().mockResolvedValue({});
    const base = {
      playerTokenTournament: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'tour1' }),
      },
      playerWeeklyTokens: {
        findMany: jest.fn().mockResolvedValue([
          { playerId: 'p1', count: 20, player: { playerName: 'Alice', playerLevel: 5 } },
        ]),
      },
      playerState: { update: playerStateUpdate },
      player: {
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({ playerLevel: 5, playerName: 'Alice' }),
      },
      mailMessage: { create: jest.fn().mockResolvedValue({ id: 'm1' }) },
      playerTokenTournamentEntry: { create: jest.fn().mockResolvedValue({}) },
    };
    const { svc } = makeService(base);
    await svc.publishResults('admin1', '2026-10-12T00:00:00.000Z');
    // rank 1 = 1000 gems
    expect(playerStateUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ gems: expect.objectContaining({ increment: 1000 }) }),
      }),
    );
  });
});
