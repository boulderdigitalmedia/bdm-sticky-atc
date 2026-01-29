import crypto from "crypto";
import prisma from "../prisma.js";

const generateId = () =>
  crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function timingSafeEqual(a, b) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function verifyShopifyHmac(req) {
  const hmacHeader =
    req.get("X-Shopify-Hmac-Sha256") || req.get("x-shopify-hmac-sha256");

  if (!hmacHeader) {
    return { ok: false, reason: "Missing HMAC header" };
  }

  if (!Buffer.isBuffer(req.body)) {
    return { ok: false, reason: "Body is not raw Buffer" };
  }

  const secret = requiredEnv("SHOPIFY_API_SECRET");

  const digest = crypto
    .createHmac("sha256", secret)
    .update(req.body)
    .digest("base64");

  const valid = timingSafeEqual(digest, hmacHeader);
  return valid ? { ok: true } : { ok: false, reason: "HMAC mismatch" };
}

function parseWebhookBody(req) {
  return JSON.parse(req.body.toString("utf8"));
}

export async function ordersCreate(req, res) {
  console.log("🔥 ORDERS_PAID WEBHOOK RECEIVED (RAW ROUTE)", {
    receivedAt: new Date().toISOString(),
  });

  try {
    // 1️⃣ Verify HMAC
    const hmacCheck = verifyShopifyHmac(req);
    if (!hmacCheck.ok) {
      console.warn("Webhook rejected:", hmacCheck.reason);
      return res.status(401).send("Invalid webhook");
    }

    // 2️⃣ Parse payload
    const order = parseWebhookBody(req);
    if (!order?.id) return res.sendStatus(200);

    const shop =
      req.get("X-Shopify-Shop-Domain") ||
      order.shop_domain;

    const checkoutToken = order.checkout_token;
    const cartToken = order.cart_token;
    const attributionToken = checkoutToken || cartToken;

    if (!attributionToken) {
      console.log("ℹ️ Order has no attribution token", order.id);
      return res.sendStatus(200);
    }

    // 3️⃣ Find attribution
    const attribution = await prisma.stickyAttribution.findUnique({
      where: { checkoutToken: attributionToken },
    });

    if (!attribution) {
      console.log("⚠️ No StickyAttribution found", {
        attributionToken,
        orderId: order.id,
      });
      return res.sendStatus(200);
    }

    // 4️⃣ Prevent double counting
    const existing = await prisma.stickyConversion.findUnique({
      where: {
        shop_orderId: {
          shop: attribution.shop,
          orderId: order.id.toString(),
        },
      },
    });

    if (existing) {
      console.log("ℹ️ Duplicate order ignored", order.id);
      return res.sendStatus(200);
    }

    // 5️⃣ Write conversion
    await prisma.stickyConversion.create({
      data: {
        id: generateId(),
        shop: attribution.shop,
        orderId: order.id.toString(),
        revenue: Number(order.total_price),
        currency: order.currency,
        occurredAt: order.processed_at
          ? new Date(order.processed_at)
          : new Date(),
      },
    });

    console.log("✅ Sticky ATC influenced revenue recorded", {
      shop: attribution.shop,
      orderId: order.id,
      revenue: order.total_price,
    });

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ Order webhook error:", err);
    return res.sendStatus(500);
  }
}
