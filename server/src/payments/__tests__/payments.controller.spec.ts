import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { PaymentsController } from '../payments.controller';
import { PaymentsService } from '../payments.service';

const WEBHOOK_SECRET = 'test-webhook-secret';

const mockPaymentsService = {
  notifyPurchase: jest.fn(),
  handleWebhookPurchase: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'REVENUECAT_WEBHOOK_SECRET') return WEBHOOK_SECRET;
    return undefined;
  }),
};

function makeSignedWebhookReq(body: object): { headers: Record<string, string>; rawBody: Buffer } {
  const rawBody = Buffer.from(JSON.stringify(body));
  const signature = createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
  return {
    headers: { 'x-revenuecat-signature': signature },
    rawBody,
  };
}

describe('PaymentsController', () => {
  let controller: PaymentsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        { provide: PaymentsService, useValue: mockPaymentsService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
  });

  // ─── POST /payments/notify ─────────────────────────────────────────────────

  describe('notify', () => {
    it('returns { rewards } on success', async () => {
      const rewards = { gems: 200 };
      mockPaymentsService.notifyPurchase.mockResolvedValueOnce(rewards);

      const req = { user: { playerId: 'player-1' } } as any;
      const body = { packId: 'diamonds_1', transactionId: 'txn-abc' } as any;

      const result = await controller.notify(req, body);

      expect(result).toEqual({ rewards });
      expect(mockPaymentsService.notifyPurchase).toHaveBeenCalledWith(
        'player-1',
        'diamonds_1',
        'txn-abc',
      );
    });

    it('propagates errors from PaymentsService', async () => {
      mockPaymentsService.notifyPurchase.mockRejectedValueOnce(new Error('boom'));

      const req = { user: { playerId: 'player-1' } } as any;
      const body = { packId: 'diamonds_1', transactionId: 'txn-abc' } as any;

      await expect(controller.notify(req, body)).rejects.toThrow('boom');
    });
  });

  // ─── POST /payments/rc-webhook ─────────────────────────────────────────────

  describe('rcWebhook', () => {
    it('calls handleWebhookPurchase for INITIAL_PURCHASE with valid HMAC signature', async () => {
      mockPaymentsService.handleWebhookPurchase.mockResolvedValueOnce(undefined);

      const body = {
        event: {
          type: 'INITIAL_PURCHASE',
          app_user_id: 'user-1',
          transaction_id: 'txn-1',
          product_id: 'com.example.pack',
        },
      };
      const req = makeSignedWebhookReq(body) as any;

      const result = await controller.rcWebhook(req, body);

      expect(result).toEqual({ ok: true });
      expect(mockPaymentsService.handleWebhookPurchase).toHaveBeenCalledWith(
        'user-1',
        'txn-1',
        'com.example.pack',
      );
    });

    it('throws UnauthorizedException (401) for invalid HMAC signature', async () => {
      const body = { event: { type: 'INITIAL_PURCHASE' } };
      const rawBody = Buffer.from(JSON.stringify(body));
      const req = {
        headers: { 'x-revenuecat-signature': 'bad-signature' },
        rawBody,
      } as any;

      await expect(controller.rcWebhook(req, body)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPaymentsService.handleWebhookPurchase).not.toHaveBeenCalled();
    });

    it('returns { ok: true } without calling handleWebhookPurchase for non-INITIAL_PURCHASE events', async () => {
      const body = {
        event: {
          type: 'RENEWAL',
          app_user_id: 'user-1',
          transaction_id: 'txn-2',
          product_id: 'com.example.pack',
        },
      };
      const req = makeSignedWebhookReq(body) as any;

      const result = await controller.rcWebhook(req, body);

      expect(result).toEqual({ ok: true });
      expect(mockPaymentsService.handleWebhookPurchase).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when no signature header provided', async () => {
      const body = { event: { type: 'INITIAL_PURCHASE' } };
      const rawBody = Buffer.from(JSON.stringify(body));
      const req = {
        headers: {},
        rawBody,
      } as any;

      await expect(controller.rcWebhook(req, body)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('returns { ok: true } without calling handleWebhookPurchase when event fields are missing', async () => {
      const body = {
        event: {
          type: 'INITIAL_PURCHASE',
          // missing app_user_id, transaction_id, product_id
        },
      };
      const req = makeSignedWebhookReq(body) as any;

      const result = await controller.rcWebhook(req, body);

      expect(result).toEqual({ ok: true });
      expect(mockPaymentsService.handleWebhookPurchase).not.toHaveBeenCalled();
    });
  });
});
