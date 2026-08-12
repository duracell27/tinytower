import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BlockService {
  constructor(private prisma: PrismaService) {}

  async blockPlayer(blockerId: string, blockedId: string): Promise<{ success: true }> {
    if (blockerId === blockedId) throw new BadRequestException('Cannot block yourself');

    await this.prisma.$transaction(async (tx) => {
      await tx.friendRequest.deleteMany({
        where: {
          OR: [
            { fromId: blockerId, toId: blockedId },
            { fromId: blockedId, toId: blockerId },
          ],
        },
      });

      await tx.block.upsert({
        where: { blockerId_blockedId: { blockerId, blockedId } },
        create: { blockerId, blockedId },
        update: {},
      });
    });

    return { success: true } as const;
  }

  async unblockPlayer(blockerId: string, blockedId: string): Promise<{ success: true }> {
    await this.prisma.block.deleteMany({
      where: { blockerId, blockedId },
    });
    return { success: true } as const;
  }

  async getBlockedIds(blockerId: string): Promise<{ ids: string[] }> {
    const blocks = await this.prisma.block.findMany({
      where: { blockerId },
      select: { blockedId: true },
    });
    return { ids: blocks.map((b) => b.blockedId) };
  }
}
