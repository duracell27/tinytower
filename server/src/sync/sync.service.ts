import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { processCommand } from '@shared/engine/processCommand';
import { gameConfig } from '@shared/config/gameConfig';
import type { GameState, Command, Floor, Production } from '@shared/types';

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

        // Log accepted commands and update ackCursor
        if (acceptedCommands.length > 0) {
          for (const cmd of acceptedCommands) {
            const logEntry = await tx.commandLog.create({
              data: {
                id: cmd.id,
                playerId,
                type: cmd.type,
                floorId: cmd.floorId,
                slotIdx: cmd.slotIdx,
                typeId: cmd.type === 'buy' ? (cmd as any).typeId : null,
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

    return {
      balance: player.balance,
      floors,
      commandQueue: [],
    };
  }
}
