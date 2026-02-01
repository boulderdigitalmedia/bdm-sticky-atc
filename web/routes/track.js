import express from "express";
import prisma from "../prisma.js";

const router = express.Router();

router.post("/track", express.json(), async (req, res) => {
  try {
    const body = req.body || {};
    const event = body.event;

    // ✅ Resolve shop from multiple sources (very important)
    // Shopify app proxy commonly provides X-Shopify-Shop-Domain.
    const shop =
      body.shop ||
      req.get("X-Shopify-Shop-Domain") ||
      req.get("x-shopify-shop-domain") ||
      null;

    if (!shop || !event) {
      return res.status(400).json({ ok: false, reason: "missing_shop_or_event" });
    }

    // ✅ Support both legacy + current payload formats
    const data = body.data ?? body;

    const {
      productId,
      variantId,
      checkoutToken,
      sessionId,
      quantity,
      price
    } = data || {};

    const timestamp = new Date();

    /* ────────────────────────────────────────────── */
    /* 1️⃣ GENERIC ANALYTICS */
    /* ────────────────────────────────────────────── */
    await prisma.analyticsEvent.create({
      data: {
        shop,
        event,
        payload: data ?? {}
      }
    });

    /* ────────────────────────────────────────────── */
    /* 2️⃣ STICKY EVENTS (DASHBOARD COUNTS) */
    /* ────────────────────────────────────────────── */
    if (String(event).includes("sticky")) {
      await prisma.stickyEvent.create({
        data: {
          id: crypto.randomUUID(),
          shop,
          event,
          productId: productId != null ? String(productId) : null,
          variantId: variantId != null ? String(variantId) : null,
          quantity: quantity != null ? Number(quantity) : null,
          price: price != null ? Number(price) : null,
          timestamp
        }
      });
    }

    /* ────────────────────────────────────────────── */
    /* 3️⃣ STICKY ATC INTENT (ATTRIBUTION) */
    /* ────────────────────────────────────────────── */
    if (
      (event === "sticky_atc_click" ||
        event === "sticky_atc_add_to_cart" ||
        event === "sticky_atc_success") &&
      variantId &&
      sessionId
    ) {
      try {
        // BigInt-safe parsing
        const vId = BigInt(String(variantId).trim());
        const pId = productId != null ? BigInt(String(productId).trim()) : null;

        await prisma.stickyAtcEvent.create({
          data: {
            shop,
            productId: pId,
            variantId: vId,
            checkoutToken: checkoutToken || null,
            sessionId
          }
        });
      } catch (e) {
        // ⚠️ Do not break tracking if attribution insert fails
        console.warn("Sticky ATC intent skipped:", e.message);
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("Track error", err);
    return res.status(500).json({ ok: false });
  }
});

export default router;
