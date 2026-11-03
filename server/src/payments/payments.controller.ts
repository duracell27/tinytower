import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
  OnModuleInit,
  UnauthorizedException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'node:crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentsService } from './payments.service';
import { NotifyPurchaseDto } from './dto/notify-purchase.dto';
import { ConfigService } from '@nestjs/config';

@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('payments')
export class PaymentsController implements OnModuleInit {
  constructor(
    private payments: PaymentsService,
    private config: ConfigService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'production' && !this.config.get<string>('REVENUECAT_WEBHOOK_SECRET')) {
      throw new Error('REVENUECAT_WEBHOOK_SECRET is not set — all RevenueCat webhooks will fail');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('notify')
  async notify(
    @Req() req: { user: { playerId: string } },
    @Body() body: NotifyPurchaseDto,
  ) {
    const rewards = await this.payments.notifyPurchase(
      req.user.playerId,
      body.packId,
      body.transactionId,
    );
    return { rewards };
  }

  @Post('rc-webhook')
  @HttpCode(200)
  async rcWebhook(
    @Req() req: Request,
    @Body() body: any,
  ) {
    const webhookSecret = this.config.get<string>('REVENUECAT_WEBHOOK_SECRET');
    const sigHeader = req.headers['x-revenuecat-webhook-signature'] as string | undefined;
    const rawBody = (req as any).rawBody as Buffer | undefined;

    if (!webhookSecret || !sigHeader || !rawBody) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const parts = Object.fromEntries(sigHeader.split(',').map(p => p.split('=')));
    const timestamp = parts['t'];
    const v1 = parts['v1'];

    if (!timestamp || !v1) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const payload = `${timestamp}.${rawBody.toString()}`;
    const expected = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
    const sigBuffer = Buffer.from(v1, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const event = body?.event;
    if (!event || event.type !== 'INITIAL_PURCHASE') return { ok: true };

    const { app_user_id, transaction_id, product_id } = event;
    if (!app_user_id || !transaction_id || !product_id) return { ok: true };

    await this.payments.handleWebhookPurchase(app_user_id, transaction_id, product_id);
    return { ok: true };
  }
}
