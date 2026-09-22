# RevenueCat Integration Design

## Overview

Інтеграція RevenueCat для обробки реальних in-app purchases (consumables) у магазині гри.
Поточний стан: кнопки "Купити" у shop.tsx симулюють покупку без реального платежу — `shopPurchase()` одразу записує команду в queue. Після інтеграції покупка нараховується **лише після** підтвердження сервером, який верифікував платіж через RevenueCat.

Підхід: **server-side verification** — клієнт ініціює покупку через RevenueCat SDK, після успіху сповіщає сервер, сервер верифікує через RevenueCat REST API, нараховує нагороди напряму до `PlayerState` та повертає результат клієнту. RevenueCat webhook — резервний канал для edge-кейсів (крах застосунку).

Тест-режим: sandbox через env vars, без реальних грошей.

---

## Архітектура флоу

```
Юзер тисне "Купити"
        ↓
  [Client] Purchases.purchaseStoreProduct(rcProductId)
        ↓  (RevenueCat / App Store / Google Play)
  Спінер "Очікуємо підтвердження..."
        ↓  success → transactionId
  [Client] POST /payments/notify { packId, transactionId }
        ↓
  [Server] Перевірка RevenueCat REST API
           → verify transaction belongs to this user
           → idempotency check (Purchase table)
           → update PlayerState (gems / tools / tokens)
           → зберегти Purchase record
           → return { rewards }
        ↓
  [Client] Ховаємо спінер
           gameStore.setManualPurchaseSuccess({ packName, rewards })
           triggerSync()  ← отримує оновлений стан
        ↓
  PurchaseSuccessModal показується
```

**RevenueCat Webhook (резервний канал):**
```
[RevenueCat] POST /payments/rc-webhook
        ↓
  [Server] Validate webhook signature (X-RevenueCat-Signature)
           event.type === 'INITIAL_PURCHASE'
           idempotency check
           → якщо ще не оброблено: нарахувати нагороди
           → якщо вже оброблено: skip (no-op)
```

Webhook захищає від:
- App crash між RevenueCat success і `POST /payments/notify`
- Мережевої помилки при notify
- Replay attacks (duplicate processing)

---

## 1. RevenueCat Dashboard Setup (ручно, до імплементації)

### Кроки:
1. Створити акаунт на revenuecat.com
2. Створити новий Project `TinyTower`
3. Додати App (iOS) → вказати Bundle ID з `app.json`
4. Додати App (Android) → вказати Package Name
5. В кожному App скопіювати **Public API Key** (для клієнта) та **Secret API Key** (для сервера)
6. Налаштувати **Webhook**: `Settings → Integrations → Webhooks → Add Endpoint`
   - URL: `https://<your-server>/payments/rc-webhook`
   - Events: `INITIAL_PURCHASE` (+ опційно `CANCELLATION`, `REFUND`)
   - Зберегти **Webhook Shared Secret** → в `REVENUECAT_WEBHOOK_SECRET` env var

### Продукти у App Store Connect (iOS):
Для кожного з 20 паків створити **Consumable In-App Purchase**:

| Pack ID         | Product ID (App Store)                  | Price Tier |
|-----------------|-----------------------------------------|------------|
| diamonds_1      | com.tinytower.shop.diamonds_1           | $0.99      |
| diamonds_2      | com.tinytower.shop.diamonds_2           | $1.99      |
| diamonds_3      | com.tinytower.shop.diamonds_3           | $4.99      |
| diamonds_4      | com.tinytower.shop.diamonds_4           | $9.99      |
| diamonds_5      | com.tinytower.shop.diamonds_5           | $19.99     |
| diamonds_6      | com.tinytower.shop.diamonds_6           | $49.99     |
| bundle_1        | com.tinytower.shop.bundle_1             | $1.99      |
| bundle_2        | com.tinytower.shop.bundle_2             | $4.99      |
| bundle_3        | com.tinytower.shop.bundle_3             | $9.99      |
| bundle_4        | com.tinytower.shop.bundle_4             | $24.99     |
| builder_1       | com.tinytower.shop.builder_1            | $1.99      |
| builder_2       | com.tinytower.shop.builder_2            | $3.99      |
| builder_3       | com.tinytower.shop.builder_3            | $7.99      |
| builder_4       | com.tinytower.shop.builder_4            | $14.99     |
| mat_briks       | com.tinytower.shop.mat_briks            | $0.99      |
| mat_glass       | com.tinytower.shop.mat_glass            | $0.99      |
| mat_nails       | com.tinytower.shop.mat_nails            | $0.99      |
| mat_screw       | com.tinytower.shop.mat_screw            | $0.99      |
| mat_wood        | com.tinytower.shop.mat_wood             | $0.99      |
| mat_cement      | com.tinytower.shop.mat_cement           | $0.99      |

Ті самі Product IDs реєструються в Google Play Console (Android).

### RevenueCat Products:
У RevenueCat Dashboard → Products → додати кожен продукт з відповідним Store Product ID.
Entitlements не потрібні (consumables не дають entitlement, вони разові).

---

## 2. Зміни у shopPacks.ts

Додати два поля до `ShopPack`:

```ts
export interface ShopPack {
  // ... існуючі поля ...
  rcProductId: string;  // RevenueCat / Store product identifier
  priceUsd:   number;   // числова ціна для ReferralService.processPurchaseBonus
}
```

Кожен пак отримує `rcProductId: 'com.tinytower.shop.<packId>'` та `priceUsd` відповідно до `price` (наприклад, `'$0.99'` → `0.99`).

---

## 3. Клієнт — новий `src/services/purchaseService.ts`

Відповідальність: ізолювати RevenueCat SDK від решти коду.

```ts
// Ініціалізація (викликати з _layout.tsx після auth)
initializePurchases(userId: string): void
  // Purchases.configure({ apiKey: RC_API_KEY, appUserID: userId })

// Отримати StoreProduct для пака (для відображення локальної ціни)
getProducts(rcProductIds: string[]): Promise<PurchasesStoreProduct[]>

// Виконати покупку
purchase(rcProductId: string): Promise<{ transactionId: string }>
  // throws PurchasesError якщо юзер скасував або помилка

// Відновити покупки (для completeness, consumables не відновлюються)
restorePurchases(): Promise<void>
```

**Env vars (клієнт):**
```
EXPO_PUBLIC_RC_API_KEY_IOS=appl_xxxx       # sandbox key під час dev
EXPO_PUBLIC_RC_API_KEY_ANDROID=goog_xxxx
```
RevenueCat автоматично використовує Sandbox середовище якщо app підписаний development provisioning profile або запущений через Expo Go / TestFlight.

---

## 4. Клієнт — новий `src/hooks/usePurchase.ts`

```ts
function usePurchase(): {
  purchasing: boolean;           // показувати спінер
  purchase: (pack: ShopPack) => Promise<void>;
  error: string | null;
  clearError: () => void;
}
```

Внутрішній флоу:
1. `setPurchasing(true)`
2. `purchaseService.purchase(pack.rcProductId)` → `transactionId`
3. `api.notifyPurchase({ packId: pack.id, transactionId })` → `{ rewards }`
4. `gameStore.setManualPurchaseSuccess({ packName: pack.name, price: pack.price, rewards })`
5. `syncService.triggerSync()`
6. `setPurchasing(false)`

Помилки:
- `PURCHASE_CANCELLED` → тихо ігнорувати (юзер сам скасував)
- Інші → `setError(localizedMessage)`, показати Alert

---

## 5. Клієнт — зміни у `src/services/api.ts`

Новий метод:

```ts
notifyPurchase(body: {
  packId: string;
  transactionId: string;
}): Promise<{ rewards: ShopRewards }>
```

`POST /payments/notify` з JWT-токеном в headers (як інші API calls).

---

## 6. Клієнт — зміни у `app/(tabs)/shop.tsx`

- Замінити виклик `gameStore.shopPurchase(pack)` на `usePurchase().purchase(pack)`
- Показувати `purchasing && <PurchaseLoadingOverlay />` (новий компонент)
- Ціни: замість хардкодних рядків (`'$0.99'`) — підтягувати локальну ціну з `getProducts()` при монтуванні; fallback — `pack.price` якщо SDK ще не завантажив

---

## 7. Клієнт — новий компонент `PurchaseLoadingOverlay`

Простий fullscreen overlay (через GlobalOverlay) зі спінером і текстом:
> "Очікуємо підтвердження платежу..."

Показується поки `purchasing === true`. Не можна закрити тапом.

---

## 8. Клієнт — зміни у `src/stores/gameStore.ts`

Видалити `shopPurchase(pack)` action (більше не потрібен — purchases йдуть через `usePurchase`).

Додати:
```ts
setManualPurchaseSuccess: (payload: PurchaseSuccessPayload) => void
// просто: set({ pendingPurchaseSuccess: payload })
// (clearPurchaseSuccess вже є)
```

Прибрати `shop_purchase` із client-side command dispatch. Команда більше не надсилається клієнтом — нагороди нараховує сервер напряму.

---

## 9. Сервер — новий модуль `server/src/payments/`

### Файли:
```
server/src/payments/
  payments.module.ts
  payments.controller.ts
  payments.service.ts
  revenuecat.client.ts      ← HTTP клієнт до RevenueCat REST API
  dto/notify-purchase.dto.ts
```

### `POST /payments/notify` (авторизований, JWT)

```ts
// dto
class NotifyPurchaseDto {
  packId: string;          // 'diamonds_1', 'bundle_3', etc.
  transactionId: string;   // від RevenueCat SDK
}

// response
{
  rewards: {
    gems?: number;
    tools?: Partial<Record<ToolKey, number>>;
    tokens?: Partial<Record<TokenColor, number>>;
  }
}
```

Логіка `PaymentsService.notifyPurchase(playerId, dto)`:
1. Знайти `pack` у `SHOP_PACKS_MAP` (shared constant) по `packId`; 404 якщо немає
2. Idempotency: `Purchase.findUnique({ transactionId })` — якщо вже є → повернути збережені rewards (не нараховувати двічі)
3. Верифікація через `RevenueCatClient.verifyTransaction(playerId, transactionId)`
   - `GET https://api.revenuecat.com/v1/subscribers/<playerId>`
   - Перевірити що `transactionId` є в `subscriber.non_subscriptions[rcProductId][]`
   - (захист від replay — `transactionId UNIQUE` в таблиці Purchase, перевірено на кроці 2)
4. Записати `Purchase { transactionId, packId, playerId, status: 'fulfilled', rewards, createdAt }`
5. Оновити `PlayerState` в транзакції: `gems += rewards.gems`, `tools += ...`, `tokens += ...`
6. Оновити `gemsShopBonus` в `CityMembership` якщо `rewards.gems > 0` (аналогічно поточному sync.service)
7. Викликати `ReferralService.processPurchaseBonus(playerId, packPrice)` (аналогічно поточному)
8. Повернути `{ rewards }`

### `POST /payments/rc-webhook` (публічний, валідація підпису)

```ts
// Headers: X-RevenueCat-Signature
// Body: RevenueCat webhook payload
```

Логіка:
1. Перевірити `HMAC-SHA256(rawBody, REVENUECAT_WEBHOOK_SECRET)` — 401 якщо не збігається
2. Якщо `event.type !== 'INITIAL_PURCHASE'` → 200 OK (ігноруємо refund/cancel поки)
3. Взяти `app_user_id` (= playerId), `transaction_id`, `product_id` (= rcProductId)
4. Знайти `pack` по `rcProductId` → мапа `rcProductId → pack`
5. Idempotency check: якщо `Purchase.findUnique({ transactionId })` існує → 200 OK, skip
6. Виконати ті самі кроки 5-7 з `notify` (shared `applyRewards` method)
7. 200 OK

### `revenuecat.client.ts`

```ts
class RevenueCatClient {
  // GET https://api.revenuecat.com/v1/subscribers/<appUserId>
  // Header: Authorization: Bearer <REVENUECAT_SECRET_KEY>
  getSubscriber(appUserId: string): Promise<RCSubscriber>
}
```

---

## 10. Сервер — Prisma міграція

Нова модель:

```prisma
model Purchase {
  id            String   @id @default(uuid())
  playerId      String
  transactionId String   @unique
  packId        String
  rcProductId   String
  status        String   // 'fulfilled'
  gemsGranted   Int      @default(0)
  toolsGranted  Json?    // { briks: 5, glass: 5, ... }
  tokensGranted Json?
  source        String   // 'notify' | 'webhook'
  createdAt     DateTime @default(now())

  player        Player   @relation(fields: [playerId], references: [id])

  @@index([playerId])
}
```

---

## 11. Environment Variables

### Клієнт (`.env` / Expo):
```
EXPO_PUBLIC_RC_API_KEY_IOS=appl_sandbox_xxxx       # sandbox для dev
EXPO_PUBLIC_RC_API_KEY_ANDROID=goog_sandbox_xxxx
```

### Сервер:
```
REVENUECAT_SECRET_KEY=sk_sandbox_xxxx              # sandbox для dev
REVENUECAT_WEBHOOK_SECRET=whsec_xxxx
```

Для production — окремі ключі без `_sandbox` через той самий механізм env vars.

---

## 12. Sandbox / Test Mode

RevenueCat sandbox працює **автоматично** якщо:
- iOS: app підписаний development provisioning profile або TestFlight
- Android: app завантажений через Internal Test Track

Apple Sandbox Testers: Settings → App Store Connect → Users → Sandbox Testers.
Тестовий юзер купує — транзакція йде через Apple Sandbox, кошти реальні НЕ списуються.
RevenueCat отримує sandbox event → надсилає webhook → сервер обробляє.

**Важливо**: sandbox webhook URL повинен бути доступний публічно (ngrok або staging сервер).

---

## 13. Зміни до існуючого коду

### `server/src/sync/sync.service.ts`
- `NEVER_AUTO_ACK` для `shop_purchase` можна залишити як є (клієнт більше не надсилає цю команду, але захист не зашкодить)
- Видалити блок обробки `shop_purchase` у `acceptedCommands` (рядки ~337-344) — тепер це робить `PaymentsService`

### `server/src/sync/sync.controller.ts`
- Без змін

### `shared/types` (Command type)
- `shop_purchase` команда залишається у типах (сервер може використовувати внутрішньо), але більше не надсилається клієнтом

---

## 14. Що НЕ входить у scope

- Підписки (subscriptions) — тільки consumables
- Restore purchases UI — consumables технічно не відновлюються
- Promo codes / offers
- Analytics RevenueCat (можна підключити пізніше)
- Refund handling — webhook REFUND ігнорується поки (гемс не знімаємо назад)

---

## Залежності для встановлення

```bash
# Клієнт
npm install react-native-purchases

# Сервер — нема нових npm пакетів (використовуємо вбудований fetch / axios що вже є)
```

`react-native-purchases` є native module — потрібен `expo prebuild` (або managed workflow plugin).
Перевірити чи є `expo-plugin` для RevenueCat: `@revenuecat/purchases-typescript-internal` має Expo config plugin.
