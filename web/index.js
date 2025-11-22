// web/index.js
import express from "express";
import { shopifyApp } from "@shopify/shopify-app-express";
import { BillingInterval } from "@shopify/shopify-api";
import { PrismaClient } from "@prisma/client";

import stickyAnalytics from "./routes/stickyAnalytics.js";
import stickyMetrics from "./routes/stickyMetrics.js";

const prisma = new PrismaClient();
const app = express();

app.use(express.json());

const BILLING_PLAN_NAME = "Sticky Add-to-Cart Bar Pro";
const BILLING_TEST = process.env.SHOPIFY_BILLING_TEST === "true";

/* ============================================
   CLEAN HOST HANDLING
============================================ */
const HOST =
  (process.env.HOST || process.env.SHOPIFY_APP_URL || "")
    .trim()
    .replace(/\/$/, ""); // remove trailing slash

if (!HOST.startsWith("https://")) {
  console.error("❌ HOST must start with https://");
}

/* ============================================
   SHOPIFY APP CONFIG
============================================ */
const shopify = shopifyApp({
  api: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    apiVersion: "2024-10",
    scopes: ["read_products", "write_products"],
    hostName: HOST.replace(/^https?:\/\//, "")
  },

  auth: {
    path: "/auth",
    callbackPath: "/auth/callback"
  },

  webhooks: {
    path: "/webhooks"
  },

  billing: {
    [BILLING_PLAN_NAME]: {
      amount: 4.99,
      currencyCode: "USD",
      interval: BillingInterval.Every30Days,
      trialDays: 14
    }
  }
});

/* ============================================
   BILLING MIDDLEWARE
============================================ */
async function requireBilling(req, res, next) {
  try {
    const session = res.locals.shopify?.session;
    if (!session) return res.status(401).send("Missing Shopify session");

    const hasPayment = await shopify.billing.check({
      session,
      plans: [BILLING_PLAN_NAME],
      isTest: BILLING_TEST
    });

    if (hasPayment) return next();

    const returnUrl = `${HOST}/?shop=${encodeURIComponent(session.shop)}`;

    const confirmationUrl = await shopify.billing.request({
      session,
      plan: BILLING_PLAN_NAME,
      isTest: BILLING_TEST,
      returnUrl
    });

    // redirect merchant to billing confirmation
    return res.redirect(confirmationUrl);

  } catch (error) {
    console.error("Billing error:", error?.response?.body || error);
    return res.status(500).send("Billing error");
  }
}

/* ============================================
   EXIT IFRAMES (Fix for Firefox OAuth)
============================================ */
app.get("/exitiframe", (req, res) => {
  const shop = req.query.shop;
  if (!shop) return res.status(400).send("Missing shop");

  return res.send(`
    <script>
      // Force redirect OUT of iframe
      window.top.location.href = "${HOST}/auth?shop=${encodeURIComponent(shop)}";
    </script>
  `);
});

/* ============================================
   OVERRIDE /auth TO FORCE TOP-LEVEL REDIRECT
============================================ */
app.get("/auth", (req, res, next) => {
  const shop = req.query.shop;

  if (!shop) return res.status(400).send("Missing shop");

  // Always break out of iframe (Firefox fix)
  const isEmbedded = req.query.embedded === "1";

  if (isEmbedded) {
    return res.redirect(`/exitiframe?shop=${encodeURIComponent(shop)}`);
  }

  // Proceed with Shopify OAuth
  return shopify.auth.begin()(req, res, next);
});

/* ============================================
   OAUTH CALLBACK
============================================ */
app.get(
  "/auth/callback",
  shopify.auth.callback(),
  requireBilling,
  (req, res) => {
    const shop = res.locals.shopify.session.shop;
    return res.redirect(`/?shop=${encodeURIComponent(shop)}`);
  }
);

/* ============================================
   PROTECTED API ROUTES
============================================ */
app.use(
  "/api/sticky",
  shopify.validateAuthenticatedSession(),
  requireBilling,
  stickyMetrics
);

/* ============================================
   PUBLIC ANALYTICS ROUTE
============================================ */
app.use("/apps/bdm-sticky-atc", stickyAnalytics);

/* ============================================
   ROOT PAGE (ADMIN APP)
============================================ */
app.get(
  "/",
  shopify.validateAuthenticatedSession(),
  requireBilling,
  (req, res) => {
    res.send("BDM Sticky ATC App Running 🎉");
  }
);

/* ============================================
   START SERVER
============================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`App running on port ${PORT}`);
});
