-- AlterTable
ALTER TABLE "CityMembership" ADD COLUMN     "cityChatLastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "CityChatMessage" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "playerId" TEXT,
    "playerName" TEXT NOT NULL,
    "playerLevel" INTEGER NOT NULL DEFAULT 1,
    "playerRole" TEXT NOT NULL DEFAULT 'NEWBIE',
    "body" VARCHAR(500) NOT NULL,
    "mentionedPlayerId" TEXT,
    "mentionedName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CityChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CityChatMessage_cityId_createdAt_idx" ON "CityChatMessage"("cityId", "createdAt");

-- CreateIndex
CREATE INDEX "CityChatMessage_mentionedPlayerId_createdAt_idx" ON "CityChatMessage"("mentionedPlayerId", "createdAt");

-- AddForeignKey
ALTER TABLE "CityChatMessage" ADD CONSTRAINT "CityChatMessage_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityChatMessage" ADD CONSTRAINT "CityChatMessage_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityChatMessage" ADD CONSTRAINT "CityChatMessage_mentionedPlayerId_fkey" FOREIGN KEY ("mentionedPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
