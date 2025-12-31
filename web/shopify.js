// web/shopify.js

import "@shopify/shopify-api/adapters/node"; // REQUIRED runtime adapter

import {
  shopifyApi,
  LATEST_API_VERSION,
  DeliveryMethod,
} from "@shopify/shopify-api";

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

  // 🔥 THIS IS THE IMPORTANT PART
  webhooks: {
    path: "/webhooks",

    ORDERS_PAID: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks/orders/paid",
    },
  },

  billing: billingConfig,

  /* ---------------------------------------------------
     AFTER AUTH HOOK (RUNS ON INSTALL + REAUTH)
     THIS IS WHAT ACTUALLY CREATES THE WEBHOOK
  --------------------------------------------------- */
  hooks: {
    afterAuth: async ({ session, redirect }) => {
      const { shop, host } = session;

      // ✅ THIS LINE IS CRITICAL
      // Registers ALL declared webhooks above
      await shopify.registerWebhooks({ session });

      // Redirect back into embedded app
      redirect(
        `/apps/bdm-sticky-atc?shop=${shop}&host=${host}`
      );
    },
  },
});

export default shopify;
