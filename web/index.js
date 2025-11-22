// web/index.js
import express from "express";
import { shopifyApp } from "@shopify/shopify-app-express";
import { BillingInterval } from "@shopify/shopify-api";
import { PrismaClient } from "@prisma/client";

import stickyAnalytics from "./routes/stickyAnalytics.js";
import stickyMetrics from "./routes/stickyMetrics.js";

const prisma = new PrismaClient(); // (kept for future use)
const app = express();

app.use(express.json());

const BILLING_PLAN_NAME = "Sticky Add-to-Cart Bar Pro";
const BILLING_TEST = process.env.SHOPIFY_BILLING_TEST === "true";

/* ============================
   SHOPIFY APP + BILLING CONFIG
   ============================ */

const shopify = shopifyApp({
  api: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    apiVersion: "2024-10",
    scopes: (process.env.SCOPES || "read_products,write_products")
      .split(",")
      .map((s) => s.trim()),
    hostName: (process.env.HOST || "")
      .replace(/^https?:\/\//, "")
      .trim()
  },

  auth: {
    path: "/auth",
    callbackPath: "/auth/callback"
  },

  webhooks: {
    path: "/webhooks"
  },

  // Single recurring plan: $4.99 / 30 days with 14-day free trial
  billing: {
    "Sticky Add-to-Cart Bar Pro": {
      amount: 4.99,
      currencyCode: "USD",
      interval: BillingInterval.Every30Days,
      trialDays: 14
    }
  }
});

/* ============================
   BILLING MIDDLEWARE
   ============================ */

async function requireBilling(req, res, next) {
  try {
    const session = res.locals.shopify?.session;
    if (!session) {
      console.error("requireBilling: missing Shopify session");
      return res.status(401).send("Missing Shopify session");
    }

    // 1) Check if the shop already has an active subscription
    const hasPayment = await shopify.billing.check({
      session,
      plans: [BILLING_PLAN_NAME],
      isTest: BILLING_TEST
    });

    if (hasPayment) {
      return next();
    }

    // 2) Request a new subscription
    const appUrl = process.env.SHOPIFY_APP_URL || `https://${process.env.HOST}`;
    const returnUrl = `${appUrl}?shop=${encodeURIComponent(session.shop)}`;

    const confirmationUrl = await shopify.billing.request({
      session,
      plan: BILLING_PLAN_NAME,
      isTest: BILLING_TEST,
      returnUrl
    });

    // Redirect merchant to approve the subscription
    return res.redirect(confirmationUrl);
  } catch (error) {
    console.error("Billing check/request error:", error?.response?.body || error);
    return res.status(500).send("Billing error");
  }
}

/* ============================
   AUTH + EXITIFRAME ROUTES
   ============================ */

// Start OAuth
app.get("/auth", shopify.auth.begin());

// Callback from Shopify OAuth
app.get(
  "/auth/callback",
  shopify.auth.callback(),
  requireBilling,
  (req, res) => {
    const session = res.locals.shopify?.session;
    const shop = session?.shop || req.query.shop;
    return res.redirect(`/?shop=${encodeURIComponent(shop)}`);
  }
);

// Used by embedded app install flow to break out of the iframe
app.get("/exitiframe", (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).send("Missing shop parameter");
  return res.redirect(`/auth?shop=${encodeURIComponent(shop)}`);
});

/* ============================
   PROTECTED API ROUTES
   ============================ */

app.use(
  "/api/sticky",
  shopify.validateAuthenticatedSession(),
  requireBilling,
  stickyMetrics
);

/* ============================
   ANALYTICS ROUTES
   (public – no auth required)
   ============================ */

app.use("/apps/bdm-sticky-atc", stickyAnalytics);

/* ============================
   ROOT (ADMIN APP UI)
   ============================ */

app.get(
  "/",
  shopify.validateAuthenticatedSession(),
  requireBilling,
  (_req, res) => {
    res.send("BDM Sticky ATC App Running 🎉");
  }
);

/* ============================
   START SERVER
   ============================ */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`App running on port ${PORT}`);
});
