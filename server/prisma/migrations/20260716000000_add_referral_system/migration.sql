-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "referralCode" TEXT;

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredId" TEXT NOT NULL,
    "referredName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registeredClaimedAt" TIMESTAMP(3),
    "level30ReachedAt" TIMESTAMP(3),
    "level30ClaimedAt" TIMESTAMP(3),
    "gemBonusEarned" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralPurchaseNotification" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredName" TEXT NOT NULL,
    "bonus" INTEGER NOT NULL,
    "purchaseAmount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "ReferralPurchaseNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referredId_key" ON "Referral"("referredId");

-- CreateIndex
CREATE INDEX "Referral_referrerId_idx" ON "Referral"("referrerId");

-- CreateIndex
CREATE INDEX "ReferralPurchaseNotification_referrerId_syncedAt_idx" ON "ReferralPurchaseNotification"("referrerId", "syncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Player_referralCode_key" ON "Player"("referralCode");

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralPurchaseNotification" ADD CONSTRAINT "ReferralPurchaseNotification_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
