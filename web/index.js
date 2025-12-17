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

// If you need raw webhook body later, we can do express.raw() on that route only.
// For now keep it simple:
app.use(express.json());

// API routes
app.use("/api/analytics", analyticsRoutes);

app.post("/webhooks/orders/paid", async (req, res) => {
  await ordersPaidHandler(req.headers["x-shopify-shop-domain"], req.body);
  res.status(200).send("OK");
});

// ──────────────────────────────────────────────
// STATIC FRONTEND (must be before any catch-all)
// ──────────────────────────────────────────────
const frontendDir = path.join(__dirname, "frontend/dist");
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
// SPA fallback ONLY for non-asset routes
// (prevents /assets/*.js returning HTML)
// ──────────────────────────────────────────────
app.get(/^\/(?!assets\/).*/, (req, res) => {
  return res.sendFile(path.join(frontendDir, "index.html"));
});

// ──────────────────────────────────────────────
// START SERVER
// ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Sticky ATC running on port ${PORT}`);
  console.log(`📁 Serving admin UI from: ${frontendDir}`);
});
