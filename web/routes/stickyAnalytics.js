import express from "express";
import prisma from "../prisma/client.js";

const router = express.Router();

/**
 * GET /api/analytics/summary
 * Returns high-level Sticky ATC performance metrics
 */
router.get("/summary", async (req, res) => {
  try {
    const shop =
      req.headers["x-shopify-shop-domain"] ||
      req.query.shop;

    if (!shop) {
      return res.status(400).json({ error: "Missing shop" });
    }

    /* -----------------------------
       PAGE VIEWS
    ------------------------------ */
    const pageViews = await prisma.stickyEvent.count({
      where: {
        shop,
        event: "page_view",
      },
    });

    /* -----------------------------
       ADD TO CART (Sticky)
    ------------------------------ */
    const addToCart = await prisma.stickyEvent.count({
      where: {
        shop,
        event: "add_to_cart",
      },
    });

    const atcRate =
      pageViews > 0 ? (addToCart / pageViews) * 100 : 0;

    /* -----------------------------
       CONVERSIONS (Orders)
    ------------------------------ */
    const conversions = await prisma.stickyConversion.count({
      where: {
        shop,
      },
    });

    /* -----------------------------
       REVENUE
    ------------------------------ */
    const revenueAgg = await prisma.stickyConversion.aggregate({
      where: {
        shop,
      },
      _sum: {
        revenue: true,
      },
    });

    const revenue = revenueAgg._sum.revenue || 0;

    res.json({
      pageViews,
      addToCart,
      atcRate,
      conversions,
      revenue,
    });
  } catch (error) {
    console.error("Sticky analytics error:", error);
    res.status(500).json({ error: "Analytics failed" });
  }
});

export default router;
