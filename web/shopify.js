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
  const apiKey = requiredEnv("SHOPIFY_API_KEY");
  const apiSecretKey = requiredEnv("SHOPIFY_API_SECRET");
  const appUrl = new URL(requiredEnv("SHOPIFY_APP_URL"));

  const scopes = requiredEnv("SCOPES")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

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

        // If host missing, bounce back into admin app view
        if (!host) {
          return res.redirect(`https://${shopDomain}/admin/apps/${apiKey}`);
        }

        // ✅ IMPORTANT: Always redirect through /exitiframe to ensure top-level context
        return res.redirect(
          `/exitiframe?shop=${encodeURIComponent(shopDomain)}&host=${encodeURIComponent(host)}`
        );
      } catch (err) {
        console.error("❌ Post-auth error:", err);
        return res.status(500).send("Shopify auth failed");
      }
    }
  );

  // Webhook processing route (raw body is handled in index.js)
  app.post("/webhooks/*", async (req, res) => {
    try {
      await shopify.api.webhooks.process({
        rawRequest: req,
        rawResponse: res,
      });
      if (res.headersSent) return;
      return res.sendStatus(200);
    } catch (err) {
      console.error("❌ Webhook processing error:", err);
      if (!res.headersSent) return res.status(500).send("Webhook error");
    }
  });

  return shopify.api;
}
