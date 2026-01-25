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

    // ✅ IMPORTANT: this must be your real Prisma-backed session storage
    sessionStorage: prismaSessionStorage(),
  });

  if (appUrl.protocol !== "https:") {
    console.warn(
      "⚠️ SHOPIFY_APP_URL should use https for OAuth + webhook registration. Current value:",
      appUrl.toString()
    );
  }

  // -----------------------------
  // Webhook Handlers
  // -----------------------------
  shopify.webhooks.addHandlers({
    ORDERS_CREATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks/orders/create",
      callback: async () => {
        // Note: This callback only runs if you wire up shopify.processWebhooks()
        // somewhere else in your app.
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
      console.error("❌ Auth begin error:", err);
      return res.status(500).send("Shopify auth failed");
    }
  });

  // -----------------------------
  // OAuth Callback
  // -----------------------------
  app.get("/auth/callback", async (req, res) => {
    try {
      const shop = req.query.shop;
      if (!shop) return res.status(400).send("Missing shop parameter");

      const sanitizedShop = shopify.utils.sanitizeShop(shop.toString());
      if (!sanitizedShop) return res.status(400).send("Invalid shop parameter");

      // 1) Complete OAuth
      const session = await shopify.auth.callback({
        rawRequest: req,
        rawResponse: res,
      });

      console.log("✅ OAuth callback returned session:", {
        id: session?.id,
        shop: session?.shop,
        isOnline: session?.isOnline,
        hasAccessToken: Boolean(session?.accessToken),
        scope: session?.scope,
        expires: session?.expires,
      });

      // 2) Hard fail if no access token (this should not happen if config is correct)
      if (!session?.accessToken) {
        console.error(
          "❌ OAuth completed but session.accessToken is missing. This usually means session storage/config mismatch or bad app credentials."
        );
        return res.status(500).send("Shopify auth failed (missing access token)");
      }

      // 3) Store the session (offline session)
      const storedOk = await shopify.config.sessionStorage.storeSession(session);
      console.log("💾 storeSession() result:", storedOk);

      // 4) Immediately load back from storage (this confirms Prisma storage works)
      const offlineSessionId = shopify.session.getOfflineId(session.shop);
      const storedSession = await shopify.config.sessionStorage.loadSession(offlineSessionId);

      console.log("🔁 Loaded offline session after storing:", {
        id: storedSession?.id,
        shop: storedSession?.shop,
        isOnline: storedSession?.isOnline,
        hasAccessToken: Boolean(storedSession?.accessToken),
      });

      if (!storedSession?.accessToken) {
        console.error(
          "❌ Session storage failed: offline session was not persisted correctly. Fix shopifySessionStoragePrisma.js"
        );
        return res.status(500).send("Shopify auth failed (session not persisted)");
      }

      // 5) Register webhooks using the stored offline session
      try {
        const registerResult = await shopify.webhooks.register({
          session: storedSession,
        });

        console.log("📌 Webhook register result:", JSON.stringify(registerResult, null, 2));

        const failures = Object.entries(registerResult).flatMap(([topic, results]) =>
          results
            .filter((r) => !r.success)
            .map((r) => ({ topic, ...r }))
        );

        if (failures.length) {
          console.error("❌ Webhook registration failures:", failures);
        } else {
          console.log("✅ Webhooks registered successfully");
        }
      } catch (err) {
        console.error("❌ Webhook registration threw error:", err);
      }

      // 6) Redirect into embedded context
      const host = req.query.host;
      const shopDomain = session.shop;

      if (!host) {
        // If host missing, redirect to Shopify Admin to re-open embedded context
        return res.redirect(`https://${shopDomain}/admin/apps/${apiKey}`);
      }

      return res.redirect(`/?shop=${shopDomain}&host=${host}`);
    } catch (err) {
      console.error("❌ Auth callback error:", err);
      return res.status(500).send("Shopify auth failed");
    }
  });

  return shopify;
}
