-- CreateTable
CREATE TABLE "StickyEvent" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "quantity" INTEGER,
    "price" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StickyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StickyMetricsDaily" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "pageViews" INTEGER NOT NULL DEFAULT 0,
    "addToCart" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "StickyMetricsDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StickyAttribution" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "checkoutToken" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,

    CONSTRAINT "StickyAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StickyConversion" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "revenue" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StickyConversion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StickyEvent_shop_idx" ON "StickyEvent"("shop");

-- CreateIndex
CREATE INDEX "StickyEvent_event_idx" ON "StickyEvent"("event");

-- CreateIndex
CREATE INDEX "StickyEvent_timestamp_idx" ON "StickyEvent"("timestamp");

-- CreateIndex
CREATE INDEX "StickyMetricsDaily_shop_idx" ON "StickyMetricsDaily"("shop");

-- CreateIndex
CREATE INDEX "StickyMetricsDaily_date_idx" ON "StickyMetricsDaily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "StickyAttribution_checkoutToken_key" ON "StickyAttribution"("checkoutToken");

-- CreateIndex
CREATE INDEX "StickyConversion_shop_idx" ON "StickyConversion"("shop");
