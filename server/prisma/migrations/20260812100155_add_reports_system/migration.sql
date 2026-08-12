-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('CHAT_MESSAGE', 'FORUM_POST', 'FORUM_COMMENT');

-- CreateEnum
CREATE TYPE "ReportCategory" AS ENUM ('SPAM', 'INSULT', 'ADVERTISEMENT', 'PROFANITY', 'THREAT', 'OTHER');

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reportCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ForumComment" ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reportCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ForumPost" ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reportCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "category" "ReportCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Report_reporterId_targetType_targetId_key" ON "Report"("reporterId", "targetType", "targetId");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
