import "@shopify/shopify-api/adapters/node";
import {
  shopifyApi,
  LATEST_API_VERSION,
  DeliveryMethod,
} from "@shopify/shopify-api";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-01";
import { prismaSessionStorage } from "./shopifySessionStoragePrisma.js";
import prisma from "./prisma.js";

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export let shopify;

/* =========================================================
   💳 BILLING HELPER (ADDED)
========================================================= */
export async function ensureBilling(session) {
  try {
    const client = new shopify.clients.Graphql({ session });

    const RETURN_URL =
      `${process.env.SHOPIFY_APP_URL}/?shop=${session.shop}`;

    const mutation = `
      mutation AppSubscriptionCreate($name: String!, $returnUrl: URL!, $trialDays: Int!) {
        appSubscriptionCreate(
          name: $name
          returnUrl: $returnUrl
          trialDays: $trialDays
          test: true
          lineItems: [
            {
              plan: {
                appRecurringPricingDetails: {
                  price: { amount: 7.99, currencyCode: USD }
                }
              }
            }
          ]
        ) {
          confirmationUrl
          userErrors { field message }
        }
      }
    `;

    const response = await client.query({
      data: {
        query: mutation,
        variables: {
          name: "Sticky Add To Cart Bar Pro",
          returnUrl: RETURN_URL,
          trialDays: 7,
        },
      },
    });

    return response.body.data.appSubscriptionCreate.confirmationUrl || null;
  } catch (e) {
    console.error("❌ Billing creation failed:", e);
    return null;
  }
}

export function initShopify(app) {
  const apiKey = requiredEnv("SHOPIFY_API_KEY");
  const apiSecretKey = requiredEnv("SHOPIFY_API_SECRET");

  const appBaseUrl = requiredEnv("SHOPIFY_APP_URL").replace(/\/+$/, "");
  const appUrl = new URL(appBaseUrl);

  const scopes = requiredEnv("SCOPES")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  shopify = shopifyApi({
    apiKey,
    apiSecretKey,
    scopes,
    hostName: appUrl.host,
    hostScheme: "https",
    apiVersion: LATEST_API_VERSION,
    isEmbeddedApp: true,
    restResources,
    sessionStorage: prismaSessionStorage(),
    cookies: {
      secure: true,
      sameSite: "none",
    },
  });

  shopify.webhooks.addHandlers({
    ORDERS_PAID: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks/orders/paid",
    },
    APP_UNINSTALLED: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks/app/uninstalled",
    },
  });

  /* =========================================================
     AUTH START
  ========================================================= */
  app.get("/auth", async (req, res) => {
    try {
      const shopParam = req.query.shop;
      if (!shopParam) return res.status(400).send("Missing shop");

      const shop = shopify.utils.sanitizeShop(String(shopParam));
      if (!shop) return res.status(400).send("Invalid shop");

      if (!req.query.embedded) {
        const redirectUrl = `/auth?shop=${encodeURIComponent(
          shop
        )}&embedded=1`;

        return res.send(`
          <html>
            <body>
              <script>
                if (window.top === window.self) {
                  window.location.href = "${redirectUrl}";
                } else {
                  window.top.location.href = "${redirectUrl}";
                }
              </script>
            </body>
          </html>
        `);
      }

      await shopify.auth.begin({
        shop,
        callbackPath: "/auth/callback",
        isOnline: false,
        rawRequest: req,
        rawResponse: res,
      });
    } catch (err) {
      console.error("❌ OAuth begin failed:", err);
      res.status(500).send("Auth start failed");
    }
  });

  /* =========================================================
     AUTH CALLBACK + BILLING
  ========================================================= */
  app.get("/auth/callback", async (req, res) => {
    try {
      const { session } = await shopify.auth.callback({
        rawRequest: req,
        rawResponse: res,
      });

      if (!session?.accessToken) throw new Error("Missing access token");

      console.log("🔑 OAuth session received:", session.shop);

      await shopify.config.sessionStorage.storeSession(session);
      console.log("💾 Session stored:", session.id);

      await shopify.webhooks.register({ session });

      // 💳 BILLING REDIRECT
      const confirmationUrl = await ensureBilling(session);
      if (confirmationUrl) {
        console.log("💳 Redirecting to billing approval");
        return res.redirect(confirmationUrl);
      }

      const host = req.query.host ? String(req.query.host) : null;

      const redirectUrl =
        `/?shop=${encodeURIComponent(session.shop)}` +
        (host ? `&host=${encodeURIComponent(host)}` : "") +
        `&embedded=1`;

      return res.redirect(redirectUrl);
    } catch (err) {
      console.error("❌ OAuth callback failed", err);
      return res.status(500).send("Auth failed");
    }
  });

  return shopify;
}
