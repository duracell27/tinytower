import { Controller, Get } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get('messages')
  async getMessages() {
    const messages = await this.chatService.fetchMessages();
    return { messages };
  }
}
