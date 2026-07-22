-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "country" TEXT;

-- CreateIndex
CREATE INDEX "ChatMessage_country_createdAt_idx" ON "ChatMessage"("country", "createdAt");
