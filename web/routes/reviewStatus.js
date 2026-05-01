import express from "express";
import prisma from "../prisma.js";

const router = express.Router();

const DAYS_BEFORE_PROMPT = 5;
const MS = 1000 * 60 * 60 * 24 * DAYS_BEFORE_PROMPT;

// GET — should we show the review prompt?
router.get("/", async (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).json({ error: "Missing shop" });

  try {
    const settings = await prisma.shopSettings.findUnique({ where: { shop } });
    if (!settings) return res.json({ showPrompt: false });

    // Already dismissed or reviewed
    if (settings.reviewPromptShown) return res.json({ showPrompt: false });

    // Not enough time has passed since install
    const installedAt = settings.createdAt;
    const now = new Date();
    if (now - new Date(installedAt) < MS) {
      return res.json({ showPrompt: false });
    }

    // Fetch their 5-day stats to show in the modal
    const since = new Date(Date.now() - MS);

    const [clicks, conversions, revenue] = await Promise.all([
      prisma.stickyAtcEvent.count({
        where: { shop, createdAt: { gte: since } },
      }),
      prisma.stickyConversion.count({
        where: { shop, occurredAt: { gte: since } },
      }),
      prisma.stickyConversion.aggregate({
        where: { shop, occurredAt: { gte: since } },
        _sum: { revenue: true },
      }),
    ]);

    return res.json({
      showPrompt: true,
      stats: {
        clicks,
        conversions,
        revenue: revenue._sum.revenue ?? 0,
      },
    });
  } catch (e) {
    console.error("review-status GET failed:", e);
    return res.json({ showPrompt: false });
  }
});

// POST — merchant dismissed or left a review
router.post("/", async (req, res) => {
  const { shop } = req.query;
  const { dismissed, left_review } = req.body;
  if (!shop) return res.status(400).json({ error: "Missing shop" });

  try {
    await prisma.shopSettings.update({
      where: { shop },
      data: { reviewPromptShown: true },
    });
    res.json({ ok: true });
  } catch (e) {
    console.error("review-status POST failed:", e);
    res.status(500).json({ error: "Failed to save" });
  }
});

export default router;