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

export function initShopify(app) {
  // IMPORTANT on Render
  try {
    app.set("trust proxy", 1);
  } catch (_) {}

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

  // ---------------------------------------------------------
  // Webhook handlers (topics + callback URL)
  // ---------------------------------------------------------
  // IMPORTANT:
  // Shopify expects callbackUrl to be either:
  //  - a full URL (https://...)
  //  - OR a relative path, BUT registration will use SHOPIFY_APP_URL base
  //
  // We'll use a FULL URL to avoid any mismatch.
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
      callbackUrl: webhookCallbackUrl, // FULL URL avoids Shopify rejecting it
      callback: async (_topic, _shop, _body) => {
        // This callback is ONLY used if you use shopify.webhooks.process()
        // We handle the webhook endpoint explicitly below.
      },
    },
  });

  // ---------------------------------------------------------
  // OAuth start
  // ---------------------------------------------------------
  app.get("/auth", async (req, res) => {
    try {
      const shop = req.query.shop;
      if (!shop) return res.status(400).send("Missing shop parameter");

      const sanitizedShop = shopify.utils.sanitizeShop(safeString(shop));
      if (!sanitizedShop) return res.status(400).send("Invalid shop parameter");

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

  // ---------------------------------------------------------
  // OAuth callback
  // ---------------------------------------------------------
  app.get("/auth/callback", async (req, res) => {
    try {
      const shop = req.query.shop;
      if (!shop) return res.status(400).send("Missing shop parameter");

      const sanitizedShop = shopify.utils.sanitizeShop(safeString(shop));
      if (!sanitizedShop) return res.status(400).send("Invalid shop parameter");

      const session = await shopify.auth.callback({
        rawRequest: req,
        rawResponse: res,
      });

      console.log("✅ OAuth session:", {
        id: session?.id,
        shop: session?.shop,
        isOnline: session?.isOnline,
        hasAccessToken: Boolean(session?.accessToken),
        scope: session?.scope,
      });

      // Store session (VERY IMPORTANT)
      await shopify.config.sessionStorage.storeSession(session);

      // ---------------------------------------------------------
      // Webhook registration MUST use OFFLINE session
      // ---------------------------------------------------------
      const shopDomain = session?.shop || sanitizedShop;
      const offlineSessionId = shopify.session.getOfflineId(shopDomain);
      const offlineSession = await shopify.config.sessionStorage.loadSession(offlineSessionId);

      if (!offlineSession?.accessToken) {
        console.error("❌ Missing OFFLINE access token. Webhooks cannot be registered.", {
          shopDomain,
          offlineSessionId,
          note:
            "This usually means OAuth ran as online token or session storage didn't persist correctly.",
        });
      } else {
        try {
          console.log("📌 Registering webhooks with OFFLINE session:", {
            shop: offlineSession.shop,
            sessionId: offlineSession.id,
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
          console.error("❌ Webhook registration threw:", err);
        }
      }

      // Shopify admin passes host param on embedded loads
      const host = req.query.host;

      if (!host) {
        return res.redirect(`https://${shopDomain}/admin/apps/${apiKey}`);
      }

      return res.redirect(`/?shop=${shopDomain}&host=${host}`);
    } catch (err) {
      console.error("❌ Auth callback error:", err);
      return res.status(500).send("Shopify auth failed");
    }
  });

  // ---------------------------------------------------------
  // Webhook receiver endpoint
  // ---------------------------------------------------------
  // IMPORTANT:
  // Shopify webhook HMAC validation requires the RAW body.
  // So your index.js MUST register this route BEFORE bodyParser.json().
  //
  // In your index.js:
  // app.post("/webhooks/orders/create", express.raw({ type: "*/*" }), ordersCreate)
  //
  // If you want Shopify's built-in verification:
  app.post("/webhooks/orders/create", async (req, res) => {
    try {
      await shopify.webhooks.process({
        rawRequest: req,
        rawResponse: res,
      });

      if (res.headersSent) return;
      return res.sendStatus(200);
    } catch (err) {
      console.error("❌ Webhook process error:", err);
      if (!res.headersSent) return res.status(500).send("Webhook error");
    }
  });

  return shopify;
}
