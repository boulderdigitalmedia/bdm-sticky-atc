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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", true);

/* =========================================================
   ⭐ UNIVERSAL WEBHOOK PROCESSOR (MUST BE EARLY)
   - Use RAW body on this route only
========================================================= */
app.post("/webhooks/*", express.raw({ type: "*/*" }), async (req, res) => {
  try {
    const shopify = shopifyModule.shopify;
    if (!shopify) {
      console.error("❌ Shopify not initialized (webhooks)");
      return res.status(200).send("ok");
    }

    await shopify.webhooks.process({
      rawBody: req.body,
      rawRequest: req,
      rawResponse: res,
    });
  } catch (error) {
    console.error("❌ Universal webhook failed:", error);
    // For compliance topics, Shopify expects a 200 even if you no-op
    res.status(200).send("ok");
  }
});

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
   BODY PARSING (NON-WEBHOOK ROUTES)
========================================================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================================================
   APP UNINSTALLED WEBHOOK — SESSION CLEANUP
   (Note: This can remain, but universal webhook route will also handle it
    if you registered APP_UNINSTALLED with a callback.)
========================================================= */
app.post("/webhooks/app/uninstalled", express.raw({ type: "*/*" }), async (req, res) => {
  try {
    const shop =
      req.headers["x-shopify-shop-domain"] ||
      req.headers["X-Shopify-Shop-Domain"];

    console.log("🧹 APP_UNINSTALLED received for:", shop);

    const shopify = shopifyModule.shopify;

    if (shopify && shop) {
      const sessions = await shopify.config.sessionStorage.findSessionsByShop(shop);
      for (const s of sessions) {
        await shopify.config.sessionStorage.deleteSession(s.id);
      }
      console.log("🧹 Session deleted via Shopify storage:", shop);
    }

    res.status(200).send("ok");
  } catch (err) {
    console.error("❌ APP_UNINSTALLED cleanup failed:", err);
    res.status(200).send("ok");
  }
});

/* =========================================================
   SHOPIFY INIT
========================================================= */
shopifyModule.initShopify(app);

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
app.use("/*", async (req, res, next) => {
  if (req.method !== "GET") return next();

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

  const shop = shopify.utils.sanitizeShop(String(req.query.shop));
  if (!shop) return res.status(400).send("Invalid shop");

  console.log("🔎 Checking offline session for:", shop);

  let session = null;

  // ✅ Correct offline session retrieval (fixes 401 Unauthorized)
  try {
    const offlineId = shopify.session.getOfflineId(shop);
    session = await shopify.config.sessionStorage.loadSession(offlineId);
  } catch (e) {
    console.error("❌ Session lookup failed:", e);
  }

  if (!session?.accessToken) {
    console.log("🔑 No session — escaping iframe to OAuth");
    return res.status(200).send(`
      <html>
        <body>
          <script>
            window.top.location.href = "/auth?shop=${encodeURIComponent(shop)}";
          </script>
        </body>
      </html>
    `);
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

    const isShopifyVerification =
      Boolean(req.headers["x-shopify-topic"]) ||
      req.get("User-Agent")?.includes("Shopify");

    if (!subs.length && !isShopifyVerification) {
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