CREATE TYPE "CityInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

CREATE TABLE "CityInvite" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "token"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "cityId"          TEXT NOT NULL,
  "invitedById"     TEXT NOT NULL,
  "invitedPlayerId" TEXT NOT NULL,
  "status"          "CityInviteStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CityInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CityInvite_token_key" ON "CityInvite"("token");
CREATE INDEX "CityInvite_invitedPlayerId_status_idx" ON "CityInvite"("invitedPlayerId", "status");
CREATE INDEX "CityInvite_cityId_idx" ON "CityInvite"("cityId");

ALTER TABLE "CityInvite"
  ADD CONSTRAINT "CityInvite_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "CityInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "Player"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "CityInvite_invitedPlayerId_fkey" FOREIGN KEY ("invitedPlayerId") REFERENCES "Player"("id") ON DELETE CASCADE;

ALTER TABLE "MailMessage" ADD COLUMN "cityInviteId" TEXT;
CREATE UNIQUE INDEX "MailMessage_cityInviteId_key" ON "MailMessage"("cityInviteId");

ALTER TABLE "MailMessage"
  ADD CONSTRAINT "MailMessage_cityInviteId_fkey" FOREIGN KEY ("cityInviteId") REFERENCES "CityInvite"("id") ON DELETE SET NULL;
