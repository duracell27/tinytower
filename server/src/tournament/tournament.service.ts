import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { currentWeekStart } from '../city/city-task.constants';
import {
  GEMS_BY_RANK, BONUS_TOKENS_BY_RANK,
  levelBracket, coinsReward, generateRandomTokens,
} from './tournament.constants';

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  playerLevel: number;
  tokenCount: number;
  gemsReward: number;
  bonusTokens: number;
  coinsReward: number;
}

export interface LeaderboardDto {
  weekStart: string;
  alreadyPublished: boolean;
  totalParticipants: number;
  entries: LeaderboardEntry[];
}

function isWeekClosed(weekStart: Date): boolean {
  const saturdayStart = new Date(weekStart.getTime() + 5 * 86_400_000);
  return new Date() >= saturdayStart;
}

@Injectable()
export class TournamentService {
  constructor(private prisma: PrismaService) {}

  async getLeaderboard(weekStartIso: string): Promise<LeaderboardDto> {
    const weekStart = new Date(weekStartIso);
    if (isNaN(weekStart.getTime())) throw new BadRequestException('Invalid weekStart');

    const [rows, existing] = await Promise.all([
      this.prisma.playerWeeklyTokens.findMany({
        where: { weekStart },
        include: { player: { select: { playerName: true, playerLevel: true } } },
        orderBy: { count: 'desc' },
      }),
      this.prisma.playerTokenTournament.findUnique({ where: { weekStart } }),
    ]);

    const entries: LeaderboardEntry[] = rows.map((row, idx) => {
      const rank = idx + 1;
      return {
        rank,
        playerId: row.playerId,
        playerName: row.player.playerName,
        playerLevel: row.player.playerLevel,
        tokenCount: row.count,
        gemsReward: GEMS_BY_RANK[rank] ?? 0,
        bonusTokens: BONUS_TOKENS_BY_RANK[rank] ?? 0,
        coinsReward: coinsReward(row.count, row.player.playerLevel),
      };
    });

    return {
      weekStart: weekStart.toISOString(),
      alreadyPublished: !!existing,
      totalParticipants: rows.length,
      entries,
    };
  }

  async publishResults(adminPlayerId: string, weekStartIso: string): Promise<{ published: number }> {
    const weekStart = new Date(weekStartIso);
    if (isNaN(weekStart.getTime())) throw new BadRequestException('Invalid weekStart');
    if (!isWeekClosed(weekStart)) throw new BadRequestException('Week is not closed yet (Sat must have begun)');

    const existing = await this.prisma.playerTokenTournament.findUnique({ where: { weekStart } });
    if (existing) throw new BadRequestException('Results already published for this week');

    const rows = await this.prisma.playerWeeklyTokens.findMany({
      where: { weekStart },
      include: { player: { select: { playerName: true, playerLevel: true } } },
      orderBy: { count: 'desc' },
    });

    const participants = rows.filter((r) => r.count > 0);
    if (participants.length === 0) throw new BadRequestException('No token data for this week');

    await this.prisma.$transaction(async (tx: any) => {
      const tournament = await tx.playerTokenTournament.create({
        data: { weekStart, createdBy: adminPlayerId },
      });

      for (let i = 0; i < participants.length; i++) {
        const row = participants[i];
        const rank = i + 1;
        const gems = GEMS_BY_RANK[rank] ?? 0;
        const bonus = BONUS_TOKENS_BY_RANK[rank] ?? 0;
        const coins = coinsReward(row.count, row.player.playerLevel);

        await tx.playerTokenTournamentEntry.create({
          data: {
            tournamentId: tournament.id,
            playerId: row.playerId,
            rank: rank <= 10 ? rank : null,
            tokenCount: row.count,
            gemsReward: gems,
            bonusTokens: bonus,
            coinsReward: coins,
          },
        });

        await tx.player.update({
          where: { id: row.playerId },
          data: { balance: { increment: coins } },
        });

        if (rank <= 10) {
          const tokenDistribution = generateRandomTokens(bonus);
          await tx.playerState.update({
            where: { playerId: row.playerId },
            data: {
              gems: { increment: gems },
              tokenGreen:  { increment: tokenDistribution.green },
              tokenBlue:   { increment: tokenDistribution.blue },
              tokenYellow: { increment: tokenDistribution.yellow },
              tokenPurple: { increment: tokenDistribution.purple },
              tokenRed:    { increment: tokenDistribution.red },
            },
          });
        }

        const isTop10 = rank <= 10;
        const subject = isTop10 ? '🏆 Token Tournament Results' : 'Token Tournament Results';
        const body = isTop10
          ? `Congratulations! You placed #${rank} in this week's tournament.\n\nTokens collected: ${row.count}\nRewards:\n  • ${gems} 💎 gems\n  • ${bonus} 🔑 random tokens\n  • ${coins.toLocaleString()} 🪙 coins\n\nRewards have been added to your account.`
          : `Thanks for participating in this week's tournament!\n\nTokens collected: ${row.count}\nRewards:\n  • ${coins.toLocaleString()} 🪙 coins\n\nRewards have been added to your account.`;

        await tx.mailMessage.create({
          data: { fromId: adminPlayerId, toId: row.playerId, subject, body },
        });
      }
    });

    return { published: participants.length };
  }
}
