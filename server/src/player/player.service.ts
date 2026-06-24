import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { gameConfig } from '@shared/config/gameConfig';

@Injectable()
export class PlayerService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.player.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.prisma.player.findUnique({ where: { id } });
  }

  async createWithInitialState(email: string, passwordHash: string, playerName: string) {
    return this.prisma.$transaction(async (tx) => {
      const player = await tx.player.create({
        data: {
          email,
          passwordHash,
          playerName,
          balance: gameConfig.startingBalance,
        },
      });

      for (const floorConfig of gameConfig.floors) {
        const floor = await tx.floor.create({
          data: {
            playerId: player.id,
            floorId: floorConfig.id,
          },
        });

        const productions = Array.from({ length: floorConfig.slots }, (_, i) => ({
          floorDbId: floor.id,
          slotIdx: i,
          typeId: null,
          stage: 'IDLE',
          stageStartedAt: BigInt(0),
        }));

        await tx.production.createMany({ data: productions });
      }

      return player;
    });
  }
}
