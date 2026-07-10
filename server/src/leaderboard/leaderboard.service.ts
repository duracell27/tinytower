import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const PAGE_SIZE = 20;

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

@Injectable()
export class LeaderboardService {
  constructor(private prisma: PrismaService) {}

  async getLeaderboard(tab: LeaderboardTab, page: number, playerId: string): Promise<LeaderboardResult> {
    const skip = (page - 1) * PAGE_SIZE;

    const orderBy =
      tab === 'level'   ? [{ playerLevel: 'desc' as const },       { createdAt: 'asc' as const }]
      : tab === 'floors' ? [{ openedFloorsCount: 'desc' as const }, { createdAt: 'asc' as const }]
      :                    [{ maxRevenuePerMin: 'desc' as const },   { createdAt: 'asc' as const }];

    const select = {
      id: true,
      playerName: true,
      playerLevel: true,
      openedFloorsCount: true,
      maxRevenuePerMin: true,
    };

    const [rows, total, me] = await Promise.all([
      this.prisma.player.findMany({ select, orderBy, skip, take: PAGE_SIZE }),
      this.prisma.player.count(),
      this.prisma.player.findUnique({ where: { id: playerId }, select }),
    ]);

    const myValue = me
      ? (tab === 'level' ? me.playerLevel : tab === 'floors' ? me.openedFloorsCount : me.maxRevenuePerMin)
      : 0;

    const aboveMe =
      tab === 'level'    ? { playerLevel: { gt: myValue } }
      : tab === 'floors' ? { openedFloorsCount: { gt: myValue } }
      :                    { maxRevenuePerMin: { gt: myValue } };

    const rank = await this.prisma.player.count({ where: aboveMe }) + 1;

    return {
      entries: rows.map((p, i) => ({
        rank: skip + i + 1,
        playerId: p.id,
        playerName: p.playerName,
        value: tab === 'level' ? p.playerLevel : tab === 'floors' ? p.openedFloorsCount : p.maxRevenuePerMin,
      })),
      total,
      currentPlayer: { rank, value: myValue },
    };
  }
}
