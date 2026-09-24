import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

const PAGE_SIZE = 15;

export interface CityChatMessageDto {
  id: string;
  cityId: string;
  playerId: string | null;
  playerName: string;
  playerLevel: number;
  playerRole: string;
  body: string;
  mentionedPlayerId: string | null;
  mentionedName: string | null;
  createdAt: string;
}

const MSG_SELECT = {
  id: true,
  cityId: true,
  playerId: true,
  playerName: true,
  playerLevel: true,
  playerRole: true,
  body: true,
  mentionedPlayerId: true,
  mentionedName: true,
  createdAt: true,
};

function toDto(m: any): CityChatMessageDto {
  return { ...m, createdAt: (m.createdAt as Date).toISOString() };
}

@Injectable()
export class CityChatService {
  constructor(private prisma: PrismaService) {}

  async getMessages(cityId: string, playerId: string, page: number) {
    const membership = await this.prisma.cityMembership.findUnique({ where: { playerId } });
    if (!membership || membership.cityId !== cityId) {
      throw new ForbiddenException('Not a member of this city');
    }

    const total = await this.prisma.cityChatMessage.count({ where: { cityId } });
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(Math.max(page, 1), totalPages);

    const rows = await this.prisma.cityChatMessage.findMany({
      where: { cityId },
      orderBy: { createdAt: 'desc' },
      skip: (safePage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: MSG_SELECT,
    });

    return { messages: rows.map(toDto), page: safePage, totalPages, total };
  }

  async sendMessage(
    cityId: string,
    playerId: string,
    body: string,
    mentionedPlayerId?: string,
    mentionedName?: string,
  ): Promise<CityChatMessageDto> {
    const membership = await this.prisma.cityMembership.findUnique({ where: { playerId } });
    if (!membership || membership.cityId !== cityId) {
      throw new ForbiddenException('Not a member of this city');
    }

    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: { playerName: true, playerLevel: true },
    });
    if (!player) throw new NotFoundException('Player not found');

    const cooldownCutoff = new Date(Date.now() - 3_000);
    const recent = await this.prisma.cityChatMessage.findFirst({
      where: { playerId, createdAt: { gte: cooldownCutoff } },
    });
    if (recent) {
      throw new HttpException(
        'Chat cooldown: please wait before sending another message',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (mentionedPlayerId) {
      const mentionedMembership = await this.prisma.cityMembership.findUnique({
        where: { playerId: mentionedPlayerId },
      });
      if (!mentionedMembership || mentionedMembership.cityId !== cityId) {
        throw new ForbiddenException('Mentioned player is not in this city');
      }
    }

    const created = await this.prisma.cityChatMessage.create({
      data: {
        cityId,
        playerId,
        playerName: player.playerName,
        playerLevel: player.playerLevel,
        playerRole: membership.role,
        body,
        mentionedPlayerId: mentionedPlayerId ?? null,
        mentionedName: mentionedName ?? null,
      },
      select: MSG_SELECT,
    });

    return toDto(created);
  }

  async hasPendingMention(cityId: string, playerId: string): Promise<boolean> {
    const membership = await this.prisma.cityMembership.findUnique({ where: { playerId } });
    if (!membership || membership.cityId !== cityId) return false;

    const mention = await this.prisma.cityChatMessage.findFirst({
      where: {
        cityId,
        mentionedPlayerId: playerId,
        createdAt: { gt: membership.cityChatLastReadAt },
      },
      select: { id: true },
    });
    return !!mention;
  }

  async getUnreadCount(cityId: string, playerId: string): Promise<number> {
    const membership = await this.prisma.cityMembership.findUnique({ where: { playerId } });
    if (!membership || membership.cityId !== cityId) return 0;
    return this.prisma.cityChatMessage.count({
      where: { cityId, createdAt: { gt: membership.cityChatLastReadAt } },
    });
  }

  async readMentions(cityId: string, playerId: string): Promise<void> {
    const membership = await this.prisma.cityMembership.findUnique({ where: { playerId } });
    if (!membership || membership.cityId !== cityId) return;
    await this.prisma.cityMembership.update({
      where: { playerId },
      data: { cityChatLastReadAt: new Date() },
    });
  }

  @Cron('0 3 * * *')
  async cleanupOldMessages() {
    const cutoff = new Date(Date.now() - 10 * 24 * 60 * 60 * 1_000);
    await this.prisma.cityChatMessage.deleteMany({ where: { createdAt: { lt: cutoff } } });
  }
}
