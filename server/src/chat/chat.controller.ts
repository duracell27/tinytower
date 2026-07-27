import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { ChatService } from './chat.service';

const SendMessageSchema = z.object({
  body: z.string().min(1).max(300),
  playerLevel: z.number().int().min(1).max(200).default(1),
  country: z.string().length(2).optional(),
});

const EditMessageSchema = z.object({
  body: z.string().min(1).max(300),
});

type AuthReq = { user: { playerId: string; email: string; isAdmin: boolean } };

@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get('messages')
  async getMessages(@Query('country') country?: string) {
    const messages = await this.chatService.fetchMessages(country);
    return { messages };
  }

  @Post('messages')
  @UseGuards(JwtAuthGuard)
  async sendMessage(@Req() req: AuthReq, @Body() body: unknown) {
    const parsed = SendMessageSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const message = await this.chatService.sendMessage(
      req.user.playerId,
      parsed.data.body,
      parsed.data.playerLevel,
      parsed.data.country,
    );
    return { message };
  }

  @Patch('messages/:id')
  @UseGuards(JwtAuthGuard)
  async editMessage(@Param('id') id: string, @Req() req: AuthReq, @Body() body: unknown) {
    const parsed = EditMessageSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const message = await this.chatService.updateMessage(id, parsed.data.body, req.user.playerId);
    return { message };
  }

  @Delete('messages/:id')
  @UseGuards(JwtAuthGuard)
  async deleteMessage(@Param('id') id: string, @Req() req: AuthReq) {
    return this.chatService.deleteMessage(id, req.user.playerId, req.user.isAdmin);
  }
}
