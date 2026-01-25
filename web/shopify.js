import "@shopify/shopify-api/adapters/node";
import { shopifyApi, LATEST_API_VERSION, DeliveryMethod } from "@shopify/shopify-api";
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

  shopify.webhooks.addHandlers({
    ORDERS_CREATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks/orders/create",
      callback: async () => {},
    },
  });

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

  // OAuth begin
  app.use("/auth", shopifyExpress.auth.begin());

  // OAuth callback
  app.use(
    "/auth/callback",
    shopifyExpress.auth.callback(),
    async (req, res) => {
      const session = res.locals.shopify.session;

      if (!session?.accessToken) {
        return res.status(500).send("Shopify auth failed (missing access token)");
      }

      try {
        const registerResult = await shopify.webhooks.register({ session });
        console.log("Webhook register result:", JSON.stringify(registerResult, null, 2));
      } catch (err) {
        console.error("Webhook registration failed:", err);
      }

      const host = req.query.host;
      const shopDomain = session.shop;

      if (!host) {
        return res.redirect(`https://${shopDomain}/admin/apps/${apiKey}`);
      }

      return res.redirect(`/?shop=${shopDomain}&host=${host}`);
    }
  );

  // Webhook receiver
  app.post("/webhooks/*", shopifyExpress.webhooks.process());

  return shopify;
}
