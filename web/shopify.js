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
  const appBaseUrl = requiredEnv("SHOPIFY_APP_URL").replace(/\/+$/, ""); // no trailing slash
  const appUrl = new URL(appBaseUrl);

  const scopes = requiredEnv("SCOPES")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  /**
   * =====================================================
   * SHOPIFY INIT
   * =====================================================
   */
  const shopify = shopifyApi({
    apiKey,
    apiSecretKey,
    scopes,
    hostName: appUrl.host,
    hostScheme: "https", // Render proxy-safe
    apiVersion: LATEST_API_VERSION,
    isEmbeddedApp: true,
    restResources,
    sessionStorage: prismaSessionStorage(),
    cookies: {
      sameSite: "none",
      secure: true,
    },
  });

  /**
   * =====================================================
   * WEBHOOK DECLARATION
   * =====================================================
   */
  shopify.webhooks.addHandlers({
    ORDERS_PAID: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks/orders/paid",
    },
  });

  /**
   * =====================================================
   * AUTO REGISTER WEBHOOKS FROM OFFLINE SESSIONS
   * =====================================================
   */
  (async () => {
    try {
      const sessions = await prisma.session.findMany({
        where: { isOnline: false },
      });

      if (!sessions.length) {
        console.log(
          "⚠️ No offline sessions found — skipping auto webhook registration"
        );
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
      const host = req.query.host;

      if (!shop) return res.status(400).send("Missing shop");

      // Normalize embedded flag: we set embedded=1 ourselves
      const embedded = req.query.embedded === "1";

      /**
       * 🔥 CRITICAL
       * Escape iframe BEFORE OAuth so cookies survive.
       * Use ABSOLUTE URL so Shopify/App Bridge can't swallow relative redirects.
       */
      if (!embedded) {
        const redirectUrl =
          `${appBaseUrl}/auth?shop=${encodeURIComponent(shop)}` +
          (host ? `&host=${encodeURIComponent(host)}` : "") +
          `&embedded=1`;

        return res.send(`
          <script>
            if (window.top === window.self) {
              window.location.href = "${redirectUrl}";
            } else {
              window.top.location.href = "${redirectUrl}";
            }
          </script>
        `);
      }

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

  /**
   * =====================================================
   * 🔐 AUTH CALLBACK
   * =====================================================
   */
  app.get("/auth/callback", async (req, res) => {
    try {
      const { session } = await shopify.auth.callback({
        rawRequest: req,
        rawResponse: res,
      });

      if (!session?.accessToken) {
        throw new Error("Missing access token");
      }

      /**
       * LOAD OFFLINE SESSION
       */
      const offlineSessionId = shopify.session.getOfflineId(session.shop);
      const offlineSession = await shopify.config.sessionStorage.loadSession(
        offlineSessionId
      );

      if (!offlineSession?.accessToken) {
        console.error("❌ Offline session missing");
        return res.status(500).send("Offline session missing");
      }

      console.log("🔑 Offline session loaded:", offlineSession.shop);

      /**
       * REGISTER WEBHOOK
       */
      const result = await shopify.webhooks.register({
        session: offlineSession,
      });

      console.log("✅ Webhook registration result:", result);

      /**
       * ✅ Redirect back to your embedded app entrypoint
       * Preserve host if present so App Bridge can mount correctly.
       */
      const host = req.query.host;
      const redirectUrl =
        `${appBaseUrl}/?shop=${encodeURIComponent(offlineSession.shop)}` +
        (host ? `&host=${encodeURIComponent(host)}` : "");

      return res.redirect(redirectUrl);
    } catch (err) {
      console.error("❌ OAuth callback failed", err);
      return res.status(500).send("Auth failed");
    }
  });

  return shopify;
}
