# Icons, UI Polish & Warehouse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace SVG worker avatars with color-coded PNG assets, add builder/hotel/reception icons, add a 40px warehouse sidebar with bottom sheet, store tool inventory in PostgreSQL, and add a Discord icon to the welcome screen.

**Architecture:** Tasks 1–4 and 7 are pure client-side changes. Task 5 is backend-only (Prisma + NestJS). Task 6 connects client to the new backend tools endpoint. Task 1 must run before Task 2 because WorkerAvatar keys images by `floorType` name.

**Tech Stack:** React Native / Expo (expo-image for all PNG rendering), NestJS + Prisma (PostgreSQL), Zustand (game store), react-native-reanimated (sheet animation).

## Global Constraints

- All PNG images use `expo-image` `<Image>` component, never `<Image>` from react-native.
- All `require()` calls for assets must be **static** (Metro bundler limitation — no dynamic `require()`).
- Font family strings: `Fredoka_700Bold`, `Fredoka_600SemiBold`, `Fredoka_500Medium`.
- Server test command: `cd server && npx jest`.
- Shared engine test command (from repo root): `npx jest --testPathPattern='shared'`.
- New NestJS files follow the pattern: injectable service + controller + module, imported in `app.module.ts`.
- No new i18n namespaces for warehouse — use hardcoded Ukrainian labels.

---

## File Map

| File | Action | Task |
|------|--------|------|
| `shared/config/gameConfig.ts` | Modify — rename floorType keys | 1 |
| `shared/engine/__tests__/workerUtils.test.ts` | Modify — `'teal'` → `'blue'` | 1 |
| `shared/engine/__tests__/processCommand.test.ts` | Modify — `'teal'` → `'blue'` | 1 |
| `shared/schemas/__tests__/schemas.test.ts` | Modify — `'teal'` → `'blue'` | 1 |
| `src/components/WorkerAvatar.tsx` | Rewrite — SVG → expo-image | 2 |
| `src/components/BuyFloorBanner.tsx` | Modify — PlusIcon → builder.png | 3 |
| `src/components/TechnicalFloor.tsx` | Modify — lobby.png → reception.png, 70×70 | 4 |
| `server/prisma/schema.prisma` | Modify — add PlayerTools model | 5 |
| `server/src/player/player.service.ts` | Modify — create PlayerTools on register | 5 |
| `server/src/tools/tools.service.ts` | Create | 5 |
| `server/src/tools/tools.controller.ts` | Create | 5 |
| `server/src/tools/tools.module.ts` | Create | 5 |
| `server/src/app.module.ts` | Modify — import ToolsModule | 5 |
| `src/stores/gameStore.ts` | Modify — add toolInventory state | 6 |
| `src/services/sync.ts` | Modify — fetch tools on start | 6 |
| `src/components/WarehouseSidebar.tsx` | Create | 6 |
| `src/components/WarehouseSheet.tsx` | Create | 6 |
| `app/(tabs)/game.tsx` | Modify — sideRight width 40, add WarehouseSidebar | 6 |
| `src/screens/WelcomeScreen.tsx` | Modify — add Discord icon | 7 |

---

## Task 1: Floor Type Rename

Rename floorType keys `teal→blue`, `amber→yellow`, `purple→violet`, `blue→red` everywhere they appear as string literals.

**Files:**
- Modify: `shared/config/gameConfig.ts`
- Modify: `shared/engine/__tests__/workerUtils.test.ts`
- Modify: `shared/engine/__tests__/processCommand.test.ts`
- Modify: `shared/schemas/__tests__/schemas.test.ts`

**Interfaces:**
- Produces: `gameConfig.floorTypes` keys are now `green | blue | yellow | violet | red`. All code that reads `worker.floorType` now receives one of these values.

- [ ] **Step 1: Update `shared/config/gameConfig.ts`**

Replace the entire `rawConfig` `floorTypes` block and `floors` array:

```typescript
const rawConfig = {
  floorTypes: {
    green:  { shirtColor: '#49AA38', accent: '#20810F', dreamJobs: ['bulky', 'cupcake', 'cake'] },
    blue:   { shirtColor: '#3376E5', accent: '#0A4DBC', dreamJobs: ['wash', 'dry', 'bleach'] },
    yellow: { shirtColor: '#E5A72E', accent: '#BC7E05', dreamJobs: ['coffee', 'pancake', 'dessert'] },
    violet: { shirtColor: '#9A6FD0', accent: '#7B52BC', dreamJobs: ['aroma', 'soap', 'candle'] },
    red:    { shirtColor: '#4C9BDD', accent: '#2E78B5', dreamJobs: ['icecream', 'shake', 'sorbet'] },
  },
  floors: [
    { id: 2, slots: 3, floorType: 'green', availableTypes: ['bulky', 'cupcake', 'cake'] },
    { id: 3, slots: 3, floorType: 'blue',  availableTypes: ['wash', 'dry', 'bleach'] },
    { id: 4, slots: 3, floorType: 'yellow', availableTypes: ['coffee', 'pancake', 'dessert'] },
  ],
  // ... rest unchanged
```

- [ ] **Step 2: Fix `shared/engine/__tests__/workerUtils.test.ts`**

Lines 20 and 37 pass `'teal'` as the `floorType` argument. Change both to `'blue'`:

```typescript
// line 20
expect(getWorkerMood(w, 'blue', 'wash')).toBe('bad');

// line 37
expect(getRevenueMultiplier(w, 'blue', 'wash')).toBe(1.0);
```

- [ ] **Step 3: Fix `shared/engine/__tests__/processCommand.test.ts`**

Line 380 has `floorType: 'teal'`. Change to `'blue'`:

```typescript
workers: [makeWorker({ floorType: 'blue', assignedFloorId: 1, assignedSlotIdx: 0 })],
```

- [ ] **Step 4: Fix `shared/schemas/__tests__/schemas.test.ts`**

Line 240 has `floorType: 'teal'`. Change to `'blue'`:

```typescript
floorType: 'blue',
```

- [ ] **Step 5: Run shared tests**

```bash
npx jest --testPathPattern='shared'
```

Expected: all tests pass (no failures about unknown floorType).

- [ ] **Step 6: Commit**

```bash
git add shared/config/gameConfig.ts shared/engine/__tests__/workerUtils.test.ts shared/engine/__tests__/processCommand.test.ts shared/schemas/__tests__/schemas.test.ts
git commit -m "refactor: rename floorType keys teal→blue, amber→yellow, purple→violet, blue→red"
```

---

## Task 2: WorkerAvatar — SVG → Image Assets

Replace the hand-drawn SVG avatar with color-coded PNG files from `assets/img/workers/`.

**Files:**
- Rewrite: `src/components/WorkerAvatar.tsx`

**Interfaces:**
- Consumes: `worker.female: boolean`, `worker.floorType: string` (one of `green|blue|yellow|violet|red` after Task 1).
- Produces: same `WorkerAvatarProps` — `{ worker: Worker; size?: number }`. Consumers unchanged.

- [ ] **Step 1: Rewrite `src/components/WorkerAvatar.tsx`**

```typescript
import React, { memo } from 'react';
import { Image } from 'expo-image';
import type { Worker } from '../../shared/types';

const MAN: Record<string, ReturnType<typeof require>> = {
  green:  require('../../assets/img/workers/man-green.png'),
  blue:   require('../../assets/img/workers/man-blue.png'),
  yellow: require('../../assets/img/workers/man-yellow.png'),
  violet: require('../../assets/img/workers/man-violet.png'),
  red:    require('../../assets/img/workers/man-red.png'),
};

const WOMAN: Record<string, ReturnType<typeof require>> = {
  green:  require('../../assets/img/workers/woman-green.png'),
  blue:   require('../../assets/img/workers/woman-blue.png'),
  yellow: require('../../assets/img/workers/woman-yellow.png'),
  violet: require('../../assets/img/workers/woman-violet.png'),
  red:    require('../../assets/img/workers/woman-red.png'),
};

interface WorkerAvatarProps {
  worker: Worker;
  size?: number;
}

function WorkerAvatarInner({ worker, size = 60 }: WorkerAvatarProps) {
  const map = worker.female ? WOMAN : MAN;
  const source = map[worker.floorType] ?? (worker.female ? WOMAN.green : MAN.green);
  return (
    <Image
      source={source}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      contentFit="cover"
    />
  );
}

const WorkerAvatar = memo(WorkerAvatarInner);
export default WorkerAvatar;
```

- [ ] **Step 2: Verify in app**

Run `npx expo start` and navigate to the Hotel panel. Worker cards must show PNG avatars instead of SVG heads. Check male and female variants.

- [ ] **Step 3: Commit**

```bash
git add src/components/WorkerAvatar.tsx
git commit -m "feat: replace WorkerAvatar SVG with color-coded PNG assets"
```

---

## Task 3: BuyFloorBanner — Builder Icon

Replace the SVG `+` circle with `builder.png`.

**Files:**
- Modify: `src/components/BuyFloorBanner.tsx`

**Interfaces:**
- Consumes: `assets/img/workers/builder.png`
- Produces: same `BuyFloorBannerProps` — no interface change.

- [ ] **Step 1: Update `src/components/BuyFloorBanner.tsx`**

1. Add `import { Image } from 'expo-image';` at the top.
2. Remove the `PlusIcon` function entirely.
3. In the JSX, replace:
```tsx
<View style={styles.ribbonPlusCircle}>
  <PlusIcon />
</View>
```
with:
```tsx
<Image
  source={require('../../assets/img/workers/builder.png')}
  style={{ width: 28, height: 28 }}
  contentFit="contain"
/>
```
4. Remove the `ribbonPlusCircle` style from `StyleSheet.create({...})`.
5. Remove `Svg` and `Path` imports if no longer used elsewhere in the file.

- [ ] **Step 2: Verify**

Run the app and scroll to the top of the tower list. The buy-floor banner must show the builder PNG instead of a circle with `+`.

- [ ] **Step 3: Commit**

```bash
git add src/components/BuyFloorBanner.tsx
git commit -m "feat: replace BuyFloorBanner plus icon with builder.png"
```

---

## Task 4: TechnicalFloor — Hotel & Reception Images

Swap `lobby.png` → `reception.png` and resize both images to 70×70.

**Files:**
- Modify: `src/components/TechnicalFloor.tsx`

**Interfaces:**
- No interface changes. `HotelFloorProps` and `LobbyFloorProps` unchanged.

- [ ] **Step 1: Update image source in `LobbyFloor`**

In `src/components/TechnicalFloor.tsx`, find:
```tsx
source={require('../../assets/img/lobby.png')}
```
Replace with:
```tsx
source={require('../../assets/img/reception.png')}
```

- [ ] **Step 2: Resize `techImage` style**

Find the `techImage` style entry:
```typescript
techImage: {
  width: 100,
  height: 50,
  borderRadius: 10,
  shadowColor: 'rgba(140,50,75,1)',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.22,
  shadowRadius: 4,
  elevation: 3,
},
```
Change to:
```typescript
techImage: {
  width: 70,
  height: 70,
  borderRadius: 10,
  shadowColor: 'rgba(140,50,75,1)',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.22,
  shadowRadius: 4,
  elevation: 3,
},
```

- [ ] **Step 3: Verify**

Run the app. Floor 1 (Hotel) shows new hotel.png at 70×70. Floor 0 (Lobby) shows reception.png at 70×70. No clipping or overflow.

- [ ] **Step 4: Commit**

```bash
git add src/components/TechnicalFloor.tsx
git commit -m "feat: swap hotel/reception images and resize to 70x70"
```

---

## Task 5: Warehouse — DB Schema & Server API

Add `PlayerTools` to Prisma, create tools on player registration, expose `GET /tools`.

**Files:**
- Modify: `server/prisma/schema.prisma`
- Modify: `server/src/player/player.service.ts`
- Create: `server/src/tools/tools.service.ts`
- Create: `server/src/tools/tools.controller.ts`
- Create: `server/src/tools/tools.module.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Produces: `GET /tools` → `{ briks: number; glass: number; nails: number; screw: number }` (JWT-protected)

- [ ] **Step 1: Add `PlayerTools` model to `server/prisma/schema.prisma`**

Append after the `Worker` model:
```prisma
model PlayerTools {
  id       Int    @id @default(autoincrement())
  playerId String @unique
  briks    Int    @default(1)
  glass    Int    @default(1)
  nails    Int    @default(1)
  screw    Int    @default(1)
  player   Player @relation(fields: [playerId], references: [id], onDelete: Cascade)
}
```

Add the reverse relation to the `Player` model:
```prisma
tools PlayerTools?
```

- [ ] **Step 2: Run Prisma migration**

```bash
cd server && npx prisma migrate dev --name add_player_tools
```

Expected: migration file created, DB updated with `PlayerTools` table.

- [ ] **Step 3: Update `server/src/player/player.service.ts`** — create PlayerTools inside the registration transaction

Inside `createWithInitialState`, add after the worker creation loop:
```typescript
await tx.playerTools.create({
  data: { playerId: player.id },
});
```

Full updated method:
```typescript
async createWithInitialState(email: string, passwordHash: string, playerName: string) {
  const workers = generateRandomWorkers(5, gameConfig);

  return this.prisma.$transaction(async (tx) => {
    const player = await tx.player.create({
      data: { email, passwordHash, playerName, balance: gameConfig.startingBalance },
    });

    for (const floorConfig of gameConfig.floors) {
      const floor = await tx.floor.create({
        data: { playerId: player.id, floorId: floorConfig.id },
      });
      const productions = floorConfig.availableTypes.map((typeId, i) => ({
        floorDbId: floor.id, slotIdx: i, typeId, stage: 'IDLE', stageStartedAt: BigInt(0),
      }));
      await tx.production.createMany({ data: productions });
    }

    for (const w of workers) {
      await tx.worker.create({
        data: {
          id: w.id, playerId: player.id, name: w.name, female: w.female,
          floorType: w.floorType, dreamJob: w.dreamJob, level: w.level,
          hairColor: w.hairColor, assignedFloorId: w.assignedFloorId,
          assignedSlotIdx: w.assignedSlotIdx,
        },
      });
    }

    await tx.playerTools.create({ data: { playerId: player.id } });

    return player;
  });
}
```

- [ ] **Step 4: Create `server/src/tools/tools.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ToolsService {
  constructor(private prisma: PrismaService) {}

  async getTools(playerId: string): Promise<{ briks: number; glass: number; nails: number; screw: number }> {
    const tools = await this.prisma.playerTools.findUnique({ where: { playerId } });
    if (!tools) return { briks: 1, glass: 1, nails: 1, screw: 1 };
    return { briks: tools.briks, glass: tools.glass, nails: tools.nails, screw: tools.screw };
  }
}
```

- [ ] **Step 5: Create `server/src/tools/tools.controller.ts`**

```typescript
import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ToolsService } from './tools.service';

@Controller('tools')
export class ToolsController {
  constructor(private toolsService: ToolsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getTools(@Req() req: { user: { playerId: string } }) {
    return this.toolsService.getTools(req.user.playerId);
  }
}
```

- [ ] **Step 6: Create `server/src/tools/tools.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ToolsController } from './tools.controller';
import { ToolsService } from './tools.service';

@Module({
  controllers: [ToolsController],
  providers: [ToolsService],
})
export class ToolsModule {}
```

- [ ] **Step 7: Register `ToolsModule` in `server/src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PlayerModule } from './player/player.module';
import { SyncModule } from './sync/sync.module';
import { ToolsModule } from './tools/tools.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    PlayerModule,
    SyncModule,
    ToolsModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 8: Run server tests**

```bash
cd server && npx jest
```

Expected: all existing tests pass. (The new endpoint has no unit tests yet — it is verified manually in Step 9.)

- [ ] **Step 9: Verify endpoint manually**

Start the server: `cd server && npm run start:dev`

Register a new account via auth endpoint, then:
```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/tools
```
Expected response:
```json
{"briks":1,"glass":1,"nails":1,"screw":1}
```

- [ ] **Step 10: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/ server/src/player/player.service.ts server/src/tools/ server/src/app.module.ts
git commit -m "feat: add PlayerTools DB model and GET /tools endpoint"
```

---

## Task 6: Warehouse — Client UI

Wire tool inventory into the game store, fetch from server on start, build sidebar + sheet UI.

**Files:**
- Modify: `src/stores/gameStore.ts`
- Modify: `src/services/sync.ts`
- Create: `src/components/WarehouseSidebar.tsx`
- Create: `src/components/WarehouseSheet.tsx`
- Modify: `app/(tabs)/game.tsx`

**Interfaces:**
- Consumes: `GET /tools` → `{ briks, glass, nails, screw }` (from Task 5)
- Produces: `useGameStore(s => s.toolInventory)` → `{ briks: number; glass: number; nails: number; screw: number }`

- [ ] **Step 1: Add `toolInventory` to `src/stores/gameStore.ts`**

Add the type inside the store interface section. Find `interface SyncState` and add **before** it:

```typescript
interface ToolInventory {
  briks: number;
  glass: number;
  nails: number;
  screw: number;
}
```

In `interface GameActions`, add:
```typescript
setToolInventory: (tools: ToolInventory) => void;
```

Change the `type GameStore` line to include `ToolInventory`:
```typescript
type GameStore = GameState & PlayerStats & SyncState & ToolInventory & GameActions;
```

In `create<GameStore>()(...)`, add the default state values (next to other state fields):
```typescript
briks: 1,
glass: 1,
nails: 1,
screw: 1,
```

Add the `setToolInventory` action inside the `create` callback:
```typescript
setToolInventory: (tools) => set(tools),
```

- [ ] **Step 2: Fetch tools on sync start in `src/services/sync.ts`**

Add an `import { api }` is already there. Add a helper function after the existing imports:

```typescript
async function fetchTools(): Promise<void> {
  if (!useAuthStore.getState().isAuthenticated) return;
  try {
    const tools = await api.get<{ briks: number; glass: number; nails: number; screw: number }>('/tools');
    useGameStore.getState().setToolInventory(tools);
  } catch {
    // Network error — keep defaults
  }
}
```

In the `syncService.start` function, call `fetchTools()` right after `doSync()`:
```typescript
start: () => {
  scheduleSync();
  appStateSubscription = AppState.addEventListener('change', handleAppState);
  doSync();
  fetchTools();
},
```

- [ ] **Step 3: Create `src/components/WarehouseSheet.tsx`**

```typescript
import React, { useEffect } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useGameStore } from '../stores/gameStore';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const TIMING = { duration: 400, easing: Easing.bezier(0.4, 0, 0.2, 1) };

const TOOLS: { key: 'briks' | 'glass' | 'nails' | 'screw'; label: string; image: ReturnType<typeof require> }[] = [
  { key: 'briks',  label: 'Цегла',   image: require('../../assets/img/tools/briks.png') },
  { key: 'glass',  label: 'Скло',    image: require('../../assets/img/tools/glass.png') },
  { key: 'nails',  label: 'Цвяхи',   image: require('../../assets/img/tools/nails.png') },
  { key: 'screw',  label: 'Шурупи',  image: require('../../assets/img/tools/screw.png') },
];

interface WarehouseSheetProps {
  visible: boolean;
  onClose: () => void;
}

export default function WarehouseSheet({ visible, onClose }: WarehouseSheetProps) {
  const scrimOpacity = useSharedValue(0);
  const translateY = useSharedValue(100);
  const briks = useGameStore((s) => s.briks);
  const glass = useGameStore((s) => s.glass);
  const nails = useGameStore((s) => s.nails);
  const screw = useGameStore((s) => s.screw);

  const counts: Record<string, number> = { briks, glass, nails, screw };

  useEffect(() => {
    if (visible) {
      scrimOpacity.value = withTiming(1, { duration: 300, easing: Easing.linear });
      translateY.value = withTiming(0, TIMING);
    } else {
      scrimOpacity.value = withTiming(0, { duration: 280, easing: Easing.linear });
      translateY.value = withTiming(100, TIMING);
    }
  }, [visible]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrimOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (translateY.value / 100) * SCREEN_HEIGHT }],
  }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.scrim, scrimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View style={[styles.sheet, sheetStyle]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.handle} />
            <View style={styles.titleRow}>
              <Image
                source={require('../../assets/img/werehouse.png')}
                style={{ width: 28, height: 28 }}
                contentFit="contain"
              />
              <Text style={styles.title}>Склад</Text>
              <Pressable onPress={onClose} style={styles.closeBtn}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
                </Svg>
              </Pressable>
            </View>
          </View>

          {/* Tool list */}
          <View style={styles.body}>
            {TOOLS.map((tool) => (
              <View key={tool.key} style={styles.row}>
                <Image source={tool.image} style={{ width: 36, height: 36 }} contentFit="contain" />
                <Text style={styles.toolLabel}>{tool.label}</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{counts[tool.key]}</Text>
                </View>
              </View>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18,26,44,0.5)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: '#EAEDF2',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#5B6472',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingBottom: 16,
  },
  handle: {
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 10,
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    gap: 10,
  },
  title: {
    flex: 1,
    fontFamily: 'Fredoka_700Bold',
    fontSize: 18,
    color: '#fff',
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  body: {
    padding: 16,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    gap: 14,
  },
  toolLabel: {
    flex: 1,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    color: '#2A3344',
  },
  countBadge: {
    backgroundColor: '#F0F2F5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  countText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 15,
    color: '#5B6472',
  },
});
```

- [ ] **Step 4: Create `src/components/WarehouseSidebar.tsx`**

```typescript
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useGameStore } from '../stores/gameStore';
import WarehouseSheet from './WarehouseSheet';

const TOOL_IMAGES: { key: 'briks' | 'glass' | 'nails' | 'screw'; image: ReturnType<typeof require> }[] = [
  { key: 'briks', image: require('../../assets/img/tools/briks.png') },
  { key: 'glass', image: require('../../assets/img/tools/glass.png') },
  { key: 'nails', image: require('../../assets/img/tools/nails.png') },
  { key: 'screw', image: require('../../assets/img/tools/screw.png') },
];

export default function WarehouseSidebar() {
  const [open, setOpen] = useState(false);
  const briks = useGameStore((s) => s.briks);
  const glass = useGameStore((s) => s.glass);
  const nails = useGameStore((s) => s.nails);
  const screw = useGameStore((s) => s.screw);
  const counts: Record<string, number> = { briks, glass, nails, screw };

  return (
    <>
      <View style={styles.sidebar}>
        {/* Warehouse icon */}
        <Pressable onPress={() => setOpen(true)} style={styles.iconWrap} hitSlop={8}>
          <Image
            source={require('../../assets/img/werehouse.png')}
            style={{ width: 26, height: 26 }}
            contentFit="contain"
          />
        </Pressable>

        {/* Tool icons */}
        {TOOL_IMAGES.map(({ key, image }) => (
          <Pressable key={key} onPress={() => setOpen(true)} style={styles.toolWrap} hitSlop={8}>
            <Image source={image} style={{ width: 22, height: 22 }} contentFit="contain" />
            <Text style={styles.count}>{counts[key]}</Text>
          </Pressable>
        ))}
      </View>

      <WarehouseSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 40,
    flex: 1,
    alignItems: 'center',
    paddingTop: 160,
    paddingBottom: 90,
    gap: 14,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  toolWrap: {
    alignItems: 'center',
    gap: 2,
  },
  count: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 9,
    color: 'rgba(255,255,255,0.9)',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
```

- [ ] **Step 5: Update `app/(tabs)/game.tsx`**

1. Add import:
```typescript
import WarehouseSidebar from '../../src/components/WarehouseSidebar';
```

2. Change `sideRight` style from `width: 0` to `width: 40`:
```typescript
sideRight: {
  width: 40,
},
```

3. Inside the `<View style={styles.sideRight} />`, replace it with:
```tsx
<View style={styles.sideRight}>
  <WarehouseSidebar />
</View>
```

- [ ] **Step 6: Verify**

Run the app. The right side of the tower should show a 40px column with the warehouse icon and 4 tool icons with `1` counts. Tapping any opens the bottom sheet. Counts match DB values after login.

- [ ] **Step 7: Commit**

```bash
git add src/stores/gameStore.ts src/services/sync.ts src/components/WarehouseSidebar.tsx src/components/WarehouseSheet.tsx app/(tabs)/game.tsx
git commit -m "feat: add warehouse sidebar with tool inventory and bottom sheet"
```

---

## Task 7: Discord Icon on WelcomeScreen

Add a vertically-centred Discord icon on the left edge of the welcome screen.

**Files:**
- Modify: `src/screens/WelcomeScreen.tsx`

**Interfaces:**
- No interface changes.

- [ ] **Step 1: Add `Linking` import**

At the top of `src/screens/WelcomeScreen.tsx`, add `Linking` to the existing react-native import:
```typescript
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, Linking } from 'react-native';
```

- [ ] **Step 2: Add Discord button JSX inside `WelcomeScreen` return**

Place it after the gradient overlay and before `{/* Logo */}`:
```tsx
{/* Discord button */}
<View style={styles.discordWrapper} pointerEvents="box-none">
  <Pressable
    onPress={() => Linking.openURL('https://discord.com/channels/1521796294270517260/1521882117208932483')}
    style={({ pressed }) => [styles.discordButton, pressed && { opacity: 0.75 }]}
  >
    <Image
      source={require('../../assets/img/discord.png')}
      style={{ width: 44, height: 44 }}
      contentFit="contain"
    />
  </Pressable>
</View>
```

- [ ] **Step 3: Add styles**

Inside `StyleSheet.create({...})`, add:
```typescript
discordWrapper: {
  position: 'absolute',
  left: 16,
  top: 0,
  bottom: 0,
  zIndex: 2,
  justifyContent: 'center',
  pointerEvents: 'box-none',
},
discordButton: {
  width: 52,
  height: 52,
  borderRadius: 14,
  backgroundColor: 'rgba(255,255,255,0.18)',
  alignItems: 'center',
  justifyContent: 'center',
},
```

- [ ] **Step 4: Verify**

Run the app. Welcome screen shows a Discord icon on the left side, vertically centred. Tapping it opens the Discord link in the device browser/app.

- [ ] **Step 5: Commit**

```bash
git add src/screens/WelcomeScreen.tsx
git commit -m "feat: add Discord icon to WelcomeScreen"
```

---

## Self-Review Checklist

### Spec coverage
- [x] Task 1: floor type rename (teal→blue, amber→yellow, purple→violet, blue→red)
- [x] Task 2: WorkerAvatar SVG → PNG, male/female by floorType color
- [x] Task 3: builder.png in BuyFloorBanner replacing PlusIcon
- [x] Task 4: hotel.png + reception.png, 70×70
- [x] Task 5: PlayerTools Prisma model, GET /tools, PlayerTools created on registration
- [x] Task 6: toolInventory in gameStore, fetched on sync start, WarehouseSidebar (40px), WarehouseSheet (bottom sheet)
- [x] Task 7: Discord icon left side vertically centred with link

### No placeholders
Confirmed — every step has explicit code or a CLI command.

### Type consistency
- `ToolInventory` type defined in Task 6 Step 1 and consumed in `WarehouseSidebar` / `WarehouseSheet` via `useGameStore(s => s.briks)` etc.
- `TOOLS` array in `WarehouseSheet` and `TOOL_IMAGES` in `WarehouseSidebar` both use `'briks' | 'glass' | 'nails' | 'screw'` — matches Prisma model field names exactly.
- `fetchTools()` in `sync.ts` calls `setToolInventory` which spreads `{ briks, glass, nails, screw }` — matches the store state fields.
