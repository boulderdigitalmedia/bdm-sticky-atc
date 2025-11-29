// web/index.js
import express from "express";
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

/* --------------------------------------------------
   PUBLIC CORS FOR STOREFRONT ANALYTICS
-------------------------------------------------- */
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

/* --------------------------------------------------
   BILLING: ALWAYS TEST MODE DURING DEVELOPMENT
-------------------------------------------------- */
const BILLING_PLAN_NAME = "Sticky Add-to-Cart Bar Pro";

// 👇 IMPORTANT: Enables test billing so NO CREDIT CARD REQUIRED
const BILLING_TEST_MODE = true;

const billingConfig = {
  [BILLING_PLAN_NAME]: {
    amount: 4.99,
    currencyCode: "USD",
    interval: BillingInterval.Every30Days,
    trialDays: 14,
  },
};

/* --------------------------------------------------
   EMBEDDED APP SUPPORT + SHOPIFY INIT (v10)
-------------------------------------------------- */
const shopify = shopifyApp({
  api: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    apiVersion: LATEST_API_VERSION,
    scopes: (process.env.SCOPES || "read_products,write_products")
      .split(",")
      .map((s) => s.trim()),
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

  // ✔ REQUIRED FOR EMBEDDED APPS
  appUrl: process.env.SHOPIFY_APP_URL,
  embedded: true,
});

/* --------------------------------------------------
   ANALYTICS SCRIPT INJECTION
-------------------------------------------------- */
async function injectAnalyticsScript(shop) {
  try {
    const offlineId = shopify.api.session.getOfflineId(shop);
    const session =
      await shopify.config.sessionStorage.loadSession(offlineId);

    if (!session) return;

    const client = new shopify.api.clients.Rest({ session });

    const themesRes = await client.get({ path: "themes" });
    const mainTheme =
      themesRes.body.themes.find((t) => t.role === "main") ||
      themesRes.body.themes[0];

    if (!mainTheme) return;

    const assetKey = "layout/theme.liquid";

    const layoutRes = await client.get({
      path: `themes/${mainTheme.id}/assets`,
      query: { "asset[key]": assetKey },
    });

    const layout = layoutRes.body.asset?.value || "";

    const scriptTag =
      `<script src="https://sticky-add-to-cart-bar-pro.onrender.com/sticky-analytics.js" defer></script>`;

    if (layout.includes("sticky-analytics.js")) return;

    const updated = layout.includes("</head>")
      ? layout.replace("</head>", `  ${scriptTag}\n</head>`)
      : layout + "\n" + scriptTag;

    await client.put({
      path: `themes/${mainTheme.id}/assets`,
      data: { asset: { key: assetKey, value: updated } },
    });

    console.log(`🌟 Injected analytics script for ${shop}`);
  } catch (err) {
    console.error("❌ injectAnalyticsScript error:", err);
  }
}

/* --------------------------------------------------
   WEBHOOK ENDPOINT
-------------------------------------------------- */
app.post("/webhooks", async (req, res) => {
  try {
    const result = await shopify.webhooks.process(req, res);

    // Theme publish → reinject analytics
    if (result?.topic === "themes/publish") {
      await injectAnalyticsScript(result.shop);
    }

    // App uninstall cleanup
    if (result?.topic === "app/uninstalled") {
      await prisma.stickyEvent.deleteMany({
        where: { shop: result.shop },
      });
    }
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.status(500).send("Webhook error");
  }
});

/* --------------------------------------------------
   BILLING MIDDLEWARE
-------------------------------------------------- */
async function requireBilling(req, res, next) {
  try {
    const session = res.locals.shopify?.session;
    if (!session) {
      const shop = req.query.shop;
      return res.redirect(`/auth?shop=${shop}`);
    }

    const { hasActivePayment } = await shopify.api.billing.check({
      session,
      plans: [BILLING_PLAN_NAME],
      isTest: BILLING_TEST_MODE,
    });

    if (hasActivePayment) return next();

    const returnUrl = `${process.env.SHOPIFY_APP_URL}/?shop=${session.shop}`;

    const confirmationUrl = await shopify.api.billing.request({
      session,
      plan: BILLING_PLAN_NAME,
      isTest: BILLING_TEST_MODE,
      returnUrl,
    });

    return res.redirect(confirmationUrl);
  } catch (err) {
    console.error("❌ requireBilling error:", err);
    res.status(500).send("Billing error");
  }
}

/* --------------------------------------------------
   AUTH ROUTES (v10)
-------------------------------------------------- */
app.get("/auth", shopify.auth.begin());

app.get(
  "/auth/callback",
  shopify.auth.callback(),
  requireBilling,
  async (req, res) => {
    const session = res.locals.shopify.session;
    const shop = session.shop;

    await injectAnalyticsScript(shop);

    res.redirect(`/?shop=${encodeURIComponent(shop)}`);
  }
);

/* --------------------------------------------------
   PROTECTED ANALYTICS API
-------------------------------------------------- */
app.use(
  "/api/sticky",
  shopify.validateAuthenticatedSession(),
  requireBilling,
  stickyMetrics
);

/* --------------------------------------------------
   PUBLIC STOREFRONT ANALYTICS ENDPOINT
-------------------------------------------------- */
app.use("/apps/bdm-sticky-atc", stickyAnalytics);

/* --------------------------------------------------
   ADMIN UI ROOT (EMBEDDED)
-------------------------------------------------- */
app.get(
  "/",
  shopify.validateAuthenticatedSession(),
  requireBilling,
  (req, res) => {
    res.send("BDM Sticky Add-To-Cart Dashboard Loaded 🎉");
  }
);

/* --------------------------------------------------
   START SERVER
-------------------------------------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Running on port ${PORT}`);
});
