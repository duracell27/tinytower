import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import type { ShopRewards, ToolKey, TokenColor } from '@shared/types';

@Controller('dev')
@UseGuards(JwtAuthGuard)
export class DevController {
  constructor(private prisma: PrismaService) {}

  @Post('grant')
  async grant(@Req() req: any, @Body() body: ShopRewards) {
    const playerId: string = req.user.playerId;
    const gems   = body.gems   ?? 0;
    const tools  = body.tools  ?? {};
    const tokens = body.tokens ?? {};

    const TOOL_FIELD: Record<ToolKey, string> = {
      briks: 'briks', glass: 'glass', nails: 'nails',
      screw: 'screw', wood:  'wood',  cement: 'cement',
    };
    const TOKEN_FIELD: Record<TokenColor, string> = {
      green: 'tokenGreen', blue: 'tokenBlue', yellow: 'tokenYellow',
      purple: 'tokenPurple', red: 'tokenRed',
    };

    await this.prisma.$transaction([
      this.prisma.playerState.update({
        where: { playerId },
        data: {
          ...(gems > 0 ? { gems: { increment: gems } } : {}),
          ...(Object.fromEntries(
            (Object.entries(tools) as [ToolKey, number][])
              .filter(([, v]) => v > 0)
              .map(([k, v]) => [TOOL_FIELD[k], { increment: v }]),
          )),
          ...(Object.fromEntries(
            (Object.entries(tokens) as [TokenColor, number][])
              .filter(([, v]) => v > 0)
              .map(([k, v]) => [TOKEN_FIELD[k], { increment: v }]),
          )),
        },
      }),
      this.prisma.player.update({
        where: { id: playerId },
        data: { stateVersion: { increment: 1 } },
      }),
    ]);

    return { ok: true };
  }
}
