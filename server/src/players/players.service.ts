// server/src/players/players.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { calcRevenuePerMin } from '@shared/engine/ratingUtils';
import { getWorkerMood } from '@shared/engine/workerUtils';
import { gameConfig } from '@shared/config/gameConfig';

const PAGE_SIZE = 20;
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

export interface UserEntry {
  id: string;
  playerName: string;
  playerLevel: number;
  city: string | null;
  lastSeenAt: string;
}

export interface UsersListResult {
  entries: UserEntry[];
  total: number;
}

export interface PlayerProfileResult {
  id: string;
  playerName: string;
  playerLevel: number;
  playerXp: number;
  openedFloorsCount: number;
  city: string | null;
  lastSeenAt: string;
  createdAt: string;
  avgStars: number;
  revenuePerMin: number;
  maxRevenuePerMin: number;
  coinBonusPercent: number;
  xpBonusPercent: number;
  happyWorkers: number;
  specialistWorkers: number;
  totalWorkers: number;
  businessUpgrades: Record<string, number>;
  categoryProgress: Record<string, number>;
}

const USER_SELECT = {
  id: true,
  playerName: true,
  playerLevel: true,
  city: true,
  lastSeenAt: true,
} as const;

@Injectable()
export class PlayersService {
  constructor(private prisma: PrismaService) {}

  async getOnlinePlayers(page: number): Promise<UsersListResult> {
    const since = new Date(Date.now() - ONLINE_THRESHOLD_MS);
    const skip = (page - 1) * PAGE_SIZE;
    const [rows, total] = await Promise.all([
      this.prisma.player.findMany({
        where: { lastSeenAt: { gte: since } },
        select: USER_SELECT,
        orderBy: { lastSeenAt: 'desc' },
        skip,
        take: PAGE_SIZE,
      }),
      this.prisma.player.count({ where: { lastSeenAt: { gte: since } } }),
    ]);
    return {
      entries: rows.map((p) => ({ ...p, lastSeenAt: p.lastSeenAt.toISOString() })),
      total,
    };
  }

  async getNoCityPlayers(page: number): Promise<UsersListResult> {
    const skip = (page - 1) * PAGE_SIZE;
    const where = { OR: [{ city: null }, { city: '' }] };
    const [rows, total] = await Promise.all([
      this.prisma.player.findMany({
        where,
        select: USER_SELECT,
        orderBy: { playerLevel: 'desc' },
        skip,
        take: PAGE_SIZE,
      }),
      this.prisma.player.count({ where }),
    ]);
    return {
      entries: rows.map((p) => ({ ...p, lastSeenAt: p.lastSeenAt.toISOString() })),
      total,
    };
  }

  async searchPlayers(q: string, page: number): Promise<UsersListResult> {
    const skip = (page - 1) * PAGE_SIZE;
    const where = { playerName: { contains: q, mode: 'insensitive' as const } };
    const [rows, total] = await Promise.all([
      this.prisma.player.findMany({
        where,
        select: USER_SELECT,
        orderBy: { playerLevel: 'desc' },
        skip,
        take: PAGE_SIZE,
      }),
      this.prisma.player.count({ where }),
    ]);
    return {
      entries: rows.map((p) => ({ ...p, lastSeenAt: p.lastSeenAt.toISOString() })),
      total,
    };
  }

  async getPlayerProfile(id: string): Promise<PlayerProfileResult | null> {
    const player = await this.prisma.player.findUnique({
      where: { id },
      select: {
        id: true,
        playerName: true,
        playerLevel: true,
        playerXp: true,
        openedFloorsCount: true,
        city: true,
        lastSeenAt: true,
        createdAt: true,
        maxRevenuePerMin: true,
        state: {
          select: {
            coinBonusPercent: true,
            xpBonusPercent: true,
            businessUpgradeGreen: true,
            businessUpgradeBlue: true,
            businessUpgradeYellow: true,
            businessUpgradePurple: true,
            businessUpgradeRed: true,
            floorStars: true,
          },
        },
        floors: {
          select: {
            id: true,
            floorId: true,
            productions: {
              select: { slotIdx: true, typeId: true, stage: true, stageStartedAt: true },
              orderBy: { slotIdx: 'asc' },
            },
          },
        },
        workers: {
          select: {
            id: true,
            floorType: true,
            dreamJob: true,
            level: true,
            isSpecialist: true,
            assignedFloorId: true,
            assignedSlotIdx: true,
            female: true,
          },
        },
        floorTypes: { select: { floorId: true, floorType: true } },
        categoryProgress: { select: { categoryKey: true, currentLevel: true } },
      },
    });

    if (!player) return null;

    // Build openedFloorTypes map for calcRevenuePerMin
    const openedFloorTypes: Record<string, string> = {};
    for (const ft of player.floorTypes) {
      openedFloorTypes[String(ft.floorId)] = ft.floorType;
    }

    // Build floors shape expected by calcRevenuePerMin
    const floorsForCalc = player.floors.map((f) => ({
      id: f.floorId,
      productions: f.productions.map((p) => ({
        typeId: p.typeId,
        stage: p.stage,
        stageStartedAt: Number(p.stageStartedAt),
        slotIdx: p.slotIdx,
      })),
    }));

    // Build workers shape for calcRevenuePerMin
    const workersForCalc = player.workers.map((w) => ({
      id: w.id,
      assignedFloorId: w.assignedFloorId,
      assignedSlotIdx: w.assignedSlotIdx,
      isSpecialist: w.isSpecialist,
      level: w.level,
      floorType: w.floorType,
      dreamJob: w.dreamJob,
      female: w.female,
    }));

    const businessUpgradesForCalc: Record<string, number> = {
      green:  player.state?.businessUpgradeGreen  ?? 0,
      blue:   player.state?.businessUpgradeBlue   ?? 0,
      yellow: player.state?.businessUpgradeYellow ?? 0,
      purple: player.state?.businessUpgradePurple ?? 0,
      red:    player.state?.businessUpgradeRed    ?? 0,
    };
    const revenuePerMin = calcRevenuePerMin(
      floorsForCalc as any,
      workersForCalc as any,
      openedFloorTypes,
      gameConfig,
      Date.now(),
      businessUpgradesForCalc,
      player.state?.coinBonusPercent ?? 0,
      (player.state?.floorStars ?? {}) as Record<string, number>,
    );

    // Happy workers: worker has assigned floor and mood is 'good'
    let happyWorkers = 0;
    for (const w of player.workers) {
      if (w.assignedFloorId === null) continue;
      const staticFloor = gameConfig.floors.find((f) => f.id === w.assignedFloorId);
      const floorType = staticFloor
        ? staticFloor.floorType
        : (openedFloorTypes[String(w.assignedFloorId)] ?? '');
      const dbFloor = player.floors.find((f) => f.floorId === w.assignedFloorId);
      const prod = dbFloor?.productions.find((p) => p.slotIdx === w.assignedSlotIdx);
      const mood = getWorkerMood(
        w as any,
        floorType,
        prod?.typeId ?? null,
      );
      if (mood === 'good') happyWorkers++;
    }

    // floorStars avg
    const starsMap = (player.state?.floorStars ?? {}) as Record<string, number>;
    const starValues = Object.values(starsMap);
    const avgStars = player.openedFloorsCount > 0
      ? starValues.reduce((s, v) => s + v, 0) / player.openedFloorsCount
      : 0;

    // categoryProgress map
    const categoryProgress: Record<string, number> = {};
    for (const cp of player.categoryProgress) {
      categoryProgress[cp.categoryKey] = cp.currentLevel;
    }

    return {
      id: player.id,
      playerName: player.playerName,
      playerLevel: player.playerLevel,
      playerXp: player.playerXp,
      openedFloorsCount: player.openedFloorsCount,
      city: player.city,
      lastSeenAt: player.lastSeenAt.toISOString(),
      createdAt: player.createdAt.toISOString(),
      avgStars,
      revenuePerMin,
      maxRevenuePerMin: player.maxRevenuePerMin,
      coinBonusPercent: player.state?.coinBonusPercent ?? 0,
      xpBonusPercent: player.state?.xpBonusPercent ?? 0,
      happyWorkers,
      specialistWorkers: player.workers.filter((w) => w.isSpecialist).length,
      totalWorkers: player.workers.length,
      businessUpgrades: {
        green:  player.state?.businessUpgradeGreen  ?? 0,
        blue:   player.state?.businessUpgradeBlue   ?? 0,
        yellow: player.state?.businessUpgradeYellow ?? 0,
        purple: player.state?.businessUpgradePurple ?? 0,
        red:    player.state?.businessUpgradeRed    ?? 0,
      },
      categoryProgress,
    };
  }
}
