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

  console.log("🔧 Shopify init config:", {
    apiKey: apiKey ? `${apiKey.slice(0, 6)}…` : null,
    appUrl: appUrl.toString(),
    hostName: appUrl.host,
    hostScheme: appUrl.protocol.replace(":", ""),
    scopes,
    apiVersion: LATEST_API_VERSION,
    embedded: true,
  });

  const shopify = shopifyApi({
    apiKey,
    apiSecretKey,
    scopes,
    hostName: appUrl.host,
    hostScheme: appUrl.protocol.replace(":", ""),
    apiVersion: LATEST_API_VERSION,
    isEmbeddedApp: true,
    restResources,
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
      callback: async () => {},
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

      console.log("➡️ /auth called:", {
        shop: sanitizedShop,
        query: req.query,
      });

      const redirectUrl = await shopify.auth.begin({
        shop: sanitizedShop,
        callbackPath: "/auth/callback",
        isOnline: false,
        rawRequest: req,
        rawResponse: res,
      });

      if (res.headersSent) return;

      if (redirectUrl) {
        console.log("➡️ Redirecting to Shopify OAuth:", redirectUrl);
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
      console.log("⬅️ /auth/callback hit:", {
        query: req.query,
      });

      const shop = req.query.shop;
      if (!shop) return res.status(400).send("Missing shop parameter");

      const sanitizedShop = shopify.utils.sanitizeShop(shop.toString());
      if (!sanitizedShop) return res.status(400).send("Invalid shop parameter");

      // 🚨 Shopify MUST send these for OAuth to work
      const code = req.query.code;
      const state = req.query.state;
      const hmac = req.query.hmac;

      if (!code || !state || !hmac) {
        console.error("❌ Missing OAuth callback params:", {
          codePresent: Boolean(code),
          statePresent: Boolean(state),
          hmacPresent: Boolean(hmac),
          query: req.query,
        });
        return res.status(400).send("Missing required OAuth callback params");
      }

      let session;
      try {
        session = await shopify.auth.callback({
          rawRequest: req,
          rawResponse: res,
        });
      } catch (err) {
        console.error("❌ shopify.auth.callback() threw:", err);
        return res.status(500).send("Shopify auth failed (callback exception)");
      }

      console.log("✅ OAuth callback returned session:", {
        id: session?.id,
        shop: session?.shop,
        isOnline: session?.isOnline,
        scope: session?.scope,
        expires: session?.expires,
        hasAccessToken: Boolean(session?.accessToken),
      });

      // 🚨 If token missing here, OAuth exchange failed (usually config mismatch)
      if (!session?.accessToken) {
        console.error("❌ Missing access token AFTER OAuth callback.", {
          shop: session?.shop ?? sanitizedShop,
          sessionId: session?.id,
          scope: session?.scope,
          note:
            "This is usually caused by bad SHOPIFY_API_SECRET, wrong SHOPIFY_APP_URL/redirect URL mismatch, or embedded cookie/proxy issues.",
        });

        return res.status(500).send("Shopify auth failed (missing access token)");
      }

      // Store session
      const storedOk = await shopify.config.sessionStorage.storeSession(session);
      console.log("💾 storeSession() result:", storedOk);

      // Load session back to confirm storage works
      const offlineSessionId = shopify.session.getOfflineId(session.shop);
      const storedSession = await shopify.config.sessionStorage.loadSession(offlineSessionId);

      console.log("🔁 Loaded offline session after storing:", {
        id: storedSession?.id,
        shop: storedSession?.shop,
        isOnline: storedSession?.isOnline,
        hasAccessToken: Boolean(storedSession?.accessToken),
      });

      // Register webhooks
      try {
        const registerResult = await shopify.webhooks.register({
          session: storedSession ?? session,
        });

        console.log("📌 Webhook register result:", JSON.stringify(registerResult, null, 2));
      } catch (err) {
        console.error("❌ Webhook registration error:", err);
      }

      // Redirect back to embedded app
      const host = req.query.host;
      const shopDomain = session.shop;

      if (!host) {
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
