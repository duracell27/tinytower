import {
  Controller, Get, Post, Body, Param, Query,
  UseGuards, Req, BadRequestException,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CityChatService } from './city-chat.service';

const SendSchema = z.object({
  body: z.string().min(1).max(500),
  mentionedPlayerId: z.string().uuid().optional(),
  mentionedName: z.string().max(50).optional(),
});

type AuthReq = { user: { playerId: string; email: string; isAdmin: boolean } };

@Controller('city/:cityId/chat')
@UseGuards(JwtAuthGuard)
export class CityChatController {
  constructor(private cityChatService: CityChatService) {}

  @Get()
  async getMessages(
    @Param('cityId') cityId: string,
    @Query('page') page = '1',
    @Req() req: AuthReq,
  ) {
    return this.cityChatService.getMessages(cityId, req.user.playerId, Math.max(1, parseInt(page, 10) || 1));
  }

  @Post()
  async sendMessage(
    @Param('cityId') cityId: string,
    @Body() rawBody: unknown,
    @Req() req: AuthReq,
  ) {
    const parsed = SendSchema.safeParse(rawBody);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const message = await this.cityChatService.sendMessage(
      cityId,
      req.user.playerId,
      parsed.data.body,
      parsed.data.mentionedPlayerId,
      parsed.data.mentionedName,
    );
    return { message };
  }

  @Get('unread-count')
  async getUnreadCount(@Param('cityId') cityId: string, @Req() req: AuthReq) {
    const count = await this.cityChatService.getUnreadCount(cityId, req.user.playerId);
    return { count };
  }

  @Get('pending-mention')
  async getPendingMention(@Param('cityId') cityId: string, @Req() req: AuthReq) {
    const hasMention = await this.cityChatService.hasPendingMention(cityId, req.user.playerId);
    return { hasMention };
  }

  @Post('read-mentions')
  async readMentions(@Param('cityId') cityId: string, @Req() req: AuthReq) {
    await this.cityChatService.readMentions(cityId, req.user.playerId);
    return { success: true };
  }
}
