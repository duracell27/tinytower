-- CreateTable
CREATE TABLE "PlayerWeeklyTokens" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlayerWeeklyTokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerTokenTournament" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerTokenTournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerTokenTournamentEntry" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "rank" INTEGER,
    "tokenCount" INTEGER NOT NULL,
    "gemsReward" INTEGER NOT NULL,
    "bonusTokens" INTEGER NOT NULL,
    "coinsReward" INTEGER NOT NULL,

    CONSTRAINT "PlayerTokenTournamentEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerWeeklyTokens_playerId_weekStart_key" ON "PlayerWeeklyTokens"("playerId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerTokenTournament_weekStart_key" ON "PlayerTokenTournament"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerTokenTournamentEntry_tournamentId_playerId_key" ON "PlayerTokenTournamentEntry"("tournamentId", "playerId");

-- AddForeignKey
ALTER TABLE "PlayerWeeklyTokens" ADD CONSTRAINT "PlayerWeeklyTokens_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerTokenTournamentEntry" ADD CONSTRAINT "PlayerTokenTournamentEntry_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "PlayerTokenTournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerTokenTournamentEntry" ADD CONSTRAINT "PlayerTokenTournamentEntry_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
