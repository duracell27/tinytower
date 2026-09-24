import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CityService } from './city.service';
import { CityBuildingService } from './city-building.service';
import { CityController } from './city.controller';

@Module({
  imports: [PrismaModule],
  providers: [CityService, CityBuildingService],
  controllers: [CityController],
  exports: [CityService, CityBuildingService],
})
export class CityModule {}
