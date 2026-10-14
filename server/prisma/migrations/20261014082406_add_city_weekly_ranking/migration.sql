-- CreateEnum
CREATE TYPE "CityWeeklyRankingStatus" AS ENUM ('PENDING', 'APPROVED');

-- AlterTable
ALTER TABLE "CityWeeklyResult" ADD COLUMN     "rank" INTEGER,
ADD COLUMN     "totalReward" INTEGER,
ADD COLUMN     "totalTickets" INTEGER;

-- CreateTable
CREATE TABLE "CityWeeklyStats" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "totalTickets" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CityWeeklyStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CityWeeklyRanking" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "status" "CityWeeklyRankingStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CityWeeklyRanking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CityWeeklyRankingEntry" (
    "id" TEXT NOT NULL,
    "rankingId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "totalTickets" INTEGER NOT NULL,
    "baseReward" INTEGER NOT NULL,
    "placementBonus" INTEGER NOT NULL DEFAULT 0,
    "superBonus" INTEGER NOT NULL DEFAULT 0,
    "totalReward" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CityWeeklyRankingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CityWeeklyStats_cityId_weekStart_key" ON "CityWeeklyStats"("cityId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "CityWeeklyRanking_weekStart_key" ON "CityWeeklyRanking"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "CityWeeklyRankingEntry_rankingId_cityId_key" ON "CityWeeklyRankingEntry"("rankingId", "cityId");

-- AddForeignKey
ALTER TABLE "CityWeeklyStats" ADD CONSTRAINT "CityWeeklyStats_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityWeeklyRankingEntry" ADD CONSTRAINT "CityWeeklyRankingEntry_rankingId_fkey" FOREIGN KEY ("rankingId") REFERENCES "CityWeeklyRanking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityWeeklyRankingEntry" ADD CONSTRAINT "CityWeeklyRankingEntry_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;
