import express from "express";
import prisma from "../prisma.js";

const router = express.Router();

router.post("/track", express.json(), async (req, res) => {
  try {
    const { shop, event, data } = req.body || {};
    if (!shop || !event) {
      return res.status(400).json({ ok: false });
    }

    const {
      productId,
      variantId,
      checkoutToken,
      sessionId
    } = data || {};

    const timestamp = new Date();

    /* ────────────────────────────────────────────── */
    /* 1️⃣ GENERIC ANALYTICS (UNCHANGED) */
    /* ────────────────────────────────────────────── */

    await prisma.analyticsEvent.create({
      data: {
        shop,
        event,
        payload: data ?? {}
      }
    });

    /* ────────────────────────────────────────────── */
    /* 2️⃣ STICKY EVENT (USED BY WEBHOOK FALLBACK) */
    /* ────────────────────────────────────────────── */

    if (event.startsWith("sticky_atc")) {
      await prisma.stickyEvent.create({
        data: {
          id: crypto.randomUUID(),
          shop,
          event,
          productId: productId ? String(productId) : null,
          variantId: variantId ? String(variantId) : null,
          quantity: null,
          price: null,
          timestamp
        }
      });
    }

    /* ────────────────────────────────────────────── */
    /* 3️⃣ STICKY ATC INTENT (TOKEN / SESSION MATCHING) */
    /* ────────────────────────────────────────────── */

    if (
      (event === "sticky_atc_click" || event === "sticky_atc_success") &&
      variantId &&
      sessionId
    ) {
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

    return res.json({ ok: true });
  } catch (err) {
    console.error("Track error", err);
    return res.status(500).json({ ok: false });
  }
});

export default router;
