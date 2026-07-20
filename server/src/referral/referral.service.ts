import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { REGISTERED_COINS, LEVEL10_GEMS, LEVEL30_GEMS, PURCHASE_BONUS_PERCENT } from './referral-constants';

function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = randomBytes(6);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

@Injectable()
export class ReferralService {
  constructor(private prisma: PrismaService) {}

  async getPlayerReferral(playerId: string) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: { referralCode: true },
    });
    if (!player) throw new NotFoundException('Player not found');

    let referralCode = player.referralCode;
    if (!referralCode) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateReferralCode();
        const existing = await this.prisma.player.findUnique({ where: { referralCode: candidate } });
        if (!existing) { referralCode = candidate; break; }
      }
      if (referralCode) {
        await this.prisma.player.update({
          where: { id: playerId },
          data: { referralCode },
        });
      }
    }

    const [referrals, usedReferral] = await Promise.all([
      this.prisma.referral.findMany({
        where: { referrerId: playerId },
        include: { referred: { select: { playerLevel: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.referral.findUnique({ where: { referredId: playerId } }),
    ]);

    return {
      code: referralCode ?? null,
      hasUsedCode: usedReferral !== null,
      referrals: referrals.map((r) => ({
        id: r.id,
        referredName: r.referredName,
        referredLevel: r.referred.playerLevel,
        milestones: {
          registered: { claimedAt: r.registeredClaimedAt?.toISOString() ?? null },
          level10: {
            reachedAt: r.level10ReachedAt?.toISOString() ?? null,
            claimedAt: r.level10ClaimedAt?.toISOString() ?? null,
          },
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
    milestone: 'registered' | 'level10' | 'level30',
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
        await tx.player.update({
          where: { id: playerId },
          data: { balance: { increment: REGISTERED_COINS } },
        });
        return { coins: REGISTERED_COINS };
      }

      if (milestone === 'level10') {
        if (!referral.level10ReachedAt) throw new BadRequestException('Milestone not yet reached');
        if (referral.level10ClaimedAt) throw new BadRequestException('Already claimed');
        await tx.referral.update({
          where: { id: referralId },
          data: { level10ClaimedAt: new Date() },
        });
        await tx.playerState.update({
          where: { playerId },
          data: { gems: { increment: LEVEL10_GEMS } },
        });
        return { gems: LEVEL10_GEMS };
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

  async applyReferralCode(playerId: string, code: string) {
    const referrer = await this.prisma.player.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });
    if (!referrer) throw new BadRequestException('Invalid referral code');
    if (referrer.id === playerId) throw new BadRequestException('Cannot use your own referral code');

    const existing = await this.prisma.referral.findUnique({ where: { referredId: playerId } });
    if (existing) throw new BadRequestException('Referral code already used');

    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: { playerName: true },
    });
    if (!player) throw new NotFoundException('Player not found');

    await this.prisma.referral.create({
      data: {
        referrerId: referrer.id,
        referredId: playerId,
        referredName: player.playerName,
      },
    });

    return { ok: true as const };
  }

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
