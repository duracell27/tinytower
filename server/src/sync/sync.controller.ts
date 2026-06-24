import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SyncService } from './sync.service';
import { CommandSchema } from '@shared/schemas/command';

const SyncRequestSchema = z.object({
  commands: z.array(CommandSchema),
  lastAckCursor: z.number().int().nonnegative(),
});

@Controller('sync')
export class SyncController {
  constructor(private syncService: SyncService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async sync(
    @Req() req: { user: { playerId: string } },
    @Body() body: unknown,
  ) {
    const result = SyncRequestSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.issues);

    return this.syncService.processSync(
      req.user.playerId,
      result.data.commands,
      result.data.lastAckCursor,
    );
  }
}
