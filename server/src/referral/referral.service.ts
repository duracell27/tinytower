import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const REGISTERED_GEMS = 5;
const LEVEL30_GEMS = 50;
const PURCHASE_BONUS_PERCENT = 10;

@Injectable()
export class ReferralService {
  constructor(private prisma: PrismaService) {}

  async getPlayerReferral(playerId: string) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: { referralCode: true },
    });
    if (!player) throw new NotFoundException('Player not found');

    const referrals = await this.prisma.referral.findMany({
      where: { referrerId: playerId },
      include: { referred: { select: { playerLevel: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return {
      code: player.referralCode ?? null,
      referrals: referrals.map((r) => ({
        id: r.id,
        referredName: r.referredName,
        referredLevel: r.referred.playerLevel,
        milestones: {
          registered: { claimedAt: r.registeredClaimedAt?.toISOString() ?? null },
          level30: {
            reachedAt: r.level30ReachedAt?.toISOString() ?? null,
            claimedAt: r.level30ClaimedAt?.toISOString() ?? null,
          },
        },
        gemBonusEarned: r.gemBonusEarned,
      })),
    };
  }

  async claimMilestone(
    playerId: string,
    referralId: string,
    milestone: 'registered' | 'level30',
  ) {
    return this.prisma.$transaction(async (tx) => {
      const referral = await tx.referral.findUnique({ where: { id: referralId } });

      if (!referral || referral.referrerId !== playerId) {
        throw new NotFoundException('Referral not found');
      }

      if (milestone === 'registered') {
        if (referral.registeredClaimedAt) throw new BadRequestException('Already claimed');
        await tx.referral.update({
          where: { id: referralId },
          data: { registeredClaimedAt: new Date() },
        });
        await tx.playerState.update({
          where: { playerId },
          data: { gems: { increment: REGISTERED_GEMS } },
        });
        return { gems: REGISTERED_GEMS };
      }

      if (milestone === 'level30') {
        if (!referral.level30ReachedAt) throw new BadRequestException('Milestone not yet reached');
        if (referral.level30ClaimedAt) throw new BadRequestException('Already claimed');
        await tx.referral.update({
          where: { id: referralId },
          data: { level30ClaimedAt: new Date() },
        });
        await tx.playerState.update({
          where: { playerId },
          data: { gems: { increment: LEVEL30_GEMS } },
        });
        return { gems: LEVEL30_GEMS };
      }

      throw new BadRequestException('Unknown milestone');
    });
  }

  // Called from gem purchase flow when implemented
  async processPurchaseBonus(buyerId: string, purchaseAmount: number) {
    const referral = await this.prisma.referral.findUnique({
      where: { referredId: buyerId },
    });
    if (!referral) return;

    const bonus = Math.floor(purchaseAmount * PURCHASE_BONUS_PERCENT / 100);
    if (bonus <= 0) return;

    await this.prisma.$transaction([
      this.prisma.referral.update({
        where: { id: referral.id },
        data: { gemBonusEarned: { increment: bonus } },
      }),
      this.prisma.playerState.update({
        where: { playerId: referral.referrerId },
        data: { gems: { increment: bonus } },
      }),
      this.prisma.referralPurchaseNotification.create({
        data: {
          referrerId: referral.referrerId,
          referredName: referral.referredName,
          bonus,
          purchaseAmount,
        },
      }),
    ]);
  }
}
