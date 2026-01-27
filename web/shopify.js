import "@shopify/shopify-api/adapters/node";
import crypto from "crypto";
import { shopifyApi, LATEST_API_VERSION, DeliveryMethod } from "@shopify/shopify-api";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-01";
import { prismaSessionStorage } from "./shopifySessionStoragePrisma.js";

/* ────────────────────────────────────────────── */
/* ENV HELPERS */
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

    console.log("ORDERS_PAID webhook received", {
      shop,
      orderId: order.id,
      orderNumber: order.order_number,
      totalPrice: order.total_price,
      currency: order.currency,
      webhookId
    });

    // Line items (used later for attribution)
    for (const item of order.line_items || []) {
      console.log("Order line item", {
        variantId: item.variant_id,
        productId: item.product_id,
        quantity: item.quantity,
        price: item.price
      });
    }

    /**
     * TODO (next step for you):
     * - Match variant_id to Sticky ATC click events
     * - Attribute influenced revenue
     * - Persist analytics in DB
     */

  } catch (err) {
    console.error("ORDERS_PAID webhook processing failed", err);
    throw err;
  }
}

/* ────────────────────────────────────────────── */
/* SHOPIFY INIT */
/* ────────────────────────────────────────────── */

export function initShopify(app) {
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
    sessionStorage: prismaSessionStorage()
  });

  if (appUrl.protocol !== "https:") {
    console.warn(
      "SHOPIFY_APP_URL should use https for webhook registration:",
      appUrl.toString()
    );
  }

  /* ────────────────────────────────────────────── */
  /* WEBHOOK REGISTRATION */
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
    if (redirectUrl) return res.redirect(redirectUrl);
    return res.sendStatus(200);
  });

  /* ────────────────────────────────────────────── */
  /* AUTH CALLBACK */
  /* ────────────────────────────────────────────── */

  app.get("/auth/callback", async (req, res) => {
    try {
      const session = await shopify.auth.callback({
        rawRequest: req,
        rawResponse: res
      });

      if (!session?.accessToken) {
        console.error("OAuth completed without access token", {
          shop: session?.shop
        });
      }

      // Register webhooks AFTER OAuth
      if (session?.accessToken) {
        try {
          const registerResult = await shopify.webhooks.register({ session });

          const failures = Object.entries(registerResult).flatMap(
            ([topic, results]) =>
              results
                .filter((r) => !r.success)
                .map((r) => ({ topic, ...r }))
          );

          if (failures.length) {
            console.error("Webhook registration failures:", failures);
          } else {
            console.log("Webhooks registered successfully", registerResult);
          }
        } catch (err) {
          console.error("Webhook registration error", err);
        }
      }

      const host = req.query.host;
      const shop = session.shop;

      if (!host) {
        return res.redirect(`https://${shop}/admin/apps/${apiKey}`);
      }

      return res.redirect(`/?shop=${shop}&host=${host}`);
    } catch (err) {
      if (err?.name === "CookieNotFound") {
        const shop = req.query.shop;
        const sanitizedShop = shop
          ? shopify.utils.sanitizeShop(shop.toString())
          : null;

        if (sanitizedShop) {
          const params = new URLSearchParams({ shop: sanitizedShop });
          if (req.query.host) params.set("host", req.query.host.toString());
          return res.redirect(`/auth?${params.toString()}`);
        }
      }

      console.error("Auth callback failed", err);
      return res.status(500).send("Shopify auth failed");
    }
  });

  return shopify;
}
