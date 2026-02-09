import express from "express";
import prisma from "../prisma.js";

const router = express.Router();

/**
 * POST /apps/bdm-sticky-atc/track
 * Receives storefront analytics events and stores them in AnalyticsEvent.
 *
 * Expected payload (from your storefront script):
 * {
 *   event: "page_view" | "variant_change" | "add_to_cart" | "checkout_completed" | ...
 *   shop: "example.myshopify.com" (optional; we also accept header)
 *   variantId?: number|string
 *   sessionId?: string
 *   ts?: number
 *   ...anything else
 * }
 */
router.post("/track", async (req, res) => {
  try {
    // Prefer Shopify header, then body.shop
    const shopFromHeader =
      req.get("X-Shopify-Shop-Domain") ||
      req.get("x-shopify-shop-domain");

    const shop = (shopFromHeader || req.body?.shop || "").toString().trim();

    const event = (req.body?.event || "").toString().trim();
    const payload = req.body || {};

    // Don’t hard-fail if shop is missing (some themes/scripts won’t send it),
    // but do require an event name.
    if (!event) {
      return res.status(200).json({ ok: false, error: "Missing event" });
    }

    await prisma.analyticsEvent.create({
      data: {
        shop: shop || "unknown",
        event,
        payload, // Json field in Prisma schema
      },
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[BDM track] error", err);
    // Keep returning 200 so storefront never breaks checkout/cart UX
    return res.status(200).json({ ok: false });
  }
});

export default router;