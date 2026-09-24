import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { CityBuildingType, CityBuildingState } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  BONUS_PER_LEVEL,
  IS_VIP_BUILDING,
  BOOST_DURATION_MS,
  getLevelConfig,
  INSTANT_SKIP_GEMS_PER_HOUR,
} from './city-building.constants';

const ROLE_RANK = ['NEWBIE', 'CITIZEN', 'BUSINESSMAN', 'ADVISOR', 'VICE_MAYOR', 'ACTING_MAYOR', 'MAYOR'];

function isAdvisorOrAbove(role: string): boolean {
  return ROLE_RANK.indexOf(role) >= ROLE_RANK.indexOf('ADVISOR');
}

export interface CityBuildingBonuses {
  deliveryBonus: number;
  sellBonus: number;
  revenueBonus: number;
  personalXpBonus: number;
  cityXpBonus: number;
  elevatorDiamondBonus: number;
  hotelBonus: number;
}

export interface CityBuildingDto {
  buildingType: CityBuildingType;
  level: number;
  state: 'IDLE' | 'BUILDING' | 'ACTIVE';
  isBoosted: boolean;
  boostMultiplier: number | null;
  boostFinishesAt: string | null;
  buildFinishesAt: string | null;
  currentBonus: number;
}

const ZERO_BONUSES: CityBuildingBonuses = {
  deliveryBonus: 0,
  sellBonus: 0,
  revenueBonus: 0,
  personalXpBonus: 0,
  cityXpBonus: 0,
  elevatorDiamondBonus: 0,
  hotelBonus: 0,
};

@Injectable()
export class CityBuildingService {
  constructor(private prisma: PrismaService) {}

  async getBuildingBonusesForCity(
    cityId: string,
    playerFloorCount: number,
  ): Promise<CityBuildingBonuses> {
    const now = new Date();
    const buildings = await this.prisma.cityBuilding.findMany({ where: { cityId } });

    if (buildings.length === 0) return { ...ZERO_BONUSES };

    // Lazy activation: flip BUILDING → ACTIVE for any whose timer has passed
    const toActivateIds = buildings
      .filter(b => b.state === CityBuildingState.BUILDING && b.buildFinishesAt && b.buildFinishesAt <= now)
      .map(b => b.id);

    if (toActivateIds.length > 0) {
      await this.prisma.cityBuilding.updateMany({
        where: { id: { in: toActivateIds } },
        data: { state: CityBuildingState.ACTIVE, buildFinishesAt: null },
      });
      for (const b of buildings) {
        if (toActivateIds.includes(b.id)) {
          b.state = CityBuildingState.ACTIVE;
          b.buildFinishesAt = null;
        }
      }
    }

    const result: CityBuildingBonuses = { ...ZERO_BONUSES };

    for (const b of buildings) {
      if (b.state !== CityBuildingState.ACTIVE || b.level === 0) continue;
      const boostActive = b.boostFinishesAt != null && b.boostFinishesAt > now;
      const multiplier = boostActive ? (b.boostMultiplier ?? 1) : 1;
      const baseBonus = b.level * BONUS_PER_LEVEL[b.buildingType] * multiplier;

      switch (b.buildingType) {
        case CityBuildingType.MOTOR_POOL:       result.deliveryBonus       += baseBonus; break;
        case CityBuildingType.AD_AGENCY:        result.sellBonus           += baseBonus; break;
        case CityBuildingType.CITY_BANK:        result.revenueBonus        += baseBonus; break;
        case CityBuildingType.BUSINESS_SCHOOL:  result.personalXpBonus     += baseBonus; break;
        case CityBuildingType.STATE_ACADEMY:    result.cityXpBonus         += baseBonus; break;
        case CityBuildingType.VIP_CLUB:         result.elevatorDiamondBonus += baseBonus; break;
        case CityBuildingType.VIP_HOTEL:
          if (playerFloorCount >= 30) result.hotelBonus += baseBonus;
          break;
      }
    }

    return result;
  }

  async startUpgrade(
    cityId: string,
    buildingType: CityBuildingType,
    requesterId: string,
  ) {
    const membership = await this.prisma.cityMembership.findUnique({
      where: { playerId: requesterId },
    });
    if (!membership || membership.cityId !== cityId || !isAdvisorOrAbove(membership.role)) {
      throw new ForbiddenException('ADVISOR+ required');
    }

    const existing = await this.prisma.cityBuilding.findUnique({
      where: { cityId_buildingType: { cityId, buildingType } },
    });
    const currentLevel = existing?.level ?? 0;
    const currentState = existing?.state ?? CityBuildingState.IDLE;

    if (currentState === CityBuildingState.BUILDING) {
      throw new BadRequestException('Already building');
    }
    if (currentLevel >= 15) {
      throw new BadRequestException('Max level reached');
    }

    const nextLevel = currentLevel + 1;
    const cfg = getLevelConfig(nextLevel);
    const isVip = IS_VIP_BUILDING.has(buildingType);

    const budgetUpdate: Record<string, any> = {};
    if (isVip) {
      budgetUpdate.budgetGems = { decrement: cfg.vipCostGems };
    } else if (cfg.standardCostGems != null) {
      budgetUpdate.budgetGems = { decrement: cfg.standardCostGems };
    } else {
      budgetUpdate.budgetCoins = { decrement: cfg.standardCostCoins! };
    }

    await this.prisma.city.update({ where: { id: cityId }, data: budgetUpdate });

    const buildFinishesAt = new Date(Date.now() + cfg.buildDurationMs);
    return this.prisma.cityBuilding.upsert({
      where: { cityId_buildingType: { cityId, buildingType } },
      create: { cityId, buildingType, level: nextLevel, state: CityBuildingState.BUILDING, buildFinishesAt },
      update: { level: nextLevel, state: CityBuildingState.BUILDING, buildFinishesAt },
    });
  }

  async skipBuild(
    cityId: string,
    buildingType: CityBuildingType,
    requesterId: string,
  ) {
    const membership = await this.prisma.cityMembership.findUnique({
      where: { playerId: requesterId },
    });
    if (!membership || membership.cityId !== cityId || !isAdvisorOrAbove(membership.role)) {
      throw new ForbiddenException('ADVISOR+ required');
    }

    const building = await this.prisma.cityBuilding.findUnique({
      where: { cityId_buildingType: { cityId, buildingType } },
    });
    if (!building || building.state !== CityBuildingState.BUILDING || !building.buildFinishesAt) {
      throw new BadRequestException('Not currently building');
    }

    const remainingMs = building.buildFinishesAt.getTime() - Date.now();
    const hoursRemaining = Math.ceil(Math.max(0, remainingMs) / (60 * 60 * 1000));
    const gemCost = hoursRemaining * INSTANT_SKIP_GEMS_PER_HOUR;

    await this.prisma.city.update({
      where: { id: cityId },
      data: { budgetGems: { decrement: gemCost } },
    });

    return this.prisma.cityBuilding.update({
      where: { id: building.id },
      data: { state: CityBuildingState.ACTIVE, buildFinishesAt: null },
    });
  }

  async activateBoost(
    cityId: string,
    buildingType: CityBuildingType,
    boostType: 'coins' | 'gems',
    requesterId: string,
  ) {
    const membership = await this.prisma.cityMembership.findUnique({
      where: { playerId: requesterId },
    });
    if (!membership || membership.cityId !== cityId || !isAdvisorOrAbove(membership.role)) {
      throw new ForbiddenException('ADVISOR+ required');
    }

    const building = await this.prisma.cityBuilding.findUnique({
      where: { cityId_buildingType: { cityId, buildingType } },
    });
    if (!building || building.state !== CityBuildingState.ACTIVE) {
      throw new BadRequestException('Building must be ACTIVE to boost');
    }
    if (building.boostFinishesAt && building.boostFinishesAt > new Date()) {
      throw new BadRequestException('Boost already active');
    }

    const cfg = getLevelConfig(building.level);
    const boostMultiplier = boostType === 'gems' ? 2.0 : 1.3;
    const budgetUpdate =
      boostType === 'gems'
        ? { budgetGems: { decrement: cfg.boostGemsCost } }
        : { budgetCoins: { decrement: cfg.boostCoinsCost } };

    await this.prisma.city.update({ where: { id: cityId }, data: budgetUpdate });

    return this.prisma.cityBuilding.update({
      where: { id: building.id },
      data: {
        boostMultiplier,
        boostFinishesAt: new Date(Date.now() + BOOST_DURATION_MS),
      },
    });
  }

  async listBuildings(cityId: string): Promise<CityBuildingDto[]> {
    const now = new Date();
    const buildings = await this.prisma.cityBuilding.findMany({ where: { cityId } });

    const toActivateIds = buildings
      .filter(b => b.state === CityBuildingState.BUILDING && b.buildFinishesAt && b.buildFinishesAt <= now)
      .map(b => b.id);

    if (toActivateIds.length > 0) {
      await this.prisma.cityBuilding.updateMany({
        where: { id: { in: toActivateIds } },
        data: { state: CityBuildingState.ACTIVE, buildFinishesAt: null },
      });
      for (const b of buildings) {
        if (toActivateIds.includes(b.id)) {
          b.state = CityBuildingState.ACTIVE;
          b.buildFinishesAt = null;
        }
      }
    }

    return buildings.map(b => {
      const isBoosted = b.boostFinishesAt != null && b.boostFinishesAt > now;
      const boostMult = isBoosted ? (b.boostMultiplier ?? 1) : 1;
      const bonus =
        b.state === CityBuildingState.ACTIVE
          ? b.level * BONUS_PER_LEVEL[b.buildingType] * boostMult
          : 0;
      return {
        buildingType: b.buildingType,
        level: b.level,
        state: b.state as 'IDLE' | 'BUILDING' | 'ACTIVE',
        isBoosted,
        boostMultiplier: b.boostMultiplier,
        boostFinishesAt: b.boostFinishesAt?.toISOString() ?? null,
        buildFinishesAt: b.buildFinishesAt?.toISOString() ?? null,
        currentBonus: bonus,
      };
    });
  }
}
