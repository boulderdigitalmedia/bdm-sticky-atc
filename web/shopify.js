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

    // ✅ FIX: correct Prisma session storage function
    sessionStorage: prismaSessionStorage(),
  });

  if (appUrl.protocol !== "https:") {
    console.warn(
      "⚠️ SHOPIFY_APP_URL should use https for webhook registration. Current value:",
      appUrl.toString()
    );
  }

  // -----------------------------
  // Webhook Handlers
  // -----------------------------
  shopify.webhooks.addHandlers({
    // ✅ Using string topic is the most reliable across versions
    ORDERS_CREATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks/orders/create",
      callback: async () => {
        // This callback is only used if you wire up processWebhooks middleware elsewhere.
      },
    },
  });

  // -----------------------------
  // Begin OAuth
  // -----------------------------
  app.get("/auth", async (req, res) => {
    try {
      const shop = req.query.shop;
      if (!shop) return res.status(400).send("Missing shop parameter");

      const sanitizedShop = shopify.utils.sanitizeShop(shop.toString());
      if (!sanitizedShop) return res.status(400).send("Invalid shop parameter");

      const redirectUrl = await shopify.auth.begin({
        shop: sanitizedShop,
        callbackPath: "/auth/callback",
        isOnline: false,
        rawRequest: req,
        rawResponse: res,
      });

      if (res.headersSent) return;

      if (redirectUrl) {
        return res.redirect(redirectUrl);
      }

      return res.sendStatus(200);
    } catch (err) {
      console.error("Auth begin error:", err);
      return res.status(500).send("Shopify auth failed");
    }
  });

  // -----------------------------
  // OAuth callback
  // -----------------------------
  app.get("/auth/callback", async (req, res) => {
    try {
      const shop = req.query.shop;
      if (!shop) return res.status(400).send("Missing shop parameter");

      const sanitizedShop = shopify.utils.sanitizeShop(shop.toString());
      if (!sanitizedShop) return res.status(400).send("Invalid shop parameter");

      const session = await shopify.auth.callback({
        rawRequest: req,
        rawResponse: res,
      });

      // Make sure we have a usable offline session
      let accessSession = session;

      // These guardrails help if callback returns incomplete session data
      if (!accessSession?.shop) {
        accessSession.shop = sanitizedShop;
      }
      if (!accessSession?.id) {
        accessSession.id = shopify.session.getOfflineId(sanitizedShop);
      }
      if (accessSession?.isOnline == null) {
        accessSession.isOnline = false;
      }

      // ✅ FIX: store the correct session object (the one we will use)
      await shopify.config.sessionStorage.storeSession(accessSession);

      // If for any reason accessToken isn't present, try to reload from storage
      if (!accessSession?.accessToken) {
        const offlineSessionId = shopify.session.getOfflineId(sanitizedShop);
        const storedSession = await shopify.config.sessionStorage.loadSession(offlineSessionId);

        if (storedSession?.accessToken) {
          accessSession = storedSession;
        } else {
          console.error(
            "❌ Missing access token after OAuth callback for shop:",
            session?.shop ?? sanitizedShop
          );
          return res.status(500).send("Shopify auth failed");
        }
      }

      // -----------------------------
      // Register webhooks
      // -----------------------------
      try {
        const registerResult = await shopify.webhooks.register({
          session: accessSession,
        });

        console.log("Webhook register result:", JSON.stringify(registerResult, null, 2));

        const failures = Object.entries(registerResult).flatMap(([topic, results]) =>
          results
            .filter((result) => !result.success)
            .map((result) => ({ topic, ...result }))
        );

        if (failures.length) {
          console.error("❌ Webhook registration failures:", failures);
        } else {
          console.log("✅ Webhooks registered successfully");
        }
      } catch (err) {
        console.error("❌ Webhook registration failed:", err);
      }

      // -----------------------------
      // Redirect back into embedded app context
      // -----------------------------
      const host = req.query.host;
      const shopDomain = accessSession.shop;

      if (!host) {
        // If host missing, redirect to Shopify Admin to re-open embedded context
        return res.redirect(`https://${shopDomain}/admin/apps/${apiKey}`);
      }

      return res.redirect(`/?shop=${shopDomain}&host=${host}`);
    } catch (err) {
      console.error("Auth callback error:", err);
      return res.status(500).send("Shopify auth failed");
    }
  });

  return shopify;
}
