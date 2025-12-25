import express from "express";
import prisma from "../prisma.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { shop, checkoutToken, timestamp } = req.body;

    if (!shop || !checkoutToken) {
      return res.status(400).json({ ok: false });
    }

    await prisma.stickyAttribution.upsert({
      where: { checkoutToken },
      update: {},
      create: {
        shop,
        checkoutToken,
        timestamp
      }
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Attribution error:", err);
    res.status(500).json({ ok: false });
  }
});

export default router;
