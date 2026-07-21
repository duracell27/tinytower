import { Controller, Get, Post, Body, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatService } from './chat.service';

const SendMessageSchema = z.object({
  body: z.string().min(1).max(300),
  playerName: z.string().min(1).max(50),
});

@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get('messages')
  async getMessages() {
    const messages = await this.chatService.fetchMessages();
    return { messages };
  }

  @Post('messages')
  @UseGuards(JwtAuthGuard)
  async sendMessage(
    @Req() req: { user: { playerId: string; email: string; isAdmin: boolean } },
    @Body() body: unknown,
  ) {
    const parsed = SendMessageSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);

    const message = await this.chatService.sendMessage(
      req.user.playerId,
      parsed.data.playerName,
      parsed.data.body,
    );
    return { message };
  }
}
