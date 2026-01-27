import express from "express";
import prisma from "../prisma.js";

const router = express.Router();

router.post("/track", express.json(), async (req, res) => {
  try {
    const { shop, event, data } = req.body || {};
    if (!shop || !event) {
      return res.status(400).json({ ok: false });
    }

    // Always store generic analytics
    await prisma.analyticsEvent.create({
      data: {
        shop,
        event,
        payload: data ?? {}
      }
    });

    // Sticky ATC attribution intent
    if (
      event === "sticky_atc_click" ||
      event === "sticky_atc_success"
    ) {
      const { productId, variantId, checkoutToken, sessionId } = data || {};

      if (variantId && sessionId) {
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
    console.error("Track error", err);
    return res.status(500).json({ ok: false });
  }
});

export default router;
