import express from "express";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const router = express.Router();

router.post("/track", async (req, res) => {
  try {
    const { shop, event, product, variant, quantity, price } = req.body;

    if (!shop || !event) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Store raw event
    await prisma.stickyEvent.create({
      data: {
        shop,
        event,
        productId: product?.toString() || null,
        variantId: variant?.toString() || null,
        quantity: quantity ? Number(quantity) : null,
        price: price ? Number(price) : null
      }
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("Analytics ingest error:", err);
    return res.status(500).json({ error: "Failed to save analytics" });
  }
});

router.post("/conversion", async (req, res) => {
  try {
    const { shop, product, variant, added_at, order_id, order_status } = req.body;

    await prisma.stickyConversion.create({
      data: {
        shop,
        product,
        variant,
        addedAt: new Date(added_at),
        orderId: order_id?.toString() || null,
        status: order_status || "unknown"
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Conversion save error:", err);
    res.status(500).json({ error: "Failed to save conversion" });
  }
});

export default router;
