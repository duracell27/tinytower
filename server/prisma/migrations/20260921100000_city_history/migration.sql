-- CreateTable
CREATE TABLE "CityHistoryEvent" (
    "id"         TEXT NOT NULL,
    "cityId"     TEXT NOT NULL,
    "eventType"  TEXT NOT NULL,
    "actorId"    TEXT,
    "actorName"  TEXT NOT NULL,
    "targetId"   TEXT,
    "targetName" TEXT,
    "fromRole"   TEXT,
    "toRole"     TEXT,
    "toLevel"    INTEGER,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CityHistoryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CityHistoryEvent_cityId_createdAt_idx" ON "CityHistoryEvent"("cityId", "createdAt");

-- AddForeignKey
ALTER TABLE "CityHistoryEvent" ADD CONSTRAINT "CityHistoryEvent_cityId_fkey"
    FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityHistoryEvent" ADD CONSTRAINT "CityHistoryEvent_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityHistoryEvent" ADD CONSTRAINT "CityHistoryEvent_targetId_fkey"
    FOREIGN KEY ("targetId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
