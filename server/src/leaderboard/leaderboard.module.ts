import { Module } from '@nestjs/common';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';
import { redisProvider } from '../auth/redis.provider';

@Module({
  controllers: [LeaderboardController],
  providers: [LeaderboardService, redisProvider],
})
export class LeaderboardModule {}
