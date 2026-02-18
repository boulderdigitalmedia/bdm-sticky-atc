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

// Extract sticky marker from order
function getStickyMarkerFromOrder(order) {
  const na = order?.note_attributes;

  // OS2 format (array)
  if (Array.isArray(na)) {
    const match = na.find(a => a?.name === "bdm_sticky_atc");
    if (match?.value) return match.value;
  }

  // Admin "Additional details" object format (WHAT YOU HAVE NOW)
  if (na && typeof na === "object") {
    if (na.bdm_sticky_atc) return na.bdm_sticky_atc;
  }

  // Legacy attribute fallback
  if (order?.attributes?.bdm_sticky_atc) {
    return order.attributes.bdm_sticky_atc;
  }

  return null;
}


/* ────────────────────────────────────────────── */
/* ORDERS_PAID WEBHOOK */
/* ────────────────────────────────────────────── */

export async function ordersCreate(req, res) {
  console.log("🔥 WEBHOOK HIT", {
    topic: req.get("X-Shopify-Topic"),
    shopHeader: req.get("X-Shopify-Shop-Domain"),
    receivedAt: new Date().toISOString(),
  });

  try {
    if (!verifyShopifyHmac(req).ok) {
      console.log("❌ HMAC FAILED");
      return res.status(401).send("Invalid webhook");
    }

    const order = parseWebhookBody(req);

    console.log("🧾 ORDER RECEIVED", {
      id: order?.id,
      total_price: order?.total_price,
      currency: order?.currency,
      attributes: order?.attributes,
      note_attributes: order?.note_attributes,
    });

    if (!order?.id) {
      console.log("⚠️ Order missing ID");
      return res.sendStatus(200);
    }

    const shop =
      req.get("X-Shopify-Shop-Domain") ||
      order.shop_domain;

    const orderId = order.id.toString();

    const existing = await prisma.stickyConversion.findFirst({
      where: { shop, orderId },
    });

    if (existing) {
      console.log("⚠️ Conversion already exists", orderId);
      return res.sendStatus(200);
    }

    /* 1️⃣ Token-based attribution */
    const attributionToken =
      order.checkout_token || order.cart_token;

    if (attributionToken) {
      console.log("🔑 CHECKOUT TOKEN FOUND", attributionToken);

      const attribution = await prisma.stickyAttribution.findUnique({
        where: { checkoutToken: attributionToken },
      });

      if (attribution) {
        console.log("🎯 TOKEN MATCH FOUND");

        console.log("💾 INSERTING stickyConversion (token)", {
          shop,
          orderId,
          revenue: order.total_price,
        });

        await prisma.stickyConversion.create({
          data: {
            id: generateId(),
            shop,
            orderId,
            revenue: Number(order.total_price),
            currency: order.currency,
            occurredAt: new Date(order.processed_at || order.created_at),
          },
        });

        console.log("✅ stickyConversion INSERTED (token)", orderId);

        await prisma.analyticsEvent.create({
          data: {
            shop,
            event: "add_to_cart",
            payload: { source: "bdm_sticky_atc", method: "token_match", orderId },
          },
        });

        console.log("📊 analyticsEvent INSERTED (token)");
        return res.sendStatus(200);
      }
    }

    /* 2️⃣ Cart attribute attribution */
    const stickyRaw = getStickyMarkerFromOrder(order);
    console.log("🔍 STICKY MARKER RAW", stickyRaw);

    if (stickyRaw) {
      let sticky = null;
      try {
        sticky = JSON.parse(stickyRaw);
      } catch (e) {
        console.log("❌ FAILED TO PARSE STICKY JSON", e);
      }

      if (sticky?.source === "bdm_sticky_atc") {
        console.log("🎯 CART ATTRIBUTE MATCH");

        console.log("💾 INSERTING stickyConversion (cart attr)", {
          shop,
          orderId,
          revenue: order.total_price,
        });

        await prisma.stickyConversion.create({
          data: {
            id: generateId(),
            shop,
            orderId,
            revenue: Number(order.total_price),
            currency: order.currency,
            occurredAt: new Date(order.processed_at || order.created_at),
          },
        });

        console.log("✅ stickyConversion INSERTED (cart attr)", orderId);

        await prisma.analyticsEvent.create({
          data: {
            shop,
            event: "add_to_cart",
            payload: sticky,
          },
        });

        console.log("📊 analyticsEvent INSERTED (cart attr)");
        return res.sendStatus(200);
      }
    }

    /* 3️⃣ Fallback attribution */
    const recentAtc = await prisma.stickyEvent.findFirst({
      where: {
        shop,
        event: "add_to_cart",
        timestamp: {
          gte: new Date(Date.now() - 1000 * 60 * 60 * 24),
        },
      },
      orderBy: { timestamp: "desc" },
    });

    if (recentAtc) {
      console.log("🎯 FALLBACK MATCH FOUND");

      await prisma.stickyConversion.create({
        data: {
          id: generateId(),
          shop,
          orderId,
          revenue: Number(order.total_price),
          currency: order.currency,
          occurredAt: new Date(order.processed_at || order.created_at),
        },
      });

      await prisma.analyticsEvent.create({
        data: {
          shop,
          event: "add_to_cart",
          payload: { source: "bdm_sticky_atc", method: "fallback", orderId },
        },
      });

      console.log("✅ stickyConversion + analyticsEvent INSERTED (fallback)");
      return res.sendStatus(200);
    }

    console.log("⚠️ NO ATTRIBUTION MATCH FOUND", orderId);
    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ Order webhook error:", err);
    return res.sendStatus(500);
  }
}
