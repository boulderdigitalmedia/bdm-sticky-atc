import "@shopify/shopify-api/adapters/node";
import { shopifyApi, LATEST_API_VERSION, DeliveryMethod } from "@shopify/shopify-api";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-01";
import { prismaSessionStorage } from "./shopifySessionStoragePrisma.js";

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function initShopify(app) {
  const apiKey = requiredEnv("SHOPIFY_API_KEY");
  const apiSecretKey = requiredEnv("SHOPIFY_API_SECRET");
  const appUrl = requiredEnv("SHOPIFY_APP_URL");
  const scopes = requiredEnv("SCOPES").split(",").map((s) => s.trim()).filter(Boolean);

  const shopify = shopifyApi({
    apiKey,
    apiSecretKey,
    scopes,
    hostName: new URL(appUrl).host,
    apiVersion: LATEST_API_VERSION,
    isEmbeddedApp: true,
    restResources,
    sessionStorage: prismaSessionStorage()
  });

  // Begin OAuth
  app.get("/auth", async (req, res) => {
    const shop = req.query.shop;
    if (!shop) return res.status(400).send("Missing shop parameter");

    const redirectUrl = await shopify.auth.begin({
      shop,
      callbackPath: "/auth/callback",
      isOnline: false,
      rawRequest: req,
      rawResponse: res
    });

    return res.redirect(redirectUrl);
  });

  // OAuth callback
  app.get("/auth/callback", async (req, res) => {
    try {
      const session = await shopify.auth.callback({
        rawRequest: req,
        rawResponse: res
      });

      // session is stored by sessionStorage automatically by callback() in most flows,
      // but storeSession is safe to ensure persistence.
      await shopify.sessionStorage.storeSession(session);

      await shopify.webhooks.register({
        session,
        topic: "ORDERS_CREATE",
        webhook: {
          deliveryMethod: DeliveryMethod.Http,
          callbackUrl: new URL("/webhooks/orders/create", appUrl).toString()
        }
      });

      // Shopify admin passes host param on embedded loads
      const host = req.query.host;
      const shop = session.shop;

      if (!host) {
        // If host missing, redirect to Shopify Admin to re-open embedded context
        return res.redirect(`https://${shop}/admin/apps/${apiKey}`);
      }

      return res.redirect(`/?shop=${shop}&host=${host}`);
    } catch (err) {
      console.error("Auth callback error:", err);
      return res.status(500).send("Shopify auth failed");
    }
  });

  return shopify;
}
