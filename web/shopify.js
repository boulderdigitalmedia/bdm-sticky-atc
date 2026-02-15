import "@shopify/shopify-api/adapters/node";
import {
  shopifyApi,
  LATEST_API_VERSION,
  DeliveryMethod,
} from "@shopify/shopify-api";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-01";
import { prismaSessionStorage } from "./shopifySessionStoragePrisma.js";
import prisma from "./prisma.js";

/* =====================================================
   ENV HELPERS
===================================================== */
function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

/* =====================================================
   ⭐ EXPORT SHOPIFY INSTANCE (IMPORTANT)
===================================================== */
export let shopify;

/* =====================================================
   INIT SHOPIFY
===================================================== */
export function initShopify(app) {
  const apiKey = requiredEnv("SHOPIFY_API_KEY");
  const apiSecretKey = requiredEnv("SHOPIFY_API_SECRET");
  const appBaseUrl = requiredEnv("SHOPIFY_APP_URL").replace(/\/+$/, "");
  const appUrl = new URL(appBaseUrl);

  const scopes = requiredEnv("SCOPES")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  shopify = shopifyApi({
    apiKey,
    apiSecretKey,
    scopes,
    hostName: appUrl.host,
    hostScheme: "https",
    apiVersion: LATEST_API_VERSION,
    isEmbeddedApp: true,
    restResources,
    sessionStorage: prismaSessionStorage(),
  });

  /* =====================================================
     WEBHOOK DECLARATION
  ===================================================== */
  shopify.webhooks.addHandlers({
    ORDERS_PAID: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks/orders/paid",
    },
  });

  /* =====================================================
     AUTO REGISTER WEBHOOKS FOR EXISTING SHOPS
  ===================================================== */
  (async () => {
    try {
      const sessions = await prisma.session.findMany({
        where: { isOnline: false },
      });

      for (const s of sessions) {
        try {
          await shopify.webhooks.register({ session: s });
        } catch {}
      }
    } catch {}
  })();

  /* =====================================================
     🔐 AUTH ROUTES (MODERN EMBEDDED SAFE)
  ===================================================== */

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
        rawResponse: res,
      });
    } catch (err) {
      console.error("❌ OAuth begin failed:", err);
      res.status(500).send("Auth start failed");
    }
  });

  app.get("/auth/callback", async (req, res) => {
    try {
      const { session } = await shopify.auth.callback({
        rawRequest: req,
        rawResponse: res,
      });

      if (!session?.accessToken) {
        throw new Error("Missing access token");
      }

      console.log("🔑 OAuth session received:", session.shop);

      // Register webhook immediately
      await shopify.webhooks.register({ session });

      const host = req.query.host;

      const redirectUrl =
        `/?shop=${encodeURIComponent(session.shop)}` +
        (host ? `&host=${encodeURIComponent(host)}` : "");

      // ⭐ NORMAL REDIRECT — NO iframe escape
      res.redirect(redirectUrl);
    } catch (err) {
      console.error("❌ OAuth callback failed", err);
      return res.status(500).send("Auth failed");
    }
  });

  return shopify;
}
