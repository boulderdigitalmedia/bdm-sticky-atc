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
  // Required on Render
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

  // -----------------------------
  // Webhooks: define handler
  // -----------------------------
  const webhookPath = "/webhooks/orders/create";
  const webhookCallbackUrl = new URL(webhookPath, appUrl).toString();

  shopify.webhooks.addHandlers({
    ORDERS_CREATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: webhookCallbackUrl, // full URL is safest
      callback: async () => {},
    },
  });

  // -----------------------------
  // OAuth start (idempotent)
  // -----------------------------
  app.get("/auth", async (req, res) => {
    try {
      const shop = req.query.shop;
      if (!shop) return res.status(400).send("Missing shop parameter");

      const sanitizedShop = shopify.utils.sanitizeShop(safeString(shop));
      if (!sanitizedShop) return res.status(400).send("Invalid shop parameter");

      // ✅ If we already have an OFFLINE token, skip OAuth
      const offlineSessionId = shopify.session.getOfflineId(sanitizedShop);
      const existingOfflineSession = await shopify.config.sessionStorage.loadSession(
        offlineSessionId
      );

      if (existingOfflineSession?.accessToken) {
        console.log("🔁 /auth skipped (offline session exists):", {
          shop: sanitizedShop,
          offlineSessionId,
        });

        const host = req.query.host;
        if (!host) {
          return res.redirect(`https://${sanitizedShop}/admin/apps/${apiKey}`);
        }

        return res.redirect(`/?shop=${sanitizedShop}&host=${host}`);
      }

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
  // OAuth callback (safe on replay)
  // -----------------------------
  app.get("/auth/callback", async (req, res) => {
    const host = req.query.host;
    const shop = req.query.shop;

    try {
      const sanitizedShop = shopify.utils.sanitizeShop(safeString(shop));
      if (!sanitizedShop) return res.status(400).send("Invalid shop parameter");

      console.log("⬅️ /auth/callback hit:", {
        shop: sanitizedShop,
        codePresent: Boolean(req.query.code),
        hostPresent: Boolean(host),
        timestamp: req.query.timestamp,
      });

      const session = await shopify.auth.callback({
        rawRequest: req,
        rawResponse: res,
      });

      console.log("✅ OAuth callback session:", {
        id: session?.id,
        shop: session?.shop,
        isOnline: session?.isOnline,
        hasAccessToken: Boolean(session?.accessToken),
        scope: session?.scope,
      });

      if (!session?.accessToken) {
        console.error("❌ Missing access token after OAuth callback:", {
          shop: session?.shop ?? sanitizedShop,
        });
        return res.status(500).send("Shopify auth failed (missing access token)");
      }

      // Store session
      await shopify.config.sessionStorage.storeSession(session);

      // Load offline session for webhook registration
      const offlineSessionId = shopify.session.getOfflineId(session.shop);
      const offlineSession = await shopify.config.sessionStorage.loadSession(offlineSessionId);

      if (!offlineSession?.accessToken) {
        console.error("❌ Missing OFFLINE token after storing session:", {
          offlineSessionId,
          shop: session.shop,
        });
      } else {
        // Register webhooks
        try {
          const registerResult = await shopify.webhooks.register({ session: offlineSession });
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
      }

      // Redirect back to embedded app
      if (!host) {
        return res.redirect(`https://${session.shop}/admin/apps/${apiKey}`);
      }
      return res.redirect(`/?shop=${session.shop}&host=${host}`);
    } catch (err) {
      // ✅ Handle replayed/duplicate callback gracefully
      const errBody = err?.response?.body;
      const isAlreadyUsedCode =
        errBody?.error === "invalid_request" &&
        safeString(errBody?.error_description).includes("already used");

      if (isAlreadyUsedCode) {
        console.warn("⚠️ OAuth callback replay detected (code already used). Redirecting…", {
          shop,
        });

        if (shop && host) {
          return res.redirect(`/?shop=${shop}&host=${host}`);
        }
        if (shop) {
          return res.redirect(`https://${shop}/admin/apps/${apiKey}`);
        }
        return res.status(400).send("OAuth code already used. Please try again.");
      }

      console.error("❌ Auth callback error:", err);
      return res.status(500).send("Shopify auth failed");
    }
  });

  // -----------------------------
  // Webhook receiver (Shopify verifies raw body)
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
      console.error("❌ Webhook process error:", err);
      if (!res.headersSent) return res.status(500).send("Webhook error");
    }
  });

  return shopify;
}
