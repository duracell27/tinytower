import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { processCommand } from '@shared/engine/processCommand';
import { checkDailyReset } from '@shared/engine/lobbyUtils';
import { xpForCommand, applyXpGain } from '@shared/engine/xp';
import { gameConfig } from '@shared/config/gameConfig';
import { calcRevenuePerMin } from '@shared/engine/ratingUtils';
import type { GameState, Command, Floor, Production, Worker } from '@shared/types';
import type { NewAchievementGrant, CategoryProgressState } from '@shared/types/achievements';
import { AchievementService } from '../achievement/achievement.service';

export interface SyncResult {
  state: GameState;
  stateVersion: number;
  ackCursor: number;
  serverTime: number;
  playerLevel: number;
  playerXp: number;
  newAchievements: NewAchievementGrant[];
  coinBonusPercent: number;
  xpBonusPercent: number;
  categoryProgress: Record<string, CategoryProgressState>;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private prisma: PrismaService,
    private achievementService: AchievementService,
  ) {}

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
        state: true,
        floorConstructions: true,
        floorTypes: true,
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

    let gameState = checkDailyReset(this.dbToGameState(player), serverNow);
    const gameStateBefore = this.dbToGameState(player);
    const acceptedCommands: Command[] = [];
    let totalXpGained = 0;

    for (const command of newCommands) {
      const prevBalance = gameState.balance;
      const result = processCommand(
        gameState, command, gameConfig, command.timestamp, player.playerLevel,
        { coinPercent: gameState.coinBonusPercent, xpPercent: gameState.xpBonusPercent },
      );
      if (result.success) {
        const xp = result.xpGained !== undefined
          ? result.xpGained
          : xpForCommand(command.type, prevBalance, result.state.balance);
        totalXpGained += xp;
        gameState = result.state;
        acceptedCommands.push(command);
      } else {
        this.logger.warn(`Command ${command.id} (${command.type}) failed: ${result.error}`);
      }
    }

    let boughtCount = 0;
    let listedCount = 0;
    let collectCount = 0;
    for (const cmd of acceptedCommands) {
      if (cmd.type === 'buy')     boughtCount++;
      if (cmd.type === 'list')    listedCount++;
      if (cmd.type === 'collect') collectCount++;
    }
    const passengersCount = gameState.stats.totalPassengersLifted - gameStateBefore.stats.totalPassengersLifted;

    // Capture balances after commands but before XP level-up rewards
    const baseBalance = gameState.balance;
    const baseGems = gameState.gems;

    let xpResult = applyXpGain(player.playerLevel, player.playerXp, totalXpGained);
    gameState = {
      ...gameState,
      balance: baseBalance + xpResult.bonusCoins,
      gems: baseGems + xpResult.bonusGems,
    };

    const currentRevenue = calcRevenuePerMin(
      gameState.floors,
      gameState.workers,
      gameState.openedFloorTypes ?? {},
      gameConfig,
      serverNow,
    );
    const currentOpenedFloors = gameConfig.floors.length + Object.keys(gameState.openedFloorTypes ?? {}).length;

    let ackCursor = lastAckCursor;
    let allNewGrants: NewAchievementGrant[] = [];
    let coinBonusDelta = 0;
    let xpBonusDelta = 0;

    if (acceptedCommands.length > 0 || newCommands.length === 0) {
      await this.prisma.$transaction(async (tx) => {
        // Re-read playerLevel/playerXp under a row lock to prevent concurrent-sync races.
        // If another request committed a level change between our initial read and now,
        // recompute XP from the locked values so both requests' rewards are applied correctly.
        const [locked] = await tx.$queryRaw<{
          playerLevel: number;
          playerXp: number;
          totalBought: number;
          totalListed: number;
          totalCollected: number;
          totalPassengersLifted: number;
          maxRevenuePerMin: number;
        }[]>`
          SELECT "playerLevel", "playerXp", "totalBought", "totalListed", "totalCollected", "totalPassengersLifted", "maxRevenuePerMin"
          FROM "Player" WHERE id = ${playerId} FOR UPDATE
        `;
        if (locked && (locked.playerLevel !== player.playerLevel || locked.playerXp !== player.playerXp)) {
          xpResult = applyXpGain(locked.playerLevel, locked.playerXp, totalXpGained);
          gameState = {
            ...gameState,
            balance: baseBalance + xpResult.bonusCoins,
            gems: baseGems + xpResult.bonusGems,
          };
        }
        // Compute final stats using locked player values + deltas to avoid stale reads under concurrency
        const finalStats = {
          totalBought:           (locked?.totalBought           ?? player.totalBought)           + boughtCount,
          totalListed:           (locked?.totalListed            ?? player.totalListed)            + listedCount,
          totalCollected:        (locked?.totalCollected         ?? player.totalCollected)         + collectCount,
          totalPassengersLifted: (locked?.totalPassengersLifted  ?? player.totalPassengersLifted)  + passengersCount,
        };
        gameState = { ...gameState, stats: finalStats };

        // Achievement progress
        const categoryDeltas: [string, number][] = [
          ['buy',      boughtCount],
          ['list',     listedCount],
          ['collect',  collectCount],
          ['elevator', passengersCount],
        ];
        for (const [key, amount] of categoryDeltas) {
          if (amount === 0) continue;
          const r = await this.achievementService.incrementProgress(tx, playerId, key, amount);
          gameState = { ...gameState, gems: gameState.gems + r.gemsToAdd };
          coinBonusDelta += r.coinBonusDelta;
          xpBonusDelta   += r.xpBonusDelta;
          allNewGrants.push(...r.newGrants);
        }

        if (coinBonusDelta > 0 || xpBonusDelta > 0) {
          await tx.playerState.update({
            where: { playerId },
            data: {
              coinBonusPercent: { increment: coinBonusDelta },
              xpBonusPercent:   { increment: xpBonusDelta },
            },
          });
        }

        // Single consolidated player update with all final values
        await tx.player.update({
          where: { id: playerId },
          data: {
            balance: gameState.balance,
            playerLevel: xpResult.playerLevel,
            playerXp: xpResult.playerXp,
            totalBought:           { increment: boughtCount },
            totalListed:           { increment: listedCount },
            totalCollected:        { increment: collectCount },
            totalPassengersLifted: { increment: passengersCount },
            stateVersion: {
              increment: (acceptedCommands.length > 0 || allNewGrants.length > 0) ? 1 : 0,
            },
            lastSeenAt: new Date(serverNow),
            openedFloorsCount: currentOpenedFloors,
            ...(currentRevenue > (locked?.maxRevenuePerMin ?? player.maxRevenuePerMin ?? 0)
              ? { maxRevenuePerMin: currentRevenue }
              : {}),
          },
        });

        await tx.playerState.upsert({
          where: { playerId },
          create: {
            playerId,
            gems: gameState.gems,
            lobbyCapacity: gameState.lobbyCapacity,
            hotelCapacity: gameState.hotelCapacity,
            elevatorLevel: gameState.elevatorLevel,
            elevatorFloor: gameState.elevatorFloor,
            dailyTips: gameState.dailyTips,
            dailyGemsCollected: gameState.dailyGemsCollected,
            dailyTipsRewardClaimed: gameState.dailyTipsStage1Claimed,
            dailyTipsStage2Claimed: gameState.dailyTipsStage2Claimed,
            dailyFillLobbyUses: gameState.dailyFillLobbyUses,
            lastDailyReset: BigInt(gameState.lastDailyReset),
            nextVisitorAt: BigInt(gameState.nextVisitorAt),
            briks: gameState.tools.briks,
            glass: gameState.tools.glass,
            nails: gameState.tools.nails,
            screw: gameState.tools.screw,
            lobbyVisitors: gameState.lobbyVisitors,
          },
          update: {
            gems: gameState.gems,
            lobbyCapacity: gameState.lobbyCapacity,
            hotelCapacity: gameState.hotelCapacity,
            elevatorLevel: gameState.elevatorLevel,
            elevatorFloor: gameState.elevatorFloor,
            dailyTips: gameState.dailyTips,
            dailyGemsCollected: gameState.dailyGemsCollected,
            dailyTipsRewardClaimed: gameState.dailyTipsStage1Claimed,
            dailyTipsStage2Claimed: gameState.dailyTipsStage2Claimed,
            dailyFillLobbyUses: gameState.dailyFillLobbyUses,
            lastDailyReset: BigInt(gameState.lastDailyReset),
            nextVisitorAt: BigInt(gameState.nextVisitorAt),
            briks: gameState.tools.briks,
            glass: gameState.tools.glass,
            nails: gameState.tools.nails,
            screw: gameState.tools.screw,
            lobbyVisitors: gameState.lobbyVisitors,
          },
        });

        const activeFloorIds = gameState.underConstruction.map((uc) => uc.floorId);
        await tx.floorConstruction.deleteMany({
          where: { playerId, floorId: { notIn: activeFloorIds } },
        });
        for (const uc of gameState.underConstruction) {
          await tx.floorConstruction.upsert({
            where: { playerId_floorId: { playerId, floorId: uc.floorId } },
            create: {
              playerId,
              floorId: uc.floorId,
              startedAt: BigInt(uc.startedAt),
              durationMs: uc.durationMs,
              requiredTools: uc.requiredTools,
              selectedFloorType: uc.selectedFloorType ?? null,
            },
            update: {
              selectedFloorType: uc.selectedFloorType ?? null,
            },
          });
        }

        const activeFloorTypeIds = Object.keys(gameState.openedFloorTypes ?? {}).map(Number);
        await tx.playerFloorType.deleteMany({
          where: { playerId, floorId: { notIn: activeFloorTypeIds } },
        });
        for (const [floorIdStr, floorType] of Object.entries(gameState.openedFloorTypes ?? {})) {
          const floorId = Number(floorIdStr);
          await tx.playerFloorType.upsert({
            where: { playerId_floorId: { playerId, floorId } },
            create: { playerId, floorId, floorType },
            update: { floorType },
          });
        }

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
              level: w.level,
              isSpecialist: w.isSpecialist,
            },
            create: {
              id: w.id,
              playerId,
              name: w.name,
              female: w.female,
              floorType: w.floorType,
              dreamJob: w.dreamJob,
              level: w.level,
              isSpecialist: w.isSpecialist,
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

        await tx.commandLog.deleteMany({
          where: { playerId, cursor: { lt: ackCursor } },
        });
      });
    }

    const updatedPlayer = await this.prisma.player.findUnique({
      where: { id: playerId },
    });

    const progressRows = await this.prisma.playerCategoryProgress.findMany({
      where: { playerId },
      select: { categoryKey: true, progress: true, currentLevel: true, claimedLevels: true },
    });
    const categoryProgress: Record<string, CategoryProgressState> = {};
    for (const row of progressRows) {
      categoryProgress[row.categoryKey] = {
        progress: row.progress,
        currentLevel: row.currentLevel,
        claimedLevels: row.claimedLevels as number[],
      };
    }

    const finalCoinBonus = gameState.coinBonusPercent + coinBonusDelta;
    const finalXpBonus   = gameState.xpBonusPercent   + xpBonusDelta;

    return {
      state: gameState,
      stateVersion: updatedPlayer?.stateVersion ?? player.stateVersion,
      ackCursor,
      serverTime: serverNow,
      playerLevel: updatedPlayer?.playerLevel ?? xpResult.playerLevel,
      playerXp: updatedPlayer?.playerXp ?? xpResult.playerXp,
      newAchievements: allNewGrants,
      coinBonusPercent: finalCoinBonus,
      xpBonusPercent: finalXpBonus,
      categoryProgress,
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
      isSpecialist: w.isSpecialist ?? false,
    }));

    const s = player.state;

    return {
      balance: player.balance,
      gems: s?.gems ?? 20,
      floors,
      commandQueue: [],
      workers,
      hotelCapacity: s?.hotelCapacity ?? gameConfig.hotelCapacity,
      lobbyVisitors: (s?.lobbyVisitors as any[]) ?? [],
      lobbyCapacity: s?.lobbyCapacity ?? gameConfig.lobbyConfig.defaultLobbyCapacity,
      elevatorLevel: s?.elevatorLevel ?? 1,
      elevatorFloor: s?.elevatorFloor ?? 0,
      dailyTips: s?.dailyTips ?? 0,
      dailyGemsCollected: s?.dailyGemsCollected ?? 0,
      dailyTipsStage1Claimed: s?.dailyTipsRewardClaimed ?? false,
      dailyTipsStage2Claimed: s?.dailyTipsStage2Claimed ?? false,
      lastDailyReset: Number(s?.lastDailyReset ?? 0),
      nextVisitorAt: Number(s?.nextVisitorAt ?? 0),
      tools: {
        briks: s?.briks ?? 1,
        glass: s?.glass ?? 1,
        nails: s?.nails ?? 1,
        screw: s?.screw ?? 1,
      },
      underConstruction: (player.floorConstructions ?? []).map((fc: any) => ({
        floorId: fc.floorId,
        startedAt: Number(fc.startedAt),
        durationMs: fc.durationMs,
        requiredTools: fc.requiredTools as { tool: string; count: number }[],
        selectedFloorType: fc.selectedFloorType ?? null,
      })),
      openedFloorTypes: Object.fromEntries(
        (player.floorTypes ?? []).map((ft: any) => [String(ft.floorId), ft.floorType]),
      ),
      stats: {
        totalBought:           player.totalBought,
        totalListed:           player.totalListed,
        totalCollected:        player.totalCollected        ?? 0,
        totalPassengersLifted: player.totalPassengersLifted ?? 0,
      },
      coinBonusPercent: s?.coinBonusPercent ?? 0,
      xpBonusPercent:   s?.xpBonusPercent   ?? 0,
      dailyFillLobbyUses: s?.dailyFillLobbyUses ?? 0,
    };
  }
}
