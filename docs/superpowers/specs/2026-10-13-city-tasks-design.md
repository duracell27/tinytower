# City Tasks Design

**Date:** 2026-10-13  
**Branch:** feat/social-login → new branch `feat/city-tasks`

---

## Overview

City Tasks — 9 щоденних завдань для міста. Будь-який учасник бере завдання і виконує його протягом дня (reset о опівночі UTC). Завершені завдання приносять місту **style stars** — нову валюту для змагань між містами.

---

## Task Definitions

### 7 завдань з рівнем міста (активні від City Level 10+)

Формула: `X = clamp((Y - 10) * K + BASE, BASE, MAX_AT_50)`  
де `Y = cityLevel`, складність не росте після рівня 50.

| # | Тип | Дія | K | BASE | MAX (lv50) |
|---|-----|-----|---|------|-----------|
| 1 | `WHOLESALE_PURCHASES` | Купити n товарів | 15 | 50 | 650 |
| 2 | `GOODS_ON_DISPLAY` | Викласти n товарів | 30 | 100 | 1300 |
| 3 | `CASH_COLLECTOR` | Зібрати виручку з n товарів | 50 | 150 | 2150 |
| 4 | `CARRIER` | Відвезти n відвідувачів ліфтом | 25 | 100 | 1100 |
| 5 | `VIP_CARRIER` | Привезти n VIP ліфтом | 5 | 10 | 210 |
| 6 | `EVICT_RESIDENTS` | Виселити n жителів | 5 | 15 | 215 |
| 7 | `NEW_RESIDENTS` | Привезти n жителів до готелю | 5 | 25 | 225 |

### 2 стабільних завдання

| # | Тип | Дія | Ціль |
|---|-----|-----|------|
| 8 | `BUILD_FLOOR` | Побудувати новий поверх | 1 |
| 9 | `EASY_MONEY` | Отримати 30 діамантів у чайових | 30 |

---

## Mechanics

- **Daily reset:** о 00:00 UTC кожен день
- **Учасники:** 1 або 2 гравці на завдання; 1 гравець одночасно лише в 1 завданні
- **Прогрес:** сумується від обох учасників автоматично через sync
- **Reward:** 1–10 style stars (random при зборі)
- **x2 бонус:** якщо завдання зібрано протягом 10 годин від `takenAt`
- **Ручний збір:** Mayor / Acting Mayor / Vice Mayor збирає нагороду вручну (кнопка "Зібрати")
- **Скасування:** ті самі ролі можуть скасувати завдання → воно повертається в `AVAILABLE`
- **Expiry:** о опівночі всі незавершені/незібрані завдання стають `EXPIRED` і створюються нові

---

## DB Schema

### Нові моделі (Prisma)

```prisma
enum CityTaskType {
  WHOLESALE_PURCHASES
  GOODS_ON_DISPLAY
  CASH_COLLECTOR
  CARRIER
  VIP_CARRIER
  EVICT_RESIDENTS
  NEW_RESIDENTS
  BUILD_FLOOR
  EASY_MONEY
}

enum CityTaskStatus {
  AVAILABLE
  IN_PROGRESS
  COMPLETED
  COLLECTED
  EXPIRED
}

model CityDailyTask {
  id              String               @id @default(cuid())
  cityId          String
  city            City                 @relation(fields: [cityId], references: [id], onDelete: Cascade)
  taskType        CityTaskType
  date            DateTime             // 00:00 UTC дня
  status          CityTaskStatus       @default(AVAILABLE)
  requiredCount   Int                  // розраховано від рівня міста при lazy create
  currentProgress Int                  @default(0)
  takenAt         DateTime?            // коли перший учасник взяв
  completedAt     DateTime?
  collectedAt     DateTime?
  rewardStars     Int?                 // 1-10, присвоюється при зборі
  finalStars      Int?                 // rewardStars * multiplier
  participants    CityTaskParticipant[]

  @@unique([cityId, taskType, date])
  @@index([cityId, date])
}

model CityTaskParticipant {
  id        String        @id @default(cuid())
  taskId    String
  task      CityDailyTask @relation(fields: [taskId], references: [id], onDelete: Cascade)
  playerId  String
  progress  Int           @default(0)
  joinedAt  DateTime      @default(now())

  @@unique([taskId, playerId])
  @@index([playerId])
}
```

### Зміни в існуючих моделях

```prisma
model City {
  // ... існуючі поля
  styleStars   Int   @default(0)
  dailyTasks   CityDailyTask[]
}
```

---

## Server Architecture

### city-task.service.ts (новий)

**`getOrCreateDailyTasks(cityId, cityLevel)`**  
Lazy create: повертає 9 `CityDailyTask` для поточного дня. Якщо записів немає — створює їх з `requiredCount` розрахованим від `cityLevel` (clamp level 10–50 для формул).

**`joinTask(playerId, taskId)`**  
- Перевірка: гравець не в іншому активному завданні сьогодні
- Перевірка: завдання має < 2 учасників і статус `AVAILABLE` або `IN_PROGRESS`
- Перший учасник → встановлює `takenAt`, статус → `IN_PROGRESS`
- Повертає оновлений task

**`collectTask(actorId, taskId)`**  
- Перевірка: роль актора ≥ `VICE_MAYOR`
- Перевірка: статус `COMPLETED`
- `rewardStars = random(1, 10)`
- `multiplier = (now - takenAt) < 10h ? 2 : 1`
- `finalStars = rewardStars * multiplier`
- `city.styleStars += finalStars`
- Статус → `COLLECTED`

**`cancelTask(actorId, taskId)`**  
- Перевірка: роль актора ≥ `VICE_MAYOR`
- Видаляє учасників, скидає прогрес, статус → `AVAILABLE`, очищає `takenAt`

**`expireTasks()`**  
- Викликається на початку `getOrCreateDailyTasks` нового дня
- Всі `IN_PROGRESS` / `COMPLETED` завдання попереднього дня → `EXPIRED`

### city-task.constants.ts (новий)

```typescript
// deliver_visitor — спеціальний: тип залежить від payload.isVip
// receive_tip — рахується лише якщо payload.type === 'diamond'
export const TASK_COMMAND_MAP: Partial<Record<string, CityTaskType | 'DUAL_VISITOR'>> = {
  buy_product:     'WHOLESALE_PURCHASES',
  place_product:   'GOODS_ON_DISPLAY',
  collect_product: 'CASH_COLLECTOR',
  deliver_visitor: 'DUAL_VISITOR',   // resolveTaskType перевіряє payload.isVip → VIP_CARRIER або CARRIER
  evict_resident:  'EVICT_RESIDENTS',
  hotel_checkin:   'NEW_RESIDENTS',
  buy_floor:       'BUILD_FLOOR',
  receive_tip:     'EASY_MONEY',
}

// resolveTaskType логіка:
// if command === 'deliver_visitor': return payload.isVip ? 'VIP_CARRIER' : 'CARRIER'
// if command === 'receive_tip': return payload.type === 'diamond' ? 'EASY_MONEY' : null
// else: return TASK_COMMAND_MAP[command] ?? null

export function calcRequiredCount(taskType: CityTaskType, cityLevel: number): number {
  const y = Math.max(10, Math.min(50, cityLevel));
  switch (taskType) {
    case 'WHOLESALE_PURCHASES': return (y - 10) * 15 + 50;
    case 'GOODS_ON_DISPLAY':    return (y - 10) * 30 + 100;
    case 'CASH_COLLECTOR':      return (y - 10) * 50 + 150;
    case 'CARRIER':             return (y - 10) * 25 + 100;
    case 'VIP_CARRIER':         return (y - 10) * 5 + 10;
    case 'EVICT_RESIDENTS':     return (y - 10) * 5 + 15;
    case 'NEW_RESIDENTS':       return (y - 10) * 5 + 25;
    case 'BUILD_FLOOR':         return 1;
    case 'EASY_MONEY':          return 30;
  }
}
```

### Інтеграція в sync.service.ts

В межах існуючої Prisma транзакції після обробки кожної команди:

```typescript
await cityTaskService.updateProgressForCommand(playerId, command, tx);
```

**`updateProgressForCommand`:**
```typescript
async updateProgressForCommand(playerId, command, tx) {
  const participant = await tx.cityTaskParticipant.findFirst({
    where: { playerId, task: { date: today(), status: 'IN_PROGRESS' } },
    include: { task: true }
  });
  if (!participant) return;

  const taskType = resolveTaskType(command); // з TASK_COMMAND_MAP
  if (!taskType || participant.task.taskType !== taskType) return;

  const increment = resolveIncrement(command); // зазвичай 1
  const newTotal = Math.min(
    participant.task.currentProgress + increment,
    participant.task.requiredCount
  );
  const isCompleted = newTotal >= participant.task.requiredCount;

  await tx.cityTaskParticipant.update({
    where: { id: participant.id },
    data: { progress: { increment } }
  });
  await tx.cityDailyTask.update({
    where: { id: participant.task.id },
    data: {
      currentProgress: newTotal,
      ...(isCompleted && { status: 'COMPLETED', completedAt: new Date() }),
    }
  });
}
```

### Зміни в SyncResult

```typescript
export interface SyncResult {
  // ... існуючі поля
  cityTasks?: {
    tasks: CityTaskSummary[]
    myActiveTaskId: string | null
    cityStyleStars: number
  }
}
```

`cityTasks` включається в SyncResult лише якщо гравець є членом міста.

---

## API Endpoints

| Method | Path | Auth | Опис |
|--------|------|------|------|
| `GET` | `/city/tasks` | member | Повертає 9 завдань дня (lazy create) |
| `POST` | `/city/tasks/:id/join` | member | Взяти завдання |
| `POST` | `/city/tasks/:id/collect` | Vice Mayor+ | Зібрати нагороду |
| `POST` | `/city/tasks/:id/cancel` | Vice Mayor+ | Скасувати завдання |

---

## Client Architecture

### cityTaskStore.ts (новий Zustand store)

```typescript
interface CityTaskSummary {
  id: string
  taskType: CityTaskType
  status: CityTaskStatus
  requiredCount: number
  currentProgress: number
  participants: { playerId: string; progress: number }[]
  takenAt?: string
  canDoubleUntil?: string  // takenAt + 10h ISO string
  rewardStars?: number
  finalStars?: number
}

interface CityTaskStore {
  tasks: CityTaskSummary[]
  myActiveTaskId: string | null
  cityStyleStars: number
  setFromSync: (data: NonNullable<SyncResult['cityTasks']>) => void
  joinTask: (taskId: string) => Promise<void>
  collectTask: (taskId: string) => Promise<void>
  cancelTask: (taskId: string) => Promise<void>
}
```

`setFromSync` викликається в `sync.ts` поруч з існуючим `setCityMarketingBonus`.

### CityTaskFAB.tsx (новий компонент)

- Розташований ліворуч на головному екрані (дзеркально до існуючих FAB)
- Відображається лише якщо `myActiveTaskId !== null`
- Кругова анімація прогресу навколо іконки (аналогічно `TutorialTaskFAB`)
- `progress = currentTask.currentProgress / currentTask.requiredCount`
- Тап → навігація на `app/city/tasks.tsx`

---

## Screens

### app/city/tasks.tsx (новий)

**Layout:**
```
┌─────────────────────────────────┐
│  ⭐ Style Stars: 142             │  ← cityStyleStars
├─────────────────────────────────┤
│  [Завдання 1]  ████░░  30/50   │
│  👤 Alice  ×2⏱  [Взяти]        │
├─────────────────────────────────┤
│  [Завдання 2]  ████████ Done   │
│  👤 Bob 👤 Carl  [Зібрати]      │  ← тільки для Mayor/VM/AM
├─────────────────────────────────┤
│  ...                            │
└─────────────────────────────────┘
```

**Картка завдання:**
- Назва + іконка
- Progress bar (`currentProgress / requiredCount`, `X / N`)
- Аватари учасників (max 2 слоти, сірі якщо пусті)
- Маркер `×2` з таймером якщо `now < canDoubleUntil`
- Кнопки стану:
  - `AVAILABLE` → "Взяти" (для будь-якого member без активного завдання)
  - `IN_PROGRESS` (я учасник) → "Активне" (disabled)
  - `IN_PROGRESS` (я не учасник, < 2 учасників) → "Приєднатись"
  - `COMPLETED` + роль ≥ VM → "Зібрати"
  - `COLLECTED` → "✓ Виконано"
- Кнопка "Скасувати" (тільки Mayor/Acting Mayor/Vice Mayor, для IN_PROGRESS/COMPLETED)

### Навігація

У `app/(tabs)/city.tsx` або `app/city/[id].tsx` — кнопка/таб посилання на `/city/tasks`.

---

## i18n Keys

```json
{
  "cityTasks.title": "City Tasks",
  "cityTasks.styleStars": "Style Stars",
  "cityTasks.take": "Take",
  "cityTasks.join": "Join",
  "cityTasks.active": "Active",
  "cityTasks.collect": "Collect",
  "cityTasks.cancel": "Cancel",
  "cityTasks.done": "Done",
  "cityTasks.doubleBonus": "×2",
  "cityTasks.task.wholesalePurchases": "Wholesale Purchases",
  "cityTasks.task.goodsOnDisplay": "Goods on Display",
  "cityTasks.task.cashCollector": "Cash Collector",
  "cityTasks.task.carrier": "Carrier",
  "cityTasks.task.vipCarrier": "VIP Carrier",
  "cityTasks.task.evictResidents": "Evict Residents",
  "cityTasks.task.newResidents": "New Residents",
  "cityTasks.task.buildFloor": "New Floor",
  "cityTasks.task.easyMoney": "Easy Money"
}
```

---

## Out of Scope (V1)

- City vs city competitions (style stars накопичуються, логіка змагань — окремий spec)
- Push notifications при завершенні завдання
- Task history / stats
- Автоматичне призначення Acting Mayor при скануванні завдань
