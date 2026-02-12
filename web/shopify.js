import "@shopify/shopify-api/adapters/node";
import {
  shopifyApi,
  LATEST_API_VERSION,
  DeliveryMethod
} from "@shopify/shopify-api";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-01";
import { prismaSessionStorage } from "./shopifySessionStoragePrisma.js";
import prisma from "./prisma.js";

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
   * ✅ Register webhook definition
   * Express handles the route itself.
   */
  shopify.webhooks.addHandlers({
    ORDERS_PAID: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks/orders/paid"
    }
  });

  /**
   * 🔥 AUTO REGISTER WEBHOOKS USING SAVED OFFLINE SESSIONS
   * This fixes the "no webhook logs" problem permanently.
   */
  (async () => {
    try {
      const sessions = await prisma.session.findMany();

      if (!sessions.length) {
        console.log("⚠️ No sessions found yet — skipping auto webhook registration");
        return;
      }

      for (const session of sessions) {
        try {
          const result = await shopify.webhooks.register({ session });
          console.log("🔥 AUTO WEBHOOK REGISTER RESULT:", result);
        } catch (err) {
          console.error("❌ Failed to register webhook for session", session.shop, err);
        }
      }
    } catch (err) {
      console.error("❌ Auto webhook registration failed:", err);
    }
  })();

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

      // 🔥 Register webhook on install/update
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
