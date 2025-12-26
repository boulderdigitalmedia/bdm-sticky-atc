import express from "express";
import prisma from "../prisma.js";

const router = express.Router();

/**
 * POST /apps/bdm-sticky-atc/attribution
 * Called when checkout is initiated from Sticky ATC
 */
router.post("/attribution", async (req, res) => {
  try {
    const {
      shop,
      checkoutToken,
      productId,
      variantId,
    } = req.body;

    if (!shop || !checkoutToken) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await prisma.stickyAttribution.create({
      data: {
        shop,
        checkoutToken,
        productId,
        variantId,
        timestamp: Date.now(),
      },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Attribution error:", err);
    res.status(500).json({ error: "Failed to store attribution" });
  }
});

export default router;
