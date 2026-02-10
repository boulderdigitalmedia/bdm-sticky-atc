import express from "express";
import prisma from "../prisma.js";

const router = express.Router();

/**
 * POST /apps/bdm-sticky-atc/track
 * Receives storefront analytics events and stores them in AnalyticsEvent.
 */
router.post("/track", async (req, res) => {
  // 🔎 DEBUG: confirm the route is being hit at all
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
    body: req.body,
  });

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
      console.warn("[TRACK] Missing event name", {
        shop,
        body: req.body,
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
      payloadKeys: Object.keys(req.body || {}),
    });

    const record = await prisma.analyticsEvent.create({
      data: {
        shop,
        event,
        payload: req.body || {},
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
    // 🔴 DEBUG: DB or runtime error (currently invisible without this)
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
