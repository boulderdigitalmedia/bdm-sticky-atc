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
/* ORDERS_PAID WEBHOOK HANDLER */
/* ────────────────────────────────────────────── */

export async function ordersCreate(req, res) {
  console.log("🔥 ORDERS_PAID WEBHOOK RECEIVED (RAW ROUTE)", {
    receivedAt: new Date().toISOString(),
  });

  try {
    /* 1️⃣ Verify HMAC */
    if (!verifyShopifyHmac(req).ok) {
      console.warn("⚠️ Invalid Shopify webhook signature");
      return res.status(401).send("Invalid webhook");
    }

    /* 2️⃣ Parse payload */
    const order = parseWebhookBody(req);
    if (!order?.id) return res.sendStatus(200);

    const shop =
      req.get("X-Shopify-Shop-Domain") ||
      order.shop_domain;

    const orderId = order.id.toString();

    /* 3️⃣ Prevent double counting */
    const existing = await prisma.stickyConversion.findFirst({
      where: {
        shop,
        orderId,
      },
    });

    if (existing) {
      console.log("ℹ️ Conversion already recorded", orderId);
      return res.sendStatus(200);
    }

    const checkoutToken = order.checkout_token;
    const cartToken = order.cart_token;
    const attributionToken = checkoutToken || cartToken;

    /* 4️⃣ PRIMARY: token-based attribution */
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
            occurredAt: order.processed_at
              ? new Date(order.processed_at)
              : new Date(),
          },
        });

        console.log("✅ Revenue attributed via token match", {
          orderId,
          shop,
        });

        return res.sendStatus(200);
      }
    }

    /* 5️⃣ FALLBACK: recent Sticky ATC intent */
    const variantIds = order.line_items
      .map((li) => li.variant_id)
      .filter(Boolean)
      .map(String);

    const recentIntent = await prisma.stickyEvent.findFirst({
      where: {
        shop,
        event: "sticky_atc_success",
        variantId: { in: variantIds },
        timestamp: {
          gte: new Date(Date.now() - 1000 * 60 * 60 * 24), // 24h window
        },
      },
    });

    if (recentIntent) {
      await prisma.stickyConversion.create({
        data: {
          id: generateId(),
          shop,
          orderId,
          revenue: Number(order.total_price),
          currency: order.currency,
          occurredAt: order.processed_at
            ? new Date(order.processed_at)
            : new Date(),
        },
      });

      console.log("✅ Revenue attributed via fallback intent", {
        orderId,
        shop,
      });

      return res.sendStatus(200);
    }

    /* 6️⃣ No attribution */
    console.log("⚠️ No attribution match found", {
      orderId,
      shop,
    });

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ Order webhook error:", err);
    return res.sendStatus(500);
  }
}
