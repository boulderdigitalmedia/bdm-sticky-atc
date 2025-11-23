// web/routes/stickyMetrics.js
import express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

/**
 * GET /api/sticky/summary
 * Returns summary stats for the current shop
 */
router.get("/summary", async (req, res) => {
  try {
    const session = res.locals.shopify?.session;
    if (!session) {
      return res.status(401).json({ error: "No Shopify session" });
    }

    const shopDomain = session.shop;

    const [
      impressions,
      atcClicks,
      addToCartEvents,
      qtyAgg,
      variantCounts,
    ] = await Promise.all([
      prisma.StickyEvent.count({
        where: { shopDomain, type: "impression" },
      }),
      prisma.StickyEvent.count({
        where: { shopDomain, type: "atc_click" },
      }),
      prisma.StickyEvent.count({
        where: { shopDomain, type: "add_to_cart" },
      }),
      prisma.StickyEvent.aggregate({
        where: { shopDomain, type: "add_to_cart" },
        _sum: { quantity: true },
      }),
      prisma.StickyEvent.groupBy({
        by: ["variantId"],
        where: {
          shopDomain,
          type: "add_to_cart",
          variantId: { not: "" },
        },
        _count: { _all: true },
      }),
    ]);

    router.get("/daily", async (req, res) => {
  try {
    const data = await prisma.stickyDailySummary.findMany({
      orderBy: { date: "asc" },
    });

    res.json(data);
  } catch (err) {
    console.error("Failed to fetch daily analytics", err);
    res.status(500).json({ error: true });
  }
});

    
    const totalQty = qtyAgg._sum.quantity || 0;
    const conversionRate =
      impressions > 0 ? addToCartEvents / impressions : null;
    const avgQuantity =
      addToCartEvents > 0 ? totalQty / addToCartEvents : null;

    return res.json({
      shopDomain,
      impressions,
      atcClicks,
      addToCartEvents,
      conversionRate,      // add_to_cart / impressions
      avgQuantity,         // items per add_to_cart event
      topVariants: variantCounts
        .sort((a, b) => b._count._all - a._count._all)
        .slice(0, 10),
    });
  } catch (err) {
    console.error("Sticky metrics error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
