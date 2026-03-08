import express from "express";
import prisma from "../prisma.js";

const router = express.Router();

/**
 * Health check route
 * Useful to confirm Shopify app proxy is working
 */
router.get("/test", (req, res) => {
  res.set({
    "Cache-Control": "no-store",
  });

  return res.status(200).json({
    status: "tracking alive",
    time: new Date().toISOString(),
  });
});

/**
 * POST /apps/bdm-sticky-atc/track
 * Receives storefront analytics events and stores them in AnalyticsEvent.
 */
router.post("/", async (req, res) => {
  // Prevent Shopify proxy caching
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
    "Surrogate-Control": "no-store",
  });

  const body = req.body || {};

  console.log("[TRACK REQUEST]", {
    body,
    shop: req.headers["x-shopify-shop-domain"],
  });

  // 🔎 DEBUG: confirm route hit
  console.log("[TRACK] HIT", {
    path: req.originalUrl,
    method: req.method,
    query: req.query,
    headers: {
      "x-shopify-shop-domain": req.get("x-shopify-shop-domain"),
      "content-type": req.get("content-type"),
      origin: req.get("origin"),
      referer: req.get("referer"),
    },
    body,
  });

  try {
    /**
     * Resolve shop safely
     */
    let shop =
      req.query?.shop ||
      req.get("x-shopify-shop-domain") ||
      body.shop ||
      "unknown";

    shop = String(shop).trim();

    /**
     * Resolve event
     */
    const event = body?.event ? String(body.event).trim() : "";

    if (!event) {
      console.warn("[TRACK] Missing event name", {
        shop,
        body,
      });

      return res.status(200).json({
        ok: false,
        error: "Missing event",
      });
    }

    // 🔎 DEBUG: before DB write
    console.log("[TRACK] INSERTING EVENT", {
      shop,
      event,
      payloadKeys: Object.keys(body || {}),
    });

    const record = await prisma.analyticsEvent.create({
      data: {
        shop,
        event,
        payload: body,
      },
    });

    // 🔎 DEBUG: DB success
    console.log("[TRACK] INSERTED", {
      id: record.id,
      shop: record.shop,
      event: record.event,
      createdAt: record.createdAt,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[TRACK] ERROR", {
      message: err?.message,
      stack: err?.stack,
    });

    return res.status(200).json({
      ok: false,
      error: "Internal tracking error",
    });
  }
});

export default router;