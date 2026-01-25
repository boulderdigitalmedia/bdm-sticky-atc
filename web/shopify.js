import express from "express";
import shopifyAppPkg from "@shopify/shopify-app-express";
import { ApiVersion, DeliveryMethod } from "@shopify/shopify-api";
import { prismaSessionStorage } from "./shopifySessionStoragePrisma.js";

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

  // ✅ ESM/CJS interop: the function lives on .default
  const shopifyApp = shopifyAppPkg.default ?? shopifyAppPkg;

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

  // Webhook processing route (Shopify verified)
  app.post("/webhooks/*", shopify.webhooks.process());

  return shopify;
}
