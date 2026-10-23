import { Controller, Post, Body, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

const RegisterTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['ios', 'android']),
});

@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Post('token')
  @UseGuards(JwtAuthGuard)
  async registerToken(
    @Req() req: { user: { playerId: string } },
    @Body() body: unknown,
  ): Promise<void> {
    const result = RegisterTokenSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.issues.map((i) => i.message).join(', '));
    await this.notificationsService.saveToken(req.user.playerId, result.data.token, result.data.platform);
  }
}
