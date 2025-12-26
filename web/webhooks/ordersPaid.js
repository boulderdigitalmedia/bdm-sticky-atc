// web/webhooks/ordersPaid.js

import prisma from "../prisma.js";

/**
 * Shopify Orders Paid Webhook
 * Attributes conversions + revenue to Sticky ATC
 */
export async function ordersPaidHandler(shop, order) {
  try {
    if (!shop || !order?.id) {
      console.warn("Missing shop or order id");
      return;
    }

    const orderId = String(order.id);
    const checkoutToken = order.checkout_token;

    if (!checkoutToken) {
      console.log("Order has no checkout token — skipping attribution");
      return;
    }

    // ──────────────────────────────────────────────
    // 1️⃣ Prevent duplicate processing
    // ──────────────────────────────────────────────
    const alreadyProcessed = await prisma.stickyConversion.findFirst({
      where: { orderId },
    });

    if (alreadyProcessed) {
      console.log(`Order ${orderId} already processed`);
      return;
    }

    // ──────────────────────────────────────────────
    // 2️⃣ Look for Sticky ATC attribution
    // ──────────────────────────────────────────────
    const attribution = await prisma.stickyAttribution.findUnique({
      where: { checkoutToken },
    });

    if (!attribution) {
      console.log(`No Sticky ATC attribution for order ${orderId}`);
      return;
    }

    // ──────────────────────────────────────────────
    // 3️⃣ Calculate revenue
    // ──────────────────────────────────────────────
    const revenue = Number(order.total_price || 0);
    const currency = order.currency || "USD";
    const occurredAt = new Date(order.processed_at || Date.now());

    // ──────────────────────────────────────────────
    // 4️⃣ Save conversion
    // ──────────────────────────────────────────────
    await prisma.stickyConversion.create({
      data: {
        shop,
        orderId,
        revenue,
        currency,
        occurredAt,
      },
    });

    // ──────────────────────────────────────────────
    // 5️⃣ Update daily metrics
    // ──────────────────────────────────────────────
    const date = new Date(occurredAt);
    date.setUTCHours(0, 0, 0, 0);

    await prisma.stickyMetricsDaily.upsert({
      where: {
        shop_date: {
          shop,
          date,
        },
      },
      update: {
        conversions: { increment: 1 },
        revenue: { increment: revenue },
      },
      create: {
        shop,
        date,
        conversions: 1,
        revenue,
      },
    });

    console.log(
      `✅ Sticky ATC conversion attributed — Order ${orderId}, $${revenue}`
    );
  } catch (err) {
    console.error("❌ Orders Paid webhook error:", err);
    throw err;
  }
}
