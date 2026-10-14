-- CreateTable
CREATE TABLE "CityWeeklyResult" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "message" VARCHAR(500),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CityWeeklyResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CityWeeklyResult_cityId_weekStart_key" ON "CityWeeklyResult"("cityId", "weekStart");

-- AddForeignKey
ALTER TABLE "CityWeeklyResult" ADD CONSTRAINT "CityWeeklyResult_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;
