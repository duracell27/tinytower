-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "rcProductId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "gemsGranted" INTEGER NOT NULL DEFAULT 0,
    "toolsGranted" JSONB,
    "tokensGranted" JSONB,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_transactionId_key" ON "Purchase"("transactionId");

-- CreateIndex
CREATE INDEX "Purchase_playerId_idx" ON "Purchase"("playerId");

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
