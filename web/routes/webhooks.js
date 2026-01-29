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

  // Must be same length or timingSafeEqual throws
  if (aBuf.length !== bBuf.length) return false;

  return crypto.timingSafeEqual(aBuf, bBuf);
}

function verifyShopifyHmac(req) {
  // Shopify sends this header
  const hmacHeader =
    req.get("X-Shopify-Hmac-Sha256") || req.get("x-shopify-hmac-sha256");

  if (!hmacHeader) {
    return { ok: false, reason: "Missing X-Shopify-Hmac-Sha256 header" };
  }

  // We must have raw body (Buffer) to compute correct HMAC
  if (!Buffer.isBuffer(req.body)) {
    return {
      ok: false,
      reason:
        "req.body is not a Buffer. Ensure express.raw({ type: '*/*' }) is used BEFORE bodyParser.json().",
    };
  }

  const secret = requiredEnv("SHOPIFY_API_SECRET");

  const digest = crypto
    .createHmac("sha256", secret)
    .update(req.body)
    .digest("base64");

  const valid = timingSafeEqual(digest, hmacHeader);

  return valid ? { ok: true } : { ok: false, reason: "HMAC validation failed" };
}

function parseWebhookBody(req) {
  if (!Buffer.isBuffer(req.body)) {
    throw new Error(
      "Expected raw Buffer body. Ensure express.raw({ type: '*/*' }) is set on this route."
    );
  }

  const text = req.body.toString("utf8");
  return JSON.parse(text);
}

export async function ordersCreate(req, res) {
  console.log("🔥 ORDERS_PAID WEBHOOK RECEIVED (RAW ROUTE)", {
  receivedAt: new Date().toISOString()
});
  try {
    // ✅ 1) Verify HMAC
    const hmacCheck = verifyShopifyHmac(req);
    if (!hmacCheck.ok) {
      console.warn("⚠️ Webhook rejected:", {
        reason: hmacCheck.reason,
        shop: req.get("X-Shopify-Shop-Domain") || req.get("x-shopify-shop-domain"),
        topic: req.get("X-Shopify-Topic") || req.get("x-shopify-topic"),
      });
      return res.status(401).send("Invalid webhook signature");
    }

    // ✅ 2) Parse JSON body
    const order = parseWebhookBody(req);

    // Safety: if payload isn't an order, just ack
    if (!order?.id) return res.sendStatus(200);

    const checkoutToken = order.checkout_token;
    const cartToken = order.cart_token;
    const attributionToken = checkoutToken || cartToken;

    if (!attributionToken) return res.sendStatus(200);

    const attribution = await prisma.stickyAttribution.findUnique({
      where: { checkoutToken: attributionToken },
    });

    if (!attribution) return res.sendStatus(200);

    // Prevent double conversions
    const existing = await prisma.stickyConversion.findFirst({
      where: { orderId: order.id.toString() },
    });

    if (existing) return res.sendStatus(200);

    await prisma.stickyConversion.create({
      data: {
        id: generateId(),
        shop: attribution.shop,
        orderId: order.id.toString(),
        revenue: parseFloat(order.total_price),
        currency: order.currency,
        occurredAt: order.created_at ? new Date(order.created_at) : new Date(),
      },
    });

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ Order webhook error:", err);

    // 500 makes Shopify retry (can be useful while debugging)
    return res.sendStatus(500);
  }
}
