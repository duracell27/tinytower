-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "playerLevel" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "playerXp" INTEGER NOT NULL DEFAULT 0;

-- Migrate existing playerLevel/playerXp from lobbyState JSON blob to columns
UPDATE "Player"
SET
  "playerLevel" = COALESCE(("lobbyState"->>'playerLevel')::int, 1),
  "playerXp"    = COALESCE(("lobbyState"->>'playerXp')::int, 0)
WHERE "lobbyState" IS NOT NULL
  AND ("lobbyState"->>'playerLevel' IS NOT NULL
    OR "lobbyState"->>'playerXp' IS NOT NULL);
