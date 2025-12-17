import express from "express";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/analytics/track
 * Receives events from the sticky ATC script
 */
router.post("/track", async (req, res) => {
  try {
    const {
      event,
      shop,
      product,
      variant,
      quantity,
      timestamp,
    } = req.body;

    if (!event || !shop) {
      return res.status(400).json({ error: "Missing event or shop" });
    }

    await prisma.stickyEvent.create({
      data: {
        event,
        shop,
        productId: product ? String(product) : null,
        variantId: variant ? String(variant) : null,
        quantity: quantity || null,
        createdAt: timestamp ? new Date(timestamp) : new Date(),
      },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Failed to track event" });
  }
});

export default router;
