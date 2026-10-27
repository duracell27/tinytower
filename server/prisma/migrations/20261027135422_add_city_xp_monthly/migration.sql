-- CreateTable
CREATE TABLE "CityXpMonthly" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CityXpMonthly_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CityXpMonthly_cityId_idx" ON "CityXpMonthly"("cityId");

-- CreateIndex
CREATE UNIQUE INDEX "CityXpMonthly_cityId_year_month_key" ON "CityXpMonthly"("cityId", "year", "month");

-- AddForeignKey
ALTER TABLE "CityXpMonthly" ADD CONSTRAINT "CityXpMonthly_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;
