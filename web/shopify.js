import "@shopify/shopify-api/adapters/node";
import {
  shopifyApi,
  LATEST_API_VERSION,
  DeliveryMethod,
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
  const appBaseUrl = requiredEnv("SHOPIFY_APP_URL").replace(/\/+$/, "");
  const appUrl = new URL(appBaseUrl);

  const scopes = requiredEnv("SCOPES")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const shopify = shopifyApi({
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
     AUTO REGISTER WEBHOOKS (BEST EFFORT)
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
     🔐 AUTH START
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

  /* =====================================================
     🔐 AUTH CALLBACK — FIXED VERSION
  ===================================================== */
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

      /**
       * ⭐ IMPORTANT FIX
       * Use session returned by callback directly.
       * DO NOT reload from Prisma here.
       */
      await shopify.webhooks.register({ session });

      const host = req.query.host;

      const redirectUrl =
        `${appBaseUrl}/?shop=${encodeURIComponent(session.shop)}` +
        (host ? `&host=${encodeURIComponent(host)}` : "");

      return res.redirect(redirectUrl);
    } catch (err) {
      console.error("❌ OAuth callback failed", err);
      return res.status(500).send("Auth failed");
    }
  });

  return shopify;
}
