import "@shopify/shopify-api/adapters/node";
import express from "express";
import {
  shopifyApi,
  LATEST_API_VERSION,
  DeliveryMethod,
} from "@shopify/shopify-api";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-01";
import {
  shopifyApp,
  LATEST_API_VERSION as APP_LATEST_API_VERSION,
} from "@shopify/shopify-app-express";
import { prismaSessionStorage } from "./shopifySessionStoragePrisma.js";

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function initShopify(app) {
  const apiKey = requiredEnv("SHOPIFY_API_KEY");
  const apiSecretKey = requiredEnv("SHOPIFY_API_SECRET");
  const appUrl = new URL(requiredEnv("SHOPIFY_APP_URL"));

  const scopes = requiredEnv("SCOPES")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  console.log("🔧 Shopify init config:", {
    apiKey: apiKey ? `${apiKey.slice(0, 6)}…` : null,
    appUrl: appUrl.toString(),
    hostName: appUrl.host,
    hostScheme: appUrl.protocol.replace(":", ""),
    scopes,
  });

  const shopify = shopifyApi({
    apiKey,
    apiSecretKey,
    scopes,
    hostName: appUrl.host,
    hostScheme: appUrl.protocol.replace(":", ""),
    apiVersion: LATEST_API_VERSION,
    isEmbeddedApp: true,
    restResources,
    sessionStorage: prismaSessionStorage(),
  });

  if (appUrl.protocol !== "https:") {
    console.warn(
      "⚠️ SHOPIFY_APP_URL should use https for OAuth + webhook registration. Current value:",
      appUrl.toString()
    );
  }

  // -----------------------------
  // Webhook Handlers
  // -----------------------------
  shopify.webhooks.addHandlers({
    ORDERS_CREATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks/orders/create",
      callback: async () => {},
    },
  });

  // -----------------------------
  // Shopify Express App Middleware (fixes OAuth/session issues)
  // -----------------------------
  const shopifyExpress = shopifyApp({
    api: shopify,
    auth: {
      path: "/auth",
      callbackPath: "/auth/callback",
    },
    webhooks: {
      path: "/webhooks",
    },
  });

  // This handles /auth automatically
  app.use("/auth", shopifyExpress.auth.begin());

  // This handles /auth/callback automatically
  app.use(
    "/auth/callback",
    shopifyExpress.auth.callback(),
    async (req, res) => {
      try {
        // The session is now guaranteed to exist
        const session = res.locals.shopify.session;

        console.log("✅ OAuth completed with session:", {
          id: session?.id,
          shop: session?.shop,
          isOnline: session?.isOnline,
          scope: session?.scope,
          hasAccessToken: Boolean(session?.accessToken),
        });

        if (!session?.accessToken) {
          console.error("❌ OAuth completed but accessToken missing");
          return res.status(500).send("Shopify auth failed (missing access token)");
        }

        // Register webhooks after auth
        try {
          const registerResult = await shopify.webhooks.register({ session });
          console.log("📌 Webhook register result:", JSON.stringify(registerResult, null, 2));
        } catch (err) {
          console.error("❌ Webhook registration failed:", err);
        }

        const host = req.query.host;
        const shopDomain = session.shop;

        if (!host) {
          return res.redirect(`https://${shopDomain}/admin/apps/${apiKey}`);
        }

        return res.redirect(`/?shop=${shopDomain}&host=${host}`);
      } catch (err) {
        console.error("❌ Post-auth handler error:", err);
        return res.status(500).send("Shopify auth failed");
      }
    }
  );

  // This processes incoming webhooks at /webhooks/*
  app.post("/webhooks/*", shopifyExpress.webhooks.process());

  return shopify;
}
