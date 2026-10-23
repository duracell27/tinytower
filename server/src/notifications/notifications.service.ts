import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { GameState, Command } from '@shared/types';
import Expo from 'expo-server-sdk';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private expo: Expo;

  constructor(private prisma: PrismaService) {
    this.expo = new Expo();
  }

  async saveToken(playerId: string, token: string, platform: string): Promise<void> {
    await this.prisma.player.update({
      where: { id: playerId },
      data: {
        pushToken: token,
        pushPlatform: platform,
        pushTokenUpdatedAt: new Date(),
      },
    });
  }

  async checkAndSendGameTriggers(
    playerId: string,
    player: { pushToken: string | null; lastSeenAt: Date; notifiedAllResidents: Date | null; notifiedCollect: Date | null; notifiedStock: Date | null; notifiedPurchase: Date | null },
    gameState: GameState,
    acceptedCommands: Command[],
  ): Promise<void> {
    if (!player.pushToken) return;
    if (Date.now() - player.lastSeenAt.getTime() < 5 * 60_000) return;

    const totalFloors = gameState.floors.length;
    if (totalFloors === 0) return;

    const commandTypes = new Set(acceptedCommands.map((c) => c.type));

    const collectReset = commandTypes.has('collect') || commandTypes.has('collect_all');
    const stockReset = commandTypes.has('list') || commandTypes.has('list_all');
    const purchaseReset = commandTypes.has('buy') || commandTypes.has('buy_all');
    const allResidentsReset = (['assign_worker', 'fire_worker', 'evict_worker', 'fire_and_evict_worker', 'evict_low_level_workers'] as Command['type'][])
      .some((t) => commandTypes.has(t));

    let notifiedCollect = collectReset ? null : player.notifiedCollect;
    let notifiedStock = stockReset ? null : player.notifiedStock;
    let notifiedPurchase = purchaseReset ? null : player.notifiedPurchase;
    let notifiedAllResidents = allResidentsReset ? null : player.notifiedAllResidents;

    const updates: Record<string, Date | null> = {};
    if (collectReset) updates.notifiedCollect = null;
    if (stockReset) updates.notifiedStock = null;
    if (purchaseReset) updates.notifiedPurchase = null;
    if (allResidentsReset) updates.notifiedAllResidents = null;

    const now = new Date();

    if (notifiedCollect === null) {
      const readyCount = gameState.floors.filter((f) => f.productions.some((p) => p.stage === 'READY_TO_COLLECT')).length;
      if (readyCount / totalFloors >= 0.75) {
        await this.sendPush(player.pushToken, 'Vibe Tower', 'Time to collect! Most floors are ready 💰');
        updates.notifiedCollect = now;
      }
    }

    if (notifiedStock === null) {
      const readyCount = gameState.floors.filter((f) => f.productions.some((p) => p.stage === 'READY_TO_LIST')).length;
      if (readyCount / totalFloors >= 0.75) {
        await this.sendPush(player.pushToken, 'Vibe Tower', 'Time to restock! Your shelves are waiting 📦');
        updates.notifiedStock = now;
      }
    }

    if (notifiedPurchase === null) {
      const readyCount = gameState.floors.filter((f) => f.productions.some((p) => p.stage === 'IDLE')).length;
      if (readyCount / totalFloors >= 0.75) {
        await this.sendPush(player.pushToken, 'Vibe Tower', 'Ready to reorder! Stock up your floors 🛒');
        updates.notifiedPurchase = now;
      }
    }

    if (notifiedAllResidents === null) {
      const allHaveWorker = gameState.floors.every((f) => gameState.workers.some((w) => w.assignedFloorId === f.id));
      if (allHaveWorker) {
        await this.sendPush(player.pushToken, 'Vibe Tower', 'All residents are ready! 🏢');
        updates.notifiedAllResidents = now;
      }
    }

    if (Object.keys(updates).length > 0) {
      await this.prisma.player.update({
        where: { id: playerId },
        data: updates,
      });
    }
  }

  async sendPush(token: string, title: string, body: string): Promise<void> {
    try {
      const receipts = await this.expo.sendPushNotificationsAsync([
        { to: token, title, body, sound: 'default' },
      ]);
      for (const receipt of receipts) {
        if (receipt.status === 'error') {
          const details = (receipt as any).details;
          if (details?.error === 'DeviceNotRegistered') {
            await this.prisma.player.updateMany({
              where: { pushToken: token },
              data: { pushToken: null },
            });
          } else {
            this.logger.error(`Push error for token ${token}: ${JSON.stringify(receipt)}`);
          }
        }
      }
    } catch (err) {
      this.logger.error(`sendPush failed for token ${token}: ${err}`);
    }
  }
}
