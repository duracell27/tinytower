import { Controller, Get, Post, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CityTaskService } from './city-task.service';
import { CityService } from './city.service';
import { PrismaService } from '../prisma/prisma.service';

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
    if (!bonus) return { tasks: [], myActiveTaskId: null, cityStyleStars: 0 };
    const [tasks, city] = await Promise.all([
      this.cityTaskService.getOrCreateDailyTasks(bonus.cityId, bonus.level),
      this.prisma.city.findUnique({ where: { id: bonus.cityId }, select: { styleStars: true } }),
    ]);
    const myActive = tasks.find(
      (t) =>
        t.participants.some((p) => p.playerId === req.user.playerId) &&
        (t.status === 'IN_PROGRESS' || t.status === 'COMPLETED'),
    );
    return { tasks, myActiveTaskId: myActive?.id ?? null, cityStyleStars: city?.styleStars ?? 0 };
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
}
