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

  // stub — full implementation in Task 3
  async checkAndSendGameTriggers(
    playerId: string,
    player: any,
    gameState: GameState,
    acceptedCommands: Command[],
  ): Promise<void> {}

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
