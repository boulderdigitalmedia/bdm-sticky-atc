import "dotenv/config";

import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import shopify from "./shopify.js";
import trackRoutes from "./routes/stickyAnalytics.js";
import attributionRoute from "./routes/attribution.js";
import { ordersPaidHandler } from "./webhooks/ordersPaid.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

/* ───────── BODY PARSING ───────── */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ───────── CORS FOR STOREFRONT ───────── */
app.use("/apps/bdm-sticky-atc", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

/* ───────── ANALYTICS ───────── */
app.use("/apps/bdm-sticky-atc", trackRoutes);
app.use("/apps/bdm-sticky-atc/attribution", attributionRoute);

/* ───────── WEBHOOK ───────── */
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

/* ───────── FRONTEND ───────── */
const frontendDir = path.join(__dirname, "frontend", "dist");
app.use(express.static(frontendDir));

app.get("/", async (req, res) => {
  const { shop, host } = req.query;
  if (!shop || !host) {
    return res.redirect(`/auth?shop=${process.env.DEFAULT_SHOP}`);
  }
  return res.sendFile(path.join(frontendDir, "index.html"));
});

/* ───────── AUTH ───────── */
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

/* ───────── SPA FALLBACK ───────── */
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Sticky ATC backend running on port ${PORT}`);
});
