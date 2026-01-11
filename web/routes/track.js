import express from "express";
import prisma from "../prisma.js";

const router = express.Router();

router.post("/track", express.json(), async (req, res) => {
  try {
    const { shop, event, data } = req.body || {};

    if (!shop || !event) {
      return res.status(400).json({ ok: false, error: "Missing shop or event" });
    }

    await prisma.analyticsEvent.create({
      data: {
        shop,
        event,
        payload: data ?? {}
      }
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("Track error:", err);
    return res.status(500).json({ ok: false, error: "Tracking failed" });
  }
});

export default router;
