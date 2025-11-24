// web/index.js
import express from "express";
import { shopifyApp } from "@shopify/shopify-app-express";
import {
  BillingInterval,
  LATEST_API_VERSION,
  DeliveryMethod,
} from "@shopify/shopify-api";
import { PrismaClient } from "@prisma/client";

import stickyAnalytics from "./routes/stickyAnalytics.js";
import stickyMetrics from "./routes/stickyMetrics.js";

const prisma = new PrismaClient(); // reserved for analytics, etc.
const app = express();

app.use(express.json());

// Allow storefront JS to POST analytics to this app
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

const BILLING_PLAN_NAME = "Sticky Add-to-Cart Bar Pro";
const BILLING_TEST_MODE = process.env.SHOPIFY_BILLING_TEST === "true";

/* ----------------------------------------
   BILLING CONFIG (for shopify.api.billing)
----------------------------------------- */

const billingConfig = {
  [BILLING_PLAN_NAME]: {
    amount: 4.99,
    currencyCode: "USD",
    interval: BillingInterval.Every30Days,
    trialDays: 14,
  },
};

/* ----------------------------------------
   SHOPIFY APP INIT (v10 style)
----------------------------------------- */

const shopify = shopifyApp({
  api: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    apiVersion: LATEST_API_VERSION, // or "2024-10"
    scopes: (process.env.SCOPES || "read_products,write_products")
      .split(",")
      .map((s) => s.trim()),
    hostName: (process.env.HOST || "").replace(/^https?:\/\//, "").trim(),

    // ⬅️ billing config for v10
    billing: billingConfig,
  },

  auth: {
    path: "/auth",
    callbackPath: "/auth/callback",
  },

  webhooks: {
    path: "/webhooks",
    // These topics will be registered automatically
    topics: [
      "CHECKOUTS_CREATE",
      "ORDERS_PAID",
      "APP_UNINSTALLED",
      "THEMES_PUBLISH",
    ],
  },
});

/* ----------------------------------------
   THEME INJECTION HELPER
   - Injects {% render 'sticky-atc-bar' %} into main theme
----------------------------------------- */

async function injectStickyForShop(shop) {
  try {
    const offlineId = shopify.api.session.getOfflineId(shop);
    const session = await shopify.config.sessionStorage.loadSession(offlineId);

    if (!session) {
      console.warn("⚠️ No offline session found for shop", shop);
      return;
    }

    const client = new shopify.api.clients.Rest({ session });

    // 1) Get themes, find main theme
    const themesRes = await client.get({ path: "themes" });
    const themes = themesRes.body.themes || [];
    const mainTheme =
      themes.find((t) => t.role === "main") || themes[0];

    if (!mainTheme) {
      console.warn("⚠️ No main theme found for", shop);
      return;
    }

    // 2) Get layout/theme.liquid
    const assetKey = "layout/theme.liquid";
    const assetRes = await client.get({
      path: `themes/${mainTheme.id}/assets`,
      query: { "asset[key]": assetKey },
    });

    const layout = assetRes.body.asset?.value || "";
    if (!layout) {
      console.warn(
        "⚠️ No layout/theme.liquid content for theme",
        mainTheme.id,
        "shop",
        shop
      );
      return;
    }

    // 3) If snippet already present, do nothing
    if (layout.includes("sticky-atc-bar")) {
      console.log("✅ Sticky snippet already present for", shop);
      return;
    }

    const snippetTag = `{% render 'sticky-atc-bar' %}`;
    let updated;

    if (layout.includes("</body>")) {
      updated = layout.replace(
        "</body>",
        `  ${snippetTag}\n</body>`
      );
    } else {
      // Fallback: just append at end
      updated = `${layout}\n${snippetTag}\n`;
    }

    // 4) Save updated theme.liquid
    await client.put({
      path: `themes/${mainTheme.id}/assets`,
      data: {
        asset: {
          key: assetKey,
          value: updated,
        },
      },
    });

    console.log(
      `🎯 Injected sticky-atc-bar snippet into ${shop}, theme ${mainTheme.id}`
    );
  } catch (err) {
    console.error("❌ Error injecting sticky bar for", shop, err);
  }
}

/* ----------------------------------------
   WEBHOOK HANDLERS (uninstall + theme publish)
----------------------------------------- */

/* ----------------------------------------
   WEBHOOK HANDLERS (v8 syntax)
----------------------------------------- */

app.post("/webhooks", async (req, res) => {
  try {
    await shopify.webhooks.process(req, res);
  } catch (err) {
    console.error("❌ Webhook processing failed:", err);
    res.status(500).send("Webhook error");
  }
});

// Register APP_UNINSTALLED webhook
shopify.webhooks.register({
  session: null,
  topic: "APP_UNINSTALLED",
  deliveryMethod: "http",
  address: `${process.env.SHOPIFY_APP_URL}/webhooks`,
});

// Register THEMES_PUBLISH webhook
shopify.webhooks.register({
  session: null,
  topic: "THEMES_PUBLISH",
  deliveryMethod: "http",
  address: `${process.env.SHOPIFY_APP_URL}/webhooks`,
});


/* ----------------------------------------
   BILLING MIDDLEWARE (uses shopify.api.billing)
----------------------------------------- */

async function requireBilling(req, res, next) {
  try {
    const session = res.locals.shopify?.session;

    if (!session) {
      console.error("❌ requireBilling: missing Shopify session");
      const shop = req.query.shop;
      if (shop) {
        return res.redirect(`/auth?shop=${encodeURIComponent(shop)}`);
      }
      return res.status(401).send("Missing Shopify session");
    }

    // 1️⃣ Check if the shop already has an active subscription
    const { hasActivePayment } = await shopify.api.billing.check({
      session,
      plans: [BILLING_PLAN_NAME],
      isTest: BILLING_TEST_MODE,
    });

    if (hasActivePayment) {
      return next();
    }

    // 2️⃣ No active billing – request subscription
    const appUrl =
      process.env.SHOPIFY_APP_URL || `https://${process.env.HOST}`;
    const returnUrl = `${appUrl}/?shop=${encodeURIComponent(
      session.shop
    )}`;

    const confirmationUrl = await shopify.api.billing.request({
      session,
      plan: BILLING_PLAN_NAME,
      isTest: BILLING_TEST_MODE,
      returnUrl,
    });

    console.log(
      "🧾 Redirecting merchant to billing approval:",
      confirmationUrl
    );
    return res.redirect(confirmationUrl);
  } catch (error) {
    console.error("❌ Billing check/request error:", error);
    return res.status(500).send("Billing error");
  }
}

/* ----------------------------------------
   AUTH + CALLBACK + EXITIFRAME
----------------------------------------- */

// Start OAuth
app.get("/auth", shopify.auth.begin());

// OAuth callback
app.get(
  "/auth/callback",
  shopify.auth.callback(),
  requireBilling,
  async (req, res) => {
    const session = res.locals.shopify?.session;
    const shop = session?.shop || req.query.shop;

    // Optional: inject snippet on first successful install / auth
    if (shop) {
      await injectStickyForShop(shop);
    }

    return res.redirect(`/?shop=${encodeURIComponent(shop)}`);
  }
);

// For embedded install flow (break out of iframe → /auth)
app.get("/exitiframe", (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).send("Missing shop parameter");
  return res.redirect(`/auth?shop=${encodeURIComponent(shop)}`);
});

/* ----------------------------------------
   WEBHOOK ENDPOINT (Shopify → your app)
----------------------------------------- */

app.post("/webhooks", shopify.webhooks.process());

/* ----------------------------------------
   PROTECTED API (requires auth + billing)
----------------------------------------- */

app.use(
  "/api/sticky",
  shopify.validateAuthenticatedSession(),
  requireBilling,
  stickyMetrics
);

/* ----------------------------------------
   PUBLIC ANALYTICS ENDPOINT
----------------------------------------- */

app.use("/apps/bdm-sticky-atc", stickyAnalytics);

/* ----------------------------------------
   ROOT (ADMIN APP UI)
----------------------------------------- */

app.get(
  "/",
  shopify.validateAuthenticatedSession(),
  requireBilling,
  (_req, res) => {
    res.send("BDM Sticky ATC App Running 🎉");
  }
);

app.get(
  "/analytics",
  shopify.validateAuthenticatedSession(),
  requireBilling,
  (req, res) => {
    return res.render("index"); // loads React UI
  }
);

/* ----------------------------------------
   START SERVER
----------------------------------------- */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 App running on port ${PORT}`);
});
