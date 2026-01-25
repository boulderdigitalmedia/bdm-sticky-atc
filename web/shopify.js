import "@shopify/shopify-api/adapters/node";
import { shopifyApi, LATEST_API_VERSION, DeliveryMethod } from "@shopify/shopify-api";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-01";
import { prismaSessionStorage } from "./shopifySessionStoragePrisma.js";

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function safeString(v) {
  if (v == null) return "";
  return String(v);
}

// ✅ Prevent duplicate OAuth begins per shop
const oauthInFlight = new Map(); // shopDomain -> timestamp

export function initShopify(app) {
  // Required on Render (proxy/https/cookies)
  app.set("trust proxy", 1);

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
    sessionStorage: prismaSessionStorage(),
  });

  // -----------------------------
  // Webhook registration setup
  // -----------------------------
  const webhookPath = "/webhooks/orders/create";
  const webhookCallbackUrl = new URL(webhookPath, appUrl).toString();

  if (appUrl.protocol !== "https:") {
    console.warn(
      "⚠️ SHOPIFY_APP_URL should use https for webhook registration. Current value:",
      appUrl.toString()
    );
  }

  shopify.webhooks.addHandlers({
    ORDERS_CREATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: webhookCallbackUrl, // full URL avoids base-url mismatch
      callback: async () => {},
    },
  });

  // -----------------------------
  // OAuth begin
  // -----------------------------
  app.get("/auth", async (req, res) => {
    try {
      const shop = req.query.shop;
      if (!shop) return res.status(400).send("Missing shop parameter");

      const sanitizedShop = shopify.utils.sanitizeShop(safeString(shop));
      if (!sanitizedShop) return res.status(400).send("Invalid shop parameter");

      // ✅ Block double /auth spam within 3 seconds
      const now = Date.now();
      const last = oauthInFlight.get(sanitizedShop);
      if (last && now - last < 3000) {
        console.warn("⚠️ Duplicate /auth blocked:", sanitizedShop);
        return res.status(429).send("Auth already in progress. Please wait.");
      }
      oauthInFlight.set(sanitizedShop, now);

      console.log("➡️ /auth begin:", { shop: sanitizedShop });

      const redirectUrl = await shopify.auth.begin({
        shop: sanitizedShop,
        callbackPath: "/auth/callback",
        isOnline: false, // OFFLINE token (required for webhooks)
        rawRequest: req,
        rawResponse: res,
      });

      if (res.headersSent) return;
      if (redirectUrl) return res.redirect(redirectUrl);
      return res.sendStatus(200);
    } catch (err) {
      console.error("❌ Auth begin error:", err);
      return res.status(500).send("Shopify auth failed");
    }
  });

  // -----------------------------
  // OAuth callback
  // -----------------------------
  app.get("/auth/callback", async (req, res) => {
    const host = req.query.host;
    const shop = req.query.shop;

    try {
      const code = req.query.code;

      if (!shop) return res.status(400).send("Missing shop parameter");
      if (!code) return res.status(400).send("Missing code parameter");

      const sanitizedShop = shopify.utils.sanitizeShop(safeString(shop));
      if (!sanitizedShop) return res.status(400).send("Invalid shop parameter");

      console.log("⬅️ /auth/callback hit:", {
        shop: sanitizedShop,
        codePresent: Boolean(code),
        hostPresent: Boolean(host),
        timestamp: req.query.timestamp,
        node: process.version,
      });

      let session;
      try {
        session = await shopify.auth.callback({
          rawRequest: req,
          rawResponse: res,
        });
      } catch (err) {
        console.error("❌ shopify.auth.callback threw:", err?.message || err);

        if (err?.response?.body) {
          console.error("❌ Shopify response body:", err.response.body);
        }

        oauthInFlight.delete(sanitizedShop);
        return res.status(500).send("Shopify auth failed (callback threw)");
      }

      console.log("✅ OAuth callback returned session:", {
        id: session?.id,
        shop: session?.shop,
        isOnline: session?.isOnline,
        scope: session?.scope,
        hasAccessToken: Boolean(session?.accessToken),
      });

      // Always clear lock after callback attempt
      oauthInFlight.delete(sanitizedShop);

      // Hard fail if token exchange didn't succeed
      if (!session?.accessToken || !session?.id || !session?.shop) {
        console.error("❌ OAuth callback returned empty session (token exchange failed).", {
          expectedShop: sanitizedShop,
          gotShop: session?.shop,
          hasAccessToken: Boolean(session?.accessToken),
          note:
            "Most common causes: Node runtime mismatch (use Node 20), proxy issues, or OAuth called twice.",
        });
        return res.status(500).send("Shopify auth failed (empty session)");
      }

      // Store session
      await shopify.config.sessionStorage.storeSession(session);

      // -----------------------------
      // Register webhooks using OFFLINE session
      // -----------------------------
      const offlineSessionId = shopify.session.getOfflineId(session.shop);
      const offlineSession = await shopify.config.sessionStorage.loadSession(offlineSessionId);

      console.log("🔁 Loaded offline session:", {
        id: offlineSession?.id,
        shop: offlineSession?.shop,
        isOnline: offlineSession?.isOnline,
        scope: offlineSession?.scope,
        hasAccessToken: Boolean(offlineSession?.accessToken),
      });

      if (!offlineSession?.accessToken) {
        console.error("❌ Missing OFFLINE access token. Webhooks cannot be registered.", {
          shop: session.shop,
          offlineSessionId,
        });
      } else {
        try {
          console.log("📌 Registering webhooks with OFFLINE session:", {
            shop: offlineSession.shop,
            sessionId: offlineSession.id,
            callbackUrl: webhookCallbackUrl,
          });

          const registerResult = await shopify.webhooks.register({
            session: offlineSession,
          });

          console.log("📌 Webhook register result:", JSON.stringify(registerResult, null, 2));

          const failures = Object.entries(registerResult).flatMap(([topic, results]) =>
            results
              .filter((r) => !r.success)
              .map((r) => ({
                topic,
                ...r,
              }))
          );

          if (failures.length) {
            console.error("❌ Webhook registration failures:", failures);
          } else {
            console.log("✅ Webhooks registered successfully");
          }
        } catch (err) {
          console.error("❌ Webhook registration failed:", err);
        }
      }

      // Redirect into embedded context
      if (!host) {
        return res.redirect(`https://${session.shop}/admin/apps/${apiKey}`);
      }

      return res.redirect(`/?shop=${session.shop}&host=${host}`);
    } catch (err) {
      console.error("❌ Auth callback error:", err);
      return res.status(500).send("Shopify auth failed");
    }
  });

  // -----------------------------
  // Optional: webhook processor route
  // (You can remove this if you ONLY use your own handler)
  // -----------------------------
  app.post("/webhooks/orders/create", async (req, res) => {
    try {
      await shopify.webhooks.process({
        rawRequest: req,
        rawResponse: res,
      });

      if (res.headersSent) return;
      return res.sendStatus(200);
    } catch (err) {
      console.error("❌ shopify.webhooks.process error:", err);
      if (!res.headersSent) return res.status(500).send("Webhook error");
    }
  });

  return shopify;
}
