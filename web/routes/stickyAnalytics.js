import express from "express";

const router = express.Router();

/**
 * POST /track
 * Called from:
 *   /apps/bdm-sticky-atc/track  (Shopify App Proxy)
 */
router.post("/track", async (req, res) => {
  try {
    console.log("[STICKY ANALYTICS] TRACK EVENT", req.body);

    const { shop, event, data } = req.body || {};

    if (!shop || !event) {
      console.warn("[STICKY ANALYTICS] Missing shop or event");
      return res.sendStatus(400);
    }

    // TODO: write to DB (Prisma, etc)
    // await prisma.stickyEvent.create({ ... })

    res.sendStatus(200);
  } catch (err) {
    console.error("[STICKY ANALYTICS] Track error", err);
    res.sendStatus(500);
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
