// web/index.js

import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import shopify from "./shopify.js";
import prisma from "./prisma.js";

// ROUTES
import trackRoutes from "./routes/track.js";
import analyticsRoutes from "./routes/stickyAnalytics.js";

// WEBHOOKS
import { ordersPaidHandler } from "./webhooks/ordersPaid.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 10000;
const app = express();

/* ────────────────────────────────────────────── */
/* MIDDLEWARE                                    */
/* ────────────────────────────────────────────── */

// Shopify requires raw body for webhooks, so we must conditionally parse
app.use((req, res, next) => {
  if (req.originalUrl.startsWith("/webhooks")) {
    next();
  } else {
    express.json()(req, res, next);
  }
});

/* ────────────────────────────────────────────── */
/* ANALYTICS TRACKING (PIXEL → BACKEND)          */
/* MUST MATCH PIXEL URL EXACTLY                  */
/* ────────────────────────────────────────────── */

app.use("/apps/bdm-sticky-atc", trackRoutes);

/* ────────────────────────────────────────────── */
/* ADMIN ANALYTICS API                            */
/* ────────────────────────────────────────────── */

app.use("/api/analytics", analyticsRoutes);

/* ────────────────────────────────────────────── */
/* SHOPIFY WEBHOOKS                               */
/* ────────────────────────────────────────────── */

app.post(
  "/webhooks/orders/paid",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      await ordersPaidHandler(
        req.headers["x-shopify-shop-domain"],
        req.body
      );
      res.status(200).send("OK");
    } catch (err) {
      console.error("Webhook error:", err);
      res.status(500).send("Webhook failed");
    }
  }
);

/* ────────────────────────────────────────────── */
/* STATIC FRONTEND (VITE BUILD)                   */
/* ────────────────────────────────────────────── */

const frontendDir = path.join(__dirname, "frontend/dist");
app.use(express.static(frontendDir));

/* ────────────────────────────────────────────── */
/* ROOT → AUTH OR APP                             */
/* ────────────────────────────────────────────── */

app.get("/", async (req, res) => {
  const { shop, host } = req.query;

  if (!shop || !host) {
    return res.redirect(`/auth?shop=${process.env.DEFAULT_SHOP}`);
  }

  return res.sendFile(path.join(frontendDir, "index.html"));
});

/* ────────────────────────────────────────────── */
/* SHOPIFY AUTH                                   */
/* ────────────────────────────────────────────── */

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

/* ────────────────────────────────────────────── */
/* SPA FALLBACK                                   */
/* ────────────────────────────────────────────── */

app.get("*", (req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

/* ────────────────────────────────────────────── */
/* START SERVER                                   */
/* ────────────────────────────────────────────── */

app.listen(PORT, () => {
  console.log(`✅ Sticky ATC backend running on port ${PORT}`);
});
