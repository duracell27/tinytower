import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { GameState, Command } from '@shared/types';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

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

  // stub — full implementation in Task 3
  async sendPush(token: string, title: string, body: string): Promise<void> {}
}
