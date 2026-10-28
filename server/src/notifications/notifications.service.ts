import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Command } from '@shared/types';
import Expo from 'expo-server-sdk';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private expo: Expo;

  constructor(private prisma: PrismaService) {
    this.expo = new Expo();
  }

  async saveToken(playerId: string, token: string, platform: string, language = 'en'): Promise<void> {
    // Remove the token from any other player who previously held it
    await this.prisma.player.updateMany({
      where: { pushToken: token, id: { not: playerId } },
      data: { pushToken: null, pushTokenUpdatedAt: new Date() },
    });
    await this.prisma.player.update({
      where: { id: playerId },
      data: {
        pushToken: token,
        pushPlatform: platform,
        pushLanguage: language,
        pushTokenUpdatedAt: new Date(),
      },
    });
  }

  async resetNotificationStateForCommands(playerId: string, acceptedCommands: Command[]): Promise<void> {
    if (acceptedCommands.length === 0) return;

    const commandTypes = new Set(acceptedCommands.map((c) => c.type));

    const collectReset = commandTypes.has('collect') || commandTypes.has('collect_all');
    const stockReset = commandTypes.has('list') || commandTypes.has('list_all');
    const purchaseReset = commandTypes.has('buy') || commandTypes.has('buy_all');
    const allResidentsReset = (['assign_worker', 'fire_worker', 'evict_worker', 'fire_and_evict_worker', 'evict_low_level_workers'] as Command['type'][])
      .some((t) => commandTypes.has(t));

    const updates: Record<string, null> = {};
    if (collectReset) updates.notifiedCollect = null;
    if (stockReset) updates.notifiedStock = null;
    if (purchaseReset) updates.notifiedPurchase = null;
    if (allResidentsReset) updates.notifiedAllResidents = null;

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
