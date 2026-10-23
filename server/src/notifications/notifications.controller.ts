import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Post('token')
  @UseGuards(JwtAuthGuard)
  async registerToken(
    @Req() req: { user: { playerId: string } },
    @Body() body: { token: string; platform: string },
  ): Promise<void> {
    await this.notificationsService.saveToken(req.user.playerId, body.token, body.platform);
  }
}
