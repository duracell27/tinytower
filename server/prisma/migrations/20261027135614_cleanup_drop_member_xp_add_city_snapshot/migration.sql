/*
  Warnings:

  - You are about to drop the `CityMemberXpMonthly` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CityMemberXpMonthly" DROP CONSTRAINT "CityMemberXpMonthly_cityId_fkey";

-- DropForeignKey
ALTER TABLE "CityMemberXpMonthly" DROP CONSTRAINT "CityMemberXpMonthly_playerId_fkey";

-- AlterTable
ALTER TABLE "City" ADD COLUMN     "cityXpLastSnapshot" INTEGER NOT NULL DEFAULT 0;

-- Seed snapshot to current cityXp so first cron delta starts from now
UPDATE "City" SET "cityXpLastSnapshot" = "cityXp";

-- DropTable
DROP TABLE "CityMemberXpMonthly";
