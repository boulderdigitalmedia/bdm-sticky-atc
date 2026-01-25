import { createRequire } from "module";
import { ApiVersion, DeliveryMethod } from "@shopify/shopify-api";
import { prismaSessionStorage } from "./shopifySessionStoragePrisma.js";

const require = createRequire(import.meta.url);

// CJS import (works in ESM projects)
const shopifyAppModule = require("@shopify/shopify-app-express");
const shopifyApp =
  shopifyAppModule?.default || shopifyAppModule?.shopifyApp || shopifyAppModule;

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function initShopify(app) {
  app.set("trust proxy", 1);

  const apiKey = requiredEnv("SHOPIFY_API_KEY");
  const apiSecretKey = requiredEnv("SHOPIFY_API_SECRET");
  const appUrl = requiredEnv("SHOPIFY_APP_URL");

  const scopes = requiredEnv("SCOPES")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (typeof shopifyApp !== "function") {
    console.error("❌ @shopify/shopify-app-express export is not a function:", {
      keys: Object.keys(shopifyAppModule || {}),
      type: typeof shopifyApp,
    });
    throw new Error("@shopify/shopify-app-express did not export a function");
  }

  const shopify = shopifyApp({
    api: {
      apiKey,
      apiSecretKey,
      scopes,
      apiVersion: ApiVersion.January24, // MUST be explicit
      isEmbeddedApp: true,
      hostName: new URL(appUrl).host,
      hostScheme: new URL(appUrl).protocol.replace(":", ""),
    },

    auth: {
      path: "/auth",
      callbackPath: "/auth/callback",
    },

    sessionStorage: prismaSessionStorage(),

    // This registers the webhook subscription in Shopify during auth,
    // but does NOT create an endpoint handler for you.
    webhooks: {
      ORDERS_CREATE: {
        deliveryMethod: DeliveryMethod.Http,
        callbackUrl: "/webhooks/orders/create",
      },
    },
  });

  // Auth routes
  app.use(shopify.auth.begin());
  app.use(shopify.auth.callback(), shopify.redirectToShopifyOrAppRoot());

  // 🚫 DO NOT call shopify.webhooks.process() (undefined in your version)

  return shopify;
}
