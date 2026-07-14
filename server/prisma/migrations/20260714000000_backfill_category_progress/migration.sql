-- Backfill playerCategoryProgress.progress from player stat columns for rows
-- where the progress counter fell behind because the PlayerCategoryProgress
-- table was created after the stat columns on Player.
--
-- Step 1: upsert progress using MAX so we never decrease a counter already ahead.
-- Step 2: recompute currentLevel and claimedLevels based on the corrected progress.

-- buy → totalBought (thresholds: 100, 500, 2500, 10000, 50000, 250000, 1000000)
INSERT INTO "PlayerCategoryProgress" ("playerId", "categoryKey", "progress", "currentLevel", "claimedLevels", "updatedAt")
SELECT p.id, 'buy', p."totalBought", 0, ARRAY[]::INTEGER[], NOW()
FROM "Player" p
WHERE p."totalBought" > 0
ON CONFLICT ("playerId", "categoryKey") DO UPDATE
  SET "progress"  = GREATEST("PlayerCategoryProgress"."progress", EXCLUDED."progress"),
      "updatedAt" = NOW();

UPDATE "PlayerCategoryProgress" cp
SET
  "currentLevel" = (
    CASE
      WHEN cp."progress" >= 1000000 THEN 7
      WHEN cp."progress" >= 250000  THEN 6
      WHEN cp."progress" >= 50000   THEN 5
      WHEN cp."progress" >= 10000   THEN 4
      WHEN cp."progress" >= 2500    THEN 3
      WHEN cp."progress" >= 500     THEN 2
      WHEN cp."progress" >= 100     THEN 1
      ELSE 0
    END
  ),
  "claimedLevels" = (
    SELECT ARRAY(
      SELECT lvl FROM unnest(ARRAY[1,2,3,4,5,6,7]) AS lvl
      WHERE cp."progress" >= (ARRAY[100,500,2500,10000,50000,250000,1000000])[lvl]
    )
  ),
  "updatedAt" = NOW()
WHERE cp."categoryKey" = 'buy';

-- list → totalListed
INSERT INTO "PlayerCategoryProgress" ("playerId", "categoryKey", "progress", "currentLevel", "claimedLevels", "updatedAt")
SELECT p.id, 'list', p."totalListed", 0, ARRAY[]::INTEGER[], NOW()
FROM "Player" p
WHERE p."totalListed" > 0
ON CONFLICT ("playerId", "categoryKey") DO UPDATE
  SET "progress"  = GREATEST("PlayerCategoryProgress"."progress", EXCLUDED."progress"),
      "updatedAt" = NOW();

UPDATE "PlayerCategoryProgress" cp
SET
  "currentLevel" = (
    CASE
      WHEN cp."progress" >= 1000000 THEN 7
      WHEN cp."progress" >= 250000  THEN 6
      WHEN cp."progress" >= 50000   THEN 5
      WHEN cp."progress" >= 10000   THEN 4
      WHEN cp."progress" >= 2500    THEN 3
      WHEN cp."progress" >= 500     THEN 2
      WHEN cp."progress" >= 100     THEN 1
      ELSE 0
    END
  ),
  "claimedLevels" = (
    SELECT ARRAY(
      SELECT lvl FROM unnest(ARRAY[1,2,3,4,5,6,7]) AS lvl
      WHERE cp."progress" >= (ARRAY[100,500,2500,10000,50000,250000,1000000])[lvl]
    )
  ),
  "updatedAt" = NOW()
WHERE cp."categoryKey" = 'list';

-- collect → totalCollected
INSERT INTO "PlayerCategoryProgress" ("playerId", "categoryKey", "progress", "currentLevel", "claimedLevels", "updatedAt")
SELECT p.id, 'collect', p."totalCollected", 0, ARRAY[]::INTEGER[], NOW()
FROM "Player" p
WHERE p."totalCollected" > 0
ON CONFLICT ("playerId", "categoryKey") DO UPDATE
  SET "progress"  = GREATEST("PlayerCategoryProgress"."progress", EXCLUDED."progress"),
      "updatedAt" = NOW();

UPDATE "PlayerCategoryProgress" cp
SET
  "currentLevel" = (
    CASE
      WHEN cp."progress" >= 1000000 THEN 7
      WHEN cp."progress" >= 250000  THEN 6
      WHEN cp."progress" >= 50000   THEN 5
      WHEN cp."progress" >= 10000   THEN 4
      WHEN cp."progress" >= 2500    THEN 3
      WHEN cp."progress" >= 500     THEN 2
      WHEN cp."progress" >= 100     THEN 1
      ELSE 0
    END
  ),
  "claimedLevels" = (
    SELECT ARRAY(
      SELECT lvl FROM unnest(ARRAY[1,2,3,4,5,6,7]) AS lvl
      WHERE cp."progress" >= (ARRAY[100,500,2500,10000,50000,250000,1000000])[lvl]
    )
  ),
  "updatedAt" = NOW()
WHERE cp."categoryKey" = 'collect';

-- elevator → totalPassengersLifted (thresholds: 100, 2500, 25000, 250000, 1000000, 2500000, 5000000)
INSERT INTO "PlayerCategoryProgress" ("playerId", "categoryKey", "progress", "currentLevel", "claimedLevels", "updatedAt")
SELECT p.id, 'elevator', p."totalPassengersLifted", 0, ARRAY[]::INTEGER[], NOW()
FROM "Player" p
WHERE p."totalPassengersLifted" > 0
ON CONFLICT ("playerId", "categoryKey") DO UPDATE
  SET "progress"  = GREATEST("PlayerCategoryProgress"."progress", EXCLUDED."progress"),
      "updatedAt" = NOW();

UPDATE "PlayerCategoryProgress" cp
SET
  "currentLevel" = (
    CASE
      WHEN cp."progress" >= 5000000  THEN 7
      WHEN cp."progress" >= 2500000  THEN 6
      WHEN cp."progress" >= 1000000  THEN 5
      WHEN cp."progress" >= 250000   THEN 4
      WHEN cp."progress" >= 25000    THEN 3
      WHEN cp."progress" >= 2500     THEN 2
      WHEN cp."progress" >= 100      THEN 1
      ELSE 0
    END
  ),
  "claimedLevels" = (
    SELECT ARRAY(
      SELECT lvl FROM unnest(ARRAY[1,2,3,4,5,6,7]) AS lvl
      WHERE cp."progress" >= (ARRAY[100,2500,25000,250000,1000000,2500000,5000000])[lvl]
    )
  ),
  "updatedAt" = NOW()
WHERE cp."categoryKey" = 'elevator';
