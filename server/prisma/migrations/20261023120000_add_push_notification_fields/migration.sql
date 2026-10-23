-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "inactivityNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "notifiedAllResidents" TIMESTAMP(3),
ADD COLUMN     "notifiedCollect" TIMESTAMP(3),
ADD COLUMN     "notifiedPurchase" TIMESTAMP(3),
ADD COLUMN     "notifiedStock" TIMESTAMP(3),
ADD COLUMN     "pushPlatform" TEXT,
ADD COLUMN     "pushToken" TEXT,
ADD COLUMN     "pushTokenUpdatedAt" TIMESTAMP(3);

