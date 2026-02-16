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
   WEBHOOKS
========================================================= */
app.post(
  "/webhooks/orders/paid",
  express.raw({ type: "*/*" }),
  async (req, res) => {
    console.log("🔥 orders/paid webhook HIT");
    return ordersCreate(req, res);
  }
);

app.post(
  "/webhooks/app/uninstalled",
  express.raw({ type: "*/*" }),
  async (req, res) => {
    try {
      const shop =
        req.headers["x-shopify-shop-domain"] ||
        req.headers["X-Shopify-Shop-Domain"];

      console.log("🧹 APP_UNINSTALLED received for:", shop);

      const shopify = shopifyModule.shopify;

      if (shopify && shop) {
        const sessions =
          await shopify.config.sessionStorage.findSessionsByShop(shop);

        for (const s of sessions) {
          await shopify.config.sessionStorage.deleteSession(s.id);
        }

        console.log("🧹 Session deleted via Shopify storage:", shop);
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

/* ROUTES */
app.use("/api/settings", settingsRouter);
app.use("/api/track", trackRouter);
app.use("/apps/bdm-sticky-atc/track", trackRouter);
app.use("/apps/bdm-sticky-atc", stickyAnalyticsRouter);
app.use("/attribution", attributionRouter);

/* INIT SHOPIFY */
shopifyModule.initShopify(app);

/* STATIC */
app.use("/web", express.static(path.join(__dirname, "public")));
app.use(
  express.static(path.join(__dirname, "frontend", "dist"), {
    index: false,
  })
);

/* =========================================================
   ⭐ EMBEDDED APP LOADER (WITH BILLING CHECK ADDED)
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

  if (!req.query.shop) {
    console.log("⚠️ No shop param — ignoring non-Shopify request");
    return res.status(200).send("OK");
  }

  const shopify = shopifyModule.shopify;
  let shop = shopify.utils.sanitizeShop(String(req.query.shop));

  console.log("🔎 Checking offline session for:", shop);

  let session = null;

  try {
    const sessions =
      await shopify.config.sessionStorage.findSessionsByShop(shop);

    session = Array.isArray(sessions)
      ? sessions.find((s) => !s.isOnline)
      : null;
  } catch (e) {
    console.error("❌ Session lookup failed:", e);
  }

  if (!session) {
    console.log("🔑 No session — redirecting to OAuth");
    return res.redirect(`/auth?shop=${encodeURIComponent(shop)}`);
  }

  /* =========================================================
     💳 BILLING CHECK (ADDED)
  ========================================================= */
  try {
    const client = new shopify.clients.Graphql({ session });

    const billingCheck = await client.query({
      data: `{
        currentAppInstallation {
          activeSubscriptions {
            id
            status
          }
        }
      }`,
    });

    const active =
      billingCheck.body.data.currentAppInstallation.activeSubscriptions.length > 0;

    if (!active) {
      console.log("💳 No active subscription — redirecting to billing");
      return res.redirect(`/auth?shop=${encodeURIComponent(shop)}`);
    }
  } catch (e) {
    console.error("❌ Billing check failed:", e);
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ App running on port ${PORT}`);
});
