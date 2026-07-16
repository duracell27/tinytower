import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { gameConfig } from '@shared/config/gameConfig';
import { generateRandomWorkers } from '@shared/config/workerNames';
import { generateVisitorAppearance } from '@shared/engine/lobbyUtils';

function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = randomBytes(6);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

@Injectable()
export class PlayerService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.player.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.prisma.player.findUnique({ where: { id } });
  }

  async findByReferralCode(code: string) {
    return this.prisma.player.findUnique({ where: { referralCode: code } });
  }

  async createWithInitialState(email: string, passwordHash: string, playerName: string) {
    const workers = generateRandomWorkers(5, gameConfig);

    // Generate a unique referral code with up to 5 retry attempts
    let referralCode: string | undefined;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateReferralCode();
      const existing = await this.prisma.player.findUnique({ where: { referralCode: candidate } });
      if (!existing) {
        referralCode = candidate;
        break;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const player = await tx.player.create({
        data: {
          email,
          passwordHash,
          playerName,
          balance: gameConfig.startingBalance,
          openedFloorsCount: gameConfig.floors.length,
          referralCode,
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

      const initialVisitors = Array.from(
        { length: gameConfig.lobbyConfig.defaultLobbyCapacity },
        () => generateVisitorAppearance(),
      );
      await tx.playerState.create({
        data: { playerId: player.id, lobbyVisitors: initialVisitors },
      });

      return player;
    });
  }
}
