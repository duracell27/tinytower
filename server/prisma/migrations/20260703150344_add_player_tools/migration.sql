-- CreateTable
CREATE TABLE "PlayerTools" (
    "id" SERIAL NOT NULL,
    "playerId" TEXT NOT NULL,
    "briks" INTEGER NOT NULL DEFAULT 1,
    "glass" INTEGER NOT NULL DEFAULT 1,
    "nails" INTEGER NOT NULL DEFAULT 1,
    "screw" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PlayerTools_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerTools_playerId_key" ON "PlayerTools"("playerId");

-- AddForeignKey
ALTER TABLE "PlayerTools" ADD CONSTRAINT "PlayerTools_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
