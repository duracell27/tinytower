/*
  Warnings:

  - The values [INSULT] on the enum `ReportCategory` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ReportCategory_new" AS ENUM ('SPAM', 'HARASSMENT', 'ADVERTISEMENT', 'PROFANITY', 'THREAT', 'ADULT_CONTENT', 'OTHER');
ALTER TABLE "Report" ALTER COLUMN "category" TYPE "ReportCategory_new" USING ("category"::text::"ReportCategory_new");
ALTER TYPE "ReportCategory" RENAME TO "ReportCategory_old";
ALTER TYPE "ReportCategory_new" RENAME TO "ReportCategory";
DROP TYPE "public"."ReportCategory_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "CityInvite" DROP CONSTRAINT "CityInvite_cityId_fkey";

-- DropForeignKey
ALTER TABLE "CityInvite" DROP CONSTRAINT "CityInvite_invitedById_fkey";

-- DropForeignKey
ALTER TABLE "CityInvite" DROP CONSTRAINT "CityInvite_invitedPlayerId_fkey";

-- DropForeignKey
ALTER TABLE "MailMessage" DROP CONSTRAINT "MailMessage_cityInviteId_fkey";

-- AlterTable
ALTER TABLE "City" ADD COLUMN     "budgetBriks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "budgetCement" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "budgetCoins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "budgetGems" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "budgetGlass" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "budgetNails" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "budgetScrew" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "budgetWood" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CityInvite" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "token" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CityMembership" ADD COLUMN     "gemsGivenThisWeek" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gemsShopBonus" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gemsWeekStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "CityBudgetTransaction" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "playerId" TEXT,
    "type" TEXT NOT NULL,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "gems" INTEGER NOT NULL DEFAULT 0,
    "briks" INTEGER NOT NULL DEFAULT 0,
    "glass" INTEGER NOT NULL DEFAULT 0,
    "nails" INTEGER NOT NULL DEFAULT 0,
    "screw" INTEGER NOT NULL DEFAULT 0,
    "wood" INTEGER NOT NULL DEFAULT 0,
    "cement" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CityBudgetTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CityBudgetTransaction_cityId_createdAt_idx" ON "CityBudgetTransaction"("cityId", "createdAt");

-- AddForeignKey
ALTER TABLE "MailMessage" ADD CONSTRAINT "MailMessage_cityInviteId_fkey" FOREIGN KEY ("cityInviteId") REFERENCES "CityInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityInvite" ADD CONSTRAINT "CityInvite_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityInvite" ADD CONSTRAINT "CityInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityInvite" ADD CONSTRAINT "CityInvite_invitedPlayerId_fkey" FOREIGN KEY ("invitedPlayerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityBudgetTransaction" ADD CONSTRAINT "CityBudgetTransaction_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityBudgetTransaction" ADD CONSTRAINT "CityBudgetTransaction_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
