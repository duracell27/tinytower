import { Injectable, BadRequestException, ForbiddenException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async fetchMessages(country?: string) {
    return this.prisma.chatMessage.findMany({
      where: { deletedAt: null, country: country ?? null },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: {
        id: true,
        playerId: true,
        playerName: true,
        playerLevel: true,
        country: true,
        body: true,
        createdAt: true,
      },
    });
  }

  async sendMessage(playerId: string, body: string, playerLevel = 1, country?: string) {
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
      data: { playerId, playerName: player.playerName, playerLevel, body, country: country ?? null },
      select: { id: true, playerId: true, playerName: true, playerLevel: true, country: true, body: true, createdAt: true },
    });
  }

  async updateMessage(id: string, body: string, requesterId: string) {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id, deletedAt: null },
      select: { playerId: true },
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.playerId !== requesterId) throw new ForbiddenException('You can only edit your own messages');
    return this.prisma.chatMessage.update({
      where: { id },
      data: { body },
      select: { id: true, playerId: true, playerName: true, playerLevel: true, country: true, body: true, createdAt: true },
    });
  }

  async deleteMessage(id: string, requesterId: string, isAdmin: boolean): Promise<{ success: true }> {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id, deletedAt: null },
      select: { playerId: true },
    });
    if (!message) throw new NotFoundException('Message not found or already deleted');
    if (!isAdmin && message.playerId !== requesterId) throw new ForbiddenException('You can only delete your own messages');
    await this.prisma.chatMessage.update({ where: { id }, data: { deletedAt: new Date() } });
    return { success: true };
  }

  @Cron('0 */15 * * * *')
  async cleanupOldMessages() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await this.prisma.chatMessage.deleteMany({ where: { createdAt: { lt: cutoff } } });
  }
}
