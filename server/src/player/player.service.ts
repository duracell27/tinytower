import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { gameConfig } from '@shared/config/gameConfig';
import { generateRandomWorkers } from '@shared/config/workerNames';

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
    const workers = generateRandomWorkers(5, gameConfig);

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

        const productions = floorConfig.availableTypes.map((typeId, i) => ({
          floorDbId: floor.id,
          slotIdx: i,
          typeId,
          stage: 'IDLE',
          stageStartedAt: BigInt(0),
        }));

        await tx.production.createMany({ data: productions });
      }

      for (const w of workers) {
        await tx.worker.create({
          data: {
            id: w.id,
            playerId: player.id,
            name: w.name,
            female: w.female,
            floorType: w.floorType,
            dreamJob: w.dreamJob,
            level: w.level,
            hairColor: w.hairColor,
            assignedFloorId: w.assignedFloorId,
            assignedSlotIdx: w.assignedSlotIdx,
          },
        });
      }

      await tx.playerState.create({ data: { playerId: player.id } });

      return player;
    });
  }
}
