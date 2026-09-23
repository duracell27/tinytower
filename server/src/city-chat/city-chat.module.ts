import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CityChatService } from './city-chat.service';
import { CityChatController } from './city-chat.controller';

@Module({
  imports: [PrismaModule],
  providers: [CityChatService],
  controllers: [CityChatController],
})
export class CityChatModule {}
