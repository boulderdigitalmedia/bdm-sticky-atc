import express from "express";
- import prisma from "../prisma/client.js";
+ import { PrismaClient } from "@prisma/client";

+ const prisma = new PrismaClient();


const router = express.Router();

router.post("/conversion", async (req, res) => {
  try {
    const { shop, orderId, revenue, currency, occurredAt } = req.body;

    await prisma.stickyConversion.create({
      data: {
        shop,
        orderId,
        revenue: Number(revenue),
        currency,
        occurredAt: new Date(occurredAt),
      },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ ok: false });
  }
});

export default router;
