// server/src/payments/__tests__/revenuecat.client.spec.ts
import { RevenueCatClient } from '../revenuecat.client';
import { ConfigService } from '@nestjs/config';

const mockConfigService = {
  get: (key: string) => key === 'REVENUECAT_SECRET_KEY' ? 'sk_test_mock' : undefined,
} as unknown as ConfigService;

describe('RevenueCatClient', () => {
  let client: RevenueCatClient;

  beforeEach(() => {
    client = new RevenueCatClient(mockConfigService);
    global.fetch = jest.fn();
  });

  it('returns true when transactionId found in non_subscriptions', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        subscriber: {
          non_subscriptions: {
            'com.shmidt.vibetower.shop.diamonds_1': [
              { id: 'txn_123' },
            ],
          },
        },
      }),
    });

    const result = await client.verifyTransaction(
      'player-uuid',
      'txn_123',
      'com.shmidt.vibetower.shop.diamonds_1',
    );
    expect(result).toBe(true);
  });

  it('returns false when transactionId not found', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        subscriber: {
          non_subscriptions: {
            'com.shmidt.vibetower.shop.diamonds_1': [
              { id: 'txn_other' },
            ],
          },
        },
      }),
    });

    const result = await client.verifyTransaction(
      'player-uuid',
      'txn_123',
      'com.shmidt.vibetower.shop.diamonds_1',
    );
    expect(result).toBe(false);
  });

  it('returns false when RC API returns 404', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 404 });

    const result = await client.verifyTransaction(
      'unknown-player',
      'txn_123',
      'com.shmidt.vibetower.shop.diamonds_1',
    );
    expect(result).toBe(false);
  });
});
