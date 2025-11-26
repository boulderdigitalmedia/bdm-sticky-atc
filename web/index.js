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
   Allow storefront JS → analytics POST requests
-------------------------------------------------- */
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

/* --------------------------------------------------
   Billing Setup
-------------------------------------------------- */
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

/* --------------------------------------------------
   Shopify App Init
-------------------------------------------------- */
const shopify = shopifyApp({
  api: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    apiVersion: LATEST_API_VERSION,
    scopes: (process.env.SCOPES ||
      "read_products,write_products").split(","),
    hostName: (process.env.HOST || "")
      .replace(/^https?:\/\//, "")
      .trim(),
    billing: billingConfig,
  },

  auth: {
    path: "/auth",
    callbackPath: "/auth/callback",
  },

  webhooks: {
    path: "/webhooks",
    topics: ["APP_UNINSTALLED", "THEMES_PUBLISH"],
  },
});

/* --------------------------------------------------
   Analytics Script Injection
-------------------------------------------------- */

async function injectAnalyticsScript(shop) {
  try {
    const offlineId = shopify.api.session.getOfflineId(shop);
    const session =
      await shopify.config.sessionStorage.loadSession(offlineId);

    if (!session) {
      console.warn("⚠ No offline session for", shop);
      return;
    }

    const client = new shopify.api.clients.Rest({ session });

    // 1️⃣ Load themes
    const themesRes = await client.get({ path: "themes" });
    const themes = themesRes.body.themes || [];
    const mainTheme =
      themes.find((t) => t.role === "main") || themes[0];

    if (!mainTheme) {
      console.warn("⚠ No main theme for", shop);
      return;
    }

    // 2️⃣ Load layout/theme.liquid
    const assetKey = "layout/theme.liquid";

    const themeFile = await client.get({
      path: `themes/${mainTheme.id}/assets`,
      query: { "asset[key]": assetKey },
    });

    const layout = themeFile.body.asset?.value || "";

    if (!layout) {
      console.warn("⚠ theme.liquid empty for", shop);
      return;
    }

    // 3️⃣ Check if our analytics script is already included
    const injectionTag = `<script src="https://sticky-add-to-cart-bar-pro.onrender.com/sticky-analytics.js" defer></script>`;

    if (layout.includes("sticky-analytics.js")) {
      console.log("✔ Analytics already present in", shop);
      return;
    }

    // 4️⃣ Inject before </head> for stability
    let updated;

    if (layout.includes("</head>")) {
      updated = layout.replace(
        "</head>",
        `  ${injectionTag}\n</head>`
      );
    } else {
      updated = `${layout}\n${injectionTag}\n`;
    }

    // 5️⃣ Save theme.liquid
    await client.put({
      path: `themes/${mainTheme.id}/assets`,
      data: {
        asset: {
          key: assetKey,
          value: updated,
        },
      },
    });

    console.log(`🌟 Analytics injected → ${shop}`);
  } catch (err) {
    console.error("❌ Analytics inject error for", shop, err);
  }
}

/* --------------------------------------------------
   Webhook Handling (v8 compatible)
-------------------------------------------------- */
app.post("/webhooks", async (req, res) => {
  try {
    await shopify.webhooks.process(req, res);
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.status(500).send("Webhook processing failed");
  }
});

/* When theme is published → reinject */
shopify.webhooks.addHandlers({
  THEMES_PUBLISH: {
    deliveryMethod: "http",
    callbackUrl: "/webhooks",
    callback: async (topic, shop, body) => {
      console.log("♻ Theme published — reinjecting analytics");
      await injectAnalyticsScript(shop);
    },
  },
});

/* App uninstall cleanup */
shopify.webhooks.addHandlers({
  APP_UNINSTALLED: {
    deliveryMethod: "http",
    callbackUrl: "/webhooks",
    callback: async (topic, shop) => {
      console.log(`🧹 App uninstalled from ${shop}`);
      // Optional: delete analytics rows
      await prisma.stickyEvent.deleteMany({
        where: { shop },
      });
    },
  },
});

/* --------------------------------------------------
   Billing Middleware
-------------------------------------------------- */
async function requireBilling(req, res, next) {
  try {
    const session = res.locals.shopify?.session;

    if (!session) {
      const shop = req.query.shop;
      return res.redirect(`/auth?shop=${encodeURIComponent(shop)}`);
    }

    const { hasActivePayment } = await shopify.api.billing.check({
      session,
      plans: [BILLING_PLAN_NAME],
      isTest: BILLING_TEST_MODE,
    });

    if (hasActivePayment) return next();

    const appUrl =
      process.env.SHOPIFY_APP_URL || `https://${process.env.HOST}`;

    const confirmationUrl = await shopify.api.billing.request({
      session,
      plan: BILLING_PLAN_NAME,
      isTest: BILLING_TEST_MODE,
      returnUrl: `${appUrl}/?shop=${session.shop}`,
    });

    return res.redirect(confirmationUrl);
  } catch (err) {
    console.error("❌ Billing error:", err);
    res.status(500).send("Billing error");
  }
}

/* --------------------------------------------------
   Auth Routes
-------------------------------------------------- */

app.get("/auth", shopify.auth.begin());

app.get(
  "/auth/callback",
  shopify.auth.callback(),
  requireBilling,
  async (req, res) => {
    const session = res.locals.shopify.session;
    const shop = session.shop;

    // Auto inject analytics after install
    await injectAnalyticsScript(shop);

    res.redirect(`/?shop=${encodeURIComponent(shop)}`);
  }
);

/* --------------------------------------------------
   Protected API (analytics dashboard)
-------------------------------------------------- */
app.use(
  "/api/sticky",
  shopify.validateAuthenticatedSession(),
  requireBilling,
  stickyMetrics
);

/* --------------------------------------------------
   Public Analytics Endpoint
-------------------------------------------------- */
app.use("/apps/bdm-sticky-atc", stickyAnalytics);

/* --------------------------------------------------
   Admin Root
-------------------------------------------------- */

app.get(
  "/",
  shopify.validateAuthenticatedSession(),
  requireBilling,
  (_req, res) => {
    res.send("BDM Sticky ATC App Running 🎉");
  }
);

/* --------------------------------------------------
   Start Server
-------------------------------------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
