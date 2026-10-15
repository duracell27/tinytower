import { Controller, Get, Post, Query, Body, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../admin/admin.guard';
import { TournamentService } from './tournament.service';

@Controller('admin/tournament/tokens')
@UseGuards(JwtAuthGuard, AdminGuard)
export class TournamentController {
  constructor(private tournamentService: TournamentService) {}

  @Get('leaderboard')
  getLeaderboard(@Query('weekStart') weekStart: string) {
    if (!weekStart) throw new BadRequestException('weekStart is required');
    return this.tournamentService.getLeaderboard(weekStart);
  }

  @Post('result')
  publishResults(
    @Req() req: { user: { playerId: string } },
    @Body() body: { weekStart: string },
  ) {
    if (!body?.weekStart) throw new BadRequestException('weekStart is required');
    return this.tournamentService.publishResults(req.user.playerId, body.weekStart);
  }
}
