import "@shopify/shopify-api/adapters/node";
import {
  shopifyApi,
  LATEST_API_VERSION,
  DeliveryMethod
} from "@shopify/shopify-api";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-01";
import { prismaSessionStorage } from "./shopifySessionStoragePrisma.js";

/* ENV HELPERS */
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
    .map(s => s.trim())
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
    sessionStorage: prismaSessionStorage()
  });

  /**
   * ✅ Register webhook
   * ❌ DO NOT provide a callback here
   * Express owns the route
   */
  shopify.webhooks.addHandlers({
    ORDERS_PAID: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks/orders/paid"
    }
  });

  /* OAuth start */
  app.get("/auth", async (req, res) => {
    const shop = req.query.shop;
    if (!shop) return res.status(400).send("Missing shop");

    const sanitizedShop = shopify.utils.sanitizeShop(shop.toString());
    if (!sanitizedShop) return res.status(400).send("Invalid shop");

    await shopify.auth.begin({
      shop: sanitizedShop,
      callbackPath: "/auth/callback",
      isOnline: false,
      rawRequest: req,
      rawResponse: res
    });
  });

  /* OAuth callback */
  app.get("/auth/callback", async (req, res) => {
    try {
      const { session } = await shopify.auth.callback({
        rawRequest: req,
        rawResponse: res
      });

      if (!session?.accessToken) {
        throw new Error("Missing access token");
      }

      // 🔥 THIS IS WHAT REGISTERS THE WEBHOOK
      const result = await shopify.webhooks.register({ session });
      console.log("✅ Webhook registration result:", result);

      const host = req.query.host;
      if (!host) {
        return res.redirect(
          `https://${session.shop}/admin/apps/${apiKey}`
        );
      }

      return res.redirect(`/?shop=${session.shop}&host=${host}`);
    } catch (err) {
      console.error("OAuth callback failed", err);
      return res.status(500).send("Auth failed");
    }
  });

  return shopify;
}
