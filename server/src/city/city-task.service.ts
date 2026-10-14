import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CityTaskType, CityTaskStatus, CityRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ALL_TASK_TYPES, calcRequiredCount, todayUtcMidnight, isWeekendUTC, currentWeekStart, computeWeeklyReward, TASK_GEM_REWARDS, TASK_COINS_MULTIPLIER } from './city-task.constants';
import { getCityLevel } from './city-level';

const LEADERSHIP_ROLES: CityRole[] = [CityRole.VICE_MAYOR, CityRole.ACTING_MAYOR, CityRole.MAYOR];

export interface CityTaskSummaryDto {
  id: string;
  taskType: CityTaskType;
  status: CityTaskStatus;
  requiredCount: number;
  currentProgress: number;
  participants: { playerId: string; progress: number }[];
  takenAt: string | null;
  canDoubleUntil: string | null;
  rewardStars: number | null;
  finalStars: number | null;
}

type PrismaTx = Omit<PrismaService, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

@Injectable()
export class CityTaskService {
  constructor(private prisma: PrismaService) {}

  async getOrCreateDailyTasks(cityId: string, cityLevel: number): Promise<CityTaskSummaryDto[]> {
    if (cityLevel < 10) return [];
    if (isWeekendUTC()) return [];
    const today = todayUtcMidnight();

    await this.prisma.cityDailyTask.updateMany({
      where: {
        cityId,
        date: { lt: today },
        status: { in: [CityTaskStatus.IN_PROGRESS, CityTaskStatus.COMPLETED] },
      },
      data: { status: CityTaskStatus.EXPIRED },
    });

    const existing = await this.prisma.cityDailyTask.findMany({
      where: { cityId, date: today },
      include: { participants: { select: { playerId: true, progress: true } } },
    });

    if (existing.length === 9) return existing.map(this.toDto);

    await this.prisma.cityDailyTask.createMany({
      data: ALL_TASK_TYPES.map((taskType) => ({
        cityId,
        taskType,
        date: today,
        requiredCount: calcRequiredCount(taskType, cityLevel),
      })),
      skipDuplicates: true,
    });

    const created = await this.prisma.cityDailyTask.findMany({
      where: { cityId, date: today },
      include: { participants: { select: { playerId: true, progress: true } } },
    });
    return created.map(this.toDto);
  }

  async joinTask(playerId: string, taskId: string): Promise<CityTaskSummaryDto> {
    const today = todayUtcMidnight();

    return this.prisma.$transaction(async (tx) => {
      const activeParticipation = await tx.cityTaskParticipant.findFirst({
        where: {
          playerId,
          task: { date: today, status: { in: [CityTaskStatus.IN_PROGRESS, CityTaskStatus.AVAILABLE] } },
        },
      });
      if (activeParticipation) throw new BadRequestException('Already participating in another task today');

      const task = await tx.cityDailyTask.findUnique({
        where: { id: taskId },
        include: { participants: true },
      });
      if (!task) throw new NotFoundException('Task not found');
      if (task.status !== CityTaskStatus.AVAILABLE && task.status !== CityTaskStatus.IN_PROGRESS) {
        throw new BadRequestException('Task is not open for joining');
      }
      if (task.participants.length >= 2) throw new BadRequestException('Task already has 2 participants');

      const isFirst = task.participants.length === 0;
      await tx.cityTaskParticipant.create({ data: { taskId, playerId, progress: 0 } });
      const updated = await tx.cityDailyTask.update({
        where: { id: taskId },
        data: {
          status: CityTaskStatus.IN_PROGRESS,
          ...(isFirst && { takenAt: new Date() }),
        },
        include: { participants: { select: { playerId: true, progress: true } } },
      });
      return this.toDto(updated);
    });
  }

  async collectTask(actorId: string, taskId: string): Promise<{ finalStars: number; gemReward: number; coinsReward: number }> {
    const task = await this.prisma.cityDailyTask.findUnique({
      where: { id: taskId },
      include: {
        participants: { select: { playerId: true } },
        city: { select: { cityXp: true } },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (task.status !== CityTaskStatus.COMPLETED) throw new BadRequestException('Task not completed');

    const membership = await this.prisma.cityMembership.findUnique({ where: { playerId: actorId } });
    if (!membership) throw new ForbiddenException('Not a member of this city');
    if (membership.cityId !== task.cityId) throw new ForbiddenException('Not a member of this city');

    const isLeader = LEADERSHIP_ROLES.includes(membership.role as CityRole);
    const isParticipant = task.participants.some((p) => p.playerId === actorId);
    if (!isLeader && !isParticipant) {
      throw new ForbiddenException('Only Vice Mayor, Acting Mayor, Mayor, or a task participant can collect');
    }

    const now = Date.now();
    const multiplier = task.takenAt && (now - task.takenAt.getTime()) <= 36_000_000 ? 2 : 1;
    const rewardStars = Math.floor(Math.random() * 10) + 1;
    const finalStars = rewardStars * multiplier;

    const cityLevel = getCityLevel(task.city.cityXp);
    const gemReward = TASK_GEM_REWARDS[task.taskType] * multiplier;
    const coinsReward = cityLevel * TASK_COINS_MULTIPLIER[task.taskType] * multiplier;
    const participantIds = task.participants.map((p) => p.playerId);

    const weekStart = currentWeekStart();
    await this.prisma.$transaction(async (tx) => {
      await tx.cityDailyTask.update({
        where: { id: taskId },
        data: { status: CityTaskStatus.COLLECTED, collectedAt: new Date(), rewardStars, finalStars },
      });
      await tx.city.update({
        where: { id: task.cityId },
        data: { styleStars: { increment: finalStars } },
      });
      await tx.cityWeeklyStats.upsert({
        where: { cityId_weekStart: { cityId: task.cityId, weekStart } },
        create: { cityId: task.cityId, weekStart, totalTickets: finalStars },
        update: { totalTickets: { increment: finalStars } },
      });
      for (const playerId of participantIds) {
        await tx.playerState.update({
          where: { playerId },
          data: { gems: { increment: gemReward } },
        });
        await tx.player.update({
          where: { id: playerId },
          data: { balance: { increment: coinsReward } },
        });
      }
    });
    return { finalStars, gemReward, coinsReward };
  }

  async cancelTask(actorId: string, taskId: string): Promise<void> {
    const task = await this.prisma.cityDailyTask.findUnique({
      where: { id: taskId },
      include: { participants: { select: { playerId: true } } },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (task.status !== CityTaskStatus.IN_PROGRESS && task.status !== CityTaskStatus.COMPLETED) {
      throw new BadRequestException('Task cannot be cancelled');
    }
    const membership = await this.prisma.cityMembership.findUnique({ where: { playerId: actorId } });
    if (!membership) throw new ForbiddenException('Not a member of this city');
    if (membership.cityId !== task.cityId) throw new ForbiddenException('Not a member of this city');

    const isLeader = LEADERSHIP_ROLES.includes(membership.role as CityRole);
    const isParticipant = task.participants.some((p) => p.playerId === actorId);
    if (!isLeader && !isParticipant) {
      throw new ForbiddenException('Only Vice Mayor, Acting Mayor, Mayor, or a task participant can cancel');
    }

    await this.prisma.$transaction([
      this.prisma.cityTaskParticipant.deleteMany({ where: { taskId } }),
      this.prisma.cityDailyTask.update({
        where: { id: taskId },
        data: { status: CityTaskStatus.AVAILABLE, currentProgress: 0, takenAt: null, completedAt: null },
      }),
    ]);
  }

  async updateProgressFromDelta(
    playerId: string,
    delta: Record<CityTaskType, number>,
    tx: PrismaTx,
  ): Promise<void> {
    const today = todayUtcMidnight();
    const participant = await tx.cityTaskParticipant.findFirst({
      where: { playerId, task: { date: today, status: CityTaskStatus.IN_PROGRESS } },
      include: { task: true },
    });
    if (!participant) return;

    const increment = delta[participant.task.taskType] ?? 0;
    if (increment === 0) return;

    const cappedIncrement = Math.min(increment, participant.task.requiredCount - participant.task.currentProgress);
    await tx.cityTaskParticipant.update({
      where: { id: participant.id },
      data: { progress: { increment: cappedIncrement } },
    });

    const newTotal = Math.min(participant.task.currentProgress + cappedIncrement, participant.task.requiredCount);
    const isCompleted = newTotal >= participant.task.requiredCount;

    await tx.cityDailyTask.update({
      where: { id: participant.task.id },
      data: {
        currentProgress: newTotal,
        ...(isCompleted && { status: CityTaskStatus.COMPLETED, completedAt: new Date() }),
      },
    });
  }

  async getWeeklyResult(cityId: string) {
    const weekStart = currentWeekStart();
    return this.prisma.cityWeeklyResult.findUnique({
      where: { cityId_weekStart: { cityId, weekStart } },
      select: { id: true, cityId: true, weekStart: true, message: true, createdBy: true, rank: true, totalTickets: true, totalReward: true, createdAt: true },
    });
  }

  async createWeeklyResult(actorId: string, cityId: string, message?: string) {
    const membership = await this.prisma.cityMembership.findUnique({ where: { playerId: actorId } });
    if (!membership || membership.cityId !== cityId) throw new ForbiddenException('Not a member of this city');
    const isLeader = ([CityRole.MAYOR, CityRole.ACTING_MAYOR] as CityRole[]).includes(membership.role);
    if (!isLeader) throw new ForbiddenException('Only Mayor or Acting Mayor can post weekly results');

    const weekStart = currentWeekStart();
    return this.prisma.cityWeeklyResult.upsert({
      where: { cityId_weekStart: { cityId, weekStart } },
      create: { cityId, weekStart, message: message ?? null, createdBy: actorId },
      update: { message: message ?? null, createdBy: actorId },
    });
  }

  toDto(task: any): CityTaskSummaryDto {
    return {
      id: task.id,
      taskType: task.taskType,
      status: task.status,
      requiredCount: task.requiredCount,
      currentProgress: task.currentProgress,
      participants: task.participants ?? [],
      takenAt: task.takenAt?.toISOString() ?? null,
      canDoubleUntil: task.takenAt
        ? new Date(task.takenAt.getTime() + 36_000_000).toISOString()
        : null,
      rewardStars: task.rewardStars ?? null,
      finalStars: task.finalStars ?? null,
    };
  }
}
