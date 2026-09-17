import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CityRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getCityLevel, getCityMaxMembers, getCityXpForNextLevel, CITY_LEVEL_THRESHOLDS } from './city-level';

const CITY_FOUND_COST_GEMS = 1000;
const CITY_RENAME_COST_GEMS = 500;
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
  cityXp: number;
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

    const xp = city.cityXp;
    const level = getCityLevel(xp);
    const maxMembers = getCityMaxMembers(level);
    const xpForNextLevel = getCityXpForNextLevel(level);
    const xpCurrentLevelBase = CITY_LEVEL_THRESHOLDS[level - 1] ?? 0;
    const xpRelative = xp - xpCurrentLevelBase;

    const myMembership = myPlayerId
      ? city.members.find((m) => m.playerId === myPlayerId)
      : null;

    return {
      id: city.id,
      name: city.name,
      description: city.description,
      level,
      xp: xpRelative,
      xpForNextLevel,
      memberCount: city.members.length,
      maxMembers,
      myRole: myMembership?.role ?? null,
      createdAt: city.createdAt.toISOString(),
      members: city.members
        .sort((a, b) => b.cityXp - a.cityXp)
        .map((m) => ({
          playerId: m.playerId,
          playerName: m.player.playerName,
          playerLevel: m.player.playerLevel,
          role: m.role,
          cityXp: m.cityXp,
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
    if (player.floors.length + 1 < MIN_FLOORS_TO_JOIN) {
      throw new BadRequestException(`Need at least ${MIN_FLOORS_TO_JOIN} floors to found a city`);
    }
    if ((player.state?.gems ?? 0) < CITY_FOUND_COST_GEMS) {
      throw new BadRequestException('Not enough gems (need 1000)');
    }

    const existing = await this.prisma.city.findUnique({ where: { name: trimmed } });
    if (existing) throw new ConflictException('City name already taken');

    const [city] = await this.prisma.$transaction([
      this.prisma.city.create({
        data: {
          name: trimmed,
          members: {
            create: { playerId, role: CityRole.MAYOR },
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

    return cities.map((city) => {
      const level = getCityLevel(city.cityXp);
      return {
        id: city.id,
        name: city.name,
        description: city.description,
        level,
        memberCount: city.members.length,
        maxMembers: getCityMaxMembers(level),
      };
    });
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

    const [target, city] = await Promise.all([
      this.prisma.player.findUnique({
        where: { id: targetPlayerId },
        select: { id: true, playerName: true, openedFloorsCount: true, cityMembership: { select: { cityId: true } } },
      }),
      this.prisma.city.findUnique({
        where: { id: cityId },
        include: { members: { select: { playerId: true } } },
      }),
    ]);
    if (!target) throw new NotFoundException('Player not found');
    if (target.cityMembership) throw new ConflictException('Player is already in a city');
    if (target.openedFloorsCount + 1 < MIN_FLOORS_TO_JOIN) {
      throw new BadRequestException(`Player needs at least ${MIN_FLOORS_TO_JOIN} floors`);
    }
    if (!city) throw new NotFoundException('City not found');

    const level = getCityLevel(city.cityXp);
    if (city.members.length >= getCityMaxMembers(level)) {
      throw new BadRequestException('City is at maximum capacity');
    }

    // Check no pending invite already exists
    const existing = await this.prisma.cityInvite.findFirst({
      where: { cityId, invitedPlayerId: targetPlayerId, status: 'PENDING' },
    });
    if (existing) throw new ConflictException('Invite already pending for this player');

    const actor = await this.prisma.player.findUnique({
      where: { id: actorId },
      select: { playerName: true },
    });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      const invite = await tx.cityInvite.create({
        data: { cityId, invitedById: actorId, invitedPlayerId: targetPlayerId, expiresAt },
      });
      await tx.mailMessage.create({
        data: {
          fromId: actorId,
          toId: targetPlayerId,
          subject: `City Invite: ${city.name}`,
          body: JSON.stringify({
            type: 'city_invite',
            cityId,
            cityName: city.name,
            cityLevel: level,
            invitedByName: actor?.playerName ?? 'Unknown',
            token: invite.token,
          }),
          cityInviteId: invite.id,
        },
      });
    });
  }

  async respondToInvite(playerId: string, token: string, accept: boolean): Promise<void> {
    const invite = await this.prisma.cityInvite.findUnique({
      where: { token },
      include: { city: { include: { members: { select: { playerId: true } } } } },
    });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.invitedPlayerId !== playerId) throw new ForbiddenException('Not your invite');
    if (invite.status !== 'PENDING') throw new BadRequestException('Invite already responded');
    if (invite.expiresAt < new Date()) {
      await this.prisma.cityInvite.update({ where: { token }, data: { status: 'EXPIRED' } });
      throw new BadRequestException('Invite has expired');
    }

    if (!accept) {
      await this.prisma.cityInvite.update({ where: { token }, data: { status: 'DECLINED' } });
      return;
    }

    // Check player still eligible
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: { cityMembership: true },
    });
    if (player?.cityMembership) throw new ConflictException('You are already in a city');

    const cityLevel = getCityLevel(invite.city.cityXp);
    if (invite.city.members.length >= getCityMaxMembers(cityLevel)) {
      throw new BadRequestException('City is now at maximum capacity');
    }

    await this.prisma.$transaction([
      this.prisma.cityInvite.update({ where: { token }, data: { status: 'ACCEPTED' } }),
      this.prisma.cityMembership.create({
        data: { cityId: invite.cityId, playerId, role: CityRole.NEWBIE },
      }),
      this.prisma.player.update({
        where: { id: playerId },
        data: { city: invite.city.name },
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

      const playerState = await this.prisma.playerState.findUnique({ where: { playerId: actorId }, select: { gems: true } });
      if (!playerState || playerState.gems < CITY_RENAME_COST_GEMS) {
        throw new BadRequestException(`Renaming costs ${CITY_RENAME_COST_GEMS} gems`);
      }

      data.name = trimmed;

      await this.prisma.$transaction([
        this.prisma.city.update({ where: { id: cityId }, data }),
        this.prisma.playerState.update({ where: { playerId: actorId }, data: { gems: { decrement: CITY_RENAME_COST_GEMS } } }),
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

    const entries = cities.map((city) => {
      const level = getCityLevel(city.cityXp);
      return { id: city.id, name: city.name, description: city.description, level, xp: city.cityXp, memberCount: city.members.length, maxMembers: getCityMaxMembers(level) };
    });

    entries.sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level;
      // Same level: higher XP progress to next level wins
      const currentThreshold = CITY_LEVEL_THRESHOLDS[a.level - 1] ?? 0;
      const nextThreshold = getCityXpForNextLevel(a.level);
      if (nextThreshold === null) return 0; // both at max level
      const range = nextThreshold - currentThreshold;
      if (range === 0) return 0;
      return (b.xp - currentThreshold) / range - (a.xp - currentThreshold) / range;
    });

    return {
      entries: entries.map((e, i) => ({ rank: skip + i + 1, ...e })),
      total,
      page,
      pageSize: PAGE_SIZE,
    };
  }

  async deleteCity(actorId: string, cityId: string): Promise<void> {
    const actorMs = await this.prisma.cityMembership.findUnique({
      where: { playerId: actorId },
    });
    if (!actorMs || actorMs.cityId !== cityId) throw new ForbiddenException('Not a member of this city');
    if (actorMs.role !== CityRole.MAYOR) throw new ForbiddenException('Only the Mayor can delete the city');

    const memberIds = await this.prisma.cityMembership.findMany({
      where: { cityId },
      select: { playerId: true },
    });

    await this.prisma.$transaction([
      this.prisma.cityMembership.deleteMany({ where: { cityId } }),
      this.prisma.player.updateMany({
        where: { id: { in: memberIds.map((m) => m.playerId) } },
        data: { city: null },
      }),
      this.prisma.cityInvite.deleteMany({ where: { cityId } }),
      this.prisma.city.delete({ where: { id: cityId } }),
    ]);
  }

  async getCityBonusForPlayer(playerId: string): Promise<{ level: number } | null> {
    const membership = await this.prisma.cityMembership.findUnique({
      where: { playerId },
      include: { city: { select: { cityXp: true } } },
    });
    if (!membership) return null;
    return { level: getCityLevel(membership.city.cityXp) };
  }

  async getXpStats(cityId: string, requesterId: string) {
    const city = await this.prisma.city.findUnique({
      where: { id: cityId },
      include: {
        members: {
          include: { player: { select: { playerName: true, playerLevel: true } } },
        },
      },
    });
    if (!city) throw new NotFoundException('City not found');

    const isMember = city.members.some((m) => m.playerId === requesterId);
    if (!isMember) throw new ForbiddenException('Not a member of this city');

    const sorted = [...city.members].sort((a, b) => b.xpPeriod - a.xpPeriod);
    const totalXpPeriod = sorted.reduce((sum, m) => sum + m.xpPeriod, 0);

    return {
      periodStart: city.xpPeriodStart.toISOString(),
      totalXpPeriod,
      members: sorted.map((m) => ({
        playerId: m.playerId,
        playerName: m.player.playerName,
        playerLevel: m.player.playerLevel,
        role: m.role,
        xpPeriod: m.xpPeriod,
        percent: totalXpPeriod > 0 ? Math.round((m.xpPeriod / totalXpPeriod) * 100) : 0,
      })),
    };
  }

  async resetXpPeriod(cityId: string, actorId: string): Promise<void> {
    const actorMs = await this.prisma.cityMembership.findUnique({
      where: { playerId: actorId },
    });
    if (!actorMs || actorMs.cityId !== cityId) throw new ForbiddenException('Not a member of this city');
    if (actorMs.role !== CityRole.MAYOR) throw new ForbiddenException('Only the Mayor can reset the XP period');

    await this.prisma.$transaction([
      this.prisma.cityMembership.updateMany({ where: { cityId }, data: { xpPeriod: 0 } }),
      this.prisma.city.update({ where: { id: cityId }, data: { xpPeriodStart: new Date() } }),
    ]);
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
