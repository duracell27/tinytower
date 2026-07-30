import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getPlayers(page: number, limit: number, search?: string) {
    const where = search
      ? {
          OR: [
            { playerName: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [players, total] = await Promise.all([
      this.prisma.player.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: { state: { select: { gems: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.player.count({ where }),
    ]);

    return {
      data: players.map((p) => ({
        id: p.id,
        email: p.email,
        playerName: p.playerName,
        playerLevel: p.playerLevel,
        balance: p.balance,
        gems: p.state?.gems ?? 0,
        isAdmin: p.isAdmin,
        lastSeenAt: p.lastSeenAt,
        createdAt: p.createdAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}
