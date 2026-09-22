# RevenueCat Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Підключити RevenueCat для реальних in-app purchases (consumables) — гемси/інструменти/токени нараховуються лише після server-side верифікації, без оптимістичних апдейтів.

**Architecture:** Клієнт викликає RevenueCat SDK → отримує `transactionId` → надсилає `POST /payments/notify` → сервер верифікує через RC REST API + перевіряє idempotency → оновлює `PlayerState` напряму → повертає `{ rewards }`. RC вебхук — резервний канал для edge-кейсів.

**Tech Stack:** `react-native-purchases` (клієнт), NestJS `payments` module (сервер), native `fetch` для RC REST API, Prisma `Purchase` model.

**Spec:** `docs/superpowers/specs/2026-09-22-revenuecat-integration-design.md`

## Global Constraints

- Bundle ID: `com.shmidt.vibetower` (iOS і Android)
- RC Product IDs: `com.shmidt.vibetower.shop.<packId>` для всіх 20 паків
- Без оптимістичних нарахувань — gems/tools/tokens додаються тільки після відповіді сервера
- Idempotency: `transactionId UNIQUE` в таблиці `Purchase` — один transactionId = одне нарахування
- JWT auth для `/payments/notify`, підпис `Authorization: Bearer <secret>` для вебхука
- `PlayerState` columns: `gems`, `briks/glass/nails/screw/wood/cement`, `tokenGreen/Blue/Yellow/Purple/Red`
- Env client: `EXPO_PUBLIC_RC_API_KEY_IOS`, `EXPO_PUBLIC_RC_API_KEY_ANDROID`
- Env server: `REVENUECAT_SECRET_KEY`, `REVENUECAT_WEBHOOK_SECRET`

---

## File Map

**Нові файли:**
- `shared/config/shopPacksConfig.ts` — дані паків без зображень (спільне між клієнтом і сервером)
- `server/src/payments/payments.module.ts`
- `server/src/payments/payments.controller.ts`
- `server/src/payments/payments.service.ts`
- `server/src/payments/revenuecat.client.ts`
- `server/src/payments/dto/notify-purchase.dto.ts`
- `server/src/payments/__tests__/payments.service.spec.ts`
- `src/services/purchaseService.ts`
- `src/hooks/usePurchase.ts`
- `src/components/PurchaseLoadingOverlay.tsx`

**Змінені файли:**
- `shared/types/index.ts` або `shared/types.ts` — додати `ShopPackData`
- `src/data/shopPacks.ts` — додати `rcProductId`, `priceUsd`; імпортувати дані з shared
- `src/services/api.ts` — додати `notifyPurchase`
- `src/stores/gameStore.ts` — видалити `shopPurchase`, додати `setManualPurchaseSuccess`
- `app/(tabs)/shop.tsx` — замінити `shopPurchase` на `usePurchase`
- `app/_layout.tsx` — ініціалізувати RC SDK після auth
- `server/src/app.module.ts` — додати `PaymentsModule`
- `server/prisma/schema.prisma` — додати модель `Purchase`

---

### Task 1: Shared pack data (без зображень)

**Files:**
- Create: `shared/config/shopPacksConfig.ts`
- Modify: `shared/types.ts` (або відповідний файл типів)

**Interfaces:**
- Produces: `ShopPackData`, `SHOP_PACKS_MAP`, `SHOP_PACKS_BY_RC_PRODUCT` — використовуються в Task 2 (клієнт) та Task 5 (сервер)

- [ ] **Step 1: Знайти де визначені shared типи**

```bash
grep -rn "ShopRewards\|ToolKey\|TokenColor" /Users/Apple/IT/tinytower/shared --include="*.ts" | head -10
```

- [ ] **Step 2: Додати `ShopPackData` до shared типів**

Знайди файл де є `ShopRewards`/`ToolKey`/`TokenColor` (або `shared/types.ts`) і додай:

```ts
export interface ShopPackData {
  id:          string;
  rcProductId: string;
  priceUsd:    number;
  rewards:     ShopRewards;
}
```

- [ ] **Step 3: Створити `shared/config/shopPacksConfig.ts`**

```ts
import type { ShopPackData } from '../types';

export const SHOP_PACKS_DATA: ShopPackData[] = [
  // Diamonds
  { id: 'diamonds_1', rcProductId: 'com.shmidt.vibetower.shop.diamonds_1', priceUsd: 0.99,  rewards: { gems: 200 } },
  { id: 'diamonds_2', rcProductId: 'com.shmidt.vibetower.shop.diamonds_2', priceUsd: 1.99,  rewards: { gems: 420 } },
  { id: 'diamonds_3', rcProductId: 'com.shmidt.vibetower.shop.diamonds_3', priceUsd: 4.99,  rewards: { gems: 1100 } },
  { id: 'diamonds_4', rcProductId: 'com.shmidt.vibetower.shop.diamonds_4', priceUsd: 9.99,  rewards: { gems: 2300 } },
  { id: 'diamonds_5', rcProductId: 'com.shmidt.vibetower.shop.diamonds_5', priceUsd: 19.99, rewards: { gems: 4800 } },
  { id: 'diamonds_6', rcProductId: 'com.shmidt.vibetower.shop.diamonds_6', priceUsd: 49.99, rewards: { gems: 12500 } },
  // Bundles
  { id: 'bundle_1', rcProductId: 'com.shmidt.vibetower.shop.bundle_1', priceUsd: 1.99,
    rewards: { gems: 150, tools: { briks: 3, glass: 3, nails: 3, screw: 3, wood: 3, cement: 3 }, tokens: { green: 3, blue: 3, yellow: 3, purple: 3, red: 3 } } },
  { id: 'bundle_2', rcProductId: 'com.shmidt.vibetower.shop.bundle_2', priceUsd: 4.99,
    rewards: { gems: 500, tools: { briks: 8, glass: 8, nails: 8, screw: 8, wood: 8, cement: 8 }, tokens: { green: 8, blue: 8, yellow: 8, purple: 8, red: 8 } } },
  { id: 'bundle_3', rcProductId: 'com.shmidt.vibetower.shop.bundle_3', priceUsd: 9.99,
    rewards: { gems: 1100, tools: { briks: 15, glass: 15, nails: 15, screw: 15, wood: 15, cement: 15 }, tokens: { green: 20, blue: 20, yellow: 20, purple: 20, red: 20 } } },
  { id: 'bundle_4', rcProductId: 'com.shmidt.vibetower.shop.bundle_4', priceUsd: 24.99,
    rewards: { gems: 3000, tools: { briks: 30, glass: 30, nails: 30, screw: 30, wood: 30, cement: 30 }, tokens: { green: 50, blue: 50, yellow: 50, purple: 50, red: 50 } } },
  // Builder
  { id: 'builder_1', rcProductId: 'com.shmidt.vibetower.shop.builder_1', priceUsd: 1.99,
    rewards: { gems: 100, tools: { briks: 5, glass: 5, nails: 5, screw: 5, wood: 5, cement: 5 } } },
  { id: 'builder_2', rcProductId: 'com.shmidt.vibetower.shop.builder_2', priceUsd: 3.99,
    rewards: { gems: 250, tools: { briks: 12, glass: 12, nails: 12, screw: 12, wood: 12, cement: 12 } } },
  { id: 'builder_3', rcProductId: 'com.shmidt.vibetower.shop.builder_3', priceUsd: 7.99,
    rewards: { gems: 600, tools: { briks: 25, glass: 25, nails: 25, screw: 25, wood: 25, cement: 25 } } },
  { id: 'builder_4', rcProductId: 'com.shmidt.vibetower.shop.builder_4', priceUsd: 14.99,
    rewards: { gems: 1200, tools: { briks: 50, glass: 50, nails: 50, screw: 50, wood: 50, cement: 50 } } },
  // Materials
  { id: 'mat_briks',  rcProductId: 'com.shmidt.vibetower.shop.mat_briks',  priceUsd: 0.99, rewards: { tools: { briks:  5 } } },
  { id: 'mat_glass',  rcProductId: 'com.shmidt.vibetower.shop.mat_glass',  priceUsd: 0.99, rewards: { tools: { glass:  5 } } },
  { id: 'mat_nails',  rcProductId: 'com.shmidt.vibetower.shop.mat_nails',  priceUsd: 0.99, rewards: { tools: { nails:  5 } } },
  { id: 'mat_screw',  rcProductId: 'com.shmidt.vibetower.shop.mat_screw',  priceUsd: 0.99, rewards: { tools: { screw:  5 } } },
  { id: 'mat_wood',   rcProductId: 'com.shmidt.vibetower.shop.mat_wood',   priceUsd: 0.99, rewards: { tools: { wood:   5 } } },
  { id: 'mat_cement', rcProductId: 'com.shmidt.vibetower.shop.mat_cement', priceUsd: 0.99, rewards: { tools: { cement: 5 } } },
];

export const SHOP_PACKS_MAP: Record<string, ShopPackData> =
  Object.fromEntries(SHOP_PACKS_DATA.map(p => [p.id, p]));

export const SHOP_PACKS_BY_RC_PRODUCT: Record<string, ShopPackData> =
  Object.fromEntries(SHOP_PACKS_DATA.map(p => [p.rcProductId, p]));
```

- [ ] **Step 4: Написати тест**

```ts
// shared/__tests__/shopPacksConfig.test.ts
import { SHOP_PACKS_DATA, SHOP_PACKS_MAP, SHOP_PACKS_BY_RC_PRODUCT } from '../config/shopPacksConfig';

describe('shopPacksConfig', () => {
  it('has 20 packs', () => {
    expect(SHOP_PACKS_DATA).toHaveLength(20);
  });

  it('all packs have rcProductId starting with com.shmidt.vibetower', () => {
    SHOP_PACKS_DATA.forEach(p => {
      expect(p.rcProductId).toMatch(/^com\.shmidt\.vibetower\.shop\./);
    });
  });

  it('SHOP_PACKS_MAP keys match ids', () => {
    SHOP_PACKS_DATA.forEach(p => {
      expect(SHOP_PACKS_MAP[p.id]).toBe(p);
    });
  });

  it('SHOP_PACKS_BY_RC_PRODUCT keys match rcProductIds', () => {
    SHOP_PACKS_DATA.forEach(p => {
      expect(SHOP_PACKS_BY_RC_PRODUCT[p.rcProductId]).toBe(p);
    });
  });

  it('all packs have priceUsd > 0', () => {
    SHOP_PACKS_DATA.forEach(p => {
      expect(p.priceUsd).toBeGreaterThan(0);
    });
  });
});
```

- [ ] **Step 5: Запустити тести**

```bash
cd /Users/Apple/IT/tinytower && npm test -- --testPathPattern="shopPacksConfig" --no-coverage
```

Очікується: PASS

- [ ] **Step 6: Commit**

```bash
git add shared/config/shopPacksConfig.ts shared/types*.ts shared/__tests__/shopPacksConfig.test.ts
git commit -m "feat(shared): add shopPacksConfig with rcProductId and priceUsd mappings"
```

---

### Task 2: Оновити shopPacks.ts — додати rcProductId та priceUsd

**Files:**
- Modify: `src/data/shopPacks.ts`

**Interfaces:**
- Consumes: `ShopPackData` з `shared/config/shopPacksConfig.ts` (Task 1)
- Produces: `ShopPack` з новими полями `rcProductId: string`, `priceUsd: number` — споживається в Task 11 (`usePurchase`)

- [ ] **Step 1: Оновити інтерфейс `ShopPack`**

В `src/data/shopPacks.ts` додай до інтерфейсу:
```ts
import type { ShopPackData } from '../../shared/config/shopPacksConfig';

export interface ShopPack {
  // ... всі існуючі поля ...
  rcProductId: string;
  priceUsd:    number;
}
```

- [ ] **Step 2: Додати rcProductId та priceUsd до кожного паку**

Для кожного з 20 паків додай відповідний `rcProductId` і `priceUsd`. Приклад для diamonds:

```ts
export const DIAMOND_PACKS: ShopPack[] = [
  {
    id: 'diamonds_1', section: 'diamonds', name: 'shop.packs.diamonds_1.name',
    price: '$0.99', rcProductId: 'com.shmidt.vibetower.shop.diamonds_1', priceUsd: 0.99,
    image: require('../../assets/img/shop/purchase1.png'),
    btnColor: '#C9637E',
    rewards: { gems: 200 },
  },
  // ... аналогічно для решти
```

Повний список відповідностей (packId → priceUsd):
- diamonds_1: 0.99, diamonds_2: 1.99, diamonds_3: 4.99, diamonds_4: 9.99, diamonds_5: 19.99, diamonds_6: 49.99
- bundle_1: 1.99, bundle_2: 4.99, bundle_3: 9.99, bundle_4: 24.99
- builder_1: 1.99, builder_2: 3.99, builder_3: 7.99, builder_4: 14.99
- всі mat_*: 0.99

- [ ] **Step 3: Перевірити TypeScript компіляцію**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -20
```

Очікується: 0 помилок

- [ ] **Step 4: Commit**

```bash
git add src/data/shopPacks.ts
git commit -m "feat(shop): add rcProductId and priceUsd to all ShopPack definitions"
```

---

### Task 3: Prisma міграція — модель Purchase

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create migration via `prisma migrate`

**Interfaces:**
- Produces: `Purchase` table з `transactionId UNIQUE` — використовується в Task 5

- [ ] **Step 1: Додати модель до schema.prisma**

В кінець файлу `server/prisma/schema.prisma` додай:

```prisma
model Purchase {
  id            String   @id @default(uuid())
  playerId      String
  transactionId String   @unique
  packId        String
  rcProductId   String
  status        String
  gemsGranted   Int      @default(0)
  toolsGranted  Json?
  tokensGranted Json?
  source        String
  createdAt     DateTime @default(now())

  player        Player   @relation(fields: [playerId], references: [id])

  @@index([playerId])
}
```

Також додай зворотний зв'язок до моделі `Player` — знайди `model Player {` і в середину додай:
```prisma
  purchases     Purchase[]
```

- [ ] **Step 2: Запустити міграцію**

```bash
cd /Users/Apple/IT/tinytower/server && npx prisma migrate dev --name add_purchase_table
```

Очікується: "Your database is now in sync with your schema."

- [ ] **Step 3: Перевірити що Prisma client згенерований**

```bash
cd /Users/Apple/IT/tinytower/server && npx prisma generate
```

- [ ] **Step 4: Commit**

```bash
cd /Users/Apple/IT/tinytower && git add server/prisma/schema.prisma server/prisma/migrations/
git commit -m "feat(server): add Purchase table for RevenueCat payment records"
```

---

### Task 4: RevenueCat HTTP клієнт

**Files:**
- Create: `server/src/payments/revenuecat.client.ts`
- Create: `server/src/payments/__tests__/revenuecat.client.spec.ts`

**Interfaces:**
- Produces:
  - `RevenueCatClient` (injectable NestJS service)
  - `rcClient.verifyTransaction(playerId: string, transactionId: string, rcProductId: string): Promise<boolean>`
  - Якщо повертає `false` → платіж не знайдено → сервер кидає 400

- [ ] **Step 1: Написати тест (failing)**

```ts
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
```

- [ ] **Step 2: Запустити, щоб переконатись що FAIL**

```bash
cd /Users/Apple/IT/tinytower/server && npx jest payments/revenuecat --no-coverage 2>&1 | tail -10
```

- [ ] **Step 3: Реалізувати `revenuecat.client.ts`**

```ts
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
```

- [ ] **Step 4: Запустити тести**

```bash
cd /Users/Apple/IT/tinytower/server && npx jest payments/revenuecat --no-coverage
```

Очікується: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add server/src/payments/revenuecat.client.ts server/src/payments/__tests__/revenuecat.client.spec.ts
git commit -m "feat(server): add RevenueCatClient for transaction verification"
```

---

### Task 5: PaymentsService — notify та applyRewards

**Files:**
- Create: `server/src/payments/payments.service.ts`
- Create: `server/src/payments/__tests__/payments.service.spec.ts`

**Interfaces:**
- Consumes:
  - `RevenueCatClient.verifyTransaction(playerId, transactionId, rcProductId): Promise<boolean>` (Task 4)
  - `SHOP_PACKS_MAP`, `SHOP_PACKS_BY_RC_PRODUCT` з `shared/config/shopPacksConfig` (Task 1)
  - `PrismaService` (вбудований)
  - `ReferralService.processPurchaseBonus(playerId: string, purchaseAmount: number): Promise<void>`
  - `CityService` (для `gemsShopBonus`)
- Produces:
  - `paymentsService.notifyPurchase(playerId: string, packId: string, transactionId: string): Promise<ShopRewards>`
  - `paymentsService.handleWebhookPurchase(appUserId: string, transactionId: string, rcProductId: string): Promise<void>`

- [ ] **Step 1: Написати тести (failing)**

```ts
// server/src/payments/__tests__/payments.service.spec.ts
import { PaymentsService } from '../payments.service';
import { BadRequestException } from '@nestjs/common';

const mockPrisma = {
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
  $transaction: jest.fn((fn: any) => fn(mockPrisma)),
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
      ).rejects.toThrow(BadRequestException);
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
```

- [ ] **Step 2: Запустити, щоб переконатись що FAIL**

```bash
cd /Users/Apple/IT/tinytower/server && npx jest payments.service --no-coverage 2>&1 | tail -10
```

- [ ] **Step 3: Реалізувати `payments.service.ts`**

```ts
// server/src/payments/payments.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
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
    if (!pack) throw new BadRequestException(`Unknown packId: ${packId}`);

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
```

- [ ] **Step 4: Запустити тести**

```bash
cd /Users/Apple/IT/tinytower/server && npx jest payments.service --no-coverage
```

Очікується: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add server/src/payments/payments.service.ts server/src/payments/__tests__/payments.service.spec.ts
git commit -m "feat(server): add PaymentsService with RC verification and reward application"
```

---

### Task 6: Payments Controller, DTO та Module

**Files:**
- Create: `server/src/payments/dto/notify-purchase.dto.ts`
- Create: `server/src/payments/payments.controller.ts`
- Create: `server/src/payments/payments.module.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Consumes: `PaymentsService.notifyPurchase`, `PaymentsService.handleWebhookPurchase` (Task 5)
- Produces: `POST /payments/notify` (JWT protected), `POST /payments/rc-webhook` (public)

- [ ] **Step 1: Створити DTO**

```ts
// server/src/payments/dto/notify-purchase.dto.ts
export class NotifyPurchaseDto {
  packId: string;
  transactionId: string;
}
```

- [ ] **Step 2: Створити Controller**

```ts
// server/src/payments/payments.controller.ts
import {
  Controller, Post, Body, Req, UseGuards,
  HttpCode, Headers, RawBodyRequest, BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentsService } from './payments.service';
import { NotifyPurchaseDto } from './dto/notify-purchase.dto';
import { ConfigService } from '@nestjs/config';

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
    @Headers('authorization') authHeader: string,
    @Body() body: any,
  ) {
    const webhookSecret = this.config.get<string>('REVENUECAT_WEBHOOK_SECRET');
    if (!webhookSecret || authHeader !== `Bearer ${webhookSecret}`) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = body?.event;
    if (!event || event.type !== 'INITIAL_PURCHASE') return { ok: true };

    const { app_user_id, transaction_id, product_id } = event;
    if (!app_user_id || !transaction_id || !product_id) return { ok: true };

    await this.payments.handleWebhookPurchase(app_user_id, transaction_id, product_id);
    return { ok: true };
  }
}
```

- [ ] **Step 3: Створити Module**

```ts
// server/src/payments/payments.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { ReferralModule } from '../referral/referral.module';
import { CityModule } from '../city/city.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RevenueCatClient } from './revenuecat.client';

@Module({
  imports: [ConfigModule, PrismaModule, ReferralModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, RevenueCatClient],
})
export class PaymentsModule {}
```

- [ ] **Step 4: Зареєструвати в app.module.ts**

В `server/src/app.module.ts` додай `PaymentsModule` до imports:

```ts
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    // ... існуючі модулі ...
    PaymentsModule,
  ],
})
```

- [ ] **Step 5: Переконатись що сервер стартує**

```bash
cd /Users/Apple/IT/tinytower/server && npm run build 2>&1 | tail -10
```

Очікується: 0 помилок компіляції

- [ ] **Step 6: Commit**

```bash
git add server/src/payments/ server/src/app.module.ts
git commit -m "feat(server): add PaymentsModule with /payments/notify and /payments/rc-webhook endpoints"
```

---

### Task 7: Клієнт — встановити react-native-purchases та env

**Files:**
- Modify: `package.json`
- Modify: `app.json` — додати expo plugin
- Create: `.env` (якщо не існує)

- [ ] **Step 1: Встановити пакет**

```bash
cd /Users/Apple/IT/tinytower && npm install react-native-purchases
```

- [ ] **Step 2: Додати expo config plugin в app.json**

В `app.json` в масив `plugins` додай:
```json
"react-native-purchases"
```

Результат:
```json
"plugins": [
  "expo-image",
  "expo-font",
  "expo-router",
  "expo-localization",
  "react-native-purchases"
]
```

- [ ] **Step 3: Створити або оновити `.env`**

Перевір чи є `.env` в корені проекту:
```bash
ls /Users/Apple/IT/tinytower/.env 2>/dev/null || echo "NOT FOUND"
```

Додай (або створи) рядки:
```
EXPO_PUBLIC_RC_API_KEY_IOS=test_xxxxxxxx
EXPO_PUBLIC_RC_API_KEY_ANDROID=test_xxxxxxxx
```

Замінити `test_xxxxxxxx` на реальний ключ з RevenueCat дашборду (той `test_...` ключ що є).

- [ ] **Step 4: Перевірити що .env в .gitignore**

```bash
grep "\.env" /Users/Apple/IT/tinytower/.gitignore
```

Якщо немає — додай `.env` до `.gitignore`.

- [ ] **Step 5: Rebuild (якщо використовується native build)**

```bash
cd /Users/Apple/IT/tinytower && npx expo prebuild --clean 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json app.json .gitignore
git commit -m "chore: install react-native-purchases and add expo plugin"
```

---

### Task 8: Клієнт — purchaseService.ts

**Files:**
- Create: `src/services/purchaseService.ts`

**Interfaces:**
- Produces:
  - `purchaseService.initialize(userId: string): void`
  - `purchaseService.purchase(rcProductId: string): Promise<{ transactionId: string }>`
  - `purchaseService.getProducts(rcProductIds: string[]): Promise<PurchasesStoreProduct[]>`

- [ ] **Step 1: Створити сервіс**

```ts
// src/services/purchaseService.ts
import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type PurchasesStoreProduct,
  PurchasesError,
  PURCHASES_ERROR_CODE,
} from 'react-native-purchases';

const RC_API_KEY = Platform.OS === 'ios'
  ? (process.env.EXPO_PUBLIC_RC_API_KEY_IOS ?? '')
  : (process.env.EXPO_PUBLIC_RC_API_KEY_ANDROID ?? '');

export const purchaseService = {
  initialize(userId: string): void {
    if (!RC_API_KEY) {
      console.warn('[RC] No API key configured');
      return;
    }
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey: RC_API_KEY, appUserID: userId });
  },

  async getProducts(rcProductIds: string[]): Promise<PurchasesStoreProduct[]> {
    try {
      return await Purchases.getProducts(rcProductIds);
    } catch {
      return [];
    }
  },

  async purchase(rcProductId: string): Promise<{ transactionId: string }> {
    const products = await Purchases.getProducts([rcProductId]);
    if (!products.length) {
      throw new Error(`Product not found: ${rcProductId}`);
    }

    const { transaction } = await Purchases.purchaseStoreProduct(products[0]);
    const transactionId = transaction?.transactionIdentifier;
    if (!transactionId) {
      throw new Error('No transactionIdentifier returned from RevenueCat');
    }

    return { transactionId };
  },
};

export { PurchasesError, PURCHASES_ERROR_CODE };
```

- [ ] **Step 2: TypeScript перевірка**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | grep "purchaseService" | head -5
```

Очікується: 0 помилок для цього файлу

- [ ] **Step 3: Commit**

```bash
git add src/services/purchaseService.ts
git commit -m "feat(client): add purchaseService wrapping react-native-purchases SDK"
```

---

### Task 9: Клієнт — api.ts notifyPurchase + gameStore cleanup

**Files:**
- Modify: `src/services/api.ts`
- Modify: `src/stores/gameStore.ts`

**Interfaces:**
- Produces:
  - `api.notifyPurchase(body: { packId: string; transactionId: string }): Promise<{ rewards: ShopRewards }>`
  - `gameStore.setManualPurchaseSuccess(payload: PurchaseSuccessPayload): void` — замість старого `shopPurchase`

- [ ] **Step 1: Додати `notifyPurchase` до `api.ts`**

Знайди в `src/services/api.ts` об'єкт `export const api = {` і додай метод:

```ts
notifyPurchase: (body: { packId: string; transactionId: string }) =>
  request<{ rewards: ShopRewards }>('POST', '/payments/notify', body),
```

Переконайся що `ShopRewards` імпортований (або імпортуй з `../../shared/types`).

- [ ] **Step 2: Оновити gameStore.ts**

Знайди `shopPurchase: (pack)` в `src/stores/gameStore.ts` і:

а) **Видали** весь `shopPurchase` action (включаючи виклик `executeCommand` та `set({ pendingPurchaseSuccess... })`)

б) **Замінити** на `setManualPurchaseSuccess`:
```ts
setManualPurchaseSuccess: (payload: { packName: string; price: string; rewards: ShopRewards }) => {
  set({ pendingPurchaseSuccess: { packName: payload.packName, price: payload.price, rewards: payload.rewards } });
},
```

в) Також видали `shopPurchase` з типу стору (інтерфейс/тип `GameStore` або аналогічний).

- [ ] **Step 3: TypeScript перевірка**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -20
```

Очікується: 0 нових помилок (можливі помилки в shop.tsx де ще використовується старий `shopPurchase` — виправимо в Task 11)

- [ ] **Step 4: Commit**

```bash
git add src/services/api.ts src/stores/gameStore.ts
git commit -m "feat(client): add api.notifyPurchase, replace shopPurchase with setManualPurchaseSuccess in gameStore"
```

---

### Task 10: Клієнт — usePurchase hook та PurchaseLoadingOverlay

**Files:**
- Create: `src/hooks/usePurchase.ts`
- Create: `src/components/PurchaseLoadingOverlay.tsx`

**Interfaces:**
- Consumes:
  - `purchaseService.purchase(rcProductId)` (Task 8)
  - `api.notifyPurchase({ packId, transactionId })` (Task 9)
  - `gameStore.setManualPurchaseSuccess(payload)` (Task 9)
  - `syncService.triggerSync()` (вже є в `src/services/sync.ts`)
  - `ShopPack` з `src/data/shopPacks.ts` (Task 2)
- Produces:
  - `usePurchase(): { purchasing: boolean; purchase: (pack: ShopPack) => Promise<void>; error: string | null; clearError: () => void }`
  - `<PurchaseLoadingOverlay visible={boolean} />` — fullscreen спінер

- [ ] **Step 1: Створити `usePurchase.ts`**

```ts
// src/hooks/usePurchase.ts
import { useState, useCallback } from 'react';
import { purchaseService, PurchasesError, PURCHASES_ERROR_CODE } from '../services/purchaseService';
import { api } from '../services/api';
import { syncService } from '../services/sync';
import { useGameStore } from '../stores/gameStore';
import type { ShopPack } from '../data/shopPacks';

export function usePurchase() {
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setManualPurchaseSuccess = useGameStore((s) => s.setManualPurchaseSuccess);

  const purchase = useCallback(async (pack: ShopPack) => {
    setPurchasing(true);
    setError(null);

    try {
      const { transactionId } = await purchaseService.purchase(pack.rcProductId);
      const { rewards } = await api.notifyPurchase({ packId: pack.id, transactionId });

      setManualPurchaseSuccess({
        packName: pack.name,
        price: pack.price,
        rewards,
      });

      syncService.triggerSync();
    } catch (err) {
      if (err instanceof PurchasesError) {
        if (err.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
          // Юзер скасував — тихо ігноруємо
          return;
        }
      }
      const message = err instanceof Error ? err.message : 'Purchase failed';
      setError(message);
    } finally {
      setPurchasing(false);
    }
  }, [setManualPurchaseSuccess]);

  return { purchasing, purchase, error, clearError: () => setError(null) };
}
```

- [ ] **Step 2: Створити `PurchaseLoadingOverlay.tsx`**

```tsx
// src/components/PurchaseLoadingOverlay.tsx
import React from 'react';
import { View, ActivityIndicator, StyleSheet, Modal } from 'react-native';
import LocaleText from './LocaleText';
import { useAppTheme } from '../hooks/useAppTheme';

interface Props {
  visible: boolean;
}

export default function PurchaseLoadingOverlay({ visible }: Props) {
  const theme = useAppTheme();

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.scrim}>
        <View style={[styles.card, { backgroundColor: theme.isDark ? '#1E1030' : '#FFFFFF' }]}>
          <ActivityIndicator size="large" color="#9A6FD0" />
          <LocaleText style={[styles.text, { color: theme.isDark ? '#E0D0FF' : '#2D1A4E' }]}>
            {'Очікуємо підтвердження платежу...'}
          </LocaleText>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 16,
    minWidth: 220,
    elevation: 8,
  },
  text: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 16,
    textAlign: 'center',
    maxWidth: 200,
  },
});
```

- [ ] **Step 3: TypeScript перевірка**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | grep -E "usePurchase|PurchaseLoading" | head -10
```

Очікується: 0 помилок

- [ ] **Step 4: Commit**

```bash
git add src/hooks/usePurchase.ts src/components/PurchaseLoadingOverlay.tsx
git commit -m "feat(client): add usePurchase hook and PurchaseLoadingOverlay component"
```

---

### Task 11: Клієнт — оновити shop.tsx

**Files:**
- Modify: `app/(tabs)/shop.tsx`

**Interfaces:**
- Consumes:
  - `usePurchase()` (Task 10)
  - `PurchaseLoadingOverlay` (Task 10)
  - `ShopPack.rcProductId` (Task 2)

- [ ] **Step 1: Знайти всі виклики shopPurchase у shop.tsx**

```bash
grep -n "shopPurchase\|gameStore\." /Users/Apple/IT/tinytower/app/\(tabs\)/shop.tsx
```

- [ ] **Step 2: Замінити shopPurchase на usePurchase**

У компоненті де рендеряться кнопки "Купити":

а) На початку файлу додай:
```tsx
import { usePurchase } from '../../src/hooks/usePurchase';
import PurchaseLoadingOverlay from '../../src/components/PurchaseLoadingOverlay';
```

б) Видали використання `useGameStore` для `shopPurchase` (інші useGameStore залишити).

в) В компоненті (або в головному ShopScreen) додай:
```tsx
const { purchasing, purchase, error, clearError } = usePurchase();
```

г) Замінити обробник кнопки купити (знайди `onPress` де викликається `shopPurchase`):
```tsx
// Було:
onPress={() => gameStore.shopPurchase(pack)}

// Стало:
onPress={() => purchase(pack)}
disabled={purchasing}
```

д) Перед `return` або всередині JSX додай:
```tsx
<PurchaseLoadingOverlay visible={purchasing} />
```

е) Показати error alert якщо є помилка (після `usePurchase`):
```tsx
useEffect(() => {
  if (error) {
    Alert.alert('Помилка покупки', error, [{ text: 'OK', onPress: clearError }]);
  }
}, [error]);
```

Додай `Alert` до імпортів з `react-native` якщо його немає.

- [ ] **Step 3: TypeScript перевірка**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -20
```

Очікується: 0 помилок

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/shop.tsx
git commit -m "feat(shop): replace shopPurchase with usePurchase hook, add loading overlay"
```

---

### Task 12: Клієнт — ініціалізація RC SDK в _layout.tsx

**Files:**
- Modify: `app/_layout.tsx`

**Interfaces:**
- Consumes:
  - `purchaseService.initialize(userId: string)` (Task 8)
  - `useAuthStore` — щоб отримати userId після логіну

- [ ] **Step 1: Знайти де відбувається auth і є userId**

```bash
grep -n "useAuthStore\|playerId\|userId\|isLoggedIn" /Users/Apple/IT/tinytower/app/_layout.tsx | head -15
```

- [ ] **Step 2: Додати ініціалізацію RC після логіну**

Знайди місце де `playerId` (або `userId`) вперше стає доступним після авторизації. Додай `useEffect`:

```tsx
import { purchaseService } from '../src/services/purchaseService';

// В компоненті, після отримання playerId з authStore:
useEffect(() => {
  if (playerId) {
    purchaseService.initialize(playerId);
  }
}, [playerId]);
```

- [ ] **Step 3: TypeScript перевірка**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat(client): initialize RevenueCat SDK after user authentication"
```

---

### Task 13: Env vars для сервера + фінальна перевірка

**Files:**
- Modify/Create: `server/.env`

- [ ] **Step 1: Перевірити чи є server/.env**

```bash
ls /Users/Apple/IT/tinytower/server/.env 2>/dev/null || echo "NOT FOUND"
```

- [ ] **Step 2: Додати RC env vars**

Додай до `server/.env`:
```
REVENUECAT_SECRET_KEY=sk_test_xxxxxxxx
REVENUECAT_WEBHOOK_SECRET=
```

Замінити `sk_test_xxxxxxxx` на реальний Secret key з RevenueCat.
`REVENUECAT_WEBHOOK_SECRET` залишити порожнім поки немає публічного сервера.

- [ ] **Step 3: Переконатись що server/.env в .gitignore**

```bash
grep "\.env" /Users/Apple/IT/tinytower/server/.gitignore 2>/dev/null || grep "\.env" /Users/Apple/IT/tinytower/.gitignore
```

- [ ] **Step 4: Запустити всі серверні тести**

```bash
cd /Users/Apple/IT/tinytower/server && npx jest --no-coverage 2>&1 | tail -15
```

Очікується: всі тести PASS

- [ ] **Step 5: Запустити всі клієнтські тести**

```bash
cd /Users/Apple/IT/tinytower && npm test -- --no-coverage 2>&1 | tail -15
```

Очікується: всі тести PASS

- [ ] **Step 6: Фінальна TypeScript перевірка**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -20
cd /Users/Apple/IT/tinytower/server && npx tsc --noEmit 2>&1 | head -20
```

Очікується: 0 помилок в обох

- [ ] **Step 7: Фінальний commit**

```bash
cd /Users/Apple/IT/tinytower
git add -A
git commit -m "feat: complete RevenueCat integration (server-side verification, no optimistic grants)"
```
