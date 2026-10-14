import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ReportModule } from '../report/report.module';
import { CityWeeklyRankingService } from '../city/city-weekly-ranking.service';

@Module({
  imports: [PrismaModule, ReportModule],
  controllers: [AdminController],
  providers: [AdminService, CityWeeklyRankingService],
})
export class AdminModule {}
