import express from "express";
import prisma from "../prisma.js";

const router = express.Router();

/**
 * POST /apps/bdm-sticky-atc/track
 * Public storefront endpoint
 * Stores raw events in StickyEvent
 */
router.post("/track", async (req, res) => {
  try {
    const {
      event,
      productId,
      variantId,
      quantity,
      price,
      timestamp,
    } = req.body || {};

    // ✅ ALWAYS derive shop server-side
    const shop =
      req.headers["x-shopify-shop-domain"] ||
      req.query.shop ||
      null;

    if (!shop || !event) {
      return res.status(400).json({ error: "Missing shop or event" });
    }

    await prisma.stickyEvent.create({
      data: {
        shop: String(shop),
        event: String(event),
        productId: productId ? String(productId) : null,
        variantId: variantId ? String(variantId) : null,
        quantity: typeof quantity === "number" ? quantity : null,
        price: typeof price === "number" ? price : null,
        timestamp: timestamp ? new Date(timestamp) : undefined,
      },
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("track error:", err);
    return res.status(500).json({ error: "Track failed" });
  }
});

/**
 * POST /apps/bdm-sticky-atc/checkout
 * Web Pixel posts here when checkout completes
 * Stores attribution token for Orders Paid webhook
 */
router.post("/checkout", async (req, res) => {
  try {
    const {
      checkoutToken,
      productId,
      variantId,
      occurredAt,
    } = req.body || {};

    const shop =
      req.headers["x-shopify-shop-domain"] ||
      req.query.shop ||
      null;

    if (!shop || !checkoutToken) {
      return res.status(400).json({ error: "Missing shop or checkoutToken" });
    }

    await prisma.stickyAttribution.upsert({
      where: { checkoutToken: String(checkoutToken) },
      update: {
        shop: String(shop),
        productId: productId ? String(productId) : "unknown",
        variantId: variantId ? String(variantId) : "unknown",
        timestamp: BigInt(Date.now()),
      },
      create: {
        shop: String(shop),
        checkoutToken: String(checkoutToken),
        productId: productId ? String(productId) : "unknown",
        variantId: variantId ? String(variantId) : "unknown",
        timestamp: BigInt(Date.now()),
      },
    });

    // Optional event log for analytics
    await prisma.stickyEvent.create({
      data: {
        shop: String(shop),
        event: "checkout_completed",
        productId: productId ? String(productId) : null,
        variantId: variantId ? String(variantId) : null,
        timestamp: occurredAt ? new Date(occurredAt) : undefined,
      },
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("checkout error:", err);
    return res.status(500).json({ error: "Checkout attribution failed" });
  }
});

/**
 * GET /apps/bdm-sticky-atc/summary
 * KPI dashboard
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
      pageViews,
      addToCart,
      conversionsAgg,
      conversionsCount,
    ] = await Promise.all([
      prisma.stickyEvent.count({
        where: { shop: String(shop), event: "page_view", timestamp: { gte: since } },
      }),
      prisma.stickyEvent.count({
        where: { shop: String(shop), event: "add_to_cart", timestamp: { gte: since } },
      }),
      prisma.stickyConversion.aggregate({
        where: { shop: String(shop), occurredAt: { gte: since } },
        _sum: { revenue: true },
      }),
      prisma.stickyConversion.count({
        where: { shop: String(shop), occurredAt: { gte: since } },
      }),
    ]);

    const revenue = conversionsAgg._sum.revenue || 0;
    const atcRate = pageViews > 0 ? (addToCart / pageViews) * 100 : 0;

    return res.json({
      days,
      pageViews,
      addToCart,
      atcRate,
      conversions: conversionsCount,
      revenue,
    });
  } catch (err) {
    console.error("summary error:", err);
    return res.status(500).json({ error: "Summary failed" });
  }
});

/**
 * GET /apps/bdm-sticky-atc/timeseries
 */
router.get("/timeseries", async (req, res) => {
  try {
    const shop =
      req.query.shop ||
      req.headers["x-shopify-shop-domain"];

    const days = Math.max(1, Number(req.query.days) || 30);
    if (!shop) return res.status(400).json({ error: "Missing shop" });

    const since = new Date(Date.now() - days * 86400000);

    const eventsByDay = await prisma.$queryRaw`
      SELECT
        date_trunc('day', "timestamp")::date AS day,
        SUM(CASE WHEN event = 'page_view' THEN 1 ELSE 0 END)::int AS page_views,
        SUM(CASE WHEN event = 'add_to_cart' THEN 1 ELSE 0 END)::int AS add_to_cart
      FROM "StickyEvent"
      WHERE shop = ${String(shop)} AND "timestamp" >= ${since}
      GROUP BY 1
      ORDER BY 1 ASC;
    `;

    const convByDay = await prisma.$queryRaw`
      SELECT
        date_trunc('day', "occurredAt")::date AS day,
        COUNT(*)::int AS conversions,
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
        pageViews: Number(r.page_views || 0),
        addToCart: Number(r.add_to_cart || 0),
        conversions: 0,
        revenue: 0,
      });
    }

    for (const r of convByDay) {
      const key = String(r.day);
      const row = map.get(key) || {
        day: key,
        pageViews: 0,
        addToCart: 0,
        conversions: 0,
        revenue: 0,
      };
      row.conversions = Number(r.conversions || 0);
      row.revenue = Number(r.revenue || 0);
      map.set(key, row);
    }

    return res.json({
      days,
      points: Array.from(map.values()).sort((a, b) =>
        a.day.localeCompare(b.day)
      ),
    });
  } catch (err) {
    console.error("timeseries error:", err);
    return res.status(500).json({ error: "Timeseries failed" });
  }
});

export default router;
