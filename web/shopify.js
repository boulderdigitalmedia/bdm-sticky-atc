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
   💳 BILLING HELPERS
========================================================= */
async function hasActiveSubscription(session) {
  const client = new shopify.clients.Graphql({ session });

  const result = await client.request(`
    query {
      currentAppInstallation {
        activeSubscriptions {
          id
          status
        }
      }
    }
  `);

  const subs =
    result?.data?.currentAppInstallation?.activeSubscriptions || [];

  return subs.length > 0;
}

async function createSubscription(session, returnUrl) {
  const client = new shopify.clients.Graphql({ session });

  // NOTE:
  // - Keep test: true for dev stores
  // - For production, set SHOPIFY_BILLING_TEST=false and use: test: false
  const testMode = (process.env.SHOPIFY_BILLING_TEST || "true") === "true";

  const mutation = `
    mutation AppSubscriptionCreate($name: String!, $returnUrl: URL!, $trialDays: Int!, $test: Boolean!) {
      appSubscriptionCreate(
        name: $name
        returnUrl: $returnUrl
        trialDays: $trialDays
        test: $test
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

  const result = await client.request(mutation, {
    variables: {
      name: "Sticky Add To Cart Bar Pro",
      returnUrl,
      trialDays: 7,
      test: testMode,
    },
  });

  const payload = result?.data?.appSubscriptionCreate;
  const errors = payload?.userErrors || [];

  if (errors.length) {
    console.error("❌ Billing userErrors:", errors);
    return null;
  }

  return payload?.confirmationUrl || null;
}

function topRedirectHtml(url) {
  return `
    <html>
      <body>
        <script>
          if (window.top === window.self) {
            window.location.href = "${url}";
          } else {
            window.top.location.href = "${url}";
          }
        </script>
      </body>
    </html>
  `;
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
    apiVersion: "2024-01",
    isEmbeddedApp: true,
    restResources,
    sessionStorage: prismaSessionStorage(),
    cookies: {
      secure: true,
      sameSite: "none",
    },
  });

  shopify.webhooks.addHandlers({
  ORDERS_UPDATED: {
  deliveryMethod: DeliveryMethod.Http,
  callbackUrl: "https://sticky-add-to-cart-bar-pro.onrender.com/apps/bdm-sticky-atc/webhooks/orders/updated",
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

      // Escape iframe BEFORE OAuth
      if (!req.query.embedded) {
        const redirectUrl = `/auth?shop=${encodeURIComponent(shop)}&embedded=1`;
        return res.send(topRedirectHtml(redirectUrl));
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
     AUTH CALLBACK
     - store session
     - register webhooks
     - then go to billing subscribe endpoint (NO LOOPS)
  ========================================================= */
  app.get("/auth/callback", async (req, res) => {
    try {
      const { session } = await shopify.auth.callback({
        rawRequest: req,
        rawResponse: res,
      });

      if (!session?.accessToken) throw new Error("Missing access token");

      console.log("🔑 OAuth session received:", session.shop);

      // Force store session (you already proved this helps)
      await shopify.config.sessionStorage.storeSession(session);
      console.log("💾 Session stored:", session.id);

      try {
  const response = await shopify.webhooks.register({ session });

  console.log("📡 WEBHOOK REGISTER RESULT", response);
} catch (e) {
  console.error("⚠️ Webhook register failed:", e);
}

      const host = req.query.host ? String(req.query.host) : null;

      // IMPORTANT: send them to billing subscribe (NOT to / directly)
      // so the first page-load after auth doesn’t loop.
      const billingUrl =
        `/billing/subscribe?shop=${encodeURIComponent(session.shop)}` +
        (host ? `&host=${encodeURIComponent(host)}` : "") +
        `&embedded=1`;

      return res.redirect(billingUrl);
    } catch (err) {
      console.error("❌ OAuth callback failed", err);
      return res.status(500).send("Auth failed");
    }
  });

  /* =========================================================
     💳 BILLING SUBSCRIBE (NEW)
     - uses OFFLINE session
     - if already active -> redirect into app
     - if not -> create subscription and redirect to confirmationUrl
  ========================================================= */
  app.get("/billing/subscribe", async (req, res) => {
    try {
      const shopParam = req.query.shop;
      if (!shopParam) return res.status(400).send("Missing shop");

      const shop = shopify.utils.sanitizeShop(String(shopParam));
      if (!shop) return res.status(400).send("Invalid shop");

      const host = req.query.host ? String(req.query.host) : null;

      // Load offline session from your storage
      const sessions = await shopify.config.sessionStorage.findSessionsByShop(
        shop
      );
      const session = Array.isArray(sessions)
        ? sessions.find((s) => !s.isOnline)
        : null;

      if (!session) {
        // No session yet -> go auth
        return res.redirect(`/auth?shop=${encodeURIComponent(shop)}`);
      }

      // If subscription exists, go to app
      const active = await hasActiveSubscription(session);
      if (active) {
        const redirectUrl =
          `/?shop=${encodeURIComponent(shop)}` +
          (host ? `&host=${encodeURIComponent(host)}` : "") +
          `&embedded=1`;
        return res.redirect(redirectUrl);
      }

      // Create subscription and send merchant to approve
      const returnUrl =
        `${process.env.SHOPIFY_APP_URL}/?shop=${encodeURIComponent(shop)}` +
        (host ? `&host=${encodeURIComponent(host)}` : "") +
        `&embedded=1`;

      const confirmationUrl = await createSubscription(session, returnUrl);
      if (!confirmationUrl) {
        return res.status(500).send("Could not start billing");
      }

      // confirmationUrl needs top-level redirect (embedded app)
      return res.send(topRedirectHtml(confirmationUrl));
    } catch (e) {
      console.error("❌ /billing/subscribe failed:", e);
      return res.status(500).send("Billing failed");
    }
  });

  return shopify;
}
