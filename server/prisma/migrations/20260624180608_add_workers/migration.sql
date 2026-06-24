-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 100,
    "stateVersion" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Floor" (
    "id" SERIAL NOT NULL,
    "playerId" TEXT NOT NULL,
    "floorId" INTEGER NOT NULL,

    CONSTRAINT "Floor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Production" (
    "id" SERIAL NOT NULL,
    "floorDbId" INTEGER NOT NULL,
    "slotIdx" INTEGER NOT NULL,
    "typeId" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'IDLE',
    "stageStartedAt" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "Production_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Worker" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "female" BOOLEAN NOT NULL,
    "floorType" TEXT NOT NULL,
    "dreamJob" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "hairColor" TEXT NOT NULL,
    "assignedFloorId" INTEGER,
    "assignedSlotIdx" INTEGER,

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommandLog" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "floorId" INTEGER,
    "slotIdx" INTEGER,
    "typeId" TEXT,
    "workerId" TEXT,
    "timestamp" BIGINT NOT NULL,
    "serverTime" BIGINT NOT NULL,
    "cursor" SERIAL NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommandLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_email_key" ON "Player"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Floor_playerId_floorId_key" ON "Floor"("playerId", "floorId");

-- CreateIndex
CREATE UNIQUE INDEX "Production_floorDbId_slotIdx_key" ON "Production"("floorDbId", "slotIdx");

-- CreateIndex
CREATE INDEX "Worker_playerId_idx" ON "Worker"("playerId");

-- CreateIndex
CREATE INDEX "CommandLog_playerId_cursor_idx" ON "CommandLog"("playerId", "cursor");

-- AddForeignKey
ALTER TABLE "Floor" ADD CONSTRAINT "Floor_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Production" ADD CONSTRAINT "Production_floorDbId_fkey" FOREIGN KEY ("floorDbId") REFERENCES "Floor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
