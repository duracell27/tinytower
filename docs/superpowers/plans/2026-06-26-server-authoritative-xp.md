# Server-Authoritative XP & Level Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move XP/level computation to the server, store in dedicated DB columns, remove client trust.

**Architecture:** Shared `xp.ts` module holds the formula used by both sides. The server computes XP from accepted commands, persists to `playerLevel`/`playerXp` columns on `Player`, and returns authoritative values. The client keeps optimistic local computation only for instant ring animation; server values override on every reconcile.

**Tech Stack:** TypeScript, NestJS, Prisma (PostgreSQL), Zustand, React Native, Jest

## Global Constraints

- `xpForLevel(level) = Math.floor(100 * Math.pow(1.5, level - 1))` — formula must be identical in shared and any copy
- XP per command = `Math.abs(nextBalance - prevBalance) + (cmd.type === 'list' ? 10 : 0)`
- Level-up coin reward = `newLevel * 100`; gem reward = `newLevel * 3`
- Run server tests from `server/` directory: `cd server && npx jest`
- Run shared/client tests from root: `npx jest`
- TypeScript check client: `npx tsc --noEmit` (one deprecation warning is pre-existing, ignore it)
- TypeScript check server: `cd server && npx tsc --noEmit`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `shared/engine/xp.ts` | **Create** | XP formula, `applyXpGain`, `xpForCommand` — single source of truth |
| `shared/engine/__tests__/xp.test.ts` | **Create** | Unit tests for xp.ts |
| `server/prisma/schema.prisma` | **Modify** | Add `playerLevel Int @default(1)` and `playerXp Int @default(0)` |
| `server/prisma/migrations/…/migration.sql` | **Edit after generate** | Add UPDATE to migrate existing JSON blob values |
| `server/src/sync/sync.service.ts` | **Modify** | Remove client params, use DB level, compute XP server-side |
| `server/src/sync/sync.controller.ts` | **Modify** | Remove playerLevel/playerXp from SyncRequestSchema |
| `server/src/sync/__tests__/sync.service.spec.ts` | **Modify** | Add playerLevel/playerXp to mockPlayer, update calls, add XP tests |
| `src/stores/gameStore.ts` | **Modify** | Import xpForLevel + LevelUpEvent from shared, remove local definitions |
| `src/services/sync.ts` | **Modify** | Remove playerLevel/playerXp from POST body |

---

## Task 1: Shared XP engine

**Files:**
- Create: `shared/engine/xp.ts`
- Create: `shared/engine/__tests__/xp.test.ts`

**Interfaces:**
- Produces:
  - `xpForLevel(level: number): number`
  - `xpForCommand(cmdType: string, prevBalance: number, nextBalance: number): number`
  - `applyXpGain(playerLevel: number, playerXp: number, xpGained: number): XpResult`
  - `interface XpResult { playerLevel: number; playerXp: number; bonusCoins: number; bonusGems: number; levelUpEvents: LevelUpEvent[] }`
  - `interface LevelUpEvent { newLevel: number; coinReward: number; gemReward: number }`

- [ ] **Step 1: Write the failing tests**

Create `shared/engine/__tests__/xp.test.ts`:

```ts
import { xpForLevel, xpForCommand, applyXpGain } from '../xp';

describe('xpForLevel', () => {
  it('returns 100 for level 1', () => {
    expect(xpForLevel(1)).toBe(100);
  });

  it('returns 150 for level 2', () => {
    expect(xpForLevel(2)).toBe(150);
  });

  it('returns 225 for level 3', () => {
    expect(xpForLevel(3)).toBe(225);
  });
});

describe('xpForCommand', () => {
  it('returns abs coin delta for non-list commands', () => {
    expect(xpForCommand('collect', 100, 125)).toBe(25);
    expect(xpForCommand('buy', 100, 90)).toBe(10);
  });

  it('adds 10 bonus for list command', () => {
    expect(xpForCommand('list', 100, 100)).toBe(10);
    expect(xpForCommand('list', 100, 110)).toBe(20);
  });
});

describe('applyXpGain', () => {
  it('accumulates XP without levelling up', () => {
    const result = applyXpGain(1, 50, 30);
    expect(result.playerLevel).toBe(1);
    expect(result.playerXp).toBe(80);
    expect(result.bonusCoins).toBe(0);
    expect(result.bonusGems).toBe(0);
    expect(result.levelUpEvents).toHaveLength(0);
  });

  it('triggers level-up when XP reaches threshold', () => {
    // xpForLevel(1) = 100, so 0 + 100 = exactly at threshold => level up
    const result = applyXpGain(1, 0, 100);
    expect(result.playerLevel).toBe(2);
    expect(result.playerXp).toBe(0);
    expect(result.bonusCoins).toBe(200); // newLevel * 100
    expect(result.bonusGems).toBe(6);   // newLevel * 3
    expect(result.levelUpEvents).toHaveLength(1);
    expect(result.levelUpEvents[0]).toEqual({ newLevel: 2, coinReward: 200, gemReward: 6 });
  });

  it('handles multiple level-ups in one batch', () => {
    // From level 1, gain enough XP to jump to level 3
    // xpForLevel(1) = 100, xpForLevel(2) = 150 → need 250 total
    const result = applyXpGain(1, 0, 260);
    expect(result.playerLevel).toBe(3);
    expect(result.levelUpEvents).toHaveLength(2);
  });

  it('carries over remaining XP after level-up', () => {
    // xpForLevel(1) = 100; gain 110 → level up, 10 XP left
    const result = applyXpGain(1, 0, 110);
    expect(result.playerLevel).toBe(2);
    expect(result.playerXp).toBe(10);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest shared/engine/__tests__/xp.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../xp'`

- [ ] **Step 3: Create `shared/engine/xp.ts`**

```ts
import type { Command, GameState } from '../types';

export interface LevelUpEvent {
  newLevel: number;
  coinReward: number;
  gemReward: number;
}

export interface XpResult {
  playerLevel: number;
  playerXp: number;
  bonusCoins: number;
  bonusGems: number;
  levelUpEvents: LevelUpEvent[];
}

export function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

export function xpForCommand(
  cmdType: string,
  prevBalance: number,
  nextBalance: number,
): number {
  const coinDelta = Math.abs(nextBalance - prevBalance);
  const listBonus = cmdType === 'list' ? 10 : 0;
  return coinDelta + listBonus;
}

export function applyXpGain(
  playerLevel: number,
  playerXp: number,
  xpGained: number,
): XpResult {
  let level = playerLevel;
  let xp = playerXp + xpGained;
  let bonusCoins = 0;
  let bonusGems = 0;
  const levelUpEvents: LevelUpEvent[] = [];

  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level++;
    const coinReward = level * 100;
    const gemReward = level * 3;
    bonusCoins += coinReward;
    bonusGems += gemReward;
    levelUpEvents.push({ newLevel: level, coinReward, gemReward });
  }

  return { playerLevel: level, playerXp: xp, bonusCoins, bonusGems, levelUpEvents };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest shared/engine/__tests__/xp.test.ts --no-coverage
```

Expected: PASS — 9 tests

- [ ] **Step 5: Commit**

```bash
git add shared/engine/xp.ts shared/engine/__tests__/xp.test.ts
git commit -m "feat(shared): add server-authoritative XP engine"
```

---

## Task 2: Prisma migration — dedicated DB columns

**Files:**
- Modify: `server/prisma/schema.prisma`
- Edit: generated migration SQL file (path shown after `migrate dev --create-only`)

**Interfaces:**
- Produces: `player.playerLevel: number` and `player.playerXp: number` accessible in Prisma queries

- [ ] **Step 1: Add columns to schema**

Edit `server/prisma/schema.prisma`, add two lines to the `Player` model after `stateVersion`:

```prisma
model Player {
  id            String    @id @default(uuid())
  email         String    @unique
  passwordHash  String
  playerName    String
  balance       Int       @default(100)
  lobbyState    Json?
  stateVersion  Int       @default(0)
  playerLevel   Int       @default(1)
  playerXp      Int       @default(0)
  lastSeenAt    DateTime  @default(now())
  createdAt     DateTime  @default(now())
  floors        Floor[]
  workers       Worker[]
}
```

- [ ] **Step 2: Generate migration without running it**

```bash
cd server && npx prisma migrate dev --name add_player_level_xp --create-only
```

This prints the path of the generated migration file, e.g.:
`server/prisma/migrations/20260626XXXXXX_add_player_level_xp/migration.sql`

- [ ] **Step 3: Edit the migration SQL to copy existing JSON values**

Open the generated `migration.sql` and append after the ALTER TABLE statements:

```sql
-- Migrate existing playerLevel/playerXp from lobbyState JSON blob to columns
UPDATE "Player"
SET
  "playerLevel" = COALESCE(("lobbyState"->>'playerLevel')::int, 1),
  "playerXp"    = COALESCE(("lobbyState"->>'playerXp')::int, 0)
WHERE "lobbyState" IS NOT NULL
  AND ("lobbyState"->>'playerLevel' IS NOT NULL
    OR "lobbyState"->>'playerXp' IS NOT NULL);
```

- [ ] **Step 4: Apply the migration**

```bash
cd server && npx prisma migrate dev
```

Expected output ends with: `Your database is now in sync with your schema.`

- [ ] **Step 5: Regenerate Prisma client**

```bash
cd server && npx prisma generate
```

- [ ] **Step 6: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/
git commit -m "feat(db): add playerLevel and playerXp columns to Player"
```

---

## Task 3: Server sync — compute XP from accepted commands

**Files:**
- Modify: `server/src/sync/sync.service.ts`
- Modify: `server/src/sync/sync.controller.ts`
- Modify: `server/src/sync/__tests__/sync.service.spec.ts`

**Interfaces:**
- Consumes: `xpForCommand`, `applyXpGain`, `LevelUpEvent`, `XpResult` from `shared/engine/xp`
- `processSync(playerId, commands, lastAckCursor)` — 3 params, no more playerLevel/playerXp
- `SyncResult.playerLevel: number`, `SyncResult.playerXp: number` — unchanged

- [ ] **Step 1: Update the test file first (TDD)**

Replace the top of `server/src/sync/__tests__/sync.service.spec.ts` mock player object — add the two new fields. Find this block:

```ts
  const mockPlayer = {
    id: 'player-uuid',
    balance: 100,
    lobbyState: null,
    stateVersion: 0,
    lastSeenAt: new Date(),
    createdAt: new Date(),
    floors: mockFloors,
    workers: mockWorkers,
  };
```

Replace with:

```ts
  const mockPlayer = {
    id: 'player-uuid',
    balance: 100,
    lobbyState: null,
    stateVersion: 0,
    playerLevel: 1,
    playerXp: 0,
    lastSeenAt: new Date(),
    createdAt: new Date(),
    floors: mockFloors,
    workers: mockWorkers,
  };
```

- [ ] **Step 2: Update existing processSync call sites in the test**

All calls in the test file currently pass 3 args (`'player-uuid', [], 0`) — these stay the same after removing the optional params. No call site changes needed.

- [ ] **Step 3: Add XP tests to the test file**

At the end of the `describe('processSync', ...)` block, add:

```ts
    it('should return playerLevel and playerXp from DB', async () => {
      const playerWithLevel = { ...mockPlayer, playerLevel: 3, playerXp: 50 };
      prisma.player.findUnique
        .mockResolvedValueOnce(playerWithLevel)
        .mockResolvedValueOnce({ ...playerWithLevel });

      const result = await syncService.processSync('player-uuid', [], 0);

      expect(result.playerLevel).toBe(3);
      expect(result.playerXp).toBe(50);
    });

    it('should accumulate XP from accepted commands and return updated level', async () => {
      // balance 100 → collect command earns 25 coins → XP = 25
      // starting at level 1 with 80 XP: 80 + 25 = 105 >= xpForLevel(1)=100 → level up to 2
      const playerNearLevelUp = { ...mockPlayer, playerLevel: 1, playerXp: 80, balance: 100 };
      const playerAfterTx = {
        ...playerNearLevelUp,
        playerLevel: 2,
        playerXp: 5,       // 80 + 25 - 100 = 5
        balance: 325,      // 100 (original) + 25 (collect) + 200 (level-up coin reward for level 2)
        stateVersion: 1,
      };

      prisma.player.findUnique
        .mockResolvedValueOnce(playerNearLevelUp)
        .mockResolvedValueOnce(playerAfterTx);

      // A collect command on floor 2, slot 0 (worker-1 is assigned there)
      // Production must be in SELLING stage — mock a player whose production is SELLING
      const sellingPlayer = {
        ...playerNearLevelUp,
        floors: [
          {
            ...mockFloors[0],
            productions: [
              { id: 1, floorDbId: 1, slotIdx: 0, typeId: 'bulky', stage: 'SELLING', stageStartedAt: BigInt(0) },
              mockFloors[0].productions[1],
              mockFloors[0].productions[2],
            ],
          },
          ...mockFloors.slice(1),
        ],
      };
      prisma.player.findUnique
        .mockReset()
        .mockResolvedValueOnce(sellingPlayer)
        .mockResolvedValueOnce(playerAfterTx);

      const collectCmd: Command = {
        id: 'cmd-collect',
        type: 'collect',
        floorId: 2,
        slotIdx: 0,
        timestamp: Date.now() + 999_999,
      };

      const result = await syncService.processSync('player-uuid', [collectCmd], 0);

      expect(result.playerLevel).toBe(2);
      expect(result.playerXp).toBe(5);
    });
```

- [ ] **Step 4: Run the tests — confirm new tests fail, existing tests pass**

```bash
cd server && npx jest src/sync/__tests__/sync.service.spec.ts --no-coverage
```

Expected: existing tests PASS, new XP tests FAIL (processSync still takes old params / doesn't compute XP).

- [ ] **Step 5: Update `sync.controller.ts` — remove client params from schema**

In `server/src/sync/sync.controller.ts`, find `SyncRequestSchema`:

```ts
const SyncRequestSchema = z.object({
  commands: z.array(CommandSchema),
  lastAckCursor: z.number().int().nonnegative(),
  playerLevel: z.number().int().positive().optional(),
  playerXp: z.number().int().nonnegative().optional(),
});
```

Replace with:

```ts
const SyncRequestSchema = z.object({
  commands: z.array(CommandSchema),
  lastAckCursor: z.number().int().nonnegative(),
});
```

Also remove the two lines passing `result.data.playerLevel` and `result.data.playerXp` to `syncService.processSync`:

```ts
    return this.syncService.processSync(
      req.user.playerId,
      result.data.commands,
      result.data.lastAckCursor,
    );
```

- [ ] **Step 6: Rewrite `sync.service.ts`**

Replace the full `sync.service.ts` with:

```ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { processCommand } from '@shared/engine/processCommand';
import { xpForCommand, applyXpGain } from '@shared/engine/xp';
import { gameConfig } from '@shared/config/gameConfig';
import type { GameState, Command, Floor, Production, Worker } from '@shared/types';

interface LobbyStateJson {
  [key: string]: unknown;
}

export interface SyncResult {
  state: GameState;
  stateVersion: number;
  ackCursor: number;
  serverTime: number;
  playerLevel: number;
  playerXp: number;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(private prisma: PrismaService) {}

  async processSync(
    playerId: string,
    commands: Command[],
    lastAckCursor: number,
  ): Promise<SyncResult> {
    const serverNow = Date.now();

    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      include: { floors: { include: { productions: true } }, workers: true },
    });

    if (!player) throw new NotFoundException('Player not found');

    const existingIds = new Set(
      (
        await this.prisma.commandLog.findMany({
          where: { playerId, id: { in: commands.map((c) => c.id) } },
          select: { id: true },
        })
      ).map((r) => r.id),
    );

    const newCommands = commands.filter(
      (c) => !existingIds.has(c.id) && c.timestamp > lastAckCursor,
    );

    let gameState = this.dbToGameState(player);
    const acceptedCommands: Command[] = [];
    let totalXpGained = 0;

    for (const command of newCommands) {
      const prevBalance = gameState.balance;
      const result = processCommand(gameState, command, gameConfig, serverNow, player.playerLevel);
      if (result.success) {
        totalXpGained += xpForCommand(command.type, prevBalance, result.state.balance);
        gameState = result.state;
        acceptedCommands.push(command);
      } else {
        this.logger.warn(`Command rejected [${command.type}]: ${result.error}`);
      }
    }

    const xpResult = applyXpGain(player.playerLevel, player.playerXp, totalXpGained);
    gameState = {
      ...gameState,
      balance: gameState.balance + xpResult.bonusCoins,
      gems: gameState.gems + xpResult.bonusGems,
    };

    let ackCursor = lastAckCursor;

    if (acceptedCommands.length > 0 || newCommands.length === 0) {
      await this.prisma.$transaction(async (tx) => {
        const existingLs = (player.lobbyState as LobbyStateJson) ?? {};
        await tx.player.update({
          where: { id: playerId },
          data: {
            balance: gameState.balance,
            playerLevel: xpResult.playerLevel,
            playerXp: xpResult.playerXp,
            lobbyState: {
              ...existingLs,
              gems: gameState.gems,
              lobbyVisitors: gameState.lobbyVisitors,
              lobbyCapacity: gameState.lobbyCapacity,
              elevatorLevel: gameState.elevatorLevel,
              elevatorFloor: gameState.elevatorFloor,
              dailyTips: gameState.dailyTips,
              dailyGemsCollected: gameState.dailyGemsCollected,
              dailyTipsRewardClaimed: gameState.dailyTipsRewardClaimed,
              lastDailyReset: gameState.lastDailyReset,
              nextVisitorAt: gameState.nextVisitorAt,
            },
            stateVersion: {
              increment: acceptedCommands.length > 0 ? 1 : 0,
            },
            lastSeenAt: new Date(serverNow),
          },
        });

        for (const floor of gameState.floors) {
          const dbFloor = player.floors.find((f) => f.floorId === floor.id);
          if (!dbFloor) continue;

          for (let i = 0; i < floor.productions.length; i++) {
            const prod = floor.productions[i];
            await tx.production.update({
              where: {
                floorDbId_slotIdx: { floorDbId: dbFloor.id, slotIdx: i },
              },
              data: {
                typeId: prod.typeId,
                stage: prod.stage,
                stageStartedAt: BigInt(prod.stageStartedAt),
              },
            });
          }
        }

        for (const w of gameState.workers) {
          await tx.worker.upsert({
            where: { id: w.id },
            update: {
              assignedFloorId: w.assignedFloorId,
              assignedSlotIdx: w.assignedSlotIdx,
            },
            create: {
              id: w.id,
              playerId,
              name: w.name,
              female: w.female,
              floorType: w.floorType,
              dreamJob: w.dreamJob,
              level: w.level,
              hairColor: w.hairColor,
              assignedFloorId: w.assignedFloorId,
              assignedSlotIdx: w.assignedSlotIdx,
            },
          });
        }

        const currentWorkerIds = gameState.workers.map((w) => w.id);
        const dbWorkerIds = (player.workers as any[]).map((w) => w.id);
        const evictedIds = dbWorkerIds.filter((id: string) => !currentWorkerIds.includes(id));
        if (evictedIds.length > 0) {
          await tx.worker.deleteMany({ where: { id: { in: evictedIds } } });
        }

        if (acceptedCommands.length > 0) {
          for (const cmd of acceptedCommands) {
            const logEntry = await tx.commandLog.create({
              data: {
                id: cmd.id,
                playerId,
                type: cmd.type,
                floorId: 'floorId' in cmd ? cmd.floorId : null,
                slotIdx: 'slotIdx' in cmd ? cmd.slotIdx : null,
                typeId: cmd.type === 'buy' ? (cmd as any).typeId : null,
                workerId: 'workerId' in cmd ? (cmd as any).workerId : null,
                timestamp: BigInt(cmd.timestamp),
                serverTime: BigInt(serverNow),
              },
            });
            ackCursor = logEntry.cursor;
          }
        }
      });
    }

    const updatedPlayer = await this.prisma.player.findUnique({
      where: { id: playerId },
    });

    return {
      state: gameState,
      stateVersion: updatedPlayer?.stateVersion ?? player.stateVersion,
      ackCursor,
      serverTime: serverNow,
      playerLevel: updatedPlayer?.playerLevel ?? xpResult.playerLevel,
      playerXp: updatedPlayer?.playerXp ?? xpResult.playerXp,
    };
  }

  private dbToGameState(player: any): GameState {
    const floors: Floor[] = player.floors.map((f: any) => ({
      id: f.floorId,
      name:
        gameConfig.floors.find((gc) => gc.id === f.floorId)?.name ??
        `Floor ${f.floorId}`,
      productions: f.productions.map(
        (p: any): Production => ({
          typeId: p.typeId,
          stage: p.stage,
          stageStartedAt: Number(p.stageStartedAt),
        }),
      ),
    }));

    const workers: Worker[] = (player.workers ?? []).map((w: any): Worker => ({
      id: w.id,
      name: w.name,
      female: w.female,
      floorType: w.floorType,
      dreamJob: w.dreamJob,
      level: w.level,
      hairColor: w.hairColor,
      assignedFloorId: w.assignedFloorId ?? null,
      assignedSlotIdx: w.assignedSlotIdx ?? null,
    }));

    const ls = (player.lobbyState as LobbyStateJson) ?? {};
    return {
      balance: player.balance,
      gems: (ls.gems as number) ?? 20,
      floors,
      commandQueue: [],
      workers,
      hotelCapacity: player.hotelCapacity ?? 10,
      lobbyVisitors: (ls.lobbyVisitors as any[]) ?? [],
      lobbyCapacity: (ls.lobbyCapacity as number) ?? 10,
      elevatorLevel: (ls.elevatorLevel as number) ?? 1,
      elevatorFloor: (ls.elevatorFloor as number) ?? 0,
      dailyTips: (ls.dailyTips as number) ?? 0,
      dailyGemsCollected: (ls.dailyGemsCollected as number) ?? 0,
      dailyTipsRewardClaimed: (ls.dailyTipsRewardClaimed as boolean) ?? false,
      lastDailyReset: (ls.lastDailyReset as number) ?? 0,
      nextVisitorAt: (ls.nextVisitorAt as number) ?? 0,
    };
  }
}
```

- [ ] **Step 7: Run all server tests**

```bash
cd server && npx jest --no-coverage
```

Expected: all tests PASS including the new XP tests.

- [ ] **Step 8: TypeScript check server**

```bash
cd server && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 9: Commit**

```bash
git add server/src/sync/sync.service.ts server/src/sync/sync.controller.ts server/src/sync/__tests__/sync.service.spec.ts
git commit -m "feat(server): compute XP/level server-side from accepted commands"
```

---

## Task 4: Client cleanup

**Files:**
- Modify: `src/stores/gameStore.ts`
- Modify: `src/services/sync.ts`

**Interfaces:**
- Consumes: `xpForLevel`, `LevelUpEvent` from `shared/engine/xp`

- [ ] **Step 1: Update `gameStore.ts` — import from shared, remove local definitions**

At the top of `src/stores/gameStore.ts`, add the import (after existing imports):

```ts
import { xpForLevel, applyXpGain, type LevelUpEvent } from '../../shared/engine/xp';
```

Then remove the local `LevelUpEvent` interface (currently in the store's interface block), the local `xpForLevel` function definition, and the manual `while` loop in `executeCommand`. Replace the entire XP block inside `executeCommand`:

Find this block (lines ~84-99 in gameStore.ts):

```ts
  const coinDelta = Math.abs(result.state.balance - balance);
  const listBonus = command.type === 'list' ? 10 : 0;
  let { playerXp, playerLevel } = store;
  let newBalance = result.state.balance;
  let newGems = result.state.gems;
  const levelUps: LevelUpEvent[] = [];
  playerXp += coinDelta + listBonus;
  while (playerXp >= xpForLevel(playerLevel)) {
    playerXp -= xpForLevel(playerLevel);
    playerLevel++;
    const coinReward = playerLevel * 100;
    const gemReward = playerLevel * 3;
    newBalance += coinReward;
    newGems += gemReward;
    levelUps.push({ newLevel: playerLevel, coinReward, gemReward });
  }
```

Replace with:

```ts
  const xpGained = Math.abs(result.state.balance - balance) + (command.type === 'list' ? 10 : 0);
  const xpResult = applyXpGain(store.playerLevel, store.playerXp, xpGained);
  let newBalance = result.state.balance + xpResult.bonusCoins;
  let newGems = result.state.gems + xpResult.bonusGems;
  const levelUps: LevelUpEvent[] = xpResult.levelUpEvents;
```

Then update the `set({...})` call that follows — replace `playerXp` and `playerLevel` fields:

```ts
    playerXp: xpResult.playerXp,
    playerLevel: xpResult.playerLevel,
```

Also remove the now-unused local `LevelUpEvent` interface from the store's `PlayerStats` interface block — it's now imported from shared.

Also remove the local `xpForLevel` function (lines ~57-59 in gameStore.ts).

- [ ] **Step 2: Update `sync.ts` — remove playerLevel/playerXp from request**

In `src/services/sync.ts`, find:

```ts
  const { commandQueue, lastAckCursor, playerLevel, playerXp } = useGameStore.getState();
```

Replace with:

```ts
  const { commandQueue, lastAckCursor } = useGameStore.getState();
```

Find:

```ts
    const response = await api.post<SyncResponse>('/sync', {
      commands: commandQueue,
      lastAckCursor,
      playerLevel,
      playerXp,
    });
```

Replace with:

```ts
    const response = await api.post<SyncResponse>('/sync', {
      commands: commandQueue,
      lastAckCursor,
    });
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: same pre-existing deprecation warning, 0 type errors.

- [ ] **Step 4: Run client/shared tests**

```bash
npx jest --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/gameStore.ts src/services/sync.ts shared/engine/xp.ts
git commit -m "feat(client): import XP engine from shared, remove level from sync payload"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| `playerLevel`/`playerXp` as proper DB columns | Task 2 |
| Migrate existing JSON blob values to columns | Task 2, Step 3 |
| Server reads level from DB, not client | Task 3, Step 6 (uses `player.playerLevel`) |
| Server computes XP from accepted commands | Task 3, Step 6 (`xpForCommand` loop) |
| Level-up rewards applied server-side | Task 3, Step 6 (`xpResult.bonusCoins/bonusGems` added to gameState) |
| Client no longer sends level in payload | Task 4, Step 2 |
| Client uses shared `xpForLevel` formula | Task 4, Step 1 |
| Instant ring animation preserved | Task 4, Step 1 (optimistic `applyXpGain` call kept in `executeCommand`) |
| Server response returns authoritative level | Task 3 (`SyncResult.playerLevel` from `updatedPlayer`) |
| `commandLog` provides audit trail | Pre-existing — no change needed |

**Placeholder scan:** None found.

**Type consistency:**
- `LevelUpEvent` defined in `shared/engine/xp.ts` (Task 1), imported in `gameStore.ts` (Task 4) ✓
- `xpForLevel` defined in `shared/engine/xp.ts` (Task 1), removed from `gameStore.ts` (Task 4) ✓
- `processSync(playerId, commands, lastAckCursor)` — 3 params in controller (Task 3, Step 5), service (Task 3, Step 6), and all test calls (Task 3, Step 2) ✓
- `player.playerLevel` / `player.playerXp` — Prisma columns added in Task 2, read in Task 3 ✓
