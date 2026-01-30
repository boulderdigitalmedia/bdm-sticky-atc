import crypto from "crypto";
import prisma from "../prisma.js";

/* ────────────────────────────────────────────── */
/* HELPERS */
/* ────────────────────────────────────────────── */

const generateId = () =>
  crypto.randomUUID
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString("hex");

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

/* ────────────────────────────────────────────── */
/* SHOPIFY HMAC VERIFICATION */
/* ────────────────────────────────────────────── */

function verifyShopifyHmac(req) {
  const hmacHeader =
    req.get("X-Shopify-Hmac-Sha256") ||
    req.get("x-shopify-hmac-sha256");

  if (!hmacHeader || !Buffer.isBuffer(req.body)) {
    return { ok: false };
  }

  const secret = requiredEnv("SHOPIFY_API_SECRET");

  const digest = crypto
    .createHmac("sha256", secret)
    .update(req.body)
    .digest("base64");

  return timingSafeEqual(digest, hmacHeader)
    ? { ok: true }
    : { ok: false };
}

function parseWebhookBody(req) {
  return JSON.parse(req.body.toString("utf8"));
}

/* ────────────────────────────────────────────── */
/* ORDERS_PAID WEBHOOK */
/* ────────────────────────────────────────────── */

export async function ordersCreate(req, res) {
  console.log("🔥 ORDERS_PAID WEBHOOK RECEIVED (RAW ROUTE)", {
    receivedAt: new Date().toISOString(),
  });

  try {
    if (!verifyShopifyHmac(req).ok) {
      return res.status(401).send("Invalid webhook");
    }

    const order = parseWebhookBody(req);
    if (!order?.id) return res.sendStatus(200);

    const shop =
      req.get("X-Shopify-Shop-Domain") ||
      order.shop_domain;

    const orderId = order.id.toString();

    /* Prevent double counting */
    const existing = await prisma.stickyConversion.findFirst({
      where: { shop, orderId },
    });
    if (existing) return res.sendStatus(200);

    /* 1️⃣ Token-based attribution (keep this) */
    const attributionToken =
      order.checkout_token || order.cart_token;

    if (attributionToken) {
      const attribution = await prisma.stickyAttribution.findUnique({
        where: { checkoutToken: attributionToken },
      });

      if (attribution) {
        await prisma.stickyConversion.create({
          data: {
            id: generateId(),
            shop,
            orderId,
            revenue: Number(order.total_price),
            currency: order.currency,
            occurredAt: new Date(order.processed_at),
          },
        });

        console.log("✅ Revenue attributed via token match", orderId);
        return res.sendStatus(200);
      }
    }

    /* 2️⃣ FALLBACK — real-world ATC attribution */
    const recentAtc = await prisma.stickyEvent.findFirst({
      where: {
        shop,
        event: "add_to_cart",
        timestamp: {
          gte: new Date(Date.now() - 1000 * 60 * 60 * 24), // 24h window
        },
      },
      orderBy: { timestamp: "desc" },
    });

    if (recentAtc) {
      await prisma.stickyConversion.create({
        data: {
          id: generateId(),
          shop,
          orderId,
          revenue: Number(order.total_price),
          currency: order.currency,
          occurredAt: new Date(order.processed_at),
        },
      });

      console.log("✅ Revenue attributed via add_to_cart fallback", orderId);
      return res.sendStatus(200);
    }

    console.log("⚠️ No attribution match found", orderId);
    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ Order webhook error:", err);
    return res.sendStatus(500);
  }
}
