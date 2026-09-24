-- CreateEnum
CREATE TYPE "CityBuildingType" AS ENUM ('MOTOR_POOL', 'AD_AGENCY', 'CITY_BANK', 'BUSINESS_SCHOOL', 'STATE_ACADEMY', 'VIP_CLUB', 'VIP_HOTEL');

-- CreateEnum
CREATE TYPE "CityBuildingState" AS ENUM ('IDLE', 'BUILDING', 'ACTIVE');

-- CreateTable
CREATE TABLE "CityBuilding" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "buildingType" "CityBuildingType" NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "state" "CityBuildingState" NOT NULL DEFAULT 'IDLE',
    "buildFinishesAt" TIMESTAMP(3),
    "boostFinishesAt" TIMESTAMP(3),
    "boostMultiplier" DOUBLE PRECISION,

    CONSTRAINT "CityBuilding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CityBuilding_cityId_buildingType_key" ON "CityBuilding"("cityId", "buildingType");

-- AddForeignKey
ALTER TABLE "CityBuilding" ADD CONSTRAINT "CityBuilding_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;
