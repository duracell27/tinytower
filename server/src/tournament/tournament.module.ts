import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TournamentController } from './tournament.controller';
import { TournamentPlayerController } from './tournament.player.controller';
import { TournamentService } from './tournament.service';

@Module({
  imports: [PrismaModule],
  controllers: [TournamentController, TournamentPlayerController],
  providers: [TournamentService],
  exports: [TournamentService],
})
export class TournamentModule {}
