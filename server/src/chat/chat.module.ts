import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';

@Module({
  imports: [PrismaModule],
  providers: [ChatService],
  controllers: [ChatController],
})
export class ChatModule {}
