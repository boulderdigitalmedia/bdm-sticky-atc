import express from "express";
import dotenv from "dotenv";
import prisma from "./prisma.js";

// Load env vars
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

/* ---------------------------------------------------
   CORS — REQUIRED FOR STOREFRONT ANALYTICS
   Allows Shopify storefront → Render backend
--------------------------------------------------- */
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

/* ---------------------------------------------------
   Middleware
--------------------------------------------------- */
app.use(express.json());

/* ---------------------------------------------------
   Health Check (Render / Debug)
--------------------------------------------------- */
app.get("/", (_req, res) => {
  res.status(200).send("Sticky ATC backend running");
});

/* ---------------------------------------------------
   ANALYTICS TRACKING ENDPOINT
   Called from storefront JS / Web Pixel
--------------------------------------------------- */
app.post("/track", async (req, res) => {
  try {
    const {
      shop,
      event,
      productId,
      variantId,
      quantity,
      price,
    } = req.body;

    if (!shop || !event) {
      return res.status(400).json({
        error: "Missing required fields",
      });
    }

    await prisma.stickyEvent.create({
      data: {
        shop,
        event,
        productId,
        variantId,
        quantity,
        price,
      },
    });

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("TRACK EVENT ERROR:", error);
    res.status(500).json({ error: "Tracking failed" });
  }
});

/* ---------------------------------------------------
   DAILY METRICS (used by Analytics dashboard)
--------------------------------------------------- */
app.get("/api/analytics/summary", async (req, res) => {
  try {
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ error: "Missing shop" });
    }

    const events = await prisma.stickyEvent.findMany({
      where: { shop },
    });

    const clicks = events.filter(e => e.event === "add_to_cart").length;
    const pageViews = events.filter(e => e.event === "page_view").length;

    const revenue = events
      .filter(e => e.event === "add_to_cart" && e.price)
      .reduce((sum, e) => sum + (e.price || 0), 0);

    res.json({
      pageViews,
      clicks,
      addToCartRate: pageViews
        ? ((clicks / pageViews) * 100).toFixed(2)
        : "0.00",
      revenue,
    });
  } catch (error) {
    console.error("ANALYTICS ERROR:", error);
    res.status(500).json({ error: "Failed to load analytics" });
  }
});

/* ---------------------------------------------------
   START SERVER
--------------------------------------------------- */
app.listen(PORT, () => {
  console.log(`✅ Sticky ATC backend running on port ${PORT}`);
});
