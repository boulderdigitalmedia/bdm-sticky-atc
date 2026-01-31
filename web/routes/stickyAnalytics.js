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
    console.log("[STICKY ANALYTICS] TRACK EVENT", req.body);

    const { shop: bodyShop, event, data, ...rest } = req.body || {};
    const shop = bodyShop || req.query.shop;

    if (!shop || !event) {
      console.warn("[STICKY ANALYTICS] Missing shop or event");
      return res.sendStatus(400);
    }

    await prisma.analyticsEvent.create({
      data: {
        shop,
        event,
        payload: data ?? rest ?? {}
      }
    });

    res.sendStatus(200);
  } catch (err) {
    console.error("[STICKY ANALYTICS] Track error", err);
    res.sendStatus(500);
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
        where: { shop, event: "page_view" }
      }),
      prisma.analyticsEvent.count({
        where: {
          shop,
          event: {
            in: ["add_to_cart", "sticky_atc_click", "sticky_atc_success"]
          }
        }
      }),
      prisma.stickyConversion.aggregate({
        where: { shop },
        _sum: { revenue: true }
      })
    ]);

    const atcRate = pageViews > 0 ? (addToCart / pageViews) * 100 : null;
    const revenue = revenueAgg._sum.revenue ?? null;

    return res.json({
      shop,
      clicks: addToCart,
      addToCart,
      atcRate,
      revenue
    });
  } catch (err) {
    console.error("[STICKY ANALYTICS] Summary error", err);
    return res.status(500).json({ error: true });
  }
});

/**
 * POST /checkout
 * Called from:
 *   /apps/bdm-sticky-atc/checkout (Shopify App Proxy)
 */
router.post("/checkout", async (req, res) => {
  try {
    console.log("[STICKY ANALYTICS] CHECKOUT ATTRIBUTION", req.body);

    const { cartToken, productId, variantId } = req.body || {};

    if (!cartToken || !productId || !variantId) {
      console.warn("[STICKY ANALYTICS] Missing attribution data");
      return res.sendStatus(400);
    }

    // TODO: write attribution to DB
    // await prisma.stickyAttribution.create({ ... })

    res.sendStatus(200);
  } catch (err) {
    console.error("[STICKY ANALYTICS] Checkout error", err);
    res.sendStatus(500);
  }
});

export default router;
