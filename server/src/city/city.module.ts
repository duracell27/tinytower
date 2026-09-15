import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CityService } from './city.service';
import { CityController } from './city.controller';

@Module({
  imports: [PrismaModule],
  providers: [CityService],
  controllers: [CityController],
  exports: [CityService],
})
export class CityModule {}
