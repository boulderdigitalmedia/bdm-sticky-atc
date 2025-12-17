// web/index.js
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

// ──────────────────────────────────────────────
// MIDDLEWARE
// ──────────────────────────────────────────────
app.use(express.json());

// ──────────────────────────────────────────────
// ANALYTICS API
// ──────────────────────────────────────────────
app.use("/api/analytics", analyticsRoutes);

// ──────────────────────────────────────────────
// WEBHOOKS
// ──────────────────────────────────────────────
app.post("/webhooks/orders/paid", async (req, res) => {
  await ordersPaidHandler(
    req.headers["x-shopify-shop-domain"],
    req.body
  );
  res.status(200).send("OK");
});

// ──────────────────────────────────────────────
// STATIC FRONTEND (VITE BUILD OUTPUT)
// ──────────────────────────────────────────────
const frontendDir = path.join(__dirname, "frontend", "dist");
app.use(express.static(frontendDir));

// ──────────────────────────────────────────────
// ROOT URL
// Shopify always loads apps with shop + host
// ──────────────────────────────────────────────
app.get("/", async (req, res) => {
  const { shop, host } = req.query;

  if (!shop || !host) {
    return res.redirect(`/auth?shop=${process.env.DEFAULT_SHOP}`);
  }

  return res.sendFile(path.join(frontendDir, "index.html"));
});

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
// SPA CATCH-ALL (DO NOT INTERCEPT ASSETS)
// THIS FIXES THE BLANK SCREEN BUG
// ──────────────────────────────────────────────
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/assets/")) {
    return next(); // let express.static handle JS/CSS
  }

  return res.sendFile(path.join(frontendDir, "index.html"));
});

// ──────────────────────────────────────────────
// START SERVER
// ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Sticky ATC running on port ${PORT}`);
  console.log(`📁 Serving admin UI from: ${frontendDir}`);
});
