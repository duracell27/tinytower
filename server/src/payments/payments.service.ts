// server/src/payments/payments.service.ts
import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RevenueCatClient } from './revenuecat.client';
import { ReferralService } from '../referral/referral.service';
import { SHOP_PACKS_MAP, SHOP_PACKS_BY_RC_PRODUCT } from '@shared/config/shopPacksConfig';
import type { ShopRewards } from '@shared/types';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private rcClient: RevenueCatClient,
    private referralService: ReferralService,
  ) {}

  async notifyPurchase(
    playerId: string,
    packId: string,
    transactionId: string,
  ): Promise<ShopRewards> {
    const pack = SHOP_PACKS_MAP[packId];
    if (!pack) throw new NotFoundException(`Unknown packId: ${packId}`);

    // Idempotency
    const existing = await this.prisma.purchase.findUnique({ where: { transactionId } });
    if (existing) {
      return this.buildRewardsFromRecord(existing);
    }

    // Verify with RevenueCat
    const valid = await this.rcClient.verifyTransaction(playerId, transactionId, pack.rcProductId);
    if (!valid) {
      this.logger.warn(`RC verification failed: player=${playerId} txn=${transactionId}`);
      throw new BadRequestException('Payment verification failed');
    }

    await this.applyRewards(playerId, pack.id, pack.rcProductId, transactionId, pack.rewards, pack.priceUsd, 'notify');
    return pack.rewards;
  }

  async handleWebhookPurchase(
    appUserId: string,
    transactionId: string,
    rcProductId: string,
  ): Promise<void> {
    const pack = SHOP_PACKS_BY_RC_PRODUCT[rcProductId];
    if (!pack) {
      this.logger.warn(`Unknown rcProductId in webhook: ${rcProductId}`);
      return;
    }

    const existing = await this.prisma.purchase.findUnique({ where: { transactionId } });
    if (existing) return; // already processed via notify

    await this.applyRewards(appUserId, pack.id, pack.rcProductId, transactionId, pack.rewards, pack.priceUsd, 'webhook');
  }

  private async applyRewards(
    playerId: string,
    packId: string,
    rcProductId: string,
    transactionId: string,
    rewards: ShopRewards,
    priceUsd: number,
    source: 'notify' | 'webhook',
  ): Promise<void> {
    const gems   = rewards.gems   ?? 0;
    const tools  = rewards.tools  ?? {};
    const tokens = rewards.tokens ?? {};

    await this.prisma.$transaction(async (tx) => {
      await tx.purchase.create({
        data: {
          playerId,
          transactionId,
          packId,
          rcProductId,
          status: 'fulfilled',
          gemsGranted:   gems,
          toolsGranted:  Object.keys(tools).length  ? tools  : undefined,
          tokensGranted: Object.keys(tokens).length ? tokens : undefined,
          source,
        },
      });

      await tx.playerState.update({
        where: { playerId },
        data: {
          ...(gems > 0 ? { gems: { increment: gems } } : {}),
          ...(tools.briks  ? { briks:  { increment: tools.briks  } } : {}),
          ...(tools.glass  ? { glass:  { increment: tools.glass  } } : {}),
          ...(tools.nails  ? { nails:  { increment: tools.nails  } } : {}),
          ...(tools.screw  ? { screw:  { increment: tools.screw  } } : {}),
          ...(tools.wood   ? { wood:   { increment: tools.wood   } } : {}),
          ...(tools.cement ? { cement: { increment: tools.cement } } : {}),
          ...(tokens.green  ? { tokenGreen:  { increment: tokens.green  } } : {}),
          ...(tokens.blue   ? { tokenBlue:   { increment: tokens.blue   } } : {}),
          ...(tokens.yellow ? { tokenYellow: { increment: tokens.yellow } } : {}),
          ...(tokens.purple ? { tokenPurple: { increment: tokens.purple } } : {}),
          ...(tokens.red    ? { tokenRed:    { increment: tokens.red    } } : {}),
        },
      });

      // Bump stateVersion so the next sync triggers a full reconcile and the
      // client sees the updated gems/tools/tokens immediately.
      await tx.player.update({
        where: { id: playerId },
        data: { stateVersion: { increment: 1 } },
      });

      if (gems > 0) {
        const membership = await tx.cityMembership.findUnique({ where: { playerId } });
        if (membership) {
          await tx.cityMembership.update({
            where: { playerId },
            data: { gemsShopBonus: { increment: gems } },
          });
        }
      }
    });

    // Outside transaction (best-effort, non-critical)
    await this.referralService.processPurchaseBonus(playerId, priceUsd).catch((e) => {
      this.logger.error(`referral bonus failed for ${playerId}: ${e.message}`);
    });
  }

  private buildRewardsFromRecord(record: {
    gemsGranted: number;
    toolsGranted: unknown;
    tokensGranted: unknown;
  }): ShopRewards {
    const rewards: ShopRewards = {};
    if (record.gemsGranted > 0) rewards.gems = record.gemsGranted;
    if (record.toolsGranted)  rewards.tools  = record.toolsGranted as ShopRewards['tools'];
    if (record.tokensGranted) rewards.tokens = record.tokensGranted as ShopRewards['tokens'];
    return rewards;
  }
}
