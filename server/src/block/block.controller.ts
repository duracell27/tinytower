import { Controller, Post, Delete, Get, Param, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BlockService } from './block.service';

type AuthReq = { user: { playerId: string } };

@Controller('block')
export class BlockController {
  constructor(private blockService: BlockService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  getBlocked(@Req() req: AuthReq) {
    return this.blockService.getBlockedIds(req.user.playerId);
  }

  @Post(':id')
  @UseGuards(JwtAuthGuard)
  blockPlayer(@Req() req: AuthReq, @Param('id') id: string) {
    return this.blockService.blockPlayer(req.user.playerId, id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  unblockPlayer(@Req() req: AuthReq, @Param('id') id: string) {
    return this.blockService.unblockPlayer(req.user.playerId, id);
  }
}
