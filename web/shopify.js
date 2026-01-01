// web/shopify.js
import "@shopify/shopify-api/adapters/node";
import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";
import pkg from "@shopify/shopify-app-express";
const { shopifyApp } = pkg;

import { billingConfig } from "./billing.js";

const shopify = shopifyApp({
  api: shopifyApi({
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    apiVersion: LATEST_API_VERSION,
    isEmbeddedApp: true,
    hostName: process.env.SHOPIFY_APP_URL.replace(/^https?:\/\//, ""),
    hostScheme: "https",
    scopes: (process.env.SCOPES || "").split(","),
  }),

  auth: {
    path: "/auth",
    callbackPath: "/auth/callback",
  },

  webhooks: {
    path: "/webhooks",
    // ✅ DEFINE WEBHOOKS HERE (THIS WAS MISSING)
    subscriptions: {
      ORDERS_PAID: {
        endpoint: "/orders/paid",
      },
    },
  },

  billing: billingConfig,

  hooks: {
    afterAuth: async ({ session, redirect }) => {
      const { shop, host } = session;

      try {
        // ✅ THIS NOW ACTUALLY REGISTERS SOMETHING
        await shopify.registerWebhooks({ session });
        console.log("✅ Webhooks registered for", shop);
      } catch (err) {
        console.error("❌ Webhook registration failed", err);
      }

      redirect(`/apps/bdm-sticky-atc?shop=${shop}&host=${host}`);
    },
  },
});

export default shopify;
