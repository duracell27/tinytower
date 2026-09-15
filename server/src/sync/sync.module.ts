import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { AchievementModule } from '../achievement/achievement.module';
import { CityModule } from '../city/city.module';

@Module({
  imports: [AchievementModule, CityModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
