import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CityService } from './city.service';
import { CityBuildingService } from './city-building.service';
import { CityController } from './city.controller';
import { CityTaskService } from './city-task.service';
import { CityTaskController } from './city-task.controller';
import { CityChatModule } from '../city-chat/city-chat.module';

@Module({
  imports: [PrismaModule, CityChatModule],
  providers: [CityService, CityBuildingService, CityTaskService],
  controllers: [CityController, CityTaskController],
  exports: [CityService, CityBuildingService, CityTaskService],
})
export class CityModule {}
