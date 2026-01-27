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
  const scopes = requiredEnv("SCOPES").split(",").map((s) => s.trim()).filter(Boolean);

  const shopify = shopifyApi({
    apiKey,
    apiSecretKey,
    scopes,
    hostName: appUrl.host,
    hostScheme: appUrl.protocol.replace(":", ""),
    apiVersion: LATEST_API_VERSION,
    isEmbeddedApp: true,
    restResources,
    sessionStorage: prismaSessionStorage()
  });

  if (appUrl.protocol !== "https:") {
    console.warn(
      "SHOPIFY_APP_URL should use https for webhook registration. Current value:",
      appUrl.toString()
    );
  }

  shopify.webhooks.addHandlers({
    ORDERS_PAID: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks/orders/paid",
      callback: async () => {}
    }
  });

  // Begin OAuth
  app.get("/auth", async (req, res) => {
    const shop = req.query.shop;
    if (!shop) return res.status(400).send("Missing shop parameter");
    const sanitizedShop = shopify.utils.sanitizeShop(shop.toString());
    if (!sanitizedShop) return res.status(400).send("Invalid shop parameter");

    const redirectUrl = await shopify.auth.begin({
      shop: sanitizedShop,
      callbackPath: "/auth/callback",
      isOnline: false,
      rawRequest: req,
      rawResponse: res
    });

    if (res.headersSent) return;
    if (redirectUrl) {
      return res.redirect(redirectUrl);
    }
    return res.sendStatus(200);
  });

  // OAuth callback
  app.get("/auth/callback", async (req, res) => {
    try {
      const shop = req.query.shop;
      if (!shop) return res.status(400).send("Missing shop parameter");
      const sanitizedShop = shopify.utils.sanitizeShop(shop.toString());
      if (!sanitizedShop) return res.status(400).send("Invalid shop parameter");

      const session = await shopify.auth.callback({
        rawRequest: req,
        rawResponse: res
      });

      if (!session?.accessToken) {
        console.error(
          "Missing access token after OAuth callback for shop:",
          session?.shop ?? sanitizedShop
        );
        const params = new URLSearchParams({ shop: sanitizedShop });
        const hostParam = req.query.host;
        if (hostParam) params.set("host", hostParam.toString());
        return res.redirect(`/auth?${params.toString()}`);
      }

      if (session?.accessToken) {
        try {
          const registerResult = await shopify.webhooks.register({ session });
          const failures = Object.entries(registerResult).flatMap(([topic, results]) =>
            results
              .filter((result) => !result.success)
              .map((result) => ({ topic, ...result }))
          );
          if (failures.length) {
            console.error("Webhook registration failures:", failures);
          }
          console.log("Webhook register result:", registerResult);
        } catch (err) {
          console.error("Webhook registration failed:", err);
        }
      }

      // Shopify admin passes host param on embedded loads
      const host = req.query.host;
      const shopDomain = session.shop;

      if (!host) {
        // If host missing, redirect to Shopify Admin to re-open embedded context
        return res.redirect(`https://${shopDomain}/admin/apps/${apiKey}`);
      }

      return res.redirect(`/?shop=${shopDomain}&host=${host}`);
    } catch (err) {
      if (err?.name === "CookieNotFound") {
        const shop = req.query.shop;
        const sanitizedShop = shop ? shopify.utils.sanitizeShop(shop.toString()) : null;
        const host = req.query.host;

        if (sanitizedShop) {
          const params = new URLSearchParams({ shop: sanitizedShop });
          if (host) params.set("host", host.toString());

          console.warn("OAuth cookie missing. Restarting auth flow.", {
            shop: sanitizedShop,
            host: host?.toString()
          });

          return res.redirect(`/auth?${params.toString()}`);
        }
      }

      console.error("Auth callback error:", err);
      return res.status(500).send("Shopify auth failed");
    }
  });

  return shopify;
}
