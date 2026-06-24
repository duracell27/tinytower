import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { processCommand } from '@shared/engine/processCommand';
import { gameConfig } from '@shared/config/gameConfig';
import type { GameState, Command, Floor, Production, Worker } from '@shared/types';

export interface SyncResult {
  state: GameState;
  stateVersion: number;
  ackCursor: number;
  serverTime: number;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(private prisma: PrismaService) {}

  async processSync(
    playerId: string,
    commands: Command[],
    lastAckCursor: number,
  ): Promise<SyncResult> {
    const serverNow = Date.now();

    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      include: {
        floors: {
          include: { productions: { orderBy: { slotIdx: 'asc' } } },
          orderBy: { floorId: 'asc' },
        },
        workers: true,
      },
    });

    if (!player) throw new NotFoundException('Player not found');

    let gameState = this.dbToGameState(player);

    // Idempotency: filter out already-processed commands
    const existingIds =
      commands.length > 0
        ? new Set(
            (
              await this.prisma.commandLog.findMany({
                where: { id: { in: commands.map((c) => c.id) } },
                select: { id: true },
              })
            ).map((c) => c.id),
          )
        : new Set<string>();

    const newCommands = commands.filter((c) => !existingIds.has(c.id));

    // Wall-clock cap: total timer durations cannot exceed real elapsed time + 5s tolerance
    const wallBudget = serverNow - player.lastSeenAt.getTime();
    let timerConsumed = 0;
    const acceptedCommands: Command[] = [];

    for (const cmd of newCommands) {
      if (cmd.type === 'list' || cmd.type === 'collect') {
        const floor = gameState.floors.find((f) => f.id === cmd.floorId);
        const prod = floor?.productions[cmd.slotIdx];
        if (prod && prod.stageStartedAt > 0) {
          const typeConfig = prod.typeId
            ? gameConfig.productionTypes[prod.typeId]
            : null;
          if (typeConfig) {
            const duration =
              cmd.type === 'list'
                ? typeConfig.deliveryDuration
                : typeConfig.sellDuration;
            timerConsumed += duration;
            if (timerConsumed > wallBudget + 5000) {
              this.logger.warn(
                `Wall-clock cap exceeded for player ${playerId}, rejecting remaining commands`,
              );
              break;
            }
          }
        }
      }

      const result = processCommand(gameState, cmd, gameConfig, serverNow);
      if (result.success) {
        gameState = result.state;
        acceptedCommands.push(cmd);
      } else {
        this.logger.warn(
          `Command ${cmd.id} (${cmd.type}) failed: ${result.error}`,
        );
      }
    }

    let ackCursor = lastAckCursor;

    if (acceptedCommands.length > 0 || newCommands.length === 0) {
      await this.prisma.$transaction(async (tx) => {
        // Update player balance and version
        await tx.player.update({
          where: { id: playerId },
          data: {
            balance: gameState.balance,
            stateVersion: {
              increment: acceptedCommands.length > 0 ? 1 : 0,
            },
            lastSeenAt: new Date(serverNow),
          },
        });

        // Persist production state for all floors
        for (const floor of gameState.floors) {
          const dbFloor = player.floors.find((f) => f.floorId === floor.id);
          if (!dbFloor) continue;

          for (let i = 0; i < floor.productions.length; i++) {
            const prod = floor.productions[i];
            await tx.production.update({
              where: {
                floorDbId_slotIdx: { floorDbId: dbFloor.id, slotIdx: i },
              },
              data: {
                typeId: prod.typeId,
                stage: prod.stage,
                stageStartedAt: BigInt(prod.stageStartedAt),
              },
            });
          }
        }

        // Persist worker state
        for (const w of gameState.workers) {
          await tx.worker.upsert({
            where: { id: w.id },
            update: {
              assignedFloorId: w.assignedFloorId,
              assignedSlotIdx: w.assignedSlotIdx,
            },
            create: {
              id: w.id,
              playerId,
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

        // Delete evicted workers
        const currentWorkerIds = gameState.workers.map((w) => w.id);
        const dbWorkerIds = (player.workers as any[]).map((w) => w.id);
        const evictedIds = dbWorkerIds.filter((id: string) => !currentWorkerIds.includes(id));
        if (evictedIds.length > 0) {
          await tx.worker.deleteMany({ where: { id: { in: evictedIds } } });
        }

        // Log accepted commands and update ackCursor
        if (acceptedCommands.length > 0) {
          for (const cmd of acceptedCommands) {
            const logEntry = await tx.commandLog.create({
              data: {
                id: cmd.id,
                playerId,
                type: cmd.type,
                floorId: 'floorId' in cmd ? cmd.floorId : null,
                slotIdx: 'slotIdx' in cmd ? cmd.slotIdx : null,
                typeId: cmd.type === 'buy' ? (cmd as any).typeId : null,
                workerId: 'workerId' in cmd ? (cmd as any).workerId : null,
                timestamp: BigInt(cmd.timestamp),
                serverTime: BigInt(serverNow),
              },
            });
            ackCursor = logEntry.cursor;
          }
        }
      });
    }

    const updatedPlayer = await this.prisma.player.findUnique({
      where: { id: playerId },
    });

    return {
      state: gameState,
      stateVersion: updatedPlayer?.stateVersion ?? player.stateVersion,
      ackCursor,
      serverTime: serverNow,
    };
  }

  private dbToGameState(player: any): GameState {
    const floors: Floor[] = player.floors.map((f: any) => ({
      id: f.floorId,
      name:
        gameConfig.floors.find((gc) => gc.id === f.floorId)?.name ??
        `Floor ${f.floorId}`,
      productions: f.productions.map(
        (p: any): Production => ({
          typeId: p.typeId,
          stage: p.stage as any,
          stageStartedAt: Number(p.stageStartedAt),
        }),
      ),
    }));

    const workers: Worker[] = (player.workers || []).map((w: any): Worker => ({
      id: w.id,
      name: w.name,
      female: w.female,
      floorType: w.floorType,
      dreamJob: w.dreamJob,
      level: w.level,
      hairColor: w.hairColor,
      assignedFloorId: w.assignedFloorId,
      assignedSlotIdx: w.assignedSlotIdx,
    }));

    return {
      balance: player.balance,
      floors,
      commandQueue: [],
      workers,
      hotelCapacity: gameConfig.hotelCapacity,
    };
  }
}
