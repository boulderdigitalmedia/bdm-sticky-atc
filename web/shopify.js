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

  // Webhook config
  const webhookPath = "/webhooks/orders/create";
  const webhookCallbackUrl = new URL(webhookPath, appUrl).toString();

  shopify.webhooks.addHandlers({
    ORDERS_CREATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: webhookCallbackUrl,
      callback: async () => {},
    },
  });

  // OAuth begin
  app.get("/auth", async (req, res) => {
    try {
      const shop = req.query.shop;
      if (!shop) return res.status(400).send("Missing shop parameter");

      const sanitizedShop = shopify.utils.sanitizeShop(safeString(shop));
      if (!sanitizedShop) return res.status(400).send("Invalid shop parameter");

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

  // OAuth callback
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

      console.log("✅ OAuth callback returned session:", {
        id: session?.id,
        shop: session?.shop,
        isOnline: session?.isOnline,
        scope: session?.scope,
        hasAccessToken: Boolean(session?.accessToken),
      });

      // Store whatever we got
      await shopify.config.sessionStorage.storeSession(session);

      // Load offline session (this is what webhooks need)
      const shopDomain = session?.shop || sanitizedShop;
      const offlineSessionId = shopify.session.getOfflineId(shopDomain);
      const offlineSession = await shopify.config.sessionStorage.loadSession(offlineSessionId);

      console.log("🔁 Loaded offline session:", {
        id: offlineSession?.id,
        shop: offlineSession?.shop,
        isOnline: offlineSession?.isOnline,
        scope: offlineSession?.scope,
        hasAccessToken: Boolean(offlineSession?.accessToken),
      });

      // If BOTH missing, auth really failed
      if (!session?.accessToken && !offlineSession?.accessToken) {
        console.error("❌ Missing access token after OAuth callback:", {
          shop: shopDomain,
          note:
            "This is commonly caused by double-callback (code already used), or session storage not persisting.",
        });
        return res.status(500).send("Shopify auth failed (missing access token)");
      }

      // Register webhooks using offline token if possible
      const accessSession = offlineSession?.accessToken ? offlineSession : session;

      try {
        const registerResult = await shopify.webhooks.register({ session: accessSession });
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
        console.error("❌ Webhook registration failed:", err);
      }

      // Redirect into embedded context
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

  return shopify;
}
