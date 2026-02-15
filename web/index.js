console.log("🚀 INDEX FILE LOADED");

import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import prisma from "./prisma.js";
import * as shopifyModule from "./shopify.js";

import settingsRouter from "./routes/settings.js";
import trackRouter from "./routes/track.js";
import stickyAnalyticsRouter from "./routes/stickyAnalytics.js";
import attributionRouter from "./routes/attribution.js";
import { ordersCreate } from "./routes/webhooks.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", true);

/* =========================================================
   CORS
========================================================= */
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Shopify-Shop-Domain"],
    credentials: true,
  })
);
app.options("*", cors());

/* =========================================================
   WEBHOOK — RAW BODY
========================================================= */
app.post(
  "/webhooks/orders/paid",
  express.raw({ type: "*/*" }),
  async (req, res) => {
    console.log("🔥 orders/paid webhook HIT");
    return ordersCreate(req, res);
  }
);

/* =========================================================
   APP UNINSTALLED WEBHOOK — SESSION CLEANUP
========================================================= */
app.post(
  "/webhooks/app/uninstalled",
  express.raw({ type: "*/*" }),
  async (req, res) => {
    try {
      const shop =
        req.headers["x-shopify-shop-domain"] ||
        req.headers["X-Shopify-Shop-Domain"];

      console.log("🧹 APP_UNINSTALLED received for:", shop);

      if (shop) {
        await prisma.session.deleteMany({
          where: { shop },
        });
        console.log("🧹 Sessions deleted for:", shop);
      }

      res.status(200).send("ok");
    } catch (err) {
      console.error("❌ APP_UNINSTALLED cleanup failed:", err);
      res.status(500).send("error");
    }
  }
);

/* =========================================================
   BODY PARSING
========================================================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================================================
   ROUTES
========================================================= */
app.use("/api/settings", settingsRouter);
app.use("/api/track", trackRouter);
app.use("/apps/bdm-sticky-atc/track", trackRouter);
app.use("/apps/bdm-sticky-atc", stickyAnalyticsRouter);
app.use("/attribution", attributionRouter);

/* =========================================================
   SHOPIFY INIT
========================================================= */
shopifyModule.initShopify(app);

/* =========================================================
   STATIC FILES
========================================================= */
app.use("/web", express.static(path.join(__dirname, "public")));
app.use(
  express.static(path.join(__dirname, "frontend", "dist"), {
    index: false,
  })
);

/* =========================================================
   DEBUG ROUTE
========================================================= */
app.get("/__debug/conversions", async (req, res) => {
  const rows = await prisma.stickyConversion.findMany({
    orderBy: { occurredAt: "desc" },
    take: 5,
  });
  res.json(rows);
});

/* =========================================================
   ⭐ EMBEDDED APP LOADER (FIXED SESSION CHECK)
========================================================= */
app.get("/*", async (req, res, next) => {
  const p = req.path || "";

  if (
    p.startsWith("/auth") ||
    p.startsWith("/webhooks") ||
    p.startsWith("/api") ||
    p.startsWith("/__debug")
  ) {
    return next();
  }

  console.log("📥 Loader hit:", req.originalUrl);

  let shop = req.query.shop;
  const host = req.query.host;

  if (!shop || !host) {
    console.log("⚠️ Missing shop or host — blocking direct access");
    return res.status(200).send(`
      <html>
        <head><title>Sticky Add To Cart Bar</title></head>
        <body style="font-family:sans-serif;padding:24px;">
          <h2>Sticky Add To Cart Bar</h2>
          <p>This app must be opened from inside Shopify Admin.</p>
        </body>
      </html>
    `);
  }

  const shopify = shopifyModule.shopify;

  if (!shopify) {
    console.error("❌ Shopify not initialized");
    return res.status(500).send("Shopify not ready");
  }

  shop = shopify.utils.sanitizeShop(String(shop));
  if (!shop) {
    console.error("❌ Invalid shop param");
    return res.status(400).send("Invalid shop");
  }

  console.log("🔎 Checking offline session for:", shop);

  let session = null;

  try {
    // ⭐ FIX: use Prisma instead of getOfflineId()
    session = await prisma.session.findFirst({
      where: {
        shop: shop,
        isOnline: false,
      },
    });
  } catch (e) {
    console.error("❌ Session lookup failed:", e);
  }

  if (!session) {
    console.log("🔑 No session — redirecting to OAuth");
    return res.redirect(`/auth?shop=${encodeURIComponent(shop)}`);
  }

  console.log("✅ Session found — loading SPA");

  const indexPath = path.join(
    __dirname,
    "frontend",
    "dist",
    "index.html"
  );

  const apiKey = process.env.SHOPIFY_API_KEY || "";

  const html = fs
    .readFileSync(indexPath, "utf8")
    .replace(
      "</head>",
      `<script>window.__SHOPIFY_API_KEY__ = ${JSON.stringify(
        apiKey
      )};</script></head>`
    );

  res.send(html);
});

/* =========================================================
   START SERVER
========================================================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ App running on port ${PORT}`);
});
