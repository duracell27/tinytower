import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { currentWeekStart } from '../city/city-task.constants';

@Controller('tournament/tokens')
@UseGuards(JwtAuthGuard)
export class TournamentPlayerController {
  constructor(private prisma: PrismaService) {}

  @Get('my-entry')
  async getMyEntry(@Req() req: { user: { playerId: string } }) {
    const playerId = req.user.playerId;
    const weekStart = currentWeekStart();

    const tournament = await this.prisma.playerTokenTournament.findUnique({
      where: { weekStart },
    });
    if (!tournament) return null;

    const entry = await this.prisma.playerTokenTournamentEntry.findUnique({
      where: { tournamentId_playerId: { tournamentId: tournament.id, playerId } },
    });
    if (!entry) return null;

    return {
      rank: entry.rank,
      tokenCount: entry.tokenCount,
      gemsReward: entry.gemsReward,
      bonusTokens: entry.bonusTokens,
      coinsReward: entry.coinsReward,
      weekStart: weekStart.toISOString(),
    };
  }
}
