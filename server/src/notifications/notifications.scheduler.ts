import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { gameConfig } from '@shared/config/gameConfig';

const THRESHOLD = 0.75;

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
      select: { id: true, pushToken: true, pushLanguage: true },
    });

    for (const player of players) {
      try {
        const isUk = player.pushLanguage === 'uk';
        await this.notificationsService.sendPush(
          player.pushToken!,
          'Vibe Tower',
          isUk
            ? 'Твоя вежа сумує! Повернись і завітай.'
            : 'Your tower misses you! Come back and check in.',
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

  @Cron('*/15 * * * *')
  async checkProductionReady(): Promise<void> {
    const now = BigInt(Date.now());

    const players = await this.prisma.player.findMany({
      where: {
        pushToken: { not: null },
        OR: [
          { notifiedCollect: null },
          { notifiedStock: null },
          { notifiedPurchase: null },
        ],
      },
      select: {
        id: true,
        pushToken: true,
        pushLanguage: true,
        notifiedCollect: true,
        notifiedStock: true,
        notifiedPurchase: true,
        floors: {
          select: {
            productions: {
              select: { typeId: true, stage: true, stageStartedAt: true },
            },
          },
        },
      },
    });

    for (const player of players) {
      try {
        const productions = player.floors.flatMap((f) => f.productions).filter((p) => p.typeId);
        if (productions.length === 0) continue;

        const isUk = player.pushLanguage === 'uk';
        const updates: { notifiedCollect?: Date; notifiedStock?: Date; notifiedPurchase?: Date } = {};

        if (!player.notifiedCollect) {
          const readyToCollect = productions.filter((p) => {
            if (p.stage !== 'SELLING' || !p.typeId) return false;
            const cfg = gameConfig.productionTypes[p.typeId];
            return cfg && now - BigInt(p.stageStartedAt) >= BigInt(cfg.sellDuration);
          });
          if (readyToCollect.length / productions.length >= THRESHOLD) {
            await this.notificationsService.sendPush(
              player.pushToken!,
              'Vibe Tower',
              isUk ? 'Час збирати монети! 💰 75%+ поверхів чекають.' : 'Time to collect! 💰 75%+ floors are ready.',
            );
            updates.notifiedCollect = new Date();
          }
        }

        if (!player.notifiedStock) {
          const readyToList = productions.filter((p) => {
            if (p.stage !== 'DELIVERING' || !p.typeId) return false;
            const cfg = gameConfig.productionTypes[p.typeId];
            return cfg && now - BigInt(p.stageStartedAt) >= BigInt(cfg.deliveryDuration);
          });
          if (readyToList.length / productions.length >= THRESHOLD) {
            await this.notificationsService.sendPush(
              player.pushToken!,
              'Vibe Tower',
              isUk ? 'Товари доставлено! 📦 75%+ поверхів готові до викладки.' : 'Goods delivered! 📦 75%+ floors ready to stock.',
            );
            updates.notifiedStock = new Date();
          }
        }

        if (!player.notifiedPurchase) {
          const readyToBuy = productions.filter((p) => p.stage === 'IDLE');
          if (readyToBuy.length / productions.length >= THRESHOLD) {
            await this.notificationsService.sendPush(
              player.pushToken!,
              'Vibe Tower',
              isUk ? 'Поповни запаси! 🛒 75%+ поверхів потребують закупки.' : 'Restock needed! 🛒 75%+ floors need purchasing.',
            );
            updates.notifiedPurchase = new Date();
          }
        }

        if (Object.keys(updates).length > 0) {
          await this.prisma.player.update({ where: { id: player.id }, data: updates });
        }
      } catch (err) {
        this.logger.error(`checkProductionReady failed for player ${player.id}: ${err}`);
      }
    }
  }
}
