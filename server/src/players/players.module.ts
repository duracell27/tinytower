// server/src/players/players.module.ts
import { Module } from '@nestjs/common';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CityModule } from '../city/city.module';

@Module({
  imports: [PrismaModule, CityModule],
  controllers: [PlayersController],
  providers: [PlayersService],
})
export class PlayersModule {}
