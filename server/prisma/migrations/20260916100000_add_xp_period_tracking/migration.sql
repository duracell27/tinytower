-- Add xpPeriodStart to City and xpPeriod to CityMembership for period XP statistics
ALTER TABLE "City" ADD COLUMN "xpPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "CityMembership" ADD COLUMN "xpPeriod" INTEGER NOT NULL DEFAULT 0;
