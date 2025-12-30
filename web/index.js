// web/index.js

import "dotenv/config"; // ✅ Safe: loads .env locally, ignored by Render

import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import shopify from "./shopify.js";
import trackRoutes from "./routes/stickyAnalytics.js";
import attributionRoute from "./routes/attribution.js";
import { ordersPaidHandler } from "./webhooks/ordersPaid.js";

// ──────────────────────────────────────────────
// PATH SETUP
// ──────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ──────────────────────────────────────────────
// APP INIT
// ──────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 10000;
// ──────────────────────────────────────────────
// APP PROXY TEST ROUTES (REQUIRED)
// ──────────────────────────────────────────────
app.get("/apps/bdm-sticky-atc", (req, res) => {
  res.status(200).send("Sticky ATC proxy OK");
});

app.get("/apps/bdm-sticky-atc/health", (req, res) => {
  res.json({ ok: true });
});

// ──────────────────────────────────────────────
// BODY PARSING
// ──────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ──────────────────────────────────────────────
// ANALYTICS TRACKING (CORS SAFE FOR STOREFRONT)
// ──────────────────────────────────────────────
app.use("/apps/bdm-sticky-atc", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

app.use("/apps/bdm-sticky-atc", trackRoutes);
app.use("/apps/bdm-sticky-atc/attribution", attributionRoute);
app.use("/apps/bdm-sticky-atc", attributionRoute);


// ──────────────────────────────────────────────
// SHOPIFY WEBHOOKS
// ──────────────────────────────────────────────
app.post("/webhooks/orders/paid", async (req, res) => {
  try {
    await ordersPaidHandler(
      req.headers["x-shopify-shop-domain"],
      req.body
    );
    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.status(500).send("Webhook failed");
  }
});

// ──────────────────────────────────────────────
// STATIC FRONTEND (VITE BUILD)
// ──────────────────────────────────────────────
const frontendDir = path.join(__dirname, "frontend", "dist");
app.use(express.static(frontendDir));

// ──────────────────────────────────────────────
// ROOT → AUTH OR LOAD APP
// ──────────────────────────────────────────────
app.get("/", async (req, res) => {
  const { shop, host } = req.query;

  if (!shop || !host) {
    return res.redirect(`/auth?shop=${process.env.DEFAULT_SHOP}`);
  }

  return res.sendFile(path.join(frontendDir, "index.html"));
});

// ──────────────────────────────────────────────
// SHOPIFY AUTH
// ──────────────────────────────────────────────
app.get("/auth", shopify.auth.begin());

app.get(
  "/auth/callback",
  shopify.auth.callback(),
  async (req, res, next) => {
    try {
      await shopify.ensureInstalledOnShop(req, res);
      return res.redirect(`/?shop=${req.query.shop}&host=${req.query.host}`);
    } catch (err) {
      next(err);
    }
  }
);

// ──────────────────────────────────────────────
// SPA CATCH-ALL
// ──────────────────────────────────────────────
app.get("*", (req, res) => {
  return res.sendFile(path.join(frontendDir, "index.html"));
});

// ──────────────────────────────────────────────
// START SERVER
// ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Sticky ATC backend running on port ${PORT}`);
});
