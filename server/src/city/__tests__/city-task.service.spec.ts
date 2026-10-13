import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CityTaskType, CityTaskStatus, CityRole } from '@prisma/client';
import { CityTaskService } from '../city-task.service';

function makeService(overrides: Record<string, any> = {}) {
  const today = new Date(Date.UTC(2026, 9, 13));
  jest.useFakeTimers().setSystemTime(today);

  const prisma = {
    cityDailyTask: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockResolvedValue({ count: 9 }),
      findUnique: jest.fn(),
      update: jest.fn().mockImplementation((args) => Promise.resolve({ ...args.data, id: args.where.id, participants: [] })),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    cityTaskParticipant: {
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'p1', ...args.data })),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      update: jest.fn().mockResolvedValue({}),
    },
    cityMembership: {
      findUnique: jest.fn(),
    },
    city: {
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue({ styleStars: 0 }),
    },
    $transaction: jest.fn().mockImplementation((ops) =>
      Array.isArray(ops) ? Promise.all(ops) : ops({ ...prisma }),
    ),
    ...overrides,
  };

  const merged = { ...prisma, ...overrides };
  return { svc: new CityTaskService(merged as any), prisma: merged };
}

describe('getOrCreateDailyTasks', () => {
  it('returns existing tasks when they exist for today', async () => {
    const tasks = Array.from({ length: 9 }, (_, i) => ({
      id: `t${i}`, taskType: 'CARRIER', status: 'AVAILABLE', participants: [],
      requiredCount: 100, currentProgress: 0, takenAt: null, collectedAt: null,
      rewardStars: null, finalStars: null, completedAt: null,
    }));
    const { svc, prisma } = makeService({
      cityDailyTask: {
        findMany: jest.fn().mockResolvedValue(tasks),
        createMany: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    });
    const result = await svc.getOrCreateDailyTasks('city1', 15);
    expect(result.length).toBe(9);
    expect(prisma.cityDailyTask.createMany).not.toHaveBeenCalled();
  });

  it('creates 9 tasks when none exist', async () => {
    const created = Array.from({ length: 9 }, (_, i) => ({
      id: `t${i}`, taskType: 'CARRIER', status: 'AVAILABLE', participants: [],
      requiredCount: 100, currentProgress: 0, takenAt: null, collectedAt: null,
      rewardStars: null, finalStars: null, completedAt: null,
    }));
    const { svc, prisma } = makeService({
      cityDailyTask: {
        findMany: jest.fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce(created),
        createMany: jest.fn().mockResolvedValue({ count: 9 }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    });
    await svc.getOrCreateDailyTasks('city1', 15);
    expect(prisma.cityDailyTask.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
  });

  it('expires yesterday IN_PROGRESS/COMPLETED tasks before creating new ones', async () => {
    const created = Array.from({ length: 9 }, (_, i) => ({
      id: `t${i}`, taskType: 'CARRIER', status: 'AVAILABLE', participants: [],
      requiredCount: 100, currentProgress: 0, takenAt: null, collectedAt: null,
      rewardStars: null, finalStars: null, completedAt: null,
    }));
    const { svc, prisma } = makeService({
      cityDailyTask: {
        findMany: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce(created),
        createMany: jest.fn().mockResolvedValue({ count: 9 }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    });
    await svc.getOrCreateDailyTasks('city1', 15);
    expect(prisma.cityDailyTask.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: { in: ['IN_PROGRESS', 'COMPLETED'] } }),
      data: { status: 'EXPIRED' },
    }));
  });
});

describe('joinTask', () => {
  it('throws if player already in a task today', async () => {
    const { svc, prisma } = makeService();
    prisma.cityTaskParticipant.findFirst.mockResolvedValue({ id: 'p1', taskId: 't1', playerId: 'player1' });
    prisma.cityDailyTask.findUnique.mockResolvedValue({
      id: 't2', status: 'AVAILABLE', participants: [],
    });
    await expect(svc.joinTask('player1', 't2')).rejects.toThrow(BadRequestException);
  });

  it('throws if task already has 2 participants', async () => {
    const { svc, prisma } = makeService();
    prisma.cityTaskParticipant.findFirst.mockResolvedValue(null);
    prisma.cityDailyTask.findUnique.mockResolvedValue({
      id: 't1', status: 'IN_PROGRESS',
      participants: [{ playerId: 'a' }, { playerId: 'b' }],
    });
    await expect(svc.joinTask('player1', 't1')).rejects.toThrow(BadRequestException);
  });

  it('sets takenAt and status IN_PROGRESS when first participant joins', async () => {
    const { svc, prisma } = makeService();
    prisma.cityTaskParticipant.findFirst.mockResolvedValue(null);
    prisma.cityDailyTask.findUnique.mockResolvedValue({
      id: 't1', status: 'AVAILABLE', participants: [],
    });
    prisma.cityDailyTask.update.mockResolvedValue({
      id: 't1', status: 'IN_PROGRESS', takenAt: new Date(), participants: [],
      requiredCount: 100, currentProgress: 0, rewardStars: null, finalStars: null, collectedAt: null, completedAt: null,
    });
    await svc.joinTask('player1', 't1');
    expect(prisma.cityDailyTask.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'IN_PROGRESS', takenAt: expect.any(Date) }),
    }));
  });
});

describe('collectTask', () => {
  it('throws ForbiddenException for NEWBIE role', async () => {
    const { svc, prisma } = makeService();
    prisma.cityMembership.findUnique.mockResolvedValue({ role: 'NEWBIE', cityId: 'c1' });
    prisma.cityDailyTask.findUnique.mockResolvedValue({
      id: 't1', status: 'COMPLETED', cityId: 'c1', takenAt: new Date(Date.now() - 1000),
    });
    await expect(svc.collectTask('actor1', 't1')).rejects.toThrow(ForbiddenException);
  });

  it('applies x2 multiplier when within 10 hours', async () => {
    const { svc, prisma } = makeService();
    prisma.cityMembership.findUnique.mockResolvedValue({ role: 'MAYOR', cityId: 'c1' });
    const takenAt = new Date(Date.now() - 5 * 3600 * 1000);
    prisma.cityDailyTask.findUnique.mockResolvedValue({
      id: 't1', status: 'COMPLETED', cityId: 'c1', takenAt,
    });
    jest.spyOn(global.Math, 'random').mockReturnValue(0.5);
    const result = await svc.collectTask('actor1', 't1');
    expect(result.finalStars).toBe(12); // floor(0.5*10)+1=6, x2=12
    jest.spyOn(global.Math, 'random').mockRestore();
  });

  it('no multiplier after 10 hours', async () => {
    const { svc, prisma } = makeService();
    prisma.cityMembership.findUnique.mockResolvedValue({ role: 'MAYOR', cityId: 'c1' });
    const takenAt = new Date(Date.now() - 11 * 3600 * 1000);
    prisma.cityDailyTask.findUnique.mockResolvedValue({
      id: 't1', status: 'COMPLETED', cityId: 'c1', takenAt,
    });
    jest.spyOn(global.Math, 'random').mockReturnValue(0.5);
    const result = await svc.collectTask('actor1', 't1');
    expect(result.finalStars).toBe(6);
    jest.spyOn(global.Math, 'random').mockRestore();
  });
});
