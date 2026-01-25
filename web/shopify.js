import "@shopify/shopify-api/adapters/node";
import { ApiVersion, DeliveryMethod } from "@shopify/shopify-api";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-01";
import { shopifyApp } from "@shopify/shopify-app-express";
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
  const appUrl = new URL(requiredEnv("SHOPIFY_APP_URL"));

  const scopes = requiredEnv("SCOPES")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  console.log("🔧 Shopify init:", {
    appUrl: appUrl.toString(),
    hostName: appUrl.host,
    hostScheme: appUrl.protocol.replace(":", ""),
    scopes,
    apiVersion: "ApiVersion.January24",
  });

  // ✅ IMPORTANT:
  // Let shopifyApp() create the internal shopifyApi instance.
  // This avoids the "apiVersion missing" crash you're getting.
  const shopify = shopifyApp({
    api: {
      apiKey,
      apiSecretKey,
      scopes,
      hostName: appUrl.host,
      hostScheme: appUrl.protocol.replace(":", ""),
      apiVersion: ApiVersion.January24,
      isEmbeddedApp: true,
      restResources,
      sessionStorage: prismaSessionStorage(),
    },

    auth: {
      path: "/auth",
      callbackPath: "/auth/callback",
    },

    webhooks: {
      path: "/webhooks",
    },
  });

  // Webhook handler definitions
  shopify.api.webhooks.addHandlers({
    ORDERS_CREATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks/orders/create",
      callback: async () => {},
    },
  });

  // OAuth begin
  app.use("/auth", shopify.auth.begin());

  // OAuth callback
  app.use(
    "/auth/callback",
    shopify.auth.callback(),
    async (req, res) => {
      try {
        const session = res.locals.shopify.session;

        console.log("✅ OAuth completed:", {
          shop: session?.shop,
          isOnline: session?.isOnline,
          hasAccessToken: Boolean(session?.accessToken),
          scope: session?.scope,
        });

        if (!session?.accessToken) {
          return res.status(500).send("Shopify auth failed (missing access token)");
        }

        // Register webhooks
        try {
          const registerResult = await shopify.api.webhooks.register({ session });
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
        console.error("❌ Post-auth error:", err);
        return res.status(500).send("Shopify auth failed");
      }
    }
  );

  // Webhook receiver
  app.post("/webhooks/*", shopify.webhooks.process());

  return shopify.api;
}
