-- CreateEnum
CREATE TYPE "CityRole" AS ENUM ('MAYOR', 'ACTING_MAYOR', 'VICE_MAYOR', 'ADVISOR', 'BUSINESSMAN', 'CITIZEN', 'NEWBIE');

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(30) NOT NULL,
    "description" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CityMembership" (
    "cityId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "role" "CityRole" NOT NULL DEFAULT 'NEWBIE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CityMembership_pkey" PRIMARY KEY ("playerId")
);

-- CreateIndex
CREATE UNIQUE INDEX "City_name_key" ON "City"("name");

-- CreateIndex
CREATE INDEX "CityMembership_cityId_idx" ON "CityMembership"("cityId");

-- AddForeignKey
ALTER TABLE "CityMembership" ADD CONSTRAINT "CityMembership_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityMembership" ADD CONSTRAINT "CityMembership_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
