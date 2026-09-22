// server/src/payments/__tests__/payments.service.spec.ts
import { PaymentsService } from '../payments.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockPrisma: any = {
  purchase: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  playerState: {
    update: jest.fn(),
  },
  cityMembership: {
    findUnique: jest.fn().mockResolvedValue(null),
    update: jest.fn(),
  },
  $transaction: jest.fn((fn: (tx: any) => any) => fn(mockPrisma)),
};

const mockRcClient = {
  verifyTransaction: jest.fn(),
};

const mockReferralService = {
  processPurchaseBonus: jest.fn().mockResolvedValue(undefined),
};

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PaymentsService(
      mockPrisma as any,
      mockRcClient as any,
      mockReferralService as any,
    );
  });

  describe('notifyPurchase', () => {
    it('throws 400 for unknown packId', async () => {
      await expect(
        service.notifyPurchase('player-1', 'unknown_pack', 'txn_1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns saved rewards on duplicate transactionId (idempotency)', async () => {
      mockPrisma.purchase.findUnique.mockResolvedValueOnce({
        gemsGranted: 200,
        toolsGranted: null,
        tokensGranted: null,
      });

      const result = await service.notifyPurchase('player-1', 'diamonds_1', 'txn_dup');
      expect(result).toEqual({ gems: 200 });
      expect(mockRcClient.verifyTransaction).not.toHaveBeenCalled();
    });

    it('throws 400 when RC verification fails', async () => {
      mockPrisma.purchase.findUnique.mockResolvedValueOnce(null);
      mockRcClient.verifyTransaction.mockResolvedValueOnce(false);

      await expect(
        service.notifyPurchase('player-1', 'diamonds_1', 'txn_bad'),
      ).rejects.toThrow(BadRequestException);
    });

    it('applies rewards and returns them on success', async () => {
      mockPrisma.purchase.findUnique.mockResolvedValueOnce(null);
      mockRcClient.verifyTransaction.mockResolvedValueOnce(true);
      mockPrisma.purchase.create.mockResolvedValueOnce({});
      mockPrisma.playerState.update.mockResolvedValueOnce({});

      const result = await service.notifyPurchase('player-1', 'diamonds_1', 'txn_ok');
      expect(result).toEqual({ gems: 200 });
      expect(mockPrisma.playerState.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { playerId: 'player-1' },
          data: expect.objectContaining({ gems: { increment: 200 } }),
        }),
      );
    });
  });

  describe('handleWebhookPurchase', () => {
    it('is no-op if transactionId already processed', async () => {
      mockPrisma.purchase.findUnique.mockResolvedValueOnce({ id: 'existing' });
      await service.handleWebhookPurchase('player-1', 'txn_done', 'com.shmidt.vibetower.shop.diamonds_1');
      expect(mockPrisma.playerState.update).not.toHaveBeenCalled();
    });

    it('applies rewards for unknown transactionId', async () => {
      mockPrisma.purchase.findUnique.mockResolvedValueOnce(null);
      mockPrisma.purchase.create.mockResolvedValueOnce({});
      mockPrisma.playerState.update.mockResolvedValueOnce({});

      await service.handleWebhookPurchase('player-1', 'txn_new', 'com.shmidt.vibetower.shop.diamonds_2');
      expect(mockPrisma.playerState.update).toHaveBeenCalled();
    });
  });
});
