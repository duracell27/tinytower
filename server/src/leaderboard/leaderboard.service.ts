import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../auth/redis.provider';
import type Redis from 'ioredis';

const PAGE_SIZE = 20;
const CACHE_TTL = 300;

export type LeaderboardTab = 'level' | 'floors' | 'revenue';

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  value: number;
}

export interface LeaderboardResult {
  entries: LeaderboardEntry[];
  total: number;
  currentPlayer: { rank: number; value: number };
}

interface CachedPage {
  entries: LeaderboardEntry[];
  total: number;
}

@Injectable()
export class LeaderboardService {
  constructor(
    private prisma: PrismaService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  async getLeaderboard(tab: LeaderboardTab, page: number, playerId: string): Promise<LeaderboardResult> {
    const cacheKey = `lb:${tab}:${page}`;

    const [cached, me] = await Promise.all([
      this.redis.get(cacheKey).catch(() => null),
      this.prisma.player.findUnique({
        where: { id: playerId },
        select: { playerLevel: true, openedFloorsCount: true, maxRevenuePerMin: true },
      }),
    ]);

    const myValue = me
      ? (tab === 'level' ? me.playerLevel : tab === 'floors' ? me.openedFloorsCount : me.maxRevenuePerMin)
      : 0;

    const aboveMe =
      tab === 'level'    ? { playerLevel:        { gt: myValue } }
      : tab === 'floors' ? { openedFloorsCount:   { gt: myValue } }
      :                    { maxRevenuePerMin:     { gt: myValue } };

    if (cached) {
      const { entries, total } = JSON.parse(cached) as CachedPage;
      const rank = await this.prisma.player.count({ where: aboveMe }) + 1;
      return { entries, total, currentPlayer: { rank, value: myValue } };
    }

    const skip = (page - 1) * PAGE_SIZE;
    const orderBy =
      tab === 'level'    ? [{ playerLevel:       'desc' as const }, { createdAt: 'asc' as const }]
      : tab === 'floors' ? [{ openedFloorsCount:  'desc' as const }, { createdAt: 'asc' as const }]
      :                    [{ maxRevenuePerMin:    'desc' as const }, { createdAt: 'asc' as const }];

    const select = {
      id: true,
      playerName: true,
      playerLevel: true,
      openedFloorsCount: true,
      maxRevenuePerMin: true,
    };

    const [rows, total] = await Promise.all([
      this.prisma.player.findMany({ select, orderBy, skip, take: PAGE_SIZE }),
      this.prisma.player.count(),
    ]);

    const entries: LeaderboardEntry[] = rows.map((p, i) => ({
      rank: skip + i + 1,
      playerId: p.id,
      playerName: p.playerName,
      value: tab === 'level' ? p.playerLevel : tab === 'floors' ? p.openedFloorsCount : p.maxRevenuePerMin,
    }));

    const [rank] = await Promise.all([
      this.prisma.player.count({ where: aboveMe }).then(n => n + 1),
      this.redis.setex(cacheKey, CACHE_TTL, JSON.stringify({ entries, total } satisfies CachedPage)).catch(() => {}),
    ]);

    return { entries, total, currentPlayer: { rank, value: myValue } };
  }
}
