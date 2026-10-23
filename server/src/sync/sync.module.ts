import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { AchievementModule } from '../achievement/achievement.module';
import { CityModule } from '../city/city.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AchievementModule, CityModule, NotificationsModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
