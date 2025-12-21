// web/routes/track.js

import express from "express";
import prisma from "../prisma.js";

const router = express.Router();

/**
 * POST /apps/bdm-sticky-atc/track
 * Receives browser events from the Sticky ATC bar
 */
router.post("/track", async (req, res) => {
  try {
    const {
      shop,
      event,
      productId,
      variantId,
      quantity,
      price,
    } = req.body;

    if (!shop || !event) {
      return res.status(400).json({ error: "Missing shop or event" });
    }

    await prisma.stickyEvent.create({
      data: {
        shop,
        event,
        productId: productId || null,
        variantId: variantId || null,
        quantity: quantity ? Number(quantity) : null,
        price: price ? Number(price) : null,
      },
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Sticky ATC track error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
