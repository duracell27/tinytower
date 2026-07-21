import { Injectable } from '@nestjs/common';
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
        body: true,
        createdAt: true,
      },
    });
  }
}
