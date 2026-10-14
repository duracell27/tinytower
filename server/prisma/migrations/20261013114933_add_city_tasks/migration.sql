-- CreateEnum
CREATE TYPE "CityTaskType" AS ENUM ('WHOLESALE_PURCHASES', 'GOODS_ON_DISPLAY', 'CASH_COLLECTOR', 'CARRIER', 'VIP_CARRIER', 'EVICT_RESIDENTS', 'NEW_RESIDENTS', 'BUILD_FLOOR', 'EASY_MONEY');

-- CreateEnum
CREATE TYPE "CityTaskStatus" AS ENUM ('AVAILABLE', 'IN_PROGRESS', 'COMPLETED', 'COLLECTED', 'EXPIRED');

-- AlterTable
ALTER TABLE "City" ADD COLUMN     "styleStars" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CityDailyTask" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "taskType" "CityTaskType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "CityTaskStatus" NOT NULL DEFAULT 'AVAILABLE',
    "requiredCount" INTEGER NOT NULL,
    "currentProgress" INTEGER NOT NULL DEFAULT 0,
    "takenAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3),
    "rewardStars" INTEGER,
    "finalStars" INTEGER,

    CONSTRAINT "CityDailyTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CityTaskParticipant" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CityTaskParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CityDailyTask_cityId_date_idx" ON "CityDailyTask"("cityId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CityDailyTask_cityId_taskType_date_key" ON "CityDailyTask"("cityId", "taskType", "date");

-- CreateIndex
CREATE INDEX "CityTaskParticipant_playerId_idx" ON "CityTaskParticipant"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "CityTaskParticipant_taskId_playerId_key" ON "CityTaskParticipant"("taskId", "playerId");

-- AddForeignKey
ALTER TABLE "CityDailyTask" ADD CONSTRAINT "CityDailyTask_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityTaskParticipant" ADD CONSTRAINT "CityTaskParticipant_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "CityDailyTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
