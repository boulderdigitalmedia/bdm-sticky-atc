import express from "express";
import prisma from "../prisma.js";

const router = express.Router();

router.post("/track", async (req, res) => {
  try {
    console.log("TRACK HIT");
    console.log("BODY:", req.body);

    const { shop, event } = req.body || {};

    if (!shop || !event) {
      return res.status(400).json({ error: "Missing shop or event" });
    }

    await prisma.stickyEvent.create({
      data: {
        shop,
        event,
      },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("TRACK ERROR", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
