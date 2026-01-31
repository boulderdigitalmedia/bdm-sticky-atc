import express from "express";
import prisma from "../prisma.js";

const router = express.Router();

/**
 * POST /track
 * Called from:
 *   /apps/bdm-sticky-atc/track  (Shopify App Proxy)
 */
router.post("/track", async (req, res) => {
  try {
    const body = req.body || {};
    const event = body.event;

    // 🔐 Infer shop safely (never require it)
    const shop =
      body.shop ||
      req.get("X-Shopify-Shop-Domain") ||
      req.query.shop ||
      "unknown";

    // ❗ Event is the ONLY required field
    if (!event) {
      return res.status(204).end(); // silent ignore
    }

    await prisma.analyticsEvent.create({
      data: {
        shop,
        event,
        payload: {
          ...body,
          shop: undefined, // avoid duplication
        },
        createdAt: body.ts ? new Date(body.ts) : new Date(),
      },
    });

    // ✅ ALWAYS succeed to storefront
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[STICKY ANALYTICS] Track error", err);

    // ❗ NEVER error to Shopify storefront
    res.status(200).json({ ok: false });
  }
});

/**
 * GET /summary
 * Called from:
 *   /apps/bdm-sticky-atc/summary (embedded admin)
 */
router.get("/summary", async (req, res) => {
  try {
    const shop = req.query.shop;
    if (!shop) {
      return res.status(400).json({ error: "Missing shop" });
    }

    const [pageViews, addToCart, revenueAgg] = await Promise.all([
      prisma.analyticsEvent.count({
        where: {
          shop,
          event: { in: ["page_view", "sticky_atc_impression"] },
        },
      }),
      prisma.analyticsEvent.count({
        where: {
          shop,
          event: {
            in: ["add_to_cart", "sticky_atc_click", "sticky_atc_success"],
          },
        },
      }),
      prisma.stickyConversion.aggregate({
        where: { shop },
        _sum: { revenue: true },
      }),
    ]);

    const atcRate = pageViews > 0 ? (addToCart / pageViews) * 100 : null;
    const revenue = revenueAgg._sum.revenue ?? null;

    res.json({
      shop,
      pageViews,
      addToCart,
      atcRate,
      revenue,
    });
  } catch (err) {
    console.error("[STICKY ANALYTICS] Summary error", err);
    res.status(500).json({ error: true });
  }
});

/**
 * POST /checkout
 * Called from:
 *   /apps/bdm-sticky-atc/checkout (Shopify App Proxy)
 */
router.post("/checkout", async (req, res) => {
  try {
    const { cartToken, productId, variantId } = req.body || {};

    if (!cartToken || !productId || !variantId) {
      return res.status(204).end();
    }

    // Future attribution logic here

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[STICKY ANALYTICS] Checkout error", err);
    res.status(200).json({ ok: false });
  }
});

export default router;
