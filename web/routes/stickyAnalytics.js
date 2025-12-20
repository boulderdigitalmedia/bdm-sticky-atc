import express from "express";
import prisma from "../prisma/client.js";

const router = express.Router();

/*
  GET /api/analytics/summary
  Returns high-level performance metrics for the app
*/
router.get("/summary", async (req, res) => {
  try {
    const shop =
      req.headers["x-shopify-shop-domain"] ||
      req.query.shop ||
      req.shop;

    if (!shop) {
      return res.status(400).json({ error: "Shop missing" });
    }

    /* -----------------------------
       Sticky ATC Clicks
    ------------------------------ */
    const clickCount = await prisma.analyticsEvent.count({
      where: {
        shop,
        event: "add_to_cart",
      },
    });

    /* -----------------------------
       Product Page Views
       (baseline for ATC rate)
    ------------------------------ */
    const pageViews = await prisma.analyticsEvent.count({
      where: {
        shop,
        event: "page_view",
      },
    });

    const atcRate =
      pageViews > 0 ? (clickCount / pageViews) * 100 : null;

    /* -----------------------------
       Revenue Influenced
       Orders that followed Sticky ATC
    ------------------------------ */
    const influencedOrders = await prisma.order.findMany({
      where: {
        shop,
        source: "sticky_atc",
        financialStatus: "paid",
      },
      select: {
        totalPrice: true,
      },
    });

    const revenue = influencedOrders.reduce(
      (sum, o) => sum + Number(o.totalPrice),
      0
    );

    res.json({
      clicks: clickCount,
      atcRate,
      revenue,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ error: "Analytics failed" });
  }
});

export default router;
