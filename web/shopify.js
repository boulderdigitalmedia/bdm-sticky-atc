console.log("🔥 NEW SHOPIFY.JS DEPLOYED");

import "@shopify/shopify-api/adapters/node";
import {
  shopifyApi,
  DeliveryMethod,
} from "@shopify/shopify-api";
import { restResources } from "@shopify/shopify-api/rest/admin/2026-01";
import { prismaSessionStorage } from "./shopifySessionStoragePrisma.js";
import prisma from "./prisma.js";

import { complianceWebhook } from "./routes/compliance.js";
import { ordersPaid } from "./routes/webhooks.js";

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export let shopify;

function topRedirectHtml(url) {
  return `
    <html>
      <body>
        <script>
          if (window.top === window.self) {
            window.location.href = "${url}";
          } else {
            window.top.location.href = "${url}";
          }
        </script>
      </body>
    </html>
  `;
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

  shopify = shopifyApi({
  apiKey,
  apiSecretKey,
  scopes,
  hostName: appUrl.host,
  hostScheme: "https",
  apiVersion: "2026-01",
  isEmbeddedApp: true,
  restResources,
  sessionStorage: prismaSessionStorage(),

  future: {
    unstable_managedPricingSupport: true,
  },

  cookies: {
    secure: true,
    sameSite: "none",
  },
});

  /* =========================================================
     ⭐ WEBHOOK HANDLERS (FIXED)
  ========================================================= */
  shopify.webhooks.addHandlers({
  ORDERS_PAID: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/webhooks/orders/paid",
    callback: ordersPaid,
  },

  APP_UNINSTALLED: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/webhooks/app/uninstalled",
    callback: async (topic, shop) => {
      const sessions =
        await shopify.config.sessionStorage.findSessionsByShop(shop);

      for (const s of sessions) {
        await shopify.config.sessionStorage.deleteSession(s.id);
      }
    },
  },

  // 🔥 Explicit topic strings (THIS is the key)

  "customers/data_request": {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/webhooks/customers/data_request",
    callback: complianceWebhook,
  },

  "customers/redact": {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/webhooks/customers/redact",
    callback: complianceWebhook,
  },

  "shop/redact": {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/webhooks/shop/redact",
    callback: complianceWebhook,
  },
});

  /* =========================================================
     AUTH START
  ========================================================= */
  app.get("/auth", async (req, res) => {
    try {
      const shopParam = req.query.shop;
      if (!shopParam) return res.status(400).send("Missing shop");

      const shop = shopify.utils.sanitizeShop(String(shopParam));
      if (!shop) return res.status(400).send("Invalid shop");

      if (!req.query.embedded) {
        const redirectUrl = `/auth?shop=${encodeURIComponent(shop)}&embedded=1`;
        return res.send(topRedirectHtml(redirectUrl));
      }

      await shopify.auth.begin({
        shop,
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

  /* =========================================================
     AUTH CALLBACK
  ========================================================= */
  app.get("/auth/callback", async (req, res) => {
    try {
      const { session } = await shopify.auth.callback({
        rawRequest: req,
        rawResponse: res,
      });

      if (!session?.accessToken) throw new Error("Missing access token");

      console.log("🔑 OAuth session received:", session.shop);

      await shopify.config.sessionStorage.storeSession(session);
      console.log("💾 Session stored:", session.id);

      try {
        const response = await shopify.webhooks.register({ session });

        console.log("📡 WEBHOOK REGISTER RESULT");
        console.log(JSON.stringify(response, null, 2));
      } catch (e) {
        console.error("⚠️ Webhook register failed:", e);
      }

      const host = req.query.host ? String(req.query.host) : null;

      const redirectUrl =
        `/?shop=${encodeURIComponent(session.shop)}` +
        (host ? `&host=${encodeURIComponent(host)}` : "") +
        `&embedded=1`;

      return res.redirect(redirectUrl);
    } catch (err) {
      console.error("❌ OAuth callback failed", err);
      return res.status(500).send("Auth failed");
    }
  });

  return shopify;
}