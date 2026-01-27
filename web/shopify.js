import "@shopify/shopify-api/adapters/node";
import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-01";
import { prismaSessionStorage } from "./shopifySessionStoragePrisma.js";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

export function initShopify(app) {
  const shopify = shopifyApi({
    apiKey: requiredEnv("SHOPIFY_API_KEY"),
    apiSecretKey: requiredEnv("SHOPIFY_API_SECRET"),
    scopes: requiredEnv("SCOPES").split(","),
    hostName: new URL(requiredEnv("SHOPIFY_APP_URL")).host,
    apiVersion: LATEST_API_VERSION,
    isEmbeddedApp: false, // 🔑 IMPORTANT — non-embedded baseline
    restResources,
    sessionStorage: prismaSessionStorage(),
  });

  // ---------------- AUTH BEGIN ----------------
  app.get("/auth", async (req, res) => {
    const { shop } = req.query;
    if (!shop) return res.status(400).send("Missing shop parameter");

    const redirectUrl = await shopify.auth.begin({
      shop,
      callbackPath: "/auth/callback",
      isOnline: false,
      rawRequest: req,
      rawResponse: res,
    });

    // Shopify SDK may already respond
    if (res.headersSent) return;
    return res.redirect(redirectUrl);
  });

  // ---------------- AUTH CALLBACK ----------------
  app.get("/auth/callback", async (req, res) => {
    try {
      const session = await shopify.auth.callback({
        rawRequest: req,
        rawResponse: res,
      });

      if (!session?.accessToken) {
        console.error("❌ OAuth failed — missing access token", session);
        if (!res.headersSent) {
          return res.status(500).send("OAuth failed");
        }
        return;
      }

      console.log("✅ OAuth success", {
        shop: session.shop,
        hasAccessToken: true,
      });

      // Shopify may already have responded
      if (res.headersSent) return;

      return res.redirect(`/?shop=${session.shop}`);
    } catch (err) {
      console.error("❌ OAuth callback error:", err);
      if (!res.headersSent) {
        return res.status(500).send("OAuth error");
      }
    }
  });

  return shopify;
}
