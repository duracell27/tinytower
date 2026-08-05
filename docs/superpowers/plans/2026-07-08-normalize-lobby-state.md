# Normalize lobbyState Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `lobbyState Json?` blob in the `Player` table with three properly typed tables (`PlayerState`, `FloorConstruction`, `PlayerFloorType`) and remove the dead `PlayerTools` table.

**Architecture:** Schema migration first (Prisma + manual data migration SQL), then server code refactor (`dbToGameState` + sync write transaction + player creation), then delete the obsolete tools module. Client code is untouched — `GameState` type is unchanged.

**Tech Stack:** NestJS, Prisma 6, PostgreSQL, Jest

## Global Constraints

- No changes to `shared/` — `GameState` TypeScript type stays the same
- No changes to client (`src/`, `app/`) — only `server/` is touched
- All existing tests must pass after each task
- `BigInt` in DB for timestamps; `Number()` conversion when reading into GameState
- Run tests from `server/` directory: `cd server && npm test`

---

## File Map

| File | Action |
|---|---|
| `server/prisma/schema.prisma` | Modify — add 3 new models, remove `PlayerTools`, remove `lobbyState` from `Player` |
| `server/prisma/migrations/<ts>_normalize_lobby_state/migration.sql` | Create (auto-generated + manually edited) |
| `server/src/sync/sync.service.ts` | Modify — `dbToGameState`, Prisma include, write transaction |
| `server/src/sync/__tests__/sync.service.spec.ts` | Modify — update mockPlayer, txMock, add tools/construction tests |
| `server/src/player/player.service.ts` | Modify — replace `playerTools.create` with `playerState.create` |
| `server/src/tools/tools.service.ts` | Delete |
| `server/src/tools/tools.controller.ts` | Delete |
| `server/src/tools/tools.module.ts` | Delete |
| `server/src/app.module.ts` | Modify — remove `ToolsModule` |

---

## Task 1: Update Prisma Schema

**Files:**
- Modify: `server/prisma/schema.prisma`

**Interfaces:**
- Produces: `PlayerState`, `FloorConstruction`, `PlayerFloorType` Prisma models used by Tasks 2–4

- [ ] **Step 1: Replace the schema**

Open `server/prisma/schema.prisma` and replace the entire file content with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Player {
  id                 String              @id @default(uuid())
  email              String              @unique
  passwordHash       String
  playerName         String
  balance            Int                 @default(100)
  stateVersion       Int                 @default(0)
  playerLevel        Int                 @default(1)
  playerXp           Int                 @default(0)
  totalBought        Int                 @default(0)
  totalListed        Int                 @default(0)
  totalSold          Int                 @default(0)
  lastSeenAt         DateTime            @default(now())
  createdAt          DateTime            @default(now())
  floors             Floor[]
  workers            Worker[]
  state              PlayerState?
  floorConstructions FloorConstruction[]
  floorTypes         PlayerFloorType[]
  achievements       PlayerAchievement[]
}

model PlayerState {
  playerId               String  @id
  gems                   Int     @default(20)
  lobbyCapacity          Int     @default(10)
  hotelCapacity          Int     @default(10)
  elevatorLevel          Int     @default(1)
  elevatorFloor          Int     @default(0)
  dailyTips              Float   @default(0)
  dailyGemsCollected     Int     @default(0)
  dailyTipsRewardClaimed Boolean @default(false)
  lastDailyReset         BigInt  @default(0)
  nextVisitorAt          BigInt  @default(0)
  briks                  Int     @default(1)
  glass                  Int     @default(1)
  nails                  Int     @default(1)
  screw                  Int     @default(1)
  lobbyVisitors          Json    @default("[]")
  player                 Player  @relation(fields: [playerId], references: [id], onDelete: Cascade)
}

model FloorConstruction {
  id                Int     @id @default(autoincrement())
  playerId          String
  floorId           Int
  startedAt         BigInt
  durationMs        Int
  requiredTools     Json
  selectedFloorType String?
  player            Player  @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@unique([playerId, floorId])
}

model PlayerFloorType {
  playerId  String
  floorId   Int
  floorType String
  player    Player @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@id([playerId, floorId])
}

model Floor {
  id          Int          @id @default(autoincrement())
  playerId    String
  floorId     Int
  player      Player       @relation(fields: [playerId], references: [id], onDelete: Cascade)
  productions Production[]

  @@unique([playerId, floorId])
}

model Production {
  id             Int     @id @default(autoincrement())
  floorDbId      Int
  slotIdx        Int
  typeId         String?
  stage          String  @default("IDLE")
  stageStartedAt BigInt  @default(0)
  floor          Floor   @relation(fields: [floorDbId], references: [id], onDelete: Cascade)

  @@unique([floorDbId, slotIdx])
}

model Worker {
  id              String  @id
  playerId        String
  name            String
  female          Boolean
  floorType       String
  dreamJob        String
  level           Int
  hairColor       String
  assignedFloorId Int?
  assignedSlotIdx Int?
  player          Player  @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@index([playerId])
}

model CommandLog {
  id          String   @id
  playerId    String
  type        String
  floorId     Int?
  slotIdx     Int?
  typeId      String?
  workerId    String?
  timestamp   BigInt
  serverTime  BigInt
  cursor      Int      @default(autoincrement())
  processedAt DateTime @default(now())

  @@index([playerId, cursor])
}

model PlayerAchievement {
  id            String   @id @default(cuid())
  playerId      String
  achievementId String
  tier          Int
  grantedAt     DateTime @default(now())
  player        Player   @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@unique([playerId, achievementId, tier])
  @@index([playerId])
}
```

- [ ] **Step 2: Validate the schema**

```bash
cd server && npx prisma format
```

Expected: no errors, file is reformatted.

- [ ] **Step 3: Generate migration file (do not apply yet)**

```bash
cd server && npx prisma migrate dev --create-only --name normalize_lobby_state
```

Expected: `server/prisma/migrations/YYYYMMDDHHMMSS_normalize_lobby_state/migration.sql` created.

- [ ] **Step 4: Edit the migration file — insert data migration SQL**

Open the generated `migration.sql`. It will contain `CREATE TABLE` statements for the new tables, an `ALTER TABLE "Player" DROP COLUMN "lobbyState"`, and a `DROP TABLE "PlayerTools"`.

Find the line that reads `-- DropTable` or `DROP TABLE "PlayerTools"` and insert the following data migration SQL **before** that line (i.e., after all CREATE TABLE statements but before any DROP/ALTER):

```sql
-- Migrate scalar fields from lobbyState JSON into PlayerState
INSERT INTO "PlayerState" (
  "playerId", gems, "lobbyCapacity", "hotelCapacity",
  "elevatorLevel", "elevatorFloor", "dailyTips", "dailyGemsCollected",
  "dailyTipsRewardClaimed", "lastDailyReset", "nextVisitorAt",
  briks, glass, nails, screw, "lobbyVisitors"
)
SELECT
  p.id,
  COALESCE(
    CASE WHEN p."lobbyState" IS NOT NULL THEN (p."lobbyState"::jsonb->>'gems')::int END,
    20
  ),
  COALESCE(
    CASE WHEN p."lobbyState" IS NOT NULL THEN (p."lobbyState"::jsonb->>'lobbyCapacity')::int END,
    10
  ),
  COALESCE(
    CASE WHEN p."lobbyState" IS NOT NULL THEN (p."lobbyState"::jsonb->>'hotelCapacity')::int END,
    10
  ),
  COALESCE(
    CASE WHEN p."lobbyState" IS NOT NULL THEN (p."lobbyState"::jsonb->>'elevatorLevel')::int END,
    1
  ),
  COALESCE(
    CASE WHEN p."lobbyState" IS NOT NULL THEN (p."lobbyState"::jsonb->>'elevatorFloor')::int END,
    0
  ),
  COALESCE(
    CASE WHEN p."lobbyState" IS NOT NULL THEN (p."lobbyState"::jsonb->>'dailyTips')::float END,
    0
  ),
  COALESCE(
    CASE WHEN p."lobbyState" IS NOT NULL THEN (p."lobbyState"::jsonb->>'dailyGemsCollected')::int END,
    0
  ),
  COALESCE(
    CASE WHEN p."lobbyState" IS NOT NULL THEN (p."lobbyState"::jsonb->>'dailyTipsRewardClaimed')::boolean END,
    false
  ),
  COALESCE(
    CASE WHEN p."lobbyState" IS NOT NULL THEN (p."lobbyState"::jsonb->>'lastDailyReset')::bigint END,
    0
  ),
  COALESCE(
    CASE WHEN p."lobbyState" IS NOT NULL THEN (p."lobbyState"::jsonb->>'nextVisitorAt')::bigint END,
    0
  ),
  COALESCE(
    CASE WHEN p."lobbyState" IS NOT NULL THEN (p."lobbyState"::jsonb->'tools'->>'briks')::int END,
    pt.briks,
    1
  ),
  COALESCE(
    CASE WHEN p."lobbyState" IS NOT NULL THEN (p."lobbyState"::jsonb->'tools'->>'glass')::int END,
    pt.glass,
    1
  ),
  COALESCE(
    CASE WHEN p."lobbyState" IS NOT NULL THEN (p."lobbyState"::jsonb->'tools'->>'nails')::int END,
    pt.nails,
    1
  ),
  COALESCE(
    CASE WHEN p."lobbyState" IS NOT NULL THEN (p."lobbyState"::jsonb->'tools'->>'screw')::int END,
    pt.screw,
    1
  ),
  COALESCE(
    CASE WHEN p."lobbyState" IS NOT NULL THEN p."lobbyState"::jsonb->'lobbyVisitors' END,
    '[]'::jsonb
  )
FROM "Player" p
LEFT JOIN "PlayerTools" pt ON pt."playerId" = p.id;

-- Migrate underConstruction array into FloorConstruction rows
INSERT INTO "FloorConstruction" ("playerId", "floorId", "startedAt", "durationMs", "requiredTools", "selectedFloorType")
SELECT
  p.id,
  (uc->>'floorId')::int,
  (uc->>'startedAt')::bigint,
  (uc->>'durationMs')::int,
  uc->'requiredTools',
  NULLIF(uc->>'selectedFloorType', '')
FROM "Player" p,
     jsonb_array_elements(
       CASE
         WHEN p."lobbyState" IS NOT NULL AND jsonb_typeof(p."lobbyState"::jsonb->'underConstruction') = 'array'
         THEN p."lobbyState"::jsonb->'underConstruction'
         ELSE '[]'::jsonb
       END
     ) AS uc
WHERE p."lobbyState" IS NOT NULL;

-- Migrate openedFloorTypes map into PlayerFloorType rows
INSERT INTO "PlayerFloorType" ("playerId", "floorId", "floorType")
SELECT
  p.id,
  (kv.key)::int,
  kv.value #>> '{}'
FROM "Player" p,
     jsonb_each(
       CASE
         WHEN p."lobbyState" IS NOT NULL AND jsonb_typeof(p."lobbyState"::jsonb->'openedFloorTypes') = 'object'
         THEN p."lobbyState"::jsonb->'openedFloorTypes'
         ELSE '{}'::jsonb
       END
     ) AS kv
WHERE p."lobbyState" IS NOT NULL;
```

- [ ] **Step 5: Apply migration**

```bash
cd server && npx prisma migrate dev
```

Expected: `The following migration(s) have been applied: normalize_lobby_state`. No new migration created. DB now has `PlayerState`, `FloorConstruction`, `PlayerFloorType` tables; `lobbyState` column and `PlayerTools` table are gone.

- [ ] **Step 6: Regenerate Prisma client**

```bash
cd server && npx prisma generate
```

Expected: `Generated Prisma Client`.

- [ ] **Step 7: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/
git commit -m "feat(db): normalize lobbyState into PlayerState, FloorConstruction, PlayerFloorType"
```

---

## Task 2: Refactor `dbToGameState` and update tests

**Files:**
- Modify: `server/src/sync/sync.service.ts`
- Modify: `server/src/sync/__tests__/sync.service.spec.ts`

**Interfaces:**
- Consumes: `PlayerState`, `FloorConstruction`, `PlayerFloorType` Prisma types from Task 1
- Produces: `dbToGameState(player): GameState` — same signature, new implementation

- [ ] **Step 1: Update `mockPlayer` in the test file**

In `server/src/sync/__tests__/sync.service.spec.ts`, replace the `mockPlayer` const (lines 91–108) with:

```ts
const mockPlayer = {
  id: 'player-uuid',
  email: 'test@test.com',
  passwordHash: 'hashed',
  playerName: 'TestPlayer',
  balance: 100,
  stateVersion: 0,
  playerLevel: 1,
  playerXp: 0,
  totalBought: 0,
  totalListed: 0,
  totalSold: 0,
  lastSeenAt: new Date(Date.now() - 60000),
  createdAt: new Date(),
  floors: mockFloors,
  workers: mockWorkers,
  state: null,
  floorConstructions: [],
  floorTypes: [],
};
```

- [ ] **Step 2: Add tools and construction reading tests**

Add these tests inside the existing `describe('processSync', ...)` block, after the last `it(...)`:

```ts
it('should read tools from PlayerState when state exists', async () => {
  const playerWithState = {
    ...mockPlayer,
    state: {
      playerId: 'player-uuid',
      gems: 50,
      lobbyCapacity: 10,
      hotelCapacity: 10,
      elevatorLevel: 1,
      elevatorFloor: 0,
      dailyTips: 0,
      dailyGemsCollected: 0,
      dailyTipsRewardClaimed: false,
      lastDailyReset: BigInt(0),
      nextVisitorAt: BigInt(0),
      briks: 3,
      glass: 2,
      nails: 1,
      screw: 4,
      lobbyVisitors: [],
    },
  };

  prisma.player.findUnique
    .mockResolvedValueOnce(playerWithState)
    .mockResolvedValueOnce({ ...mockPlayer });

  const result = await syncService.processSync('player-uuid', [], 0);

  expect(result.state.tools).toEqual({ briks: 3, glass: 2, nails: 1, screw: 4 });
  expect(result.state.gems).toBe(50);
});

it('should default tools to 1 each when state is null', async () => {
  prisma.player.findUnique
    .mockResolvedValueOnce({ ...mockPlayer, state: null })
    .mockResolvedValueOnce({ ...mockPlayer });

  const result = await syncService.processSync('player-uuid', [], 0);

  expect(result.state.tools).toEqual({ briks: 1, glass: 1, nails: 1, screw: 1 });
});

it('should read underConstruction from FloorConstruction rows', async () => {
  const playerWithConstruction = {
    ...mockPlayer,
    floorConstructions: [
      {
        id: 1,
        playerId: 'player-uuid',
        floorId: 10,
        startedAt: BigInt(1700000000000),
        durationMs: 60000,
        requiredTools: [{ tool: 'briks', count: 1 }],
        selectedFloorType: 'green',
      },
    ],
  };

  prisma.player.findUnique
    .mockResolvedValueOnce(playerWithConstruction)
    .mockResolvedValueOnce({ ...mockPlayer });

  const result = await syncService.processSync('player-uuid', [], 0);

  expect(result.state.underConstruction).toHaveLength(1);
  expect(result.state.underConstruction[0]).toEqual({
    floorId: 10,
    startedAt: 1700000000000,
    durationMs: 60000,
    requiredTools: [{ tool: 'briks', count: 1 }],
    selectedFloorType: 'green',
  });
});

it('should read openedFloorTypes from PlayerFloorType rows', async () => {
  const playerWithFloorTypes = {
    ...mockPlayer,
    floorTypes: [
      { playerId: 'player-uuid', floorId: 7, floorType: 'blue' },
      { playerId: 'player-uuid', floorId: 8, floorType: 'green' },
    ],
  };

  prisma.player.findUnique
    .mockResolvedValueOnce(playerWithFloorTypes)
    .mockResolvedValueOnce({ ...mockPlayer });

  const result = await syncService.processSync('player-uuid', [], 0);

  expect(result.state.openedFloorTypes).toEqual({ '7': 'blue', '8': 'green' });
});
```

- [ ] **Step 3: Run tests — verify new tests fail**

```bash
cd server && npm test -- --testPathPattern=sync.service
```

Expected: the 4 new tests FAIL (e.g. `TypeError: Cannot read properties of undefined`), existing tests FAIL too (due to `mockPlayer` no longer having `lobbyState` but code still reads it).

- [ ] **Step 4: Rewrite `dbToGameState` in `sync.service.ts`**

Replace the entire `private dbToGameState(player: any): GameState` method (currently lines 309–364) with:

```ts
private dbToGameState(player: any): GameState {
  const floors: Floor[] = player.floors.map((f: any) => ({
    id: f.floorId,
    productions: f.productions.map(
      (p: any): Production => ({
        typeId: p.typeId,
        stage: p.stage as any,
        stageStartedAt: Number(p.stageStartedAt),
      }),
    ),
  }));

  const workers: Worker[] = (player.workers || []).map((w: any): Worker => ({
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

  const s = player.state;

  return {
    balance: player.balance,
    gems: s?.gems ?? 20,
    floors,
    commandQueue: [],
    workers,
    hotelCapacity: s?.hotelCapacity ?? gameConfig.hotelCapacity,
    lobbyVisitors: (s?.lobbyVisitors as any[]) ?? [],
    lobbyCapacity: s?.lobbyCapacity ?? gameConfig.lobbyConfig.defaultLobbyCapacity,
    elevatorLevel: s?.elevatorLevel ?? 1,
    elevatorFloor: s?.elevatorFloor ?? 0,
    dailyTips: s?.dailyTips ?? 0,
    dailyGemsCollected: s?.dailyGemsCollected ?? 0,
    dailyTipsRewardClaimed: s?.dailyTipsRewardClaimed ?? false,
    lastDailyReset: Number(s?.lastDailyReset ?? 0),
    nextVisitorAt: Number(s?.nextVisitorAt ?? 0),
    tools: {
      briks: s?.briks ?? 1,
      glass: s?.glass ?? 1,
      nails: s?.nails ?? 1,
      screw: s?.screw ?? 1,
    },
    underConstruction: (player.floorConstructions ?? []).map((fc: any) => ({
      floorId: fc.floorId,
      startedAt: Number(fc.startedAt),
      durationMs: fc.durationMs,
      requiredTools: fc.requiredTools as { tool: string; count: number }[],
      selectedFloorType: fc.selectedFloorType ?? null,
    })),
    openedFloorTypes: Object.fromEntries(
      (player.floorTypes ?? []).map((ft: any) => [String(ft.floorId), ft.floorType]),
    ),
    stats: {
      totalBought: player.totalBought,
      totalListed: player.totalListed,
      totalSold: player.totalSold,
    },
  };
}
```

Also remove the `LobbyStateJson` interface at the top of the file (lines 8–10):
```ts
// DELETE this:
interface LobbyStateJson {
  [key: string]: unknown;
}
```

- [ ] **Step 5: Update the Prisma include in `processSync`**

In `processSync`, find the `prisma.player.findUnique` call and replace the `include` block:

```ts
const player = await this.prisma.player.findUnique({
  where: { id: playerId },
  include: {
    floors: {
      include: { productions: { orderBy: { slotIdx: 'asc' } } },
      orderBy: { floorId: 'asc' },
    },
    workers: true,
    state: true,
    floorConstructions: true,
    floorTypes: true,
  },
});
```

- [ ] **Step 6: Run tests — verify they pass**

```bash
cd server && npm test -- --testPathPattern=sync.service
```

Expected: all tests PASS (new 4 + all existing).

- [ ] **Step 7: Commit**

```bash
git add server/src/sync/sync.service.ts server/src/sync/__tests__/sync.service.spec.ts
git commit -m "feat(sync): read state from PlayerState, FloorConstruction, PlayerFloorType"
```

---

## Task 3: Refactor sync write transaction

**Files:**
- Modify: `server/src/sync/sync.service.ts`
- Modify: `server/src/sync/__tests__/sync.service.spec.ts`

**Interfaces:**
- Consumes: `PlayerState`, `FloorConstruction`, `PlayerFloorType` Prisma models
- Produces: sync transaction that writes all game state to new tables

- [ ] **Step 1: Add new mocks to `txMock` in the test file**

In `beforeEach`, inside the `txMock` object, add three new entries:

```ts
txMock = {
  player: { update: jest.fn().mockResolvedValue({}) },
  production: { update: jest.fn().mockResolvedValue({}) },
  worker: { upsert: jest.fn().mockResolvedValue({}), deleteMany: jest.fn().mockResolvedValue({}) },
  commandLog: { create: jest.fn().mockResolvedValue({ cursor: 1 }), deleteMany: jest.fn().mockResolvedValue({}) },
  playerAchievement: {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({}),
  },
  $queryRaw: jest.fn().mockResolvedValue([]),
  // New:
  playerState: { upsert: jest.fn().mockResolvedValue({}) },
  floorConstruction: { deleteMany: jest.fn().mockResolvedValue({}), upsert: jest.fn().mockResolvedValue({}) },
  playerFloorType: { upsert: jest.fn().mockResolvedValue({}) },
};
```

- [ ] **Step 2: Add write-path test**

Add this test inside `describe('processSync', ...)`:

```ts
it('should upsert PlayerState and write FloorConstruction on accepted command', async () => {
  prisma.player.findUnique
    .mockResolvedValueOnce(mockPlayer)
    .mockResolvedValueOnce({ ...mockPlayer, stateVersion: 1 });

  const buyCmd: Command = {
    id: 'cmd-write',
    type: 'buy',
    floorId: 2,
    slotIdx: 0,
    typeId: 'bulky',
    timestamp: Date.now(),
  };

  await syncService.processSync('player-uuid', [buyCmd], 0);

  expect(txMock.playerState.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { playerId: 'player-uuid' },
      create: expect.objectContaining({ playerId: 'player-uuid' }),
      update: expect.objectContaining({ gems: expect.any(Number) }),
    }),
  );
  expect(txMock.floorConstruction.deleteMany).toHaveBeenCalledWith({
    where: { playerId: 'player-uuid', floorId: { notIn: [] } },
  });
  expect(txMock.player.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.not.objectContaining({ lobbyState: expect.anything() }),
    }),
  );
});
```

- [ ] **Step 3: Run test — verify it fails**

```bash
cd server && npm test -- --testPathPattern=sync.service
```

Expected: the new `upsert PlayerState` test FAILS (`txMock.playerState.upsert` was not called).

- [ ] **Step 4: Replace the write transaction in `sync.service.ts`**

In `processSync`, find the `await tx.player.update(...)` block and replace everything from the `const { playerLevel: _pl, playerXp: _px, ...existingLs }` line through the closing `});` of the player update with the following. Keep all surrounding code (the `$queryRaw`, achievement logic, production updates, worker upserts, commandLog creates) unchanged.

Replace only the player.update call and the existingLs destructuring before it:

```ts
// (remove the existingLs destructuring line entirely)

await tx.player.update({
  where: { id: playerId },
  data: {
    balance: gameState.balance,
    playerLevel: xpResult.playerLevel,
    playerXp: xpResult.playerXp,
    totalBought: { increment: boughtCount },
    totalListed: { increment: listedCount },
    totalSold:   { increment: soldCount },
    stateVersion: {
      increment: (acceptedCommands.length > 0 || localNewAchievements.length > 0) ? 1 : 0,
    },
    lastSeenAt: new Date(serverNow),
  },
});

await tx.playerState.upsert({
  where: { playerId },
  create: {
    playerId,
    gems: gameState.gems,
    lobbyCapacity: gameState.lobbyCapacity,
    hotelCapacity: gameState.hotelCapacity,
    elevatorLevel: gameState.elevatorLevel,
    elevatorFloor: gameState.elevatorFloor,
    dailyTips: gameState.dailyTips,
    dailyGemsCollected: gameState.dailyGemsCollected,
    dailyTipsRewardClaimed: gameState.dailyTipsRewardClaimed,
    lastDailyReset: BigInt(gameState.lastDailyReset),
    nextVisitorAt: BigInt(gameState.nextVisitorAt),
    briks: gameState.tools.briks,
    glass: gameState.tools.glass,
    nails: gameState.tools.nails,
    screw: gameState.tools.screw,
    lobbyVisitors: gameState.lobbyVisitors,
  },
  update: {
    gems: gameState.gems,
    lobbyCapacity: gameState.lobbyCapacity,
    hotelCapacity: gameState.hotelCapacity,
    elevatorLevel: gameState.elevatorLevel,
    elevatorFloor: gameState.elevatorFloor,
    dailyTips: gameState.dailyTips,
    dailyGemsCollected: gameState.dailyGemsCollected,
    dailyTipsRewardClaimed: gameState.dailyTipsRewardClaimed,
    lastDailyReset: BigInt(gameState.lastDailyReset),
    nextVisitorAt: BigInt(gameState.nextVisitorAt),
    briks: gameState.tools.briks,
    glass: gameState.tools.glass,
    nails: gameState.tools.nails,
    screw: gameState.tools.screw,
    lobbyVisitors: gameState.lobbyVisitors,
  },
});

const activeFloorIds = gameState.underConstruction.map((uc) => uc.floorId);
await tx.floorConstruction.deleteMany({
  where: { playerId, floorId: { notIn: activeFloorIds } },
});
for (const uc of gameState.underConstruction) {
  await tx.floorConstruction.upsert({
    where: { playerId_floorId: { playerId, floorId: uc.floorId } },
    create: {
      playerId,
      floorId: uc.floorId,
      startedAt: BigInt(uc.startedAt),
      durationMs: uc.durationMs,
      requiredTools: uc.requiredTools,
      selectedFloorType: uc.selectedFloorType ?? null,
    },
    update: {
      selectedFloorType: uc.selectedFloorType ?? null,
    },
  });
}

for (const [floorIdStr, floorType] of Object.entries(gameState.openedFloorTypes ?? {})) {
  const floorId = Number(floorIdStr);
  await tx.playerFloorType.upsert({
    where: { playerId_floorId: { playerId, floorId } },
    create: { playerId, floorId, floorType },
    update: { floorType },
  });
}
```

- [ ] **Step 5: Run all tests**

```bash
cd server && npm test -- --testPathPattern=sync.service
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/sync/sync.service.ts server/src/sync/__tests__/sync.service.spec.ts
git commit -m "feat(sync): write game state to normalized tables instead of lobbyState"
```

---

## Task 4: Update player creation

**Files:**
- Modify: `server/src/player/player.service.ts`

**Interfaces:**
- Consumes: `PlayerState` Prisma model from Task 1
- Produces: `createWithInitialState` creates `PlayerState` row (defaults cover all fields)

- [ ] **Step 1: Replace `playerTools.create` with `playerState.create`**

In `server/src/player/player.service.ts`, find the line:
```ts
await tx.playerTools.create({ data: { playerId: player.id } });
```

Replace it with:
```ts
await tx.playerState.create({ data: { playerId: player.id } });
```

- [ ] **Step 2: Verify the server compiles**

```bash
cd server && npm run build 2>&1 | tail -5
```

Expected: `Successfully compiled` or no output (exits 0).

- [ ] **Step 3: Run all server tests**

```bash
cd server && npm test
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add server/src/player/player.service.ts
git commit -m "feat(player): create PlayerState on registration instead of PlayerTools"
```

---

## Task 5: Remove tools module

**Files:**
- Delete: `server/src/tools/tools.service.ts`
- Delete: `server/src/tools/tools.controller.ts`
- Delete: `server/src/tools/tools.module.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Consumes: nothing (removal task)
- Produces: `AppModule` without `ToolsModule`; `/tools` route no longer exists

- [ ] **Step 1: Remove the tools module files**

```bash
rm server/src/tools/tools.service.ts \
   server/src/tools/tools.controller.ts \
   server/src/tools/tools.module.ts
rmdir server/src/tools
```

- [ ] **Step 2: Update `app.module.ts`**

Replace the entire file content with:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PlayerModule } from './player/player.module';
import { SyncModule } from './sync/sync.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    PlayerModule,
    SyncModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 3: Verify build and tests**

```bash
cd server && npm run build 2>&1 | tail -5 && npm test
```

Expected: clean build, all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add server/src/app.module.ts
git rm server/src/tools/tools.service.ts server/src/tools/tools.controller.ts server/src/tools/tools.module.ts
git commit -m "chore: remove dead ToolsModule (tools merged into PlayerState)"
```

---

## Task 6: Full verification

- [ ] **Step 1: Run full test suite**

```bash
cd server && npm test -- --verbose 2>&1 | tail -20
```

Expected: all test suites pass, 0 failures.

- [ ] **Step 2: Verify server starts**

```bash
cd server && npm run build && echo "BUILD OK"
```

Expected: `BUILD OK`.

- [ ] **Step 3: Smoke-test with database**

Start the server and make a sync request:

```bash
cd server && npm run start:dev &
sleep 5
# Login and get a token, then:
curl -s -X POST http://localhost:3000/sync \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"commands":[],"lastAckCursor":0}' | jq '.state.tools'
```

Expected: `{"briks":1,"glass":1,"nails":1,"screw":1}` (or actual player values, not zeros).

- [ ] **Step 4: Final commit (if any uncommitted files remain)**

```bash
cd /Users/Apple/IT/tinytower && git status
```

All changes should already be committed from previous tasks.
