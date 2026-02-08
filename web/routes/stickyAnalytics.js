import express from "express";
import prisma from "../prisma.js";

const router = express.Router();

/**
 * Helpers
 */
function getShop(req) {
  return (
    req.query.shop ||
    req.get("X-Shopify-Shop-Domain") ||
    req.get("x-shopify-shop-domain") ||
    req.body?.shop ||
    ""
  ).toString().trim();
}


function daysAgoDate(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

/**
 * GET /apps/bdm-sticky-atc/summary?days=7
 * Returns analytics used by your dashboard:
 * {
 *   days,
 *   pageViews,
 *   addToCart,
 *   atcRate,
 *   conversions,
 *   revenue
 * }
 */
router.get("/summary", async (req, res) => {
  try {
    const shop = getShop(req);
    const days = Math.max(1, parseInt(req.query.days || "7", 10));
    const since = daysAgoDate(days);

    // Page views + add to cart from AnalyticsEvent
    const [pageViews, addToCart] = await Promise.all([
      prisma.analyticsEvent.count({
        where: {
          ...(shop ? { shop } : {}),
          event: "page_view",
          createdAt: { gte: since },
        },
      }),
      prisma.analyticsEvent.count({
        where: {
          ...(shop ? { shop } : {}),
          event: "add_to_cart",
          createdAt: { gte: since },
        },
      }),
    ]);

    // Conversions + revenue from StickyConversion (already in your schema)
    const conversions = await prisma.stickyConversion.count({
      where: {
        ...(shop ? { shop } : {}),
        occurredAt: { gte: since },
      },
    });

    const revenueAgg = await prisma.stickyConversion.aggregate({
      where: {
        ...(shop ? { shop } : {}),
        occurredAt: { gte: since },
      },
      _sum: { revenue: true },
    });

    const revenue = Number(revenueAgg?._sum?.revenue || 0);

    const atcRate =
      pageViews > 0 ? Math.round((addToCart / pageViews) * 1000) / 10 : 0;

    res.json({
      days,
      pageViews,
      addToCart,
      atcRate,
      conversions,
      revenue,
    });
  } catch (err) {
    console.error("[BDM summary] error", err);
    res.status(500).json({ error: "Failed to load summary" });
  }
});

/**
 * Optional: a simple event feed for debugging
 * GET /apps/bdm-sticky-atc/events?limit=50
 */
router.get("/events", async (req, res) => {
  try {
    const shop = getShop(req);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || "50", 10)));

    const events = await prisma.analyticsEvent.findMany({
      where: {
        ...(shop ? { shop } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    res.json({ events });
  } catch (err) {
    console.error("[BDM events] error", err);
    res.status(500).json({ error: "Failed to load events" });
  }
});

export default router;
