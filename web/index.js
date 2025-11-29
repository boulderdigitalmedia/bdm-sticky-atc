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

/* --------------------------------------------------
   Resolve __dirname
-------------------------------------------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDist = path.join(__dirname, "frontend", "dist");

/* --------------------------------------------------
   Allow Storefront → Analytics POST (CORS)
-------------------------------------------------- */
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

/* --------------------------------------------------
   BILLING CONFIG (Production Ready)
-------------------------------------------------- */
const BILLING_PLAN_NAME = "Sticky Add-to-Cart Bar Pro";

const billingConfig = {
  [BILLING_PLAN_NAME]: {
    amount: 4.99,
    currencyCode: "USD",
    interval: BillingInterval.Every30Days,
    trialDays: 14, // Free trial stays
  },
};

/* --------------------------------------------------
   Shopify App Init (v10)
-------------------------------------------------- */
const shopify = shopifyApp({
  api: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    apiVersion: LATEST_API_VERSION,
    scopes: (process.env.SCOPES ||
      "read_products,write_products").split(","),

    hostName: process.env.HOST.replace(/^https?:\/\//, ""),

    billing: billingConfig, // Real billing by default
  },

  auth: {
    path: "/auth",
    callbackPath: "/auth/callback",
  },

  webhooks: {
    path: "/webhooks",
    topics: [
      "CHECKOUTS_CREATE",
      "ORDERS_PAID",
      "APP_UNINSTALLED",
      "THEMES_PUBLISH",
    ],
  },
});

/* --------------------------------------------------
   Analytics Script Injection (Production Safe)
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
      themesRes.body.themes?.find((t) => t.role === "main") ??
      themesRes.body.themes?.[0];

    if (!mainTheme) return;

    const assetKey = "layout/theme.liquid";

    const themeFile = await client.get({
      path: `themes/${mainTheme.id}/assets`,
      query: { "asset[key]": assetKey },
    });

    const layout = themeFile.body.asset?.value || "";
    const injection =
      `<script src="https://sticky-add-to-cart-bar-pro.onrender.com/sticky-analytics.js" defer></script>`;

    if (layout.includes("sticky-analytics.js")) return;

    const updated = layout.includes("</head>")
      ? layout.replace("</head>", `  ${injection}\n</head>`)
      : `${layout}\n${injection}`;

    await client.put({
      path: `themes/${mainTheme.id}/assets`,
      data: { asset: { key: assetKey, value: updated } },
    });

    console.log(`🌟 Analytics injected → ${shop}`);
  } catch (err) {
    console.error("❌ Analytics injection error:", err);
  }
}

/* --------------------------------------------------
   Webhook Processor
-------------------------------------------------- */
app.post("/webhooks", async (req, res) => {
  try {
    const result = await shopify.webhooks.process(req, res);

    if (result?.topic === "themes/publish") {
      await injectAnalyticsScript(result.shop);
    }

    if (result?.topic === "app/uninstalled") {
      await prisma.stickyEvent.deleteMany({
        where: { shop: result.shop },
      });
    }

  } catch (err) {
    console.error("❌ Webhook error:", err);
    return res.status(500).send("Webhook error");
  }
});

/* --------------------------------------------------
   Billing Completion
-------------------------------------------------- */
app.get("/billing/complete", (req, res) => {
  const shop = req.query.shop;
  return res.redirect(`/?shop=${encodeURIComponent(shop)}`);
});

/* --------------------------------------------------
   Billing Middleware (Production Billing)
-------------------------------------------------- */
async function requireBilling(req, res, next) {
  try {
    const session = res.locals.shopify?.session;

    if (!session) {
      const shop = req.query.shop;
      return res.redirect(`/exitiframe?shop=${shop}`);
    }

    // REAL billing unless overridden
    const isTestBilling =
      process.env.SHOPIFY_BILLING_TEST === "true";

    const { hasActivePayment } = await shopify.api.billing.check({
      session,
      plans: [BILLING_PLAN_NAME],
      isTest: isTestBilling,
    });

    if (hasActivePayment) return next();

    const appUrl =
      process.env.SHOPIFY_APP_URL || `https://${process.env.HOST}`;

    const confirmationUrl = await shopify.api.billing.request({
      session,
      plan: BILLING_PLAN_NAME,
      isTest: isTestBilling,
      returnUrl: `${appUrl}/billing/complete?shop=${session.shop}`,
    });

    return res.redirect(confirmationUrl);

  } catch (err) {
    console.error("❌ Billing error:", err);
    return res.status(500).send("Billing error");
  }
}

/* --------------------------------------------------
   OAuth
-------------------------------------------------- */
app.get("/auth", shopify.auth.begin());

app.get(
  "/auth/callback",
  shopify.auth.callback(),
  requireBilling,
  async (req, res) => {
    const session = res.locals.shopify.session;

    await injectAnalyticsScript(session.shop);

    return res.redirect(`/?shop=${encodeURIComponent(session.shop)}`);
  }
);

/* --------------------------------------------------
   exitiframe (Required for Embedded App)
-------------------------------------------------- */
app.get("/exitiframe", (req, res) => {
  const shop = req.query.shop;

  res.send(`
    <script>
      window.top.location.href = "/auth?shop=${shop}";
    </script>
  `);
});

/* --------------------------------------------------
   Protected Admin API
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
   Admin UI (Embedded App)
-------------------------------------------------- */
app.get("/", (req, res) => {
  const session = res.locals.shopify?.session;

  if (!session) {
    const shop = req.query.shop;
    return res.redirect(`/exitiframe?shop=${shop}`);
  }

  res.sendFile(path.join(frontendDist, "index.html"));
});

/* --------------------------------------------------
   Serve React App
-------------------------------------------------- */
app.use(express.static(frontendDist));

app.get("*", (req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

/* --------------------------------------------------
   Start Server
-------------------------------------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Sticky ATC server running on port ${PORT}`)
);
