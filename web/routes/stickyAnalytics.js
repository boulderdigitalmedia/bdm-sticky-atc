import express from "express";
import prisma from "../prisma.js";

const router = express.Router();

/**
 * GET /apps/bdm-sticky-atc/summary
 * KPI dashboard (FIXED)
 */
router.get("/summary", async (req, res) => {
  try {
    const shop =
      req.query.shop ||
      req.headers["x-shopify-shop-domain"];

    const days = Math.max(1, Number(req.query.days) || 30);
    if (!shop) return res.status(400).json({ error: "Missing shop" });

    const since = new Date(Date.now() - days * 86400000);

    const [
      impressions,
      clicks,
      atcSuccess,
      conversionsAgg,
      conversionsCount
    ] = await Promise.all([
      prisma.analyticsEvent.count({
        where: {
          shop: String(shop),
          event: "sticky_atc_impression",
          createdAt: { gte: since }
        }
      }),
      prisma.analyticsEvent.count({
        where: {
          shop: String(shop),
          event: "sticky_atc_click",
          createdAt: { gte: since }
        }
      }),
      prisma.analyticsEvent.count({
        where: {
          shop: String(shop),
          event: "sticky_atc_success",
          createdAt: { gte: since }
        }
      }),
      prisma.stickyConversion.aggregate({
        where: {
          shop: String(shop),
          occurredAt: { gte: since }
        },
        _sum: { revenue: true }
      }),
      prisma.stickyConversion.count({
        where: {
          shop: String(shop),
          occurredAt: { gte: since }
        }
      })
    ]);

    const revenue = conversionsAgg._sum.revenue || 0;

    return res.json({
      days,
      impressions,
      clicks,
      addToCart: atcSuccess,
      atcRate: impressions > 0 ? (atcSuccess / impressions) * 100 : 0,
      purchases: conversionsCount,
      revenue
    });
  } catch (err) {
    console.error("summary error:", err);
    return res.status(500).json({ error: "Summary failed" });
  }
});

/**
 * GET /apps/bdm-sticky-atc/timeseries
 * Daily charts (FIXED)
 */
router.get("/timeseries", async (req, res) => {
  try {
    const shop =
      req.query.shop ||
      req.headers["x-shopify-shop-domain"];

    const days = Math.max(1, Number(req.query.days) || 30);
    if (!shop) return res.status(400).json({ error: "Missing shop" });

    const since = new Date(Date.now() - days * 86400000);

    // Impressions + ATC success from AnalyticsEvent
    const eventsByDay = await prisma.$queryRaw`
      SELECT
        date_trunc('day', "createdAt")::date AS day,
        SUM(CASE WHEN event = 'sticky_atc_impression' THEN 1 ELSE 0 END)::int AS impressions,
        SUM(CASE WHEN event = 'sticky_atc_success' THEN 1 ELSE 0 END)::int AS add_to_cart
      FROM "AnalyticsEvent"
      WHERE shop = ${String(shop)} AND "createdAt" >= ${since}
      GROUP BY 1
      ORDER BY 1 ASC;
    `;

    // Purchases + revenue from StickyConversion
    const convByDay = await prisma.$queryRaw`
      SELECT
        date_trunc('day', "occurredAt")::date AS day,
        COUNT(*)::int AS purchases,
        COALESCE(SUM("revenue"), 0)::float AS revenue
      FROM "StickyConversion"
      WHERE shop = ${String(shop)} AND "occurredAt" >= ${since}
      GROUP BY 1
      ORDER BY 1 ASC;
    `;

    const map = new Map();

    for (const r of eventsByDay) {
      map.set(String(r.day), {
        day: String(r.day),
        impressions: Number(r.impressions || 0),
        addToCart: Number(r.add_to_cart || 0),
        purchases: 0,
        revenue: 0
      });
    }

    for (const r of convByDay) {
      const key = String(r.day);
      const row = map.get(key) || {
        day: key,
        impressions: 0,
        addToCart: 0,
        purchases: 0,
        revenue: 0
      };
      row.purchases = Number(r.purchases || 0);
      row.revenue = Number(r.revenue || 0);
      map.set(key, row);
    }

    return res.json({
      days,
      points: Array.from(map.values()).sort((a, b) =>
        a.day.localeCompare(b.day)
      )
    });
  } catch (err) {
    console.error("timeseries error:", err);
    return res.status(500).json({ error: "Timeseries failed" });
  }
});

export { router };
export default router;
