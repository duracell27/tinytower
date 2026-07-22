import { Injectable, BadRequestException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async fetchMessages() {
    return this.prisma.chatMessage.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: {
        id: true,
        playerId: true,
        playerName: true,
        playerLevel: true,
        body: true,
        createdAt: true,
      },
    });
  }

  async sendMessage(playerId: string, body: string, playerLevel = 1) {
    if (body.length > 300) {
      throw new BadRequestException('Message exceeds 300 characters');
    }

    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: { playerName: true },
    });
    if (!player) throw new NotFoundException('Player not found');

    const cooldownCutoff = new Date(Date.now() - 3000);
    const recent = await this.prisma.chatMessage.findFirst({
      where: { playerId, createdAt: { gte: cooldownCutoff } },
    });
    if (recent) {
      throw new HttpException(
        'Chat cooldown: please wait before sending another message',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return this.prisma.chatMessage.create({
      data: { playerId, playerName: player.playerName, playerLevel, body },
      select: { id: true, playerId: true, playerName: true, playerLevel: true, body: true, createdAt: true },
    });
  }

  async deleteMessage(id: string): Promise<{ success: true }> {
    const result = await this.prisma.chatMessage.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) throw new NotFoundException('Message not found or already deleted');
    return { success: true };
  }

  @Cron('0 */15 * * * *')
  async cleanupOldMessages() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await this.prisma.chatMessage.deleteMany({ where: { createdAt: { lt: cutoff } } });
  }
}
