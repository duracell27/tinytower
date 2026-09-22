import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
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
export class PaymentsController {
  constructor(
    private payments: PaymentsService,
    private config: ConfigService,
  ) {}

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
    const signature = req.headers['x-revenuecat-signature'] as string | undefined;
    const rawBody = (req as any).rawBody as Buffer | undefined;

    if (!webhookSecret || !signature || !rawBody) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    const sigBuffer = Buffer.from(signature, 'hex');
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
