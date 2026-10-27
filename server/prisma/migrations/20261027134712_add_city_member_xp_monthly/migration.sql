-- CreateTable
CREATE TABLE "CityMemberXpMonthly" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CityMemberXpMonthly_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CityMemberXpMonthly_cityId_year_month_idx" ON "CityMemberXpMonthly"("cityId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "CityMemberXpMonthly_playerId_cityId_year_month_key" ON "CityMemberXpMonthly"("playerId", "cityId", "year", "month");

-- AddForeignKey
ALTER TABLE "CityMemberXpMonthly" ADD CONSTRAINT "CityMemberXpMonthly_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityMemberXpMonthly" ADD CONSTRAINT "CityMemberXpMonthly_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;
