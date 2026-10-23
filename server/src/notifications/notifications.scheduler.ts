import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationsScheduler {
  private readonly logger = new Logger(NotificationsScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron('0 * * * *')
  async checkInactivity(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const players = await this.prisma.player.findMany({
      where: {
        pushToken: { not: null },
        lastSeenAt: { lt: cutoff },
        inactivityNotifiedAt: null,
      },
      select: { id: true, pushToken: true },
    });

    for (const player of players) {
      try {
        await this.notificationsService.sendPush(
          player.pushToken!,
          'Vibe Tower',
          'Your tower misses you! Come back and check in 👋',
        );
        await this.prisma.player.update({
          where: { id: player.id },
          data: { inactivityNotifiedAt: new Date() },
        });
      } catch (err) {
        this.logger.error(`checkInactivity failed for player ${player.id}: ${err}`);
      }
    }
  }
}
