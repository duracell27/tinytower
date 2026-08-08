-- CreateTable
CREATE TABLE "MailMessage" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MailMessage_toId_isRead_idx" ON "MailMessage"("toId", "isRead");

-- CreateIndex
CREATE INDEX "MailMessage_toId_createdAt_idx" ON "MailMessage"("toId", "createdAt");

-- AddForeignKey
ALTER TABLE "MailMessage" ADD CONSTRAINT "MailMessage_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailMessage" ADD CONSTRAINT "MailMessage_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
