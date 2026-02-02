import express from "express";
import prisma from "../prisma.js";
import { randomUUID } from "crypto";

const router = express.Router();

router.post("/track", express.json(), async (req, res) => {
  try {
    const body = req.body || {};

    // Allow shop from body OR header
    const headerShop = req.get("X-Shopify-Shop-Domain");
    const shop = body.shop || headerShop;
    const event = body.event;

    if (!shop || !event) {
      return res.status(400).json({ ok: false, error: "Missing shop/event" });
    }

    // Standard payload is { shop, event, data: {...} }
    // Support legacy formats by falling back gracefully.
    const data = body.data ?? body.payload ?? {};
    const {
      productId,
      variantId,
      quantity,
      sellingPlanId,
      checkoutToken,
      sessionId,
      ts
    } = data || {};

    const timestamp = new Date(typeof ts === "number" ? ts : Date.now());

    // 1) Generic analytics (dashboard safe)
    await prisma.analyticsEvent.create({
      data: {
        shop,
        event,
        payload: data ?? {}
      }
    });

    // 2) Sticky events (dashboard counts)
    if (String(event).includes("sticky")) {
      await prisma.stickyEvent.create({
        data: {
          id: randomUUID(),
          shop,
          event,
          productId: productId ? String(productId) : null,
          variantId: variantId ? String(variantId) : null,
          quantity: quantity != null ? String(quantity) : null,
          price: null,
          timestamp
        }
      });
    }

    // 3) Sticky ATC intent (optional attribution table)
    if (
      (event === "sticky_atc_click" || event === "sticky_atc_success") &&
      variantId &&
      sessionId
    ) {
      try {
        await prisma.stickyAtcEvent.create({
          data: {
            shop,
            productId: productId ? BigInt(String(productId)) : null,
            variantId: BigInt(String(variantId)),
            checkoutToken: checkoutToken || null,
            sessionId
          }
        });
      } catch (e) {
        console.warn("Sticky ATC intent skipped:", e?.message || e);
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("Track error", err);
    return res.status(500).json({ ok: false });
  }
});

export default router;
