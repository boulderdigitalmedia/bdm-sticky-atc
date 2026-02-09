import express from "express";
import prisma from "../prisma.js";

const router = express.Router();

/**
 * Helpers
 */
function getShop(req) {
  const shop =
    req.query.shop ||
    req.get("X-Shopify-Shop-Domain") ||
    req.get("x-shopify-shop-domain") ||
    (req.body && req.body.shop) ||
    "";

  const cleaned = String(shop).trim();

  // Treat "unknown" the same as missing
  if (!cleaned || cleaned === "unknown") return "";

  return cleaned;
}

function daysAgoDate(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

/**
 * GET /apps/bdm-sticky-atc/summary?days=7
 * Dashboard analytics
 */
router.get("/summary", async (req, res) => {
  try {
    const shop = getShop(req);
    const days = Math.max(1, parseInt(req.query.days || "7", 10));
    const since = daysAgoDate(days);

    const whereBase = {
      ...(shop ? { shop } : {}),
      createdAt: { gte: since },
    };

    const [pageViews, addToCart] = await Promise.all([
      prisma.analyticsEvent.count({
        where: { ...whereBase, event: "page_view" },
      }),
      prisma.analyticsEvent.count({
        where: { ...whereBase, event: "add_to_cart" },
      }),
    ]);

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
      pageViews > 0
        ? Math.round((addToCart / pageViews) * 1000) / 10
        : 0;

    res.json({
      days,
      pageViews,
      addToCart,
      clicks: addToCart, // ✅ frontend expects this
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
 * Debug: recent events
 * GET /apps/bdm-sticky-atc/events?limit=50
 */
router.get("/events", async (req, res) => {
  try {
    const shop = getShop(req);
    const limit = Math.min(
      200,
      Math.max(1, parseInt(req.query.limit || "50", 10))
    );

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
