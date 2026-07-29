-- Add unique constraint on playerName (case-insensitive via unique index)
CREATE UNIQUE INDEX "Player_playerName_key" ON "Player"("playerName");
