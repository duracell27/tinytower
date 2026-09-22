import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { ReferralModule } from '../referral/referral.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RevenueCatClient } from './revenuecat.client';

@Module({
  imports: [ConfigModule, PrismaModule, ReferralModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, RevenueCatClient],
})
export class PaymentsModule {}
