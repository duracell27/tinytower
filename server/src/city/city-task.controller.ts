import { Controller, Get, Post, Param, Req, UseGuards, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CityTaskService } from './city-task.service';
import { CityService } from './city.service';
import { PrismaService } from '../prisma/prisma.service';
import { isWeekendUTC, currentWeekStart } from './city-task.constants';

type AuthReq = { user: { playerId: string } };

@Controller('city/tasks')
export class CityTaskController {
  constructor(
    private cityTaskService: CityTaskService,
    private cityService: CityService,
    private prisma: PrismaService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getTasks(@Req() req: AuthReq) {
    const bonus = await this.cityService.getCityBonusForPlayer(req.user.playerId);
    if (!bonus) return { tasks: [], myActiveTaskId: null, cityStyleStars: 0, weeklyTickets: 0, isWeekend: isWeekendUTC(), weeklyResult: null };
    const weekStart = currentWeekStart();
    const [tasks, city, weeklyResult, weeklyStats] = await Promise.all([
      this.cityTaskService.getOrCreateDailyTasks(bonus.cityId, bonus.level),
      this.prisma.city.findUnique({ where: { id: bonus.cityId }, select: { styleStars: true } }),
      this.cityTaskService.getWeeklyResult(bonus.cityId),
      this.prisma.cityWeeklyStats.findUnique({ where: { cityId_weekStart: { cityId: bonus.cityId, weekStart } }, select: { totalTickets: true } }),
    ]);
    const myActive = tasks.find(
      (t) =>
        t.participants.some((p) => p.playerId === req.user.playerId) &&
        (t.status === 'IN_PROGRESS' || t.status === 'COMPLETED'),
    );
    return {
      tasks,
      myActiveTaskId: myActive?.id ?? null,
      cityStyleStars: city?.styleStars ?? 0,
      weeklyTickets: weeklyStats?.totalTickets ?? 0,
      isWeekend: isWeekendUTC(),
      weeklyResult: weeklyResult ?? null,
    };
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  joinTask(@Req() req: AuthReq, @Param('id') taskId: string) {
    return this.cityTaskService.joinTask(req.user.playerId, taskId);
  }

  @Post(':id/collect')
  @UseGuards(JwtAuthGuard)
  collectTask(@Req() req: AuthReq, @Param('id') taskId: string) {
    return this.cityTaskService.collectTask(req.user.playerId, taskId);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  cancelTask(@Req() req: AuthReq, @Param('id') taskId: string) {
    return this.cityTaskService.cancelTask(req.user.playerId, taskId);
  }

  @Post('weekly-result')
  @UseGuards(JwtAuthGuard)
  async createWeeklyResult(@Req() req: AuthReq, @Body() body: { cityId: string; message?: string }) {
    return this.cityTaskService.createWeeklyResult(req.user.playerId, body.cityId, body.message);
  }
}
