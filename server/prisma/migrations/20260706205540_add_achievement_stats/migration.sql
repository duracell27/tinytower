-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "totalBought" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalListed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalSold" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PlayerAchievement" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerAchievement_playerId_idx" ON "PlayerAchievement"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerAchievement_playerId_achievementId_tier_key" ON "PlayerAchievement"("playerId", "achievementId", "tier");

-- AddForeignKey
ALTER TABLE "PlayerAchievement" ADD CONSTRAINT "PlayerAchievement_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
