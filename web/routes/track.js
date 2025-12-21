// web/routes/track.js

import express from "express";
import prisma from "../prisma.js";

const router = express.Router();

router.post("/track", async (req, res) => {
  try {
    console.log("TRACK HIT");
    console.log("Headers:", req.headers);
    console.log("Body:", req.body);

    const { shop, event } = req.body;

    if (!shop || !event) {
      return res.status(400).json({ error: "Missing shop or event" });
    }

    await prisma.stickyEvent.create({
      data: {
        shop,
        event,
      },
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("TRACK ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
