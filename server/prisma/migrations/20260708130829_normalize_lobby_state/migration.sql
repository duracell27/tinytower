/*
  Warnings:

  - You are about to drop the column `lobbyState` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the `PlayerTools` table. If the table is not empty, all the data it contains will be lost.

*/

-- CreateTable
CREATE TABLE "PlayerState" (
    "playerId" TEXT NOT NULL,
    "gems" INTEGER NOT NULL DEFAULT 20,
    "lobbyCapacity" INTEGER NOT NULL DEFAULT 10,
    "hotelCapacity" INTEGER NOT NULL DEFAULT 10,
    "elevatorLevel" INTEGER NOT NULL DEFAULT 1,
    "elevatorFloor" INTEGER NOT NULL DEFAULT 0,
    "dailyTips" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dailyGemsCollected" INTEGER NOT NULL DEFAULT 0,
    "dailyTipsRewardClaimed" BOOLEAN NOT NULL DEFAULT false,
    "lastDailyReset" BIGINT NOT NULL DEFAULT 0,
    "nextVisitorAt" BIGINT NOT NULL DEFAULT 0,
    "briks" INTEGER NOT NULL DEFAULT 1,
    "glass" INTEGER NOT NULL DEFAULT 1,
    "nails" INTEGER NOT NULL DEFAULT 1,
    "screw" INTEGER NOT NULL DEFAULT 1,
    "lobbyVisitors" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "PlayerState_pkey" PRIMARY KEY ("playerId")
);

-- CreateTable
CREATE TABLE "FloorConstruction" (
    "id" SERIAL NOT NULL,
    "playerId" TEXT NOT NULL,
    "floorId" INTEGER NOT NULL,
    "startedAt" BIGINT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "requiredTools" JSONB NOT NULL,
    "selectedFloorType" TEXT,

    CONSTRAINT "FloorConstruction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerFloorType" (
    "playerId" TEXT NOT NULL,
    "floorId" INTEGER NOT NULL,
    "floorType" TEXT NOT NULL,

    CONSTRAINT "PlayerFloorType_pkey" PRIMARY KEY ("playerId","floorId")
);

-- CreateIndex
CREATE UNIQUE INDEX "FloorConstruction_playerId_floorId_key" ON "FloorConstruction"("playerId", "floorId");

-- AddForeignKey
ALTER TABLE "PlayerState" ADD CONSTRAINT "PlayerState_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloorConstruction" ADD CONSTRAINT "FloorConstruction_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerFloorType" ADD CONSTRAINT "PlayerFloorType_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- DropForeignKey
ALTER TABLE "PlayerTools" DROP CONSTRAINT "PlayerTools_playerId_fkey";

-- AlterTable
ALTER TABLE "Player" DROP COLUMN "lobbyState";

-- DropTable
DROP TABLE "PlayerTools";
