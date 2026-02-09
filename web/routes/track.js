import express from "express";
import prisma from "../prisma.js";

const router = express.Router();

/**
 * POST /apps/bdm-sticky-atc/track
 * Receives storefront analytics events and stores them in AnalyticsEvent.
 *
 * Expected payload:
 * {
 *   event: "page_view" | "variant_change" | "add_to_cart" | "checkout_completed"
 *   shop?: "example.myshopify.com"
 *   variantId?: number | string
 *   sessionId?: string
 *   ts?: number
 *   ...any other data
 * }
 */
router.post("/track", async (req, res) => {
  try {
    // --- Resolve shop safely ---
    let shop = "";

    if (req.query && req.query.shop) {
      shop = req.query.shop;
    } else if (req.get("X-Shopify-Shop-Domain")) {
      shop = req.get("X-Shopify-Shop-Domain");
    } else if (req.get("x-shopify-shop-domain")) {
      shop = req.get("x-shopify-shop-domain");
    } else if (req.body && req.body.shop) {
      shop = req.body.shop;
    }

    shop = String(shop || "unknown").trim();

    // --- Resolve event ---
    const event =
      req.body && req.body.event
        ? String(req.body.event).trim()
        : "";

    if (!event) {
      // Do not hard-fail storefront UX
      return res.status(200).json({
        ok: false,
        error: "Missing event",
      });
    }

    // --- Persist event ---
    await prisma.analyticsEvent.create({
      data: {
        shop,
        event,
        payload: req.body || {},
      },
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[BDM track] error:", err);

    // Always return 200 so storefront never breaks
    return res.status(200).json({
      ok: false,
      error: "Internal tracking error",
    });
  }
});

export default router;