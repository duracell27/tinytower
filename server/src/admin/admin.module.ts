import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { ReportModule } from '../report/report.module';
import { CityWeeklyRankingService } from '../city/city-weekly-ranking.service';
import { CityService } from '../city/city.service';
import { CityBuildingService } from '../city/city-building.service';

@Module({
  imports: [PrismaModule, ReportModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard, CityWeeklyRankingService, CityService, CityBuildingService],
})
export class AdminModule {}
