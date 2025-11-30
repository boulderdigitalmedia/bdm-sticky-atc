// web/index.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { shopifyApp } from "@shopify/shopify-app-express";
import {
  BillingInterval,
  LATEST_API_VERSION,
} from "@shopify/shopify-api";
import { PrismaClient } from "@prisma/client";

import stickyAnalytics from "./routes/stickyAnalytics.js";
import stickyMetrics from "./routes/stickyMetrics.js";

const prisma = new PrismaClient();
const app = express();
app.use(express.json());

/* Resolve dirname */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDist = path.join(__dirname, "frontend", "dist");
console.log("📁 Serving admin UI from:", frontendDist);

/* CORS for storefront analytics */
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

/* Billing Setup */
const BILLING_PLAN_NAME = "Sticky Add-to-Cart Bar Pro";
const BILLING_TEST_MODE = process.env.SHOPIFY_BILLING_TEST === "true";

const billingConfig = {
  [BILLING_PLAN_NAME]: {
    amount: 4.99,
    currencyCode: "USD",
    interval: BillingInterval.Every30Days,
    trialDays: 14,
  },
};

/* Shopify Init */
const shopify = shopifyApp({
  api: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    apiVersion: LATEST_API_VERSION,
    scopes: (process.env.SCOPES || "read_products,write_products").split(","),
    hostName: process.env.HOST.replace(/^https?:\/\//, ""),
    billing: billingConfig,
  },
  auth: {
    path: "/auth",
    callbackPath: "/auth/callback",
  },
  webhooks: {
    path: "/webhooks",
  },
});

/* -------------------------
   Theme Script Injection
-------------------------- */
async function injectAnalyticsScript(shop) {
  try {
    const offlineId = shopify.api.session.getOfflineId(shop);
    const session = await shopify.config.sessionStorage.loadSession(offlineId);
    if (!session) return;

    const client = new shopify.api.clients.Rest({ session });
    const themes = await client.get({ path: "themes" });
    const mainTheme =
      themes.body.themes?.find((t) => t.role === "main") ||
      themes.body.themes?.[0];

    if (!mainTheme) return;

    const assetKey = "layout/theme.liquid";
    const themeFile = await client.get({
      path: `themes/${mainTheme.id}/assets`,
      query: { "asset[key]": assetKey },
    });

    const layout = themeFile.body.asset?.value || "";
    const injection = `<script src="https://sticky-add-to-cart-bar-pro.onrender.com/sticky-analytics.js" defer></script>`;

    if (layout.includes("sticky-analytics.js")) return;

    const updated = layout.includes("</head>")
      ? layout.replace("</head>", `${injection}\n</head>`)
      : `${layout}\n${injection}\n`;

    await client.put({
      path: `themes/${mainTheme.id}/assets`,
      data: { asset: { key: assetKey, value: updated } },
    });

    console.log(`🌟 Injected analytics into ${shop}`);
  } catch (err) {
    console.error("❌ Analytics inject error:", err);
  }
}

/* --------------------------
   Billing Middleware
--------------------------- */
async function requireBilling(req, res, next) {
  try {
    const session = res.locals.shopify.session;

    const { hasActivePayment } = await shopify.api.billing.check({
      session,
      plans: [BILLING_PLAN_NAME],
      isTest: BILLING_TEST_MODE,
    });

    if (hasActivePayment) return next();

    const appUrl =
      process.env.SHOPIFY_APP_URL || `https://${process.env.HOST}`;

    const confirmUrl = await shopify.api.billing.request({
      session,
      plan: BILLING_PLAN_NAME,
      isTest: BILLING_TEST_MODE,
      returnUrl: `${appUrl}/billing/complete?shop=${session.shop}&host=${session.host}`,
    });

    return res.redirect(confirmUrl);
  } catch (err) {
    console.error("❌ Billing error:", err);
    res.status(500).send("Billing error");
  }
}

/* --------------------------
   FIXED INSTALL ROUTE
   (this is the missing piece)
--------------------------- */
app.get("/", async (req, res) => {
  const shop = req.query.shop;
  const host = req.query.host;

  // First access from Shopify has just shop (no host)
  if (shop && !host) {
    const encodedHost = Buffer.from(`${shop}/admin`).toString("base64");
    return res.redirect(`/?shop=${shop}&host=${encodedHost}`);
  }

  // No shop at all -> start OAuth
  if (!shop) {
    return res.redirect(`/auth?shop=bdm-sandbox.myshop.myshopify.com`);
  }

  return res.sendFile(path.join(frontendDist, "index.html"));
});

/* --------------------------
   OAuth Routes
--------------------------- */
app.get("/auth", shopify.auth.begin());

app.get(
  "/auth/callback",
  shopify.auth.callback(),

  // Store host param
  async (req, res, next) => {
    const session = res.locals.shopify.session;
    if (req.query.host) {
      session.host = req.query.host;
      await shopify.config.sessionStorage.storeSession(session);
    }
    next();
  },

  requireBilling,

  async (req, res) => {
    const shop = res.locals.shopify.session.shop;
    const host = res.locals.shopify.session.host;

    await injectAnalyticsScript(shop);

    return res.redirect(`/?shop=${shop}&host=${host}`);
  }
);

/* --------------------------
   Billing Completion
--------------------------- */
app.get("/billing/complete", (req, res) => {
  const { shop, host } = req.query;
  return res.redirect(`/?shop=${shop}&host=${host}`);
});

/* --------------------------
   API + Analytics Routes
--------------------------- */
app.use(
  "/api/sticky",
  shopify.validateAuthenticatedSession(),
  requireBilling,
  stickyMetrics
);

app.use("/apps/bdm-sticky-atc", stickyAnalytics);

/* --------------------------
   Serve Admin UI
--------------------------- */
app.use(
  shopify.ensureInstalledOnShop(),
  express.static(frontendDist)
);

/* Catch-All */
app.get(
  "/*",
  shopify.ensureInstalledOnShop(),
  (req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  }
);

/* --------------------------
   Start Server
--------------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Sticky ATC running on port ${PORT}`)
);
