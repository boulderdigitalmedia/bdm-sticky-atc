/*
  Warnings:

  - You are about to drop the `StickyAttribution` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StickyConversion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StickyEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StickyMetricsDaily` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "StickyAttribution";

-- DropTable
DROP TABLE "StickyConversion";

-- DropTable
DROP TABLE "StickyEvent";

-- DropTable
DROP TABLE "StickyMetricsDaily";

-- CreateTable
CREATE TABLE "ShopifySession" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN,
    "locale" TEXT,
    "collaborator" BOOLEAN,
    "emailVerified" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopifySession_shop_idx" ON "ShopifySession"("shop");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_shop_idx" ON "AnalyticsEvent"("shop");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_event_idx" ON "AnalyticsEvent"("event");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");
