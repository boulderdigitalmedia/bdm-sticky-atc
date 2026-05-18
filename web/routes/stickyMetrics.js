// web/routes/stickyMetrics.js
import express from "express";
import prisma from "../prisma.js";

const router = express.Router();

/**
 * Resolve shop the same way stickyAnalytics.js does, so this route
 * works whether the caller passes ?shop=, an X-Shopify-Shop-Domain
 * header, or a body { shop }.
 */
function getShop(req) {
  const shop =
    req.query.shop ||
    req.get("X-Shopify-Shop-Domain") ||
    req.get("x-shopify-shop-domain") ||
    (req.body && req.body.shop) ||
    "";

  const cleaned = String(shop).trim();
  if (!cleaned || cleaned === "unknown") return "";
  return cleaned;
}

/**
 * GET /api/sticky/summary
 *
 * Returns summary stats for the current shop. The JSON shape is kept
 * backwards-compatible with the original implementation so any existing
 * caller continues to work, but the numbers are now derived from the
 * current AnalyticsEvent schema. `avgQuantity` and `topVariants` are no
 * longer tracked at the event level, so they return safe empty values.
 */
router.get("/summary", async (req, res) => {
  try {
    const shop = getShop(req);
    const whereBase = shop ? { shop } : {};

    const [impressions, atcClicks, addToCartEvents] = await Promise.all([
      prisma.analyticsEvent.count({
        where: { ...whereBase, event: "page_view" },
      }),
      prisma.analyticsEvent.count({
        where: { ...whereBase, event: "sticky_atc_click" },
      }),
      prisma.analyticsEvent.count({
        where: {
          ...whereBase,
          event: { in: ["add_to_cart", "sticky_atc_click"] },
        },
      }),
    ]);

    const conversionRate =
      impressions > 0 ? addToCartEvents / impressions : null;

    return res.json({
      shopDomain: shop,
      impressions,
      atcClicks,
      addToCartEvents,
      conversionRate,
      avgQuantity: null,
      topVariants: [],
    });
  } catch (err) {
    console.error("Sticky metrics summary error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/sticky/daily
 *
 * Returns daily rollup rows from the StickyMetricsDaily table
 * (the cron at cron/dailyAnalytics.js populates this).
 */
router.get("/daily", async (req, res) => {
  try {
    const shop = getShop(req);
    const data = await prisma.stickyMetricsDaily.findMany({
      where: shop ? { shop } : undefined,
      orderBy: { date: "asc" },
    });

    res.json(data);
  } catch (err) {
    console.error("Failed to fetch daily analytics:", err);
    res.status(500).json({ error: true });
  }
});

export default router;
