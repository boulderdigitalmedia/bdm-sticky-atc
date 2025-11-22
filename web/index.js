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

/* ======================================================
   CONFIG VALUES
====================================================== */
const BILLING_PLAN_NAME = "Sticky Add-to-Cart Bar Pro";
const BILLING_TEST_MODE = process.env.SHOPIFY_BILLING_TEST === "true";
const HOST = process.env.HOST?.replace(/^https?:\/\//, "");

/* ======================================================
   SHOPIFY APP INITIALIZATION
====================================================== */
const shopify = shopifyApp({
  api: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    apiVersion: "2024-10",
    scopes: ["read_products", "write_products"],
    hostName: HOST
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

/* ======================================================
   BILLING CHECK MIDDLEWARE
====================================================== */

async function ensureBilling(req, res, next) {
  try {
    const session = res.locals.shopify?.session;
    if (!session) {
      console.error("ensureBilling: No session found");
      return res.redirect(`/auth?shop=${req.query.shop}`);
    }

    const hasPayment = await shopify.billing.check({
      session,
      plans: [BILLING_PLAN_NAME],
      isTest: BILLING_TEST_MODE
    });

    if (hasPayment) return next();

    const returnUrl = `https://${HOST}/?shop=${session.shop}`;

    const confirmationUrl = await shopify.billing.request({
      session,
      plan: BILLING_PLAN_NAME,
      isTest: BILLING_TEST_MODE,
      returnUrl
    });

    return res.redirect(confirmationUrl);

  } catch (err) {
    console.error("Billing middleware error:", err);
    return res.status(500).send("Billing error");
  }
}

/* ======================================================
   AUTH ROUTES
====================================================== */

// Start OAuth
app.get("/auth", shopify.auth.begin());

// Complete OAuth
app.get(
  "/auth/callback",
  shopify.auth.callback(),
  ensureBilling,
  (req, res) => {
    const shop = res.locals.shopify.session.shop;
    return res.redirect(`/?shop=${shop}`);
  }
);

// Used when Shopify blocks an embedded login
app.get("/exitiframe", (req, res) => {
  const shop = req.query.shop;
  if (!shop) return res.status(400).send("Missing shop param");
  return res.redirect(`/auth?shop=${shop}`);
});

/* ======================================================
   PROTECTED API ROUTES
====================================================== */

app.use(
  "/api/sticky",
  shopify.validateAuthenticatedSession(),
  ensureBilling,
  stickyMetrics
);

/* ======================================================
   PUBLIC API ROUTES
====================================================== */

app.use("/apps/bdm-sticky-atc", stickyAnalytics);

/* ======================================================
   ADMIN HOME PAGE
====================================================== */

app.get(
  "/",
  shopify.validateAuthenticatedSession(),
  ensureBilling,
  (_req, res) => {
    res.send("BDM Sticky ATC App Running 🎉");
  }
);

/* ======================================================
   START SERVER
====================================================== */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🟢 BDM Sticky ATC running on port ${PORT}`)
);
