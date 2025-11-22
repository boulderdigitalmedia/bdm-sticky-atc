// web/index.js
import express from "express";
import { shopifyApp } from "@shopify/shopify-app-express";
import { Shopify, BillingInterval } from "@shopify/shopify-api";
import stickyAnalytics from "./routes/stickyAnalytics.js";
import stickyMetrics from "./routes/stickyMetrics.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const app = express();

app.use(express.json());

/* ----------------------------------------
   CONSTANTS
----------------------------------------- */
const BILLING_PLAN_NAME = "Sticky Add-to-Cart Bar Pro";
const BILLING_TEST_MODE = process.env.SHOPIFY_BILLING_TEST === "true";

/* ----------------------------------------
   SHOPIFY APP INITIALIZATION (v10.0.0)
----------------------------------------- */
const shopify = shopifyApp({
  api: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    apiVersion: "2024-10",
    scopes: (process.env.SCOPES || "read_products,write_products")
      .split(",")
      .map((s) => s.trim()),
    hostName: process.env.HOST.replace(/^https?:\/\//, "")
  },

  auth: {
    path: "/auth",
    callbackPath: "/auth/callback"
  },

  webhooks: {
    path: "/webhooks"
  },

  // ⭐ BILLING PLAN (Recurring)
  billing: {
    [BILLING_PLAN_NAME]: {
      amount: 4.99,
      currencyCode: "USD",
      interval: BillingInterval.Every30Days,
      trialDays: 14
    }
  }
});

/* ----------------------------------------
   🔐 Billing Middleware (v10 CORRECT FORMAT)
----------------------------------------- */
async function requireBilling(req, res, next) {
  try {
    const session = res.locals.shopify?.session;

    if (!session) {
      console.error("❌ Missing Shopify session in billing middleware");
      return res.redirect(`/auth?shop=${req.query.shop}`);
    }

    // 1️⃣ Check if store already subscribed
    const hasPayment = await Shopify.Billing.check({
      session,
      plans: [BILLING_PLAN_NAME],
      isTest: BILLING_TEST_MODE
    });

    if (hasPayment) return next();

    // 2️⃣ If not subscribed → request subscription
    const appUrl = process.env.SHOPIFY_APP_URL || `https://${process.env.HOST}`;
    const returnUrl = `${appUrl}/?shop=${session.shop}`;

    const confirmationUrl = await Shopify.Billing.request({
      session,
      plan: BILLING_PLAN_NAME,
      isTest: BILLING_TEST_MODE,
      returnUrl
    });

    console.log("🧾 Redirecting merchant to billing approval:", confirmationUrl);
    return res.redirect(confirmationUrl);

  } catch (error) {
    console.error("❌ Billing error:", error);
    return res.status(500).send("Billing error");
  }
}

/* ----------------------------------------
   🔐 AUTH ROUTES
----------------------------------------- */
app.get("/auth", shopify.auth.begin());

app.get(
  "/auth/callback",
  shopify.auth.callback(),
  requireBilling,
  (req, res) => {
    const session = res.locals.shopify.session;
    const shop = session.shop;
    return res.redirect(`/?shop=${encodeURIComponent(shop)}`);
  }
);

/* ----------------------------------------
   🚪 Exit iFrame (embedded app install)
----------------------------------------- */
app.get("/exitiframe", (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).send("Missing shop param");
  return res.redirect(`/auth?shop=${encodeURIComponent(shop)}`);
});

/* ----------------------------------------
   🔐 PROTECTED API (Requires Billing)
----------------------------------------- */
app.use(
  "/api/sticky",
  shopify.validateAuthenticatedSession(),
  requireBilling,
  stickyMetrics
);

/* ----------------------------------------
   Public Analytics
----------------------------------------- */
app.use("/apps/bdm-sticky-atc", stickyAnalytics);

/* ----------------------------------------
   Admin UI Home (Protected)
----------------------------------------- */
app.get(
  "/",
  shopify.validateAuthenticatedSession(),
  requireBilling,
  (_req, res) => {
    res.send("BDM Sticky ATC App Running 🎉");
  }
);

/* ----------------------------------------
   START SERVER
----------------------------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 App running on port ${PORT}`);
});
