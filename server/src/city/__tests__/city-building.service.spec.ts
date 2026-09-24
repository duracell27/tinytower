import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CityBuildingType, CityBuildingState } from '@prisma/client';
import { CityBuildingService } from '../city-building.service';

function makeService(prismaOverrides: Record<string, any> = {}) {
  const prisma = {
    cityBuilding: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    cityMembership: {
      findUnique: jest.fn(),
    },
    city: {
      update: jest.fn().mockResolvedValue({}),
    },
    ...prismaOverrides,
  };
  return new CityBuildingService(prisma as any);
}

// ── getBuildingBonusesForCity ─────────────────────────────────────────────────

describe('getBuildingBonusesForCity', () => {
  it('returns all-zero when no buildings exist', async () => {
    const svc = makeService();
    const bonuses = await svc.getBuildingBonusesForCity('city1', 50);
    expect(bonuses).toEqual({
      deliveryBonus: 0,
      sellBonus: 0,
      revenueBonus: 0,
      personalXpBonus: 0,
      cityXpBonus: 0,
      elevatorDiamondBonus: 0,
      hotelBonus: 0,
    });
  });

  it('returns correct delivery bonus for MOTOR_POOL level 3 ACTIVE', async () => {
    const prisma = {
      cityBuilding: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'b1',
          buildingType: CityBuildingType.MOTOR_POOL,
          level: 3,
          state: CityBuildingState.ACTIVE,
          buildFinishesAt: null,
          boostFinishesAt: null,
          boostMultiplier: null,
        }]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const svc = makeService(prisma);
    const bonuses = await svc.getBuildingBonusesForCity('city1', 50);
    expect(bonuses.deliveryBonus).toBe(6); // 3 * 2
    expect(bonuses.sellBonus).toBe(0);
  });

  it('applies boost multiplier on top of base bonus', async () => {
    const future = new Date(Date.now() + 1_000_000);
    const prisma = {
      cityBuilding: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'b2',
          buildingType: CityBuildingType.AD_AGENCY,
          level: 5,
          state: CityBuildingState.ACTIVE,
          buildFinishesAt: null,
          boostFinishesAt: future,
          boostMultiplier: 2.0,
        }]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const svc = makeService(prisma);
    const bonuses = await svc.getBuildingBonusesForCity('city1', 50);
    expect(bonuses.sellBonus).toBe(20); // 5 * 2 * 2.0
  });

  it('lazily activates a building whose buildFinishesAt has passed', async () => {
    const past = new Date(Date.now() - 1);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      cityBuilding: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'b3',
          buildingType: CityBuildingType.CITY_BANK,
          level: 1,
          state: CityBuildingState.BUILDING,
          buildFinishesAt: past,
          boostFinishesAt: null,
          boostMultiplier: null,
        }]),
        updateMany,
      },
    };
    const svc = makeService(prisma);
    const bonuses = await svc.getBuildingBonusesForCity('city1', 50);
    expect(bonuses.revenueBonus).toBe(2); // level 1 * 2
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { state: CityBuildingState.ACTIVE, buildFinishesAt: null },
    }));
  });

  it('returns hotelBonus=0 for player with fewer than 30 floors', async () => {
    const prisma = {
      cityBuilding: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'b4',
          buildingType: CityBuildingType.VIP_HOTEL,
          level: 3,
          state: CityBuildingState.ACTIVE,
          buildFinishesAt: null,
          boostFinishesAt: null,
          boostMultiplier: null,
        }]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const svc = makeService(prisma);
    const bonuses = await svc.getBuildingBonusesForCity('city1', 29);
    expect(bonuses.hotelBonus).toBe(0);
  });

  it('returns hotelBonus for player with 30+ floors', async () => {
    const prisma = {
      cityBuilding: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'b5',
          buildingType: CityBuildingType.VIP_HOTEL,
          level: 3,
          state: CityBuildingState.ACTIVE,
          buildFinishesAt: null,
          boostFinishesAt: null,
          boostMultiplier: null,
        }]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const svc = makeService(prisma);
    const bonuses = await svc.getBuildingBonusesForCity('city1', 30);
    expect(bonuses.hotelBonus).toBe(9); // 3 * 3
  });

  it('does not count bonus for BUILDING state (timer not expired)', async () => {
    const future = new Date(Date.now() + 1_000_000);
    const prisma = {
      cityBuilding: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'b6',
          buildingType: CityBuildingType.CITY_BANK,
          level: 2,
          state: CityBuildingState.BUILDING,
          buildFinishesAt: future,
          boostFinishesAt: null,
          boostMultiplier: null,
        }]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const svc = makeService(prisma);
    const bonuses = await svc.getBuildingBonusesForCity('city1', 50);
    expect(bonuses.revenueBonus).toBe(0);
  });
});

// ── startUpgrade ──────────────────────────────────────────────────────────────

describe('startUpgrade', () => {
  it('throws ForbiddenException if requester is not ADVISOR+', async () => {
    const prisma = {
      cityMembership: {
        findUnique: jest.fn().mockResolvedValue({ cityId: 'city1', role: 'NEWBIE' }),
      },
      cityBuilding: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
      city: { update: jest.fn().mockResolvedValue({}) },
    };
    const svc = makeService(prisma);
    await expect(
      svc.startUpgrade('city1', CityBuildingType.MOTOR_POOL, 'player1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws ForbiddenException if requester belongs to different city', async () => {
    const prisma = {
      cityMembership: {
        findUnique: jest.fn().mockResolvedValue({ cityId: 'other-city', role: 'ADVISOR' }),
      },
      cityBuilding: { findUnique: jest.fn(), upsert: jest.fn() },
      city: { update: jest.fn() },
    };
    const svc = makeService(prisma);
    await expect(
      svc.startUpgrade('city1', CityBuildingType.MOTOR_POOL, 'player1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws BadRequestException if building is already BUILDING', async () => {
    const prisma = {
      cityMembership: {
        findUnique: jest.fn().mockResolvedValue({ cityId: 'city1', role: 'ADVISOR' }),
      },
      cityBuilding: {
        findUnique: jest.fn().mockResolvedValue({
          level: 1,
          state: CityBuildingState.BUILDING,
        }),
        upsert: jest.fn(),
      },
      city: { update: jest.fn().mockResolvedValue({}) },
    };
    const svc = makeService(prisma);
    await expect(
      svc.startUpgrade('city1', CityBuildingType.MOTOR_POOL, 'player1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws BadRequestException if building is already level 15', async () => {
    const prisma = {
      cityMembership: {
        findUnique: jest.fn().mockResolvedValue({ cityId: 'city1', role: 'ADVISOR' }),
      },
      cityBuilding: {
        findUnique: jest.fn().mockResolvedValue({
          level: 15,
          state: CityBuildingState.ACTIVE,
        }),
        upsert: jest.fn(),
      },
      city: { update: jest.fn().mockResolvedValue({}) },
    };
    const svc = makeService(prisma);
    await expect(
      svc.startUpgrade('city1', CityBuildingType.MOTOR_POOL, 'player1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('upserts building in BUILDING state with correct level', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const prisma = {
      cityMembership: {
        findUnique: jest.fn().mockResolvedValue({ cityId: 'city1', role: 'ADVISOR' }),
      },
      cityBuilding: {
        findUnique: jest.fn().mockResolvedValue({ level: 2, state: CityBuildingState.ACTIVE }),
        upsert,
      },
      city: { update: jest.fn().mockResolvedValue({}) },
    };
    const svc = makeService(prisma);
    await svc.startUpgrade('city1', CityBuildingType.MOTOR_POOL, 'player1');
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ level: 3, state: CityBuildingState.BUILDING }),
    }));
  });
});

// ── activateBoost ──────────────────────────────────────────────────────────────

describe('activateBoost', () => {
  it('throws BadRequestException when building is in BUILDING state', async () => {
    const prisma = {
      cityMembership: {
        findUnique: jest.fn().mockResolvedValue({ cityId: 'city1', role: 'ADVISOR' }),
      },
      cityBuilding: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'b1',
          level: 2,
          state: CityBuildingState.BUILDING,
          boostFinishesAt: null,
        }),
        update: jest.fn(),
      },
      city: { update: jest.fn() },
    };
    const svc = makeService(prisma);
    await expect(
      svc.activateBoost('city1', CityBuildingType.MOTOR_POOL, 'gems', 'player1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws BadRequestException when building does not exist', async () => {
    const prisma = {
      cityMembership: {
        findUnique: jest.fn().mockResolvedValue({ cityId: 'city1', role: 'ADVISOR' }),
      },
      cityBuilding: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
      city: { update: jest.fn() },
    };
    const svc = makeService(prisma);
    await expect(
      svc.activateBoost('city1', CityBuildingType.MOTOR_POOL, 'gems', 'player1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sets boostMultiplier=2.0 for gems boost', async () => {
    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      cityMembership: {
        findUnique: jest.fn().mockResolvedValue({ cityId: 'city1', role: 'ADVISOR' }),
      },
      cityBuilding: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'b1',
          level: 3,
          state: CityBuildingState.ACTIVE,
          boostFinishesAt: null,
        }),
        update,
      },
      city: { update: jest.fn().mockResolvedValue({}) },
    };
    const svc = makeService(prisma);
    await svc.activateBoost('city1', CityBuildingType.MOTOR_POOL, 'gems', 'player1');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ boostMultiplier: 2.0 }),
    }));
  });

  it('sets boostMultiplier=1.3 for coins boost', async () => {
    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      cityMembership: {
        findUnique: jest.fn().mockResolvedValue({ cityId: 'city1', role: 'ADVISOR' }),
      },
      cityBuilding: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'b1',
          level: 3,
          state: CityBuildingState.ACTIVE,
          boostFinishesAt: null,
        }),
        update,
      },
      city: { update: jest.fn().mockResolvedValue({}) },
    };
    const svc = makeService(prisma);
    await svc.activateBoost('city1', CityBuildingType.MOTOR_POOL, 'coins', 'player1');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ boostMultiplier: 1.3 }),
    }));
  });

  it('throws BadRequestException when boost is already active', async () => {
    const future = new Date(Date.now() + 1_000_000);
    const prisma = {
      cityMembership: {
        findUnique: jest.fn().mockResolvedValue({ cityId: 'city1', role: 'ADVISOR' }),
      },
      cityBuilding: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'b1',
          level: 3,
          state: CityBuildingState.ACTIVE,
          boostFinishesAt: future,
        }),
        update: jest.fn(),
      },
      city: { update: jest.fn() },
    };
    const svc = makeService(prisma);
    await expect(
      svc.activateBoost('city1', CityBuildingType.MOTOR_POOL, 'gems', 'player1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

// ── listBuildings ─────────────────────────────────────────────────────────────

describe('listBuildings', () => {
  it('lazily activates a building whose timer expired and returns it as ACTIVE', async () => {
    const past = new Date(Date.now() - 1);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      cityBuilding: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'b1',
          buildingType: CityBuildingType.CITY_BANK,
          level: 2,
          state: CityBuildingState.BUILDING,
          buildFinishesAt: past,
          boostFinishesAt: null,
          boostMultiplier: null,
        }]),
        updateMany,
      },
    };
    const svc = makeService(prisma);
    const list = await svc.listBuildings('city1');
    expect(list[0].state).toBe('ACTIVE');
    expect(list[0].buildFinishesAt).toBeNull();
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { state: CityBuildingState.ACTIVE, buildFinishesAt: null },
    }));
  });
});
