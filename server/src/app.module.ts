import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PlayerModule } from './player/player.module';
import { SyncModule } from './sync/sync.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { AchievementModule } from './achievement/achievement.module';
import { ReferralModule } from './referral/referral.module';
import { ChatModule } from './chat/chat.module';
import { ForumModule } from './forum/forum.module';
import { StatsModule } from './stats/stats.module';
import { AdminModule } from './admin/admin.module';
import { PlayersModule } from './players/players.module';
import { FriendsModule } from './friends/friends.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    PlayerModule,
    PlayersModule,
    SyncModule,
    LeaderboardModule,
    AchievementModule,
    ReferralModule,
    ChatModule,
    ForumModule,
    StatsModule,
    AdminModule,
    FriendsModule,
  ],
})
export class AppModule {}
