import express from "express";
import prisma from "../prisma.js";

const router = express.Router();

/**
 * POST /track
 *
 * Generic analytics + Sticky ATC attribution
 */
router.post("/track", express.json(), async (req, res) => {
  try {
    const { shop, event, data } = req.body || {};

    if (!shop || !event) {
      return res.status(400).json({ ok: false, error: "Missing shop or event" });
    }

    /**
     * Always store the generic analytics event (unchanged behavior)
     */
    await prisma.analyticsEvent.create({
      data: {
        shop,
        event,
        payload: data ?? {}
      }
    });

    /**
     * Sticky ATC attribution event
     */
    if (event === "sticky_atc_click") {
      const {
        productId,
        variantId,
        checkoutToken,
        sessionId
      } = data || {};

      if (!variantId || !sessionId) {
        // Do not fail the request — just skip attribution
        console.warn("Sticky ATC event missing attribution fields", {
          shop,
          variantId,
          sessionId
        });
      } else {
        await prisma.stickyAtcEvent.create({
          data: {
            shop,
            productId: productId ? BigInt(productId) : null,
            variantId: BigInt(variantId),
            checkoutToken: checkoutToken || null,
            sessionId
          }
        });
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("Track error:", err);
    return res.status(500).json({ ok: false, error: "Tracking failed" });
  }
});

export default router;
