import { Controller, Get, Query, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LeaderboardService } from './leaderboard.service';

const QuerySchema = z.object({
  tab: z.enum(['level', 'floors', 'revenue']),
  page: z.coerce.number().int().min(1).default(1),
});

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private leaderboardService: LeaderboardService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getLeaderboard(
    @Req() req: { user: { playerId: string } },
    @Query() query: unknown,
  ) {
    const parsed = QuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return this.leaderboardService.getLeaderboard(parsed.data.tab, parsed.data.page, req.user.playerId);
  }
}
