-- CreateTable
CREATE TABLE "CityNotification" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "authorLevel" INTEGER NOT NULL DEFAULT 1,
    "text" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CityNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CityNotificationRead" (
    "notificationId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CityNotificationRead_pkey" PRIMARY KEY ("notificationId","playerId")
);

-- CreateIndex
CREATE INDEX "CityNotification_cityId_createdAt_idx" ON "CityNotification"("cityId", "createdAt");

-- AddForeignKey
ALTER TABLE "CityNotification" ADD CONSTRAINT "CityNotification_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityNotification" ADD CONSTRAINT "CityNotification_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityNotificationRead" ADD CONSTRAINT "CityNotificationRead_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "CityNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityNotificationRead" ADD CONSTRAINT "CityNotificationRead_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
