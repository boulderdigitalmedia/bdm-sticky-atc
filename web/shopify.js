import "@shopify/shopify-api/adapters/node";
import { shopifyApi, LATEST_API_VERSION, DeliveryMethod } from "@shopify/shopify-api";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-01";
import { prismaSessionStorage } from "./shopifySessionStoragePrisma.js";

/* ────────────────────────────────────────────── */
/* ENV */
/* ────────────────────────────────────────────── */

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

/* ────────────────────────────────────────────── */
/* WEBHOOK HANDLER */
/* ────────────────────────────────────────────── */

async function ordersPaidWebhook(topic, shop, body, webhookId) {
  try {
    const order = JSON.parse(body);

    console.log("ORDERS_PAID received", {
      shop,
      orderId: order.id,
      orderNumber: order.order_number,
      totalPrice: order.total_price,
      currency: order.currency
    });

    for (const item of order.line_items || []) {
      console.log("Line item", {
        variantId: item.variant_id,
        productId: item.product_id,
        quantity: item.quantity,
        price: item.price
      });
    }

    // TODO: revenue attribution logic
  } catch (err) {
    console.error("ORDERS_PAID handler failed", err);
    throw err;
  }
}

/* ────────────────────────────────────────────── */
/* INIT SHOPIFY */
/* ────────────────────────────────────────────── */

export function initShopify(app) {
  const apiKey = requiredEnv("SHOPIFY_API_KEY");
  const apiSecretKey = requiredEnv("SHOPIFY_API_SECRET");
  const appUrl = new URL(requiredEnv("SHOPIFY_APP_URL"));
  const scopes = requiredEnv("SCOPES")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  // 🔑 IMPORTANT: create session storage ONCE and keep reference
  const sessionStorage = prismaSessionStorage();

  const shopify = shopifyApi({
    apiKey,
    apiSecretKey,
    scopes,
    hostName: appUrl.host,
    hostScheme: appUrl.protocol.replace(":", ""),
    apiVersion: LATEST_API_VERSION,
    isEmbeddedApp: true,
    restResources,
    sessionStorage
  });

  /* ────────────────────────────────────────────── */
  /* WEBHOOKS */
  /* ────────────────────────────────────────────── */

  shopify.webhooks.addHandlers({
    ORDERS_PAID: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks/orders/paid",
      callback: ordersPaidWebhook
    }
  });

  /* ────────────────────────────────────────────── */
  /* AUTH START */
  /* ────────────────────────────────────────────── */

  app.get("/auth", async (req, res) => {
    const shop = req.query.shop;
    if (!shop) return res.status(400).send("Missing shop");

    const sanitizedShop = shopify.utils.sanitizeShop(shop.toString());
    if (!sanitizedShop) return res.status(400).send("Invalid shop");

    // Shopify controls the response lifecycle here
    await shopify.auth.begin({
      shop: sanitizedShop,
      callbackPath: "/auth/callback",
      isOnline: false,
      rawRequest: req,
      rawResponse: res
    });
  });

  /* ────────────────────────────────────────────── */
  /* AUTH CALLBACK (FIXED) */
  /* ────────────────────────────────────────────── */

  app.get("/auth/callback", async (req, res) => {
    try {
      // 1. Complete OAuth
      await shopify.auth.callback({
        rawRequest: req,
        rawResponse: res
      });

      const shop = shopify.utils.sanitizeShop(req.query.shop);
      if (!shop) throw new Error("Invalid shop in callback");

      // 2. Load OFFLINE session via OUR sessionStorage reference
      const offlineSessionId = shopify.session.getOfflineId(shop);
      const session = await sessionStorage.loadSession(offlineSessionId);

      if (!session?.accessToken) {
        console.error("Offline session missing after OAuth", { shop });
        return res.status(500).send("OAuth session missing");
      }

      // 3. Register webhooks
      const registerResult = await shopify.webhooks.register({ session });

      const failures = Object.entries(registerResult).flatMap(([topic, results]) =>
        results.filter(r => !r.success).map(r => ({ topic, ...r }))
      );

      if (failures.length) {
        console.error("Webhook registration failures", failures);
      } else {
        console.log("Webhooks registered successfully", registerResult);
      }

      // 4. Redirect back to embedded app
      const host = req.query.host;
      if (!host) {
        return res.redirect(`https://${shop}/admin/apps/${apiKey}`);
      }

      return res.redirect(`/?shop=${shop}&host=${host}`);
    } catch (err) {
      console.error("OAuth callback error", err);
      return res.status(500).send("Shopify auth failed");
    }
  });

  return shopify;
}
