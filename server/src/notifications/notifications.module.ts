import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsScheduler } from './notifications.scheduler';
import { GameTriggersScheduler } from './game-triggers.scheduler';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsScheduler, GameTriggersScheduler],
  exports: [NotificationsService],
})
export class NotificationsModule {}
