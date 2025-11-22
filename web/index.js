import express from "express";
import { shopifyApp } from "@shopify/shopify-app-express";
import { BillingInterval } from "@shopify/shopify-api";
import { PrismaClient } from "@prisma/client";
import stickyAnalytics from "./routes/stickyAnalytics.js";
import stickyMetrics from "./routes/stickyMetrics.js";

const prisma = new PrismaClient();
const app = express();

app.use(express.json());

/* ============================
   SHOPIFY APP + BILLING CONFIG
   ============================ */

const shopify = shopifyApp({
  api: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    apiVersion: "2024-10",
    scopes: ["read_products", "write_products"],
    hostName: process.env.HOST.replace(/https?:\/\//, "")
  },

  auth: {
    path: "/auth",
    callbackPath: "/auth/callback"
  },

  webhooks: {
    path: "/webhooks"
  },

  // ⭐ Billing plan definition
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
    const session = res.locals.shopify.session;

    // Check if merchant already subscribed
    const hasPayment = await shopify.billing.check({
      session,
      plans: ["Sticky Add-to-Cart Bar Pro"],
      isTest: process.env.SHOPIFY_BILLING_TEST === "true"
    });

    if (hasPayment) {
      return next();
    }

    // Send merchant to billing page
    const confirmationUrl = await shopify.billing.request({
      session,
      plan: "Sticky Add-to-Cart Bar Pro",
      isTest: process.env.SHOPIFY_BILLING_TEST === "true"
    });

    return res.redirect(confirmationUrl);

  } catch (err) {
    console.error("Billing check error:", err);
    return res.status(500).send("Billing error");
  }
}

/* ============================
   AUTH ROUTES
   ============================ */

app.get("/auth", shopify.auth.begin());

app.get(
  "/auth/callback",
  shopify.auth.callback(),
  requireBilling,
  async (req, res) => {
    const { shop } = req.query;
    res.redirect(`/?shop=${shop}`);
  }
);

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
   PUBLIC ANALYTICS ROUTES
   ============================ */

app.use("/apps/bdm-sticky-atc", stickyAnalytics);

/* ============================
   ROOT DASHBOARD
   ============================ */

app.get(
  "/",
  shopify.validateAuthenticatedSession(),
  requireBilling,
  (_req, res) => res.send("BDM Sticky ATC App Running 🎉")
);

/* ============================
   START SERVER
   ============================ */

app.listen(process.env.PORT || 3000, () => {
  console.log("App running on port 3000");
});
