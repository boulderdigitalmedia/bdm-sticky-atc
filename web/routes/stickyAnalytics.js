import express from "express";
import { prisma } from "../prisma.js";

const router = express.Router();

/**
 * POST /api/analytics/track
 * Public endpoint (storefront script hits this).
 * Stores raw events in StickyEvent.
 */
router.post("/track", async (req, res) => {
  try {
    const {
      shop,
      event,
      productId,
      variantId,
      quantity,
      price, // dollars (float) is fine for your schema
      timestamp,
    } = req.body || {};

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
 * POST /api/analytics/checkout
 * Web Pixel posts here when checkout completes.
 * We store attribution token (checkoutToken) so webhook can finalize later.
 */
router.post("/checkout", async (req, res) => {
  try {
    const {
      shop,
      checkoutToken,
      productId,
      variantId,
      occurredAt,
    } = req.body || {};

    if (!shop || !checkoutToken) {
      return res.status(400).json({ error: "Missing shop or checkoutToken" });
    }

    // StickyAttribution has unique checkoutToken
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

    // Optional: also log an event so you can chart "checkouts started/completed"
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
 * GET /api/analytics/summary?shop=xxx&days=30
 * Dashboard KPIs
 */
router.get("/summary", async (req, res) => {
  try {
    const shop =
      req.query.shop ||
      req.headers["x-shopify-shop-domain"];

    const days = Math.max(1, Number(req.query.days) || 30);
    if (!shop) return res.status(400).json({ error: "Missing shop" });

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [pageViews, addToCart, conversionsAgg, conversionsCount] =
      await Promise.all([
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
 * GET /api/analytics/timeseries?shop=xxx&days=30
 * Returns daily points for charts (page_views, add_to_cart, conversions, revenue)
 * Uses SQL date_trunc for Postgres.
 */
router.get("/timeseries", async (req, res) => {
  try {
    const shop =
      req.query.shop ||
      req.headers["x-shopify-shop-domain"];

    const days = Math.max(1, Number(req.query.days) || 30);
    if (!shop) return res.status(400).json({ error: "Missing shop" });

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

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

    // merge by day
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
      const existing = map.get(key) || {
        day: key,
        pageViews: 0,
        addToCart: 0,
        conversions: 0,
        revenue: 0,
      };
      existing.conversions = Number(r.conversions || 0);
      existing.revenue = Number(r.revenue || 0);
      map.set(key, existing);
    }

    return res.json({
      days,
      points: Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day)),
    });
  } catch (err) {
    console.error("timeseries error:", err);
    return res.status(500).json({ error: "Timeseries failed" });
  }
});

/**
 * GET /api/analytics/products?shop=xxx&days=30
 * Top products by ATC and by conversion revenue.
 */
router.get("/products", async (req, res) => {
  try {
    const shop =
      req.query.shop ||
      req.headers["x-shopify-shop-domain"];

    const days = Math.max(1, Number(req.query.days) || 30);
    if (!shop) return res.status(400).json({ error: "Missing shop" });

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const topAtc = await prisma.$queryRaw`
      SELECT
        "productId",
        COUNT(*)::int AS atc
      FROM "StickyEvent"
      WHERE shop = ${String(shop)}
        AND event = 'add_to_cart'
        AND "timestamp" >= ${since}
        AND "productId" IS NOT NULL
      GROUP BY "productId"
      ORDER BY atc DESC
      LIMIT 20;
    `;

    // If you want "revenue per attributed product", you need product attribution.
    // We use StickyAttribution checkoutToken -> productId
    const topRevenue = await prisma.$queryRaw`
      SELECT
        a."productId",
        COUNT(c."orderId")::int AS conversions,
        COALESCE(SUM(c."revenue"), 0)::float AS revenue
      FROM "StickyConversion" c
      JOIN "StickyAttribution" a
        ON a."shop" = c."shop"
      WHERE c.shop = ${String(shop)}
        AND c."occurredAt" >= ${since}
      GROUP BY a."productId"
      ORDER BY revenue DESC
      LIMIT 20;
    `;

    return res.json({ days, topAtc, topRevenue });
  } catch (err) {
    console.error("products error:", err);
    return res.status(500).json({ error: "Products failed" });
  }
});

export default router;
