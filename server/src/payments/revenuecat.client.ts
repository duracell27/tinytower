// server/src/payments/revenuecat.client.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const RC_API_BASE = 'https://api.revenuecat.com/v1';

@Injectable()
export class RevenueCatClient {
  private readonly secretKey: string;

  constructor(private config: ConfigService) {
    this.secretKey = this.config.get<string>('REVENUECAT_SECRET_KEY') ?? '';
  }

  async verifyTransaction(
    appUserId: string,
    transactionId: string,
    rcProductId: string,
  ): Promise<boolean> {
    try {
      const res = await fetch(`${RC_API_BASE}/subscribers/${encodeURIComponent(appUserId)}`, {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) return false;

      const data = await res.json() as {
        subscriber: {
          non_subscriptions: Record<string, Array<{ id: string }>>;
        };
      };

      const transactions = data.subscriber?.non_subscriptions?.[rcProductId] ?? [];
      return transactions.some(t => t.id === transactionId);
    } catch {
      return false;
    }
  }
}
