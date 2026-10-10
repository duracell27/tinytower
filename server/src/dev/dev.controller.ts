import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../admin/admin.guard';
import { PrismaService } from '../prisma/prisma.service';
import type { ShopRewards, ToolKey, TokenColor } from '@shared/types';

interface CityBudgetGrantBody {
  cityId: string;
  coins?: number;
  gems?: number;
  tools?: Partial<Record<ToolKey, number>>;
}

@Controller('dev')
@UseGuards(JwtAuthGuard, AdminGuard)
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

  @Post('city-budget-grant')
  async cityBudgetGrant(@Req() req: any, @Body() body: CityBudgetGrantBody) {
    const playerId: string = req.user.playerId;
    const { cityId, coins = 0, gems = 0, tools = {} } = body;

    const TOOL_FIELD: Record<ToolKey, string> = {
      briks: 'budgetBriks', glass: 'budgetGlass', nails: 'budgetNails',
      screw: 'budgetScrew', wood:  'budgetWood',  cement: 'budgetCement',
    };

    await this.prisma.city.update({
      where: { id: cityId },
      data: {
        ...(coins > 0 ? { budgetCoins: { increment: coins } } : {}),
        ...(gems  > 0 ? { budgetGems:  { increment: gems  } } : {}),
        ...(Object.fromEntries(
          (Object.entries(tools) as [ToolKey, number][])
            .filter(([, v]) => v > 0)
            .map(([k, v]) => [TOOL_FIELD[k], { increment: v }]),
        )),
      },
    });

    return { ok: true };
  }
}
