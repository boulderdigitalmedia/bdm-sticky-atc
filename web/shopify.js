import "@shopify/shopify-api/adapters/node";
import { shopifyApi, LATEST_API_VERSION, DeliveryMethod } from "@shopify/shopify-api";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-01";
import { shopifyAuth } from "@shopify/shopify-api/express";
import { prismaSessionStorage } from "./shopifySessionStoragePrisma.js";

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function initShopify(app) {
  // Render/proxies: required for correct secure cookies + redirects
  try {
    app.set("trust proxy", 1);
  } catch (_) {
    // ignore if app is not an express instance
  }

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
  // Webhook handler definitions (registration config)
  // -----------------------------
  shopify.webhooks.addHandlers({
    ORDERS_CREATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks/orders/create",
      callback: async () => {},
    },
  });

  // -----------------------------
  // AUTH ROUTES (Shopify Express middleware)
  // -----------------------------
  // Begin OAuth (offline token)
  app.get(
    "/auth",
    shopifyAuth({
      shopify,
      isOnline: false,
    })
  );

  // OAuth callback (offline token)
  app.get(
    "/auth/callback",
    shopifyAuth({
      shopify,
      isOnline: false,
    }),
    async (req, res) => {
      try {
        const session = res.locals?.shopify?.session;

        console.log("✅ OAuth callback session:", {
          id: session?.id,
          shop: session?.shop,
          isOnline: session?.isOnline,
          scope: session?.scope,
          expires: session?.expires,
          hasAccessToken: Boolean(session?.accessToken),
        });

        if (!session?.accessToken) {
          console.error("❌ OAuth completed but access token missing.");
          return res.status(500).send("Shopify auth failed (missing access token)");
        }

        // Register webhooks
        try {
          const registerResult = await shopify.webhooks.register({ session });

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

        // Redirect back into embedded app context
        const host = req.query.host;
        const shopDomain = session.shop;

        if (!host) {
          return res.redirect(`https://${shopDomain}/admin/apps/${apiKey}`);
        }

        return res.redirect(`/?shop=${shopDomain}&host=${host}`);
      } catch (err) {
        console.error("❌ Post-auth callback error:", err);
        return res.status(500).send("Shopify auth failed");
      }
    }
  );

  // -----------------------------
  // WEBHOOK RECEIVER (simple stub)
  // Replace with full verification later; this avoids 404s for now.
  // -----------------------------
  app.post("/webhooks/orders/create", async (_req, res) => {
    return res.status(200).send("ok");
  });

  return shopify;
}
