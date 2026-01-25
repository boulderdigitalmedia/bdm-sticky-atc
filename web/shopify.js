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
const oauthInFlight = new Map();
// { shopDomain: timestamp }

export function initShopify(app) {
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

  // Webhook registration config
  const webhookPath = "/webhooks/orders/create";
  const webhookCallbackUrl = new URL(webhookPath, appUrl).toString();

  shopify.webhooks.addHandlers({
    ORDERS_CREATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: webhookCallbackUrl,
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
        isOnline: false,
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
    try {
      const shop = req.query.shop;
      const code = req.query.code;

      if (!shop) return res.status(400).send("Missing shop parameter");
      if (!code) return res.status(400).send("Missing code parameter");

      const sanitizedShop = shopify.utils.sanitizeShop(safeString(shop));
      if (!sanitizedShop) return res.status(400).send("Invalid shop parameter");

      console.log("⬅️ /auth/callback hit:", {
        shop: sanitizedShop,
        codePresent: Boolean(code),
        hostPresent: Boolean(req.query.host),
        timestamp: req.query.timestamp,
      });

      const session = await shopify.auth.callback({
        rawRequest: req,
        rawResponse: res,
      });

      console.log("✅ OAuth callback returned session:", {
        id: session?.id,
        shop: session?.shop,
        isOnline: session?.isOnline,
        scope: session?.scope,
        hasAccessToken: Boolean(session?.accessToken),
      });

      // Always clear in-flight flag after callback attempt
      oauthInFlight.delete(sanitizedShop);

      // If callback returned empty session, we hard fail with better message
      if (!session?.accessToken || !session?.id || !session?.shop) {
        console.error("❌ OAuth callback returned empty session (token exchange failed).", {
          expectedShop: sanitizedShop,
          gotShop: session?.shop,
          hasAccessToken: Boolean(session?.accessToken),
          note:
            "This is usually caused by Node 22 incompatibility or double OAuth begins. Use Node 20 on Render.",
        });
        return res.status(500).send("Shopify auth failed (empty session)");
      }

      // Store session
      await shopify.config.sessionStorage.storeSession(session);

      // Load offline session for webhook registration
      const offlineSessionId = shopify.session.getOfflineId(session.shop);
      const offlineSession = await shopify.config.sessionStorage.loadSession(offlineSessionId);

      if (!offlineSession?.accessToken) {
        console.error("❌ Missing OFFLINE access token after OAuth:", {
          shop: session.shop,
          offlineSessionId,
        });
      } else {
        try {
          const registerResult = await shopify.webhooks.register({
            session: offlineSession,
          });
          console.log("📌 Webhook register result:", JSON.stringify(registerResult, null, 2));
        } catch (err) {
          console.error("❌ Webhook registration failed:", err);
        }
      }

      // Redirect back into embedded context
      const host = req.query.host;
      if (!host) {
        return res.redirect(`https://${session.shop}/admin/apps/${apiKey}`);
      }
      return res.redirect(`/?shop=${session.shop}&host=${host}`);
    } catch (err) {
      console.error("❌ Auth callback error:", err);
      return res.status(500).send("Shopify auth failed");
    }
  });

  return shopify;
}
