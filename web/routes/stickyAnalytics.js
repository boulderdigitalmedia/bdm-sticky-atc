import express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

router.post("/track", async (req, res) => {
  try {
    const { type, productId, variantId, quantity } = req.body;

    await prisma.stickyEvent.create({
      data: {
        shopDomain: "unknown",  // optional: replace with session.shop
        type,
        productId,
        variantId,
        quantity: quantity || 1
      }
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error tracking event" });
  }
});

export default router;
