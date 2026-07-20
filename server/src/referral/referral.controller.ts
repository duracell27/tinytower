import {
  Controller, Get, Post, Body, UseGuards, Req, BadRequestException,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReferralService } from './referral.service';

const ClaimSchema = z.object({
  referralId: z.string().uuid(),
  milestone: z.enum(['registered', 'level10', 'level30']),
});

const ApplyCodeSchema = z.object({
  code: z.string().regex(/^[A-Z0-9]{6}$/),
});

@Controller()
export class ReferralController {
  constructor(private referralService: ReferralService) {}

  @Get('player/referral')
  @UseGuards(JwtAuthGuard)
  async getPlayerReferral(@Req() req: { user: { playerId: string } }) {
    return this.referralService.getPlayerReferral(req.user.playerId);
  }

  @Post('referrals/claim')
  @UseGuards(JwtAuthGuard)
  async claimMilestone(
    @Req() req: { user: { playerId: string } },
    @Body() body: unknown,
  ) {
    const result = ClaimSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.issues);
    return this.referralService.claimMilestone(
      req.user.playerId,
      result.data.referralId,
      result.data.milestone,
    );
  }

  @Post('referrals/apply-code')
  @UseGuards(JwtAuthGuard)
  async applyReferralCode(
    @Req() req: { user: { playerId: string } },
    @Body() body: unknown,
  ) {
    const result = ApplyCodeSchema.safeParse(body);
    if (!result.success) throw new BadRequestException('Invalid referral code format');
    return this.referralService.applyReferralCode(req.user.playerId, result.data.code);
  }
}
