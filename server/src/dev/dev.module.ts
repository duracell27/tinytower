import { Module } from '@nestjs/common';
import { DevController } from './dev.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [DevController],
})
export class DevModule {}
