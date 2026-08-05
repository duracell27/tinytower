# Normalize lobbyState — Design Spec

**Date:** 2026-07-08  
**Status:** Approved

## Problem

The `Player` table has a `lobbyState Json?` column that acts as a catch-all blob for all game state that doesn't have its own DB table. It stores scalar fields, arrays, and maps all mixed together. This causes:

1. No type safety — all reads require `as unknown as Type` casts and runtime fallbacks.
2. Silent bugs — `tools` was duplicated across `lobbyState.tools` and the `PlayerTools` table, with the sync service only reading from `lobbyState`, causing tools to always appear as zero for new players.
3. Impossible to query individual fields in SQL.
4. No DB-level defaults or constraints.

## Goal

Replace `lobbyState` with properly normalized tables. Keep only ephemeral data (`lobbyVisitors`) as JSON.

## Schema Changes

### New table: `PlayerState`

One-to-one with `Player`. Replaces all scalar fields from `lobbyState` and merges `PlayerTools` (which is removed).

```prisma
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
```

`lobbyVisitors` stays JSON because it is purely ephemeral session state (visitors come and go every few seconds) and is never queried by SQL.

### New table: `FloorConstruction`

Replaces the `underConstruction` array inside `lobbyState`. Critical game logic (floor opening, tool checks) depends on this data being correct and atomic.

```prisma
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
```

`requiredTools` stays JSON — it is a small static array `[{tool, count}]` set once at floor purchase and never queried individually.

### New table: `PlayerFloorType`

Replaces the `openedFloorTypes` map inside `lobbyState`. Maps dynamically built floor IDs to their floor type. Composite primary key — no surrogate needed.

```prisma
model PlayerFloorType {
  playerId  String
  floorId   Int
  floorType String
  player    Player @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@id([playerId, floorId])
}
```

### Removed

- `lobbyState Json?` column from `Player`
- `PlayerTools` model and table (tools merged into `PlayerState`)

### Player relations (additions)

```prisma
state            PlayerState?
floorConstructions FloorConstruction[]
floorTypes       PlayerFloorType[]
```

## Server Code Changes

### `sync.service.ts`

**Prisma query — replace `tools: true` with:**
```ts
include: {
  floors: { include: { productions: { orderBy: { slotIdx: 'asc' } } }, orderBy: { floorId: 'asc' } },
  workers: true,
  state: true,
  floorConstructions: true,
  floorTypes: true,
}
```

**`dbToGameState` — replace all `ls.*` reads with typed field access:**
```ts
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
  underConstruction: (player.floorConstructions ?? []).map((fc) => ({
    floorId: fc.floorId,
    startedAt: Number(fc.startedAt),
    durationMs: fc.durationMs,
    requiredTools: fc.requiredTools as { tool: string; count: number }[],
    selectedFloorType: fc.selectedFloorType ?? null,
  })),
  openedFloorTypes: Object.fromEntries(
    (player.floorTypes ?? []).map((ft) => [String(ft.floorId), ft.floorType]),
  ),
  stats: {
    totalBought: player.totalBought,
    totalListed: player.totalListed,
    totalSold: player.totalSold,
  },
};
```

**Sync write transaction — replace `lobbyState` update with:**

```ts
// Upsert PlayerState
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

// Sync FloorConstruction — delete removed, upsert active
const activeFloorIds = gameState.underConstruction.map((uc) => uc.floorId);
await tx.floorConstruction.deleteMany({
  where: { playerId, floorId: { notIn: activeFloorIds } },
});
for (const uc of gameState.underConstruction) {
  await tx.floorConstruction.upsert({
    where: { playerId_floorId: { playerId, floorId: uc.floorId } },
    create: { playerId, ...ucFields },
    update: { selectedFloorType: uc.selectedFloorType },
  });
}

// Upsert PlayerFloorType entries
for (const [floorId, floorType] of Object.entries(gameState.openedFloorTypes ?? {})) {
  await tx.playerFloorType.upsert({
    where: { playerId_floorId: { playerId, floorId: Number(floorId) } },
    create: { playerId, floorId: Number(floorId), floorType },
    update: { floorType },
  });
}
```

### `player.service.ts`

Replace `playerTools.create` with `playerState.create` in `createWithInitialState`:

```ts
await tx.playerState.create({ data: { playerId: player.id } });
// defaults cover all fields
```

### Removed files

- `server/src/tools/tools.service.ts`
- `server/src/tools/tools.controller.ts`
- `server/src/tools/tools.module.ts`

Remove `ToolsModule` from `app.module.ts` imports.

## Data Migration

The Prisma migration file includes a two-phase SQL migration:

**Phase 1 — populate new tables from existing `lobbyState`:**
```sql
-- PlayerState
INSERT INTO "PlayerState" ("playerId", gems, "lobbyCapacity", "hotelCapacity",
  "elevatorLevel", "elevatorFloor", "dailyTips", "dailyGemsCollected",
  "dailyTipsRewardClaimed", "lastDailyReset", "nextVisitorAt",
  briks, glass, nails, screw, "lobbyVisitors")
SELECT
  p.id,
  COALESCE((p."lobbyState"->>'gems')::int,           20),
  COALESCE((p."lobbyState"->>'lobbyCapacity')::int,  10),
  COALESCE((p."lobbyState"->>'hotelCapacity')::int,  10),
  COALESCE((p."lobbyState"->>'elevatorLevel')::int,   1),
  COALESCE((p."lobbyState"->>'elevatorFloor')::int,   0),
  COALESCE((p."lobbyState"->>'dailyTips')::float,     0),
  COALESCE((p."lobbyState"->>'dailyGemsCollected')::int, 0),
  COALESCE((p."lobbyState"->>'dailyTipsRewardClaimed')::boolean, false),
  COALESCE((p."lobbyState"->>'lastDailyReset')::bigint, 0),
  COALESCE((p."lobbyState"->>'nextVisitorAt')::bigint,  0),
  COALESCE((p."lobbyState"->'tools'->>'briks')::int,
    pt.briks, 1),
  COALESCE((p."lobbyState"->'tools'->>'glass')::int,
    pt.glass, 1),
  COALESCE((p."lobbyState"->'tools'->>'nails')::int,
    pt.nails, 1),
  COALESCE((p."lobbyState"->'tools'->>'screw')::int,
    pt.screw, 1),
  COALESCE(p."lobbyState"->'lobbyVisitors', '[]'::json)
FROM "Player" p
LEFT JOIN "PlayerTools" pt ON pt."playerId" = p.id;

-- FloorConstruction
INSERT INTO "FloorConstruction" ("playerId", "floorId", "startedAt", "durationMs",
  "requiredTools", "selectedFloorType")
SELECT
  p.id,
  (uc->>'floorId')::int,
  (uc->>'startedAt')::bigint,
  (uc->>'durationMs')::int,
  uc->'requiredTools',
  uc->>'selectedFloorType'
FROM "Player" p,
     jsonb_array_elements(
       CASE jsonb_typeof(p."lobbyState"->'underConstruction')
         WHEN 'array' THEN p."lobbyState"->'underConstruction'
         ELSE '[]'::jsonb
       END
     ) AS uc
WHERE p."lobbyState" IS NOT NULL;

-- PlayerFloorType
INSERT INTO "PlayerFloorType" ("playerId", "floorId", "floorType")
SELECT
  p.id,
  (kv.key)::int,
  kv.value #>> '{}'
FROM "Player" p,
     jsonb_each(
       COALESCE(p."lobbyState"->'openedFloorTypes', '{}'::jsonb)
     ) AS kv
WHERE p."lobbyState" IS NOT NULL;
```

**Phase 2 — drop old columns/tables:**
```sql
ALTER TABLE "Player" DROP COLUMN "lobbyState";
DROP TABLE "PlayerTools";
```

## What Does NOT Change

- Client (`gameStore.ts`, components) — no changes needed; the store's data model is unchanged
- `shared/` engine and schemas — no changes
- `GameState` TypeScript type — unchanged
- All tests — only server-side integration tests need updating

## Out of Scope

- Querying `lobbyVisitors` by SQL — not needed today
- Adding indexes on new tables beyond the unique constraints — not needed yet
- Migrating `stats` columns — already normalized in `Player` table
