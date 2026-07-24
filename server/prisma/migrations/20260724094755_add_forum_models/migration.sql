-- CreateEnum
CREATE TYPE "ForumCategory" AS ENUM ('NEWS', 'HELP', 'GENERAL', 'CITIES', 'PURCHASES');

-- CreateTable
CREATE TABLE "ForumPost" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "playerLevel" INTEGER NOT NULL,
    "category" "ForumCategory" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" VARCHAR(5000) NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ForumPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "playerLevel" INTEGER NOT NULL,
    "body" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ForumComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumPostRead" (
    "playerId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "lastSeenCommentCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ForumPostRead_pkey" PRIMARY KEY ("playerId","postId")
);

-- CreateIndex
CREATE INDEX "ForumPost_category_isPinned_createdAt_idx" ON "ForumPost"("category", "isPinned", "createdAt");

-- CreateIndex
CREATE INDEX "ForumPost_deletedAt_idx" ON "ForumPost"("deletedAt");

-- CreateIndex
CREATE INDEX "ForumComment_postId_createdAt_idx" ON "ForumComment"("postId", "createdAt");

-- AddForeignKey
ALTER TABLE "ForumPost" ADD CONSTRAINT "ForumPost_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumComment" ADD CONSTRAINT "ForumComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ForumPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumComment" ADD CONSTRAINT "ForumComment_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumPostRead" ADD CONSTRAINT "ForumPostRead_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ForumPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumPostRead" ADD CONSTRAINT "ForumPostRead_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
