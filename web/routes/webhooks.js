import crypto from "crypto";
import prisma from "../prisma.js";

/* ────────────────────────────────────────────── */
/* HELPERS */
/* ────────────────────────────────────────────── */

function getStickyMarkerFromOrder(order) {
  const na = order?.note_attributes;

  if (Array.isArray(na)) {
    const match = na.find(a => a?.name === "bdm_sticky_atc");
    if (match?.value) return match.value;
  }

  if (na && typeof na === "object") {
    if (na.bdm_sticky_atc) return na.bdm_sticky_atc;
  }

  const ca = order?.cart_attributes;

  if (Array.isArray(ca)) {
    const match = ca.find(a => a?.name === "bdm_sticky_atc");
    if (match?.value) return match.value;
  }

  if (ca && typeof ca === "object") {
    if (ca.bdm_sticky_atc) return ca.bdm_sticky_atc;
  }

  if (order?.attributes?.bdm_sticky_atc) {
    return order.attributes.bdm_sticky_atc;
  }

  return null;
}

/* ────────────────────────────────────────────── */
/* ORDERS_PAID WEBHOOK */
/* ────────────────────────────────────────────── */

export async function ordersPaid(topic, shop, body) {

  let order = body;

  try {
    if (Buffer.isBuffer(body)) {
      order = JSON.parse(body.toString("utf8"));
    } else if (typeof body === "string") {
      order = JSON.parse(body);
    }
  } catch (e) {
    console.error("❌ Failed to parse webhook body:", e);
    return;
  }

  console.log("🔥 WEBHOOK HIT", {
    topic,
    shop,
    receivedAt: new Date().toISOString(),
  });

  console.log("ORDER BODY:", order);

  try {
    if (!order?.id) {
      console.log("⚠️ Order missing ID");
      return;
    }

    const orderId = order.id.toString();

    console.log("🧾 ORDER RECEIVED", {
      id: order.id,
      total_price: order.total_price,
      currency: order.currency,
      note_attributes: order.note_attributes,
    });

    const existing = await prisma.stickyConversion.findFirst({
      where: { shop, orderId },
    });

    if (existing) {
      console.log("⚠️ Conversion already exists", orderId);
      return;
    }

    const checkoutToken =
      order.checkout_token ||
      order.cart_token ||
      crypto.randomUUID();

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

        await prisma.stickyConversion.create({
          data: {
            id: crypto.randomUUID(),
            shop,
            orderId,
            checkoutToken,
            revenue: Number(order.total_price),
            currency: order.currency,
            occurredAt: new Date(order.processed_at || order.created_at),
          },
        });

        console.log("✅ stickyConversion INSERTED", orderId);

        await prisma.analyticsEvent.create({
          data: {
            shop,
            event: "add_to_cart",
            payload: sticky,
          },
        });

        console.log("📊 analyticsEvent INSERTED");

        return;
      }
    }

    /* 3️⃣ Fallback attribution */

    const recentAtc = await prisma.analyticsEvent.findFirst({
      where: {
        shop,
        event: "add_to_cart",
        createdAt: {
          gte: new Date(Date.now() - 1000 * 60 * 60 * 24),
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (recentAtc) {

      console.log("🎯 FALLBACK MATCH FOUND");

      await prisma.stickyConversion.create({
        data: {
          id: crypto.randomUUID(),
          shop,
          orderId,
          checkoutToken,
          revenue: Number(order.total_price),
          currency: order.currency,
          occurredAt: new Date(order.processed_at || order.created_at),
        },
      });

      await prisma.analyticsEvent.create({
        data: {
          shop,
          event: "add_to_cart",
          payload: {
            source: "bdm_sticky_atc",
            method: "fallback",
            orderId,
          },
        },
      });

      console.log("✅ stickyConversion + analyticsEvent INSERTED");

      return;
    }

    console.log("⚠️ NO ATTRIBUTION MATCH FOUND", orderId);

  } catch (err) {
    console.error("❌ Order webhook error:", err);
  }
}