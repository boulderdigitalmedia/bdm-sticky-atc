console.log("🚀 INDEX FILE LOADED");

import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { verifyWebhook } from "./verifyWebhook.js";

import prisma from "./prisma.js";
import * as shopifyModule from "./shopify.js";

import settingsRouter from "./routes/settings.js";
import trackRouter from "./routes/track.js";
import stickyAnalyticsRouter from "./routes/stickyAnalytics.js";
import attributionRouter from "./routes/attribution.js";
import { ordersUpdated } from "./routes/webhooks.js";

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
   APP UNINSTALLED WEBHOOK — SESSION CLEANUP
========================================================= */
app.post(
  "/webhooks/app/uninstalled",
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
// Shopify webhooks MUST use raw body for HMAC verification
app.use("/webhooks", express.raw({ type: "*/*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================================================
   WEBHOOK — RAW BODY
========================================================= */
app.post("/webhooks/orders/paid", async (req, res) => {
  try {
    console.log("🔥 ORDERS_PAID webhook received");

    const payload =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body?.length
          ? JSON.parse(req.body.toString())
          : {};

    console.log("💰 Paid order:", payload.id);

    const revenue = parseFloat(payload.current_total_price || "0");

await prisma.stickyConversion.upsert({
  where: { id: `order_${payload.id}` },
  update: {},
  create: {
    id: `order_${payload.id}`,
    shop: payload.domain,
    orderId: String(payload.id),
    revenue: parseFloat(payload.current_total_price || "0"),
    currency: payload.currency || "USD", // ⭐ add this line
    occurredAt: new Date(payload.created_at),
  },
});

console.log("💵 Revenue recorded:", revenue);

    // 👉 call your existing logic here if needed
    // await ordersUpdated(payload);

    res.status(200).send("ok");
  } catch (err) {
    console.error("❌ ORDERS_PAID failed:", err);
    res.status(500).send("error");
  }
});

/* =========================================================
   SHOPIFY INIT
========================================================= */
shopifyModule.initShopify(app);

/**
 * Shopify Mandatory Compliance Webhooks
 */

// Customers Data Request
app.post("/webhooks/customers/data_request", verifyWebhook, async (req, res) => {
  console.log("customers/data_request webhook received");
  res.status(200).send("ok");
});

// Customers Redact
app.post("/webhooks/customers/redact", verifyWebhook, async (req, res) => {
  console.log("customers/redact webhook received");
  res.status(200).send("ok");
});

// Shop Redact
app.post("/webhooks/shop/redact", verifyWebhook, async (req, res) => {
  console.log("shop/redact webhook received");
  res.status(200).send("ok");
});

/* =========================================================
   ROUTES
========================================================= */
app.use("/api/settings", settingsRouter);
app.use("/api/track", trackRouter);
app.use("/apps/bdm-sticky-atc/track", trackRouter);
app.use("/apps/bdm-sticky-atc", stickyAnalyticsRouter);
app.use("/attribution", attributionRouter);


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
   ⭐ EMBEDDED APP LOADER (FINAL FIX + BILLING ROUTE)
========================================================= */
app.get("/*", async (req, res, next) => {

  const p = req.path || "";

  if (
    p.startsWith("/auth") ||
    p.startsWith("/billing") ||
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

  if (!shopify) {
    console.error("❌ Shopify not initialized");
    return res.status(500).send("Shopify not ready");
  }

  const host = req.query.host ? String(req.query.host) : null;

  let shop = shopify.utils.sanitizeShop(String(req.query.shop));
  if (!shop) return res.status(400).send("Invalid shop");

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
   💳 MANAGED PRICING CHECK
========================================================= */
try {
  const client = new shopify.clients.Graphql({ session });

  const billingCheck = await client.request(`
    query {
      currentAppInstallation {
        activeSubscriptions {
          id
          status
        }
      }
    }
  `);

  const subs =
    billingCheck?.data?.currentAppInstallation?.activeSubscriptions || [];

  if (!subs.length) {
    console.log("💳 No active subscription — redirecting to Managed Pricing");

    const storeHandle = String(shop).replace(".myshopify.com", "");
    const appHandle = process.env.SHOPIFY_APP_HANDLE;

    if (!appHandle) {
      console.error("❌ Missing SHOPIFY_APP_HANDLE env var");
      return res.status(500).send("Missing SHOPIFY_APP_HANDLE");
    }

    const pricingUrl =
      `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;

    return res.status(200).send(`
      <!doctype html>
      <html>
        <body>
          <script>
            window.top.location.href = ${JSON.stringify(pricingUrl)};
          </script>
        </body>
      </html>
    `);
  }
} catch (e) {
  console.error("❌ Billing check failed:", e);
}

  console.log("✅ Session found — loading SPA");

  const indexPath = path.join(__dirname, "frontend", "dist", "index.html");

  const apiKey = process.env.SHOPIFY_API_KEY || "";

  const html = fs
    .readFileSync(indexPath, "utf8")
    .replace(
      "</head>",
      `<script>window.__SHOPIFY_API_KEY__ = ${JSON.stringify(apiKey)};</script></head>`
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

