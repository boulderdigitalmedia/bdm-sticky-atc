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
  // Render runs behind a proxy → needed for correct secure cookies/redirects
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
  // Webhook registration config
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

      const sanitizedShop = shopify.utils.sanitizeShop(safeString(shop));
      if (!sanitizedShop) return res.status(400).send("Invalid shop parameter");

      console.log("➡️ /auth called:", {
        shop: sanitizedShop,
        query: req.query,
      });

      // IMPORTANT: Some older versions return void and handle redirect internally,
      // newer versions return a redirect URL. We support both.
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
  // OAuth callback
  // -----------------------------
  app.get("/auth/callback", async (req, res) => {
    try {
      console.log("⬅️ /auth/callback hit:", { query: req.query });

      // Sanity check required params exist
      const shop = req.query.shop;
      const code = req.query.code;
      const hmac = req.query.hmac;
      const state = req.query.state;

      if (!shop || !code || !hmac || !state) {
        console.error("❌ Missing OAuth callback params:", {
          shopPresent: Boolean(shop),
          codePresent: Boolean(code),
          hmacPresent: Boolean(hmac),
          statePresent: Boolean(state),
          query: req.query,
        });
        return res.status(400).send("Missing required OAuth callback params");
      }

      const sanitizedShop = shopify.utils.sanitizeShop(safeString(shop));
      if (!sanitizedShop) return res.status(400).send("Invalid shop parameter");

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

      // If we got an empty session here, it's almost always:
      // - wrong API secret
      // - redirect URL mismatch
      // - incorrect SHOPIFY_APP_URL host
      // - or old library behavior + request mismatch
      if (!session?.accessToken || !session?.shop) {
        console.error("❌ OAuth failed: missing accessToken or shop on session.", {
          expectedShop: sanitizedShop,
          gotShop: session?.shop,
          hasAccessToken: Boolean(session?.accessToken),
          note:
            "Check SHOPIFY_API_KEY/SHOPIFY_API_SECRET, SHOPIFY_APP_URL matches Partner dashboard, and Allowed redirection URL is correct.",
        });
        return res.status(500).send("Shopify auth failed (missing access token)");
      }

      // Store session
      const storedOk = await shopify.config.sessionStorage.storeSession(session);
      console.log("💾 storeSession() result:", storedOk);

      // Load back offline session to confirm persistence
      const offlineSessionId = shopify.session.getOfflineId(session.shop);
      const storedSession = await shopify.config.sessionStorage.loadSession(offlineSessionId);

      console.log("🔁 Loaded offline session after storing:", {
        id: storedSession?.id,
        shop: storedSession?.shop,
        isOnline: storedSession?.isOnline,
        hasAccessToken: Boolean(storedSession?.accessToken),
      });

      // Use stored session if available
      const accessSession = storedSession?.accessToken ? storedSession : session;

      // Register webhooks
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
        console.error("❌ Webhook registration threw:", err);
      }

      // Redirect into embedded context
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

  // -----------------------------
  // Webhook receiver (stub)
  // -----------------------------
  app.post("/webhooks/orders/create", async (_req, res) => {
    return res.status(200).send("ok");
  });

  return shopify;
}
