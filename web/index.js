import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import shopify from "./shopify.js";
import { billingConfig } from "./billing.js";

import analyticsRoutes from "./routes/stickyAnalytics.js";
import { ordersPaidHandler } from "./webhooks/ordersPaid.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 10000;
const app = express();

/**
 * IMPORTANT:
 * - Use JSON for most routes
 * - Webhooks need RAW body. We'll mount that route before express.json()
 */

// ──────────────────────────────────────────────
// WEBHOOK: orders/paid (raw body)
// ──────────────────────────────────────────────
app.post(
  "/webhooks/orders/paid",
  express.text({ type: "application/json" }),
  async (req, res) => {
    try {
      const shop = req.headers["x-shopify-shop-domain"];
      const payload = JSON.parse(req.body || "{}");
      await ordersPaidHandler(shop, payload);
      res.status(200).send("OK");
    } catch (e) {
      console.error("orders/paid webhook error:", e);
      res.status(200).send("OK"); // Shopify expects 200 often; don’t retry-storm
    }
  }
);

// ──────────────────────────────────────────────
// JSON middleware (after webhook)
// ──────────────────────────────────────────────
app.use(express.json());

// ──────────────────────────────────────────────
// ANALYTICS API (public track + dashboard reads)
// ──────────────────────────────────────────────
app.use("/api/analytics", analyticsRoutes);

// ──────────────────────────────────────────────
// STATIC FRONTEND (Vite build output)
// ──────────────────────────────────────────────
const frontendDir = path.join(__dirname, "frontend", "dist");
app.use(express.static(frontendDir));

// ──────────────────────────────────────────────
// AUTH + BILLING
// ──────────────────────────────────────────────
app.get("/auth", shopify.auth.begin());

app.get(
  "/auth/callback",
  shopify.auth.callback(),
  async (req, res, next) => {
    try {
      await shopify.ensureInstalledOnShop(req, res);
      await shopify.billing.ensure(req, res, billingConfig);
      return res.redirect(`/?shop=${req.query.shop}&host=${req.query.host}`);
    } catch (e) {
      next(e);
    }
  }
);

// ──────────────────────────────────────────────
// ROOT: serve frontend
// ──────────────────────────────────────────────
app.get("/", async (req, res) => {
  return res.sendFile(path.join(frontendDir, "index.html"));
});

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
  console.log(`🚀 Sticky ATC running on port ${PORT}`);
  console.log(`📁 Serving admin UI from: ${frontendDir}`);
});
