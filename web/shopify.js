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

  /**
   * ✅ SHOPIFY INIT
   * IMPORTANT:
   * - Force https (Render proxy fix)
   * - SameSite=None cookies for embedded apps
   */
  const shopify = shopifyApi({
    apiKey,
    apiSecretKey,
    scopes,
    hostName: appUrl.host,
    hostScheme: "https", // 🔥 DO NOT derive from env on Render
    apiVersion: LATEST_API_VERSION,
    isEmbeddedApp: true,
    restResources,
    sessionStorage: prismaSessionStorage(),
    cookies: {
      sameSite: "none",
      secure: true
    }
  });

  /**
   * ✅ Declare webhook
   */
  shopify.webhooks.addHandlers({
    ORDERS_PAID: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks/orders/paid"
    }
  });

  /**
   * 🔥 AUTO REGISTER WEBHOOKS FROM SAVED OFFLINE SESSIONS
   */
  (async () => {
    try {
      const sessions = await prisma.session.findMany({
        where: { isOnline: false }
      });

      if (!sessions.length) {
        console.log("⚠️ No offline sessions found — skipping auto webhook registration");
        return;
      }

      for (const s of sessions) {
        try {
          const result = await shopify.webhooks.register({ session: s });
          console.log("🔥 AUTO WEBHOOK REGISTER RESULT:", result);
        } catch (err) {
          console.error("❌ Failed to register webhook for", s.shop, err);
        }
      }
    } catch (err) {
      console.error("❌ Auto webhook registration failed:", err);
    }
  })();

  /**
   * =====================================================
   * 🔐 AUTH START
   * =====================================================
   */
  app.get("/auth", async (req, res) => {
    try {
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
    } catch (err) {
      console.error("❌ OAuth begin failed:", err);
      res.status(500).send("Auth start failed");
    }
  });

  /**
   * =====================================================
   * 🔐 AUTH CALLBACK
   * =====================================================
   */
  app.get("/auth/callback", async (req, res) => {
    try {
      const { session } = await shopify.auth.callback({
        rawRequest: req,
        rawResponse: res
      });

      if (!session?.accessToken) {
        throw new Error("Missing access token");
      }

      /**
       * ✅ LOAD OFFLINE SESSION
       */
      const offlineSessionId = shopify.session.getOfflineId(session.shop);

      const offlineSession =
        await shopify.config.sessionStorage.loadSession(
          offlineSessionId
        );

      if (!offlineSession?.accessToken) {
        console.error("❌ Offline session missing");
        return res.status(500).send("Offline session missing");
      }

      console.log("🔑 Offline session loaded:", offlineSession.shop);

      /**
       * 🔥 REGISTER WEBHOOK
       */
      const result = await shopify.webhooks.register({
        session: offlineSession
      });

      console.log("✅ Webhook registration result:", result);

      /**
       * =====================================================
       * ✅ EMBEDDED REDIRECT (CORRECT WAY)
       * =====================================================
       */

      const host = req.query.host;
      const redirectUrl = `/?shop=${offlineSession.shop}${
        host ? `&host=${host}` : ""
      }`;

      return res.redirect(redirectUrl);
    } catch (err) {
      console.error("❌ OAuth callback failed", err);
      return res.status(500).send("Auth failed");
    }
  });

  return shopify;
}
