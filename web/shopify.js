import "@shopify/shopify-api/adapters/node";
import { shopifyApi, LATEST_API_VERSION, DeliveryMethod } from "@shopify/shopify-api";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-01";
import { prismaSessionStorage } from "./shopifySessionStoragePrisma.js";
import prisma from "./prisma.js";

/* ────────────────────────────────────────────── */
/* ENV HELPERS */
/* ────────────────────────────────────────────── */

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

/* ────────────────────────────────────────────── */
/* WEBHOOK HANDLER: ORDERS_PAID */
/* ────────────────────────────────────────────── */

async function ordersPaidWebhook(topic, shop, body) {
  const order = JSON.parse(body);
  const orderId = BigInt(order.id);

  // Prevent double-counting
  const existing = await prisma.stickyConversion.findUnique({
    where: {
      shop_orderId: {
        shop,
        orderId
      }
    }
  });
  if (existing) return;

  const checkoutToken = order.checkout_token;
  if (!checkoutToken) return;

  const variantIds = order.line_items.map((li) =>
    BigInt(li.variant_id)
  );

  // Find Sticky ATC intent within attribution window
  const events = await prisma.stickyAtcEvent.findMany({
    where: {
      shop,
      checkoutToken,
      variantId: { in: variantIds },
      createdAt: {
        gte: new Date(Date.now() - 1000 * 60 * 60 * 24) // 24h window
      }
    }
  });

  if (!events.length) return;

  await prisma.stickyConversion.create({
    data: {
      shop,
      orderId,
      checkoutToken,
      revenue: Number(order.total_price),
      currency: order.currency,
      occurredAt: new Date(order.processed_at)
    }
  });

  console.log("Sticky ATC influenced revenue recorded", {
    shop,
    orderId: order.id,
    revenue: order.total_price
  });
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
    .map((s) => s.trim())
    .filter(Boolean);

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
  /* AUTH CALLBACK */
/* ────────────────────────────────────────────── */

  app.get("/auth/callback", async (req, res) => {
    try {
      // Use session returned by callback
      const { session } = await shopify.auth.callback({
        rawRequest: req,
        rawResponse: res
      });

      if (!session?.accessToken) {
        console.error("OAuth completed without session");
        return res.status(500).send("OAuth failed");
      }

      // Register webhooks using this session
      const registerResult = await shopify.webhooks.register({ session });

      const failures = Object.entries(registerResult).flatMap(
        ([topic, results]) =>
          results.filter((r) => !r.success).map((r) => ({ topic, ...r }))
      );

      if (failures.length) {
        console.error("Webhook registration failures", failures);
      } else {
        console.log("Webhooks registered successfully", registerResult);
      }

      // Redirect back into embedded app
      const host = req.query.host;
      if (!host) {
        return res.redirect(
          `https://${session.shop}/admin/apps/${apiKey}`
        );
      }

      return res.redirect(`/?shop=${session.shop}&host=${host}`);
    } catch (err) {
      console.error("OAuth callback error", err);
      return res.status(500).send("Shopify auth failed");
    }
  });

  return shopify;
}
