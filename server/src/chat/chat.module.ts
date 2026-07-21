import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { AdminGuard } from './admin.guard';

@Module({
  imports: [PrismaModule],
  providers: [ChatService, AdminGuard],
  controllers: [ChatController],
})
export class ChatModule {}
