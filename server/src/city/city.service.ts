import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CityRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getCityLevel, getCityMaxMembers, getCityXpForNextLevel } from './city-level';

const CITY_FOUND_COST_GEMS = 1000;
const CITY_RENAME_COST_BALANCE = 500;
const MIN_FLOORS_TO_JOIN = 10;

const ROLE_ORDER: CityRole[] = [
  CityRole.NEWBIE,
  CityRole.CITIZEN,
  CityRole.BUSINESSMAN,
  CityRole.ADVISOR,
  CityRole.VICE_MAYOR,
  CityRole.ACTING_MAYOR,
  CityRole.MAYOR,
];

function roleRank(role: CityRole): number {
  return ROLE_ORDER.indexOf(role);
}

export interface MemberDto {
  playerId: string;
  playerName: string;
  playerLevel: number;
  role: CityRole;
  joinedAt: string;
  lastSeenAt: string;
}

export interface CityDetailDto {
  id: string;
  name: string;
  description: string | null;
  level: number;
  xp: number;
  xpForNextLevel: number | null;
  memberCount: number;
  maxMembers: number;
  members: MemberDto[];
  myRole: CityRole | null;
  createdAt: string;
}

export interface CitySummaryDto {
  id: string;
  name: string;
  description: string | null;
  level: number;
  memberCount: number;
  maxMembers: number;
}

export interface CityRankingEntry {
  rank: number;
  id: string;
  name: string;
  description: string | null;
  level: number;
  xp: number;
  memberCount: number;
  maxMembers: number;
}

export interface CityRankingsDto {
  entries: CityRankingEntry[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class CityService {
  constructor(private prisma: PrismaService) {}

  private async getMyMembership(playerId: string) {
    return this.prisma.cityMembership.findUnique({
      where: { playerId },
      include: { city: true },
    });
  }

  private async computeCityXp(cityId: string): Promise<number> {
    const memberships = await this.prisma.cityMembership.findMany({
      where: { cityId },
      select: { xpAtJoin: true, player: { select: { playerXp: true } } },
    });
    return memberships.reduce((sum, m) => sum + Math.max(0, m.player.playerXp - m.xpAtJoin), 0);
  }

  private async buildCityDetail(cityId: string, myPlayerId: string | null): Promise<CityDetailDto> {
    const city = await this.prisma.city.findUnique({
      where: { id: cityId },
      include: {
        members: {
          include: { player: { select: { playerName: true, playerLevel: true, lastSeenAt: true } } },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
    if (!city) throw new NotFoundException('City not found');

    const xp = await this.computeCityXp(cityId);
    const level = getCityLevel(xp);
    const maxMembers = getCityMaxMembers(level);
    const xpForNextLevel = getCityXpForNextLevel(level);

    const myMembership = myPlayerId
      ? city.members.find((m) => m.playerId === myPlayerId)
      : null;

    return {
      id: city.id,
      name: city.name,
      description: city.description,
      level,
      xp,
      xpForNextLevel,
      memberCount: city.members.length,
      maxMembers,
      myRole: myMembership?.role ?? null,
      createdAt: city.createdAt.toISOString(),
      members: city.members.map((m) => ({
        playerId: m.playerId,
        playerName: m.player.playerName,
        playerLevel: m.player.playerLevel,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
        lastSeenAt: m.player.lastSeenAt.toISOString(),
      })),
    };
  }

  async createCity(playerId: string, name: string): Promise<CityDetailDto> {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 30) {
      throw new BadRequestException('City name must be 1–30 characters');
    }

    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      include: {
        state: { select: { gems: true } },
        floors: { select: { id: true } },
        cityMembership: true,
      },
    });
    if (!player) throw new NotFoundException('Player not found');
    if (player.cityMembership) throw new ConflictException('Already in a city');
    if (player.floors.length < MIN_FLOORS_TO_JOIN) {
      throw new BadRequestException(`Need at least ${MIN_FLOORS_TO_JOIN} floors to found a city`);
    }
    if ((player.state?.gems ?? 0) < CITY_FOUND_COST_GEMS) {
      throw new BadRequestException('Not enough gems (need 1000)');
    }

    const existing = await this.prisma.city.findUnique({ where: { name: trimmed } });
    if (existing) throw new ConflictException('City name already taken');

    const currentXp = player.playerXp ?? 0;

    const [city] = await this.prisma.$transaction([
      this.prisma.city.create({
        data: {
          name: trimmed,
          members: {
            create: { playerId, role: CityRole.MAYOR, xpAtJoin: currentXp },
          },
        },
      }),
      this.prisma.playerState.update({
        where: { playerId },
        data: { gems: { decrement: CITY_FOUND_COST_GEMS } },
      }),
      this.prisma.player.update({
        where: { id: playerId },
        data: { city: trimmed },
      }),
    ]);

    return this.buildCityDetail(city.id, playerId);
  }

  async getMyCityInfo(playerId: string): Promise<CityDetailDto | null> {
    const membership = await this.getMyMembership(playerId);
    if (!membership) return null;
    return this.buildCityDetail(membership.cityId, playerId);
  }

  async getCityById(cityId: string, requesterId: string): Promise<CityDetailDto> {
    return this.buildCityDetail(cityId, requesterId);
  }

  async searchCities(q: string): Promise<CitySummaryDto[]> {
    const cities = await this.prisma.city.findMany({
      where: q ? { name: { contains: q, mode: 'insensitive' } } : {},
      include: { members: { select: { playerId: true } } },
      take: 20,
      orderBy: { name: 'asc' },
    });

    return Promise.all(
      cities.map(async (city) => {
        const xp = await this.computeCityXp(city.id);
        const level = getCityLevel(xp);
        return {
          id: city.id,
          name: city.name,
          description: city.description,
          level,
          memberCount: city.members.length,
          maxMembers: getCityMaxMembers(level),
        };
      }),
    );
  }

  async invitePlayer(actorId: string, cityId: string, targetPlayerId: string): Promise<void> {
    const actorMembership = await this.prisma.cityMembership.findUnique({
      where: { playerId: actorId },
    });
    if (!actorMembership || actorMembership.cityId !== cityId) {
      throw new ForbiddenException('Not a member of this city');
    }

    const canInviteRoles: CityRole[] = [CityRole.MAYOR, CityRole.ACTING_MAYOR, CityRole.VICE_MAYOR, CityRole.ADVISOR];
    if (!canInviteRoles.includes(actorMembership.role)) {
      throw new ForbiddenException('Insufficient role to invite');
    }

    const target = await this.prisma.player.findUnique({
      where: { id: targetPlayerId },
      include: {
        floors: { select: { id: true } },
        cityMembership: true,
      },
    });
    if (!target) throw new NotFoundException('Player not found');
    if (target.cityMembership) throw new ConflictException('Player is already in a city');
    if (target.floors.length < MIN_FLOORS_TO_JOIN) {
      throw new BadRequestException(`Player needs at least ${MIN_FLOORS_TO_JOIN} floors`);
    }

    const city = await this.prisma.city.findUnique({
      where: { id: cityId },
      include: { members: { select: { playerId: true } } },
    });
    if (!city) throw new NotFoundException('City not found');

    const xp = await this.computeCityXp(cityId);
    const level = getCityLevel(xp);
    const maxMembers = getCityMaxMembers(level);
    if (city.members.length >= maxMembers) {
      throw new BadRequestException('City is at maximum capacity');
    }

    const targetXpAtJoin = target.playerXp ?? 0;

    await this.prisma.$transaction([
      this.prisma.cityMembership.create({
        data: { cityId, playerId: targetPlayerId, role: CityRole.NEWBIE, xpAtJoin: targetXpAtJoin },
      }),
      this.prisma.player.update({
        where: { id: targetPlayerId },
        data: { city: city.name },
      }),
    ]);
  }

  async leaveCity(playerId: string): Promise<void> {
    const membership = await this.getMyMembership(playerId);
    if (!membership) throw new NotFoundException('Not in a city');

    const { cityId } = membership;

    if (membership.role === CityRole.MAYOR) {
      const otherMembers = await this.prisma.cityMembership.count({
        where: { cityId, playerId: { not: playerId } },
      });
      if (otherMembers > 0) {
        throw new BadRequestException('Transfer MAYOR role before leaving');
      }
      // Last member — dissolve city
      await this.prisma.$transaction([
        this.prisma.cityMembership.delete({ where: { playerId } }),
        this.prisma.city.delete({ where: { id: cityId } }),
        this.prisma.player.update({ where: { id: playerId }, data: { city: null } }),
      ]);
      return;
    }

    await this.prisma.$transaction([
      this.prisma.cityMembership.delete({ where: { playerId } }),
      this.prisma.player.update({ where: { id: playerId }, data: { city: null } }),
    ]);
  }

  async kickMember(actorId: string, cityId: string, targetPlayerId: string): Promise<void> {
    const [actorMs, targetMs] = await Promise.all([
      this.prisma.cityMembership.findUnique({ where: { playerId: actorId } }),
      this.prisma.cityMembership.findUnique({ where: { playerId: targetPlayerId } }),
    ]);

    if (!actorMs || actorMs.cityId !== cityId) throw new ForbiddenException('Not a member of this city');
    if (!targetMs || targetMs.cityId !== cityId) throw new NotFoundException('Target not in this city');
    if (actorId === targetPlayerId) throw new BadRequestException('Cannot kick yourself');

    const canKick = this.canActOnTarget(actorMs.role, targetMs.role, 'kick');
    if (!canKick) throw new ForbiddenException('Insufficient role to kick this member');

    await this.prisma.$transaction([
      this.prisma.cityMembership.delete({ where: { playerId: targetPlayerId } }),
      this.prisma.player.update({ where: { id: targetPlayerId }, data: { city: null } }),
    ]);
  }

  async changeMemberRole(actorId: string, cityId: string, targetPlayerId: string, newRole: CityRole): Promise<void> {
    const [actorMs, targetMs] = await Promise.all([
      this.prisma.cityMembership.findUnique({ where: { playerId: actorId } }),
      this.prisma.cityMembership.findUnique({ where: { playerId: targetPlayerId } }),
    ]);

    if (!actorMs || actorMs.cityId !== cityId) throw new ForbiddenException('Not a member of this city');
    if (!targetMs || targetMs.cityId !== cityId) throw new NotFoundException('Target not in this city');

    const canPromote = this.canActOnTarget(actorMs.role, targetMs.role, 'promote');
    if (!canPromote) throw new ForbiddenException('Insufficient role to change this member\'s role');

    // VICE_MAYOR can only set roles up to ADVISOR
    if (actorMs.role === CityRole.VICE_MAYOR && roleRank(newRole) >= roleRank(CityRole.VICE_MAYOR)) {
      throw new ForbiddenException('Vice Mayor can only promote up to Advisor');
    }

    // If assigning MAYOR, demote current actor from MAYOR to ACTING_MAYOR (transfer)
    const updates: any[] = [
      this.prisma.cityMembership.update({
        where: { playerId: targetPlayerId },
        data: { role: newRole },
      }),
    ];

    if (newRole === CityRole.MAYOR && actorMs.role === CityRole.MAYOR) {
      updates.push(
        this.prisma.cityMembership.update({
          where: { playerId: actorId },
          data: { role: CityRole.ACTING_MAYOR },
        }),
      );
    }

    await this.prisma.$transaction(updates);
  }

  async updateCity(actorId: string, cityId: string, updates: { name?: string; description?: string }): Promise<CityDetailDto> {
    const actorMs = await this.prisma.cityMembership.findUnique({
      where: { playerId: actorId },
    });
    if (!actorMs || actorMs.cityId !== cityId) throw new ForbiddenException('Not a member of this city');

    const canEdit: CityRole[] = [CityRole.MAYOR, CityRole.ACTING_MAYOR];
    if (!canEdit.includes(actorMs.role)) throw new ForbiddenException('Insufficient role to edit city settings');

    const data: { name?: string; description?: string | null } = {};

    if (updates.description !== undefined) {
      data.description = updates.description.trim() || null;
    }

    if (updates.name !== undefined) {
      const trimmed = updates.name.trim();
      if (!trimmed || trimmed.length > 30) throw new BadRequestException('City name must be 1–30 characters');

      const existing = await this.prisma.city.findUnique({ where: { name: trimmed } });
      if (existing && existing.id !== cityId) throw new ConflictException('City name already taken');

      const player = await this.prisma.player.findUnique({ where: { id: actorId }, select: { balance: true } });
      if (!player || player.balance < CITY_RENAME_COST_BALANCE) {
        throw new BadRequestException(`Renaming costs ${CITY_RENAME_COST_BALANCE} coins`);
      }

      data.name = trimmed;

      await this.prisma.$transaction([
        this.prisma.city.update({ where: { id: cityId }, data }),
        this.prisma.player.update({ where: { id: actorId }, data: { balance: { decrement: CITY_RENAME_COST_BALANCE } } }),
        this.prisma.player.updateMany({ where: { cityMembership: { cityId } }, data: { city: trimmed } }),
      ]);

      return this.buildCityDetail(cityId, actorId);
    }

    await this.prisma.city.update({ where: { id: cityId }, data });
    return this.buildCityDetail(cityId, actorId);
  }

  async getCityRankings(page: number): Promise<CityRankingsDto> {
    const PAGE_SIZE = 20;
    const skip = (page - 1) * PAGE_SIZE;

    const [cities, total] = await Promise.all([
      this.prisma.city.findMany({
        include: { members: { select: { playerId: true } } },
        skip,
        take: PAGE_SIZE,
      }),
      this.prisma.city.count(),
    ]);

    const entries = await Promise.all(
      cities.map(async (city) => {
        const xp = await this.computeCityXp(city.id);
        const level = getCityLevel(xp);
        return { id: city.id, name: city.name, description: city.description, level, xp, memberCount: city.members.length, maxMembers: getCityMaxMembers(level) };
      }),
    );

    entries.sort((a, b) => b.xp - a.xp);

    return {
      entries: entries.map((e, i) => ({ rank: skip + i + 1, ...e })),
      total,
      page,
      pageSize: PAGE_SIZE,
    };
  }

  async getCityBonusForPlayer(playerId: string): Promise<{ level: number } | null> {
    const membership = await this.prisma.cityMembership.findUnique({ where: { playerId } });
    if (!membership) return null;
    const xp = await this.computeCityXp(membership.cityId);
    return { level: getCityLevel(xp) };
  }

  private canActOnTarget(actorRole: CityRole, targetRole: CityRole, action: 'kick' | 'promote'): boolean {
    if (actorRole === CityRole.MAYOR) return true;

    if (actorRole === CityRole.ACTING_MAYOR) {
      return targetRole !== CityRole.MAYOR;
    }

    if (actorRole === CityRole.VICE_MAYOR) {
      return roleRank(targetRole) <= roleRank(CityRole.ADVISOR);
    }

    return false;
  }
}
