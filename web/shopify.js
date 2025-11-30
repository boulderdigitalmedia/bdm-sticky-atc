// web/shopify.js
import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";
import { ShopifyApp } from "@shopify/shopify-app-express";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-10";

// Billing config optional, imported only if needed
import { billingConfig } from "./billing.js";

const requiredScopes = [];

const shopify = ShopifyApp({
  api: shopifyApi({
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    apiVersion: LATEST_API_VERSION,
    scopes: requiredScopes,
    hostScheme: "https",
    isEmbeddedApp: true,
    hostName: process.env.SHOPIFY_APP_URL.replace(/https?:\/\//, ""),
    restResources,
  }),

  auth: {
    path: "/auth",
    callbackPath: "/auth/callback",
  },

  webhooks: {
    path: "/webhooks",
  },

  // Optional billing integration
  billing: billingConfig || undefined,
});

export default shopify;
