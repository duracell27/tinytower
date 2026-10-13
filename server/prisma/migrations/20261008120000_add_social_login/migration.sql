-- AlterTable: make passwordHash nullable
ALTER TABLE "Player" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- AlterTable: add googleId and appleId
ALTER TABLE "Player" ADD COLUMN "googleId" TEXT;
ALTER TABLE "Player" ADD COLUMN "appleId" TEXT;

-- CreateIndex: unique constraints
CREATE UNIQUE INDEX "Player_googleId_key" ON "Player"("googleId");
CREATE UNIQUE INDEX "Player_appleId_key" ON "Player"("appleId");
