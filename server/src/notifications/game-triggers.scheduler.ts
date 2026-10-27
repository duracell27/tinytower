import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { gameConfig } from '@shared/config/gameConfig';

const INACTIVE_THRESHOLD_MS = 10 * 60 * 1000; // only check players inactive for at least 10 min

@Injectable()
export class GameTriggersScheduler {
  private readonly logger = new Logger(GameTriggersScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron('*/10 * * * *')
  async checkGameTriggers(): Promise<void> {
    const cutoff = new Date(Date.now() - INACTIVE_THRESHOLD_MS);

    const players = await this.prisma.player.findMany({
      where: {
        pushToken: { not: null },
        lastSeenAt: { lt: cutoff },
        OR: [
          { notifiedCollect: null },
          { notifiedStock: null },
          { notifiedPurchase: null },
          { notifiedAllResidents: null },
        ],
      },
      include: {
        floors: { include: { productions: true } },
        workers: true,
      },
    });

    for (const player of players) {
      try {
        const totalFloors = player.floors.length;
        if (totalFloors === 0) continue;

        const now = Date.now();
        const updates: Record<string, Date | null> = {};
        const nowDate = new Date();

        // collect_ready: SELLING stage with elapsed >= actual sell duration → READY_TO_COLLECT
        if (player.notifiedCollect === null) {
          const readyCount = player.floors.filter((f) =>
            f.productions.some((p) => {
              if (p.stage === 'READY_TO_COLLECT') return true;
              if (p.stage !== 'SELLING') return false;
              const typeConfig = p.typeId ? (gameConfig.productionTypes as Record<string, { sellDuration: number } | undefined>)[p.typeId] : null;
              const sellDuration = typeConfig?.sellDuration ?? 0;
              return now - Number(p.stageStartedAt) >= sellDuration;
            }),
          ).length;
          if (readyCount / totalFloors >= 0.75) {
            await this.notificationsService.sendPush(
              player.pushToken!,
              'Vibe Tower',
              'Time to collect! Most floors are ready 💰',
            );
            updates.notifiedCollect = nowDate;
          }
        }

        // stock_ready: DELIVERING stage with elapsed >= actual delivery duration → READY_TO_LIST
        if (player.notifiedStock === null) {
          const readyCount = player.floors.filter((f) =>
            f.productions.some((p) => {
              if (p.stage === 'READY_TO_LIST') return true;
              if (p.stage !== 'DELIVERING') return false;
              const typeConfig = p.typeId ? (gameConfig.productionTypes as Record<string, { deliveryDuration: number } | undefined>)[p.typeId] : null;
              const deliveryDuration = typeConfig?.deliveryDuration ?? 0;
              return now - Number(p.stageStartedAt) >= deliveryDuration;
            }),
          ).length;
          if (readyCount / totalFloors >= 0.75) {
            await this.notificationsService.sendPush(
              player.pushToken!,
              'Vibe Tower',
              'Time to restock! Your shelves are waiting 📦',
            );
            updates.notifiedStock = nowDate;
          }
        }

        // purchase_ready: IDLE with no product selected (typeId === null only)
        if (player.notifiedPurchase === null) {
          const readyCount = player.floors.filter((f) =>
            f.productions.some((p) => p.stage === 'IDLE' && p.typeId === null),
          ).length;
          if (readyCount / totalFloors >= 0.75) {
            await this.notificationsService.sendPush(
              player.pushToken!,
              'Vibe Tower',
              'Ready to reorder! Stock up your floors 🛒',
            );
            updates.notifiedPurchase = nowDate;
          }
        }

        // all_residents: every floor has an assigned worker
        if (player.notifiedAllResidents === null) {
          const allHaveWorker = player.floors.every((f) =>
            player.workers.some((w) => w.assignedFloorId === f.floorId),
          );
          if (allHaveWorker) {
            await this.notificationsService.sendPush(
              player.pushToken!,
              'Vibe Tower',
              'All residents are ready! 🏢',
            );
            updates.notifiedAllResidents = nowDate;
          }
        }

        if (Object.keys(updates).length > 0) {
          await this.prisma.player.update({
            where: { id: player.id },
            data: updates,
          });
        }
      } catch (err) {
        this.logger.error(`checkGameTriggers failed for player ${player.id}: ${err}`);
      }
    }
  }
}
