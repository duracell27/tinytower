-- DropTable
DROP TABLE "PlayerAchievement";

-- AlterTable
ALTER TABLE "Player" DROP COLUMN "totalSold",
ADD COLUMN     "totalCollected" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalPassengersLifted" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PlayerState" ADD COLUMN     "coinBonusPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "xpBonusPercent" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PlayerCategoryProgress" (
    "playerId" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentLevel" INTEGER NOT NULL DEFAULT 0,
    "claimedLevels" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerCategoryProgress_pkey" PRIMARY KEY ("playerId","categoryKey")
);

-- CreateIndex
CREATE INDEX "PlayerCategoryProgress_playerId_idx" ON "PlayerCategoryProgress"("playerId");

-- AddForeignKey
ALTER TABLE "PlayerCategoryProgress" ADD CONSTRAINT "PlayerCategoryProgress_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
