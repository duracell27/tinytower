import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { processCommand } from '@shared/engine/processCommand';
import { xpForCommand, applyXpGain } from '@shared/engine/xp';
import { gameConfig } from '@shared/config/gameConfig';
import type { GameState, Command, Floor, Production, Worker } from '@shared/types';

interface LobbyStateJson {
  [key: string]: unknown;
}

export interface SyncResult {
  state: GameState;
  stateVersion: number;
  ackCursor: number;
  serverTime: number;
  playerLevel: number;
  playerXp: number;
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

    const existingIds =
      commands.length > 0
        ? new Set(
            (
              await this.prisma.commandLog.findMany({
                where: { playerId, id: { in: commands.map((c) => c.id) } },
                select: { id: true },
              })
            ).map((r) => r.id),
          )
        : new Set<string>();

    const newCommands = commands.filter(
      (c) => !existingIds.has(c.id) && c.timestamp > lastAckCursor,
    );

    if (newCommands.length > 0) {
      this.logger.log(`Processing ${newCommands.length} new commands: ${newCommands.map((c) => c.type).join(', ')}`);
    }

    let gameState = this.dbToGameState(player);
    const acceptedCommands: Command[] = [];
    let totalXpGained = 0;

    for (const command of newCommands) {
      const prevBalance = gameState.balance;
      const result = processCommand(gameState, command, gameConfig, command.timestamp, player.playerLevel);
      if (result.success) {
        totalXpGained += xpForCommand(command.type, prevBalance, result.state.balance);
        gameState = result.state;
        acceptedCommands.push(command);
      } else {
        this.logger.warn(`Command ${command.id} (${command.type}) failed: ${result.error}`);
      }
    }

    // Capture balances after commands but before XP level-up rewards
    const baseBalance = gameState.balance;
    const baseGems = gameState.gems;

    let xpResult = applyXpGain(player.playerLevel, player.playerXp, totalXpGained);
    gameState = {
      ...gameState,
      balance: baseBalance + xpResult.bonusCoins,
      gems: baseGems + xpResult.bonusGems,
    };

    let ackCursor = lastAckCursor;

    if (acceptedCommands.length > 0 || newCommands.length === 0) {
      await this.prisma.$transaction(async (tx) => {
        // Re-read playerLevel/playerXp under a row lock to prevent concurrent-sync races.
        // If another request committed a level change between our initial read and now,
        // recompute XP from the locked values so both requests' rewards are applied correctly.
        const [locked] = await tx.$queryRaw<{ playerLevel: number; playerXp: number }[]>`
          SELECT "playerLevel", "playerXp" FROM "Player" WHERE id = ${playerId} FOR UPDATE
        `;
        if (locked && (locked.playerLevel !== player.playerLevel || locked.playerXp !== player.playerXp)) {
          xpResult = applyXpGain(locked.playerLevel, locked.playerXp, totalXpGained);
          gameState = {
            ...gameState,
            balance: baseBalance + xpResult.bonusCoins,
            gems: baseGems + xpResult.bonusGems,
          };
        }
        const { playerLevel: _pl, playerXp: _px, ...existingLs } = (player.lobbyState as LobbyStateJson) ?? {};
        await tx.player.update({
          where: { id: playerId },
          data: {
            balance: gameState.balance,
            playerLevel: xpResult.playerLevel,
            playerXp: xpResult.playerXp,
            lobbyState: {
              ...existingLs,
              gems: gameState.gems,
              lobbyVisitors: gameState.lobbyVisitors,
              lobbyCapacity: gameState.lobbyCapacity,
              hotelCapacity: gameState.hotelCapacity,
              elevatorLevel: gameState.elevatorLevel,
              elevatorFloor: gameState.elevatorFloor,
              dailyTips: gameState.dailyTips,
              dailyGemsCollected: gameState.dailyGemsCollected,
              dailyTipsRewardClaimed: gameState.dailyTipsRewardClaimed,
              lastDailyReset: gameState.lastDailyReset,
              nextVisitorAt: gameState.nextVisitorAt,
              tools: gameState.tools,
              underConstruction: gameState.underConstruction,
              openedFloorTypes: gameState.openedFloorTypes,
            },
            stateVersion: {
              increment: acceptedCommands.length > 0 ? 1 : 0,
            },
            lastSeenAt: new Date(serverNow),
          },
        });

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

        // Create new floors that don't exist in DB yet (e.g. opened via open_floor command)
        for (const floor of gameState.floors) {
          const dbFloor = player.floors.find((f: any) => f.floorId === floor.id);
          if (dbFloor) continue; // already exists, handled above
          await tx.floor.create({
            data: {
              playerId,
              floorId: floor.id,
              productions: {
                create: floor.productions.map((prod, slotIdx) => ({
                  slotIdx,
                  typeId: prod.typeId,
                  stage: prod.stage,
                  stageStartedAt: BigInt(prod.stageStartedAt),
                })),
              },
            },
          });
        }

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

        const currentWorkerIds = gameState.workers.map((w) => w.id);
        const dbWorkerIds = (player.workers as any[]).map((w) => w.id);
        const evictedIds = dbWorkerIds.filter((id: string) => !currentWorkerIds.includes(id));
        if (evictedIds.length > 0) {
          await tx.worker.deleteMany({ where: { id: { in: evictedIds } } });
        }

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
      playerLevel: updatedPlayer?.playerLevel ?? xpResult.playerLevel,
      playerXp: updatedPlayer?.playerXp ?? xpResult.playerXp,
    };
  }

  private dbToGameState(player: any): GameState {
    const floors: Floor[] = player.floors.map((f: any) => ({
      id: f.floorId,
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
      assignedFloorId: w.assignedFloorId ?? null,
      assignedSlotIdx: w.assignedSlotIdx ?? null,
    }));

    const ls = (player.lobbyState as LobbyStateJson) ?? {};

    return {
      balance: player.balance,
      gems: (ls.gems as number) ?? 20,
      floors,
      commandQueue: [],
      workers,
      hotelCapacity: (ls.hotelCapacity as number) ?? gameConfig.hotelCapacity,
      lobbyVisitors: (ls.lobbyVisitors as any[]) ?? [],
      lobbyCapacity: (ls.lobbyCapacity as number) ?? gameConfig.lobbyConfig.defaultLobbyCapacity,
      elevatorLevel: (ls.elevatorLevel as number) ?? 1,
      elevatorFloor: (ls.elevatorFloor as number) ?? 0,
      dailyTips: (ls.dailyTips as number) ?? 0,
      dailyGemsCollected: (ls.dailyGemsCollected as number) ?? 0,
      dailyTipsRewardClaimed: (ls.dailyTipsRewardClaimed as boolean) ?? false,
      lastDailyReset: (ls.lastDailyReset as number) ?? 0,
      nextVisitorAt: (ls.nextVisitorAt as number) ?? 0,
      tools: (ls.tools as { briks: number; glass: number; nails: number; screw: number }) ?? { briks: 0, glass: 0, nails: 0, screw: 0 },
      underConstruction: (ls.underConstruction as any) ?? null,
      openedFloorTypes: (ls.openedFloorTypes as Record<string, string>) ?? {},
    };
  }
}
