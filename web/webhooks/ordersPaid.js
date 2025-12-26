import prisma from "../prisma.js";

/**
 * Shopify orders/paid webhook
 */
export async function ordersPaidHandler(shop, order) {
  if (!order || !order.checkout_token) return;

  const checkoutToken = order.checkout_token;

  // 1️⃣ Find attribution
  const attribution = await prisma.stickyAttribution.findUnique({
    where: { checkoutToken },
  });

  if (!attribution) {
    console.log("No Sticky ATC attribution found");
    return;
  }

  const revenue = parseFloat(order.total_price || 0);
  const currency = order.currency || "USD";

  // 2️⃣ Store conversion
  await prisma.stickyConversion.create({
    data: {
      shop,
      orderId: String(order.id),
      revenue,
      currency,
      occurredAt: new Date(order.processed_at),
    },
  });

  // 3️⃣ Update daily metrics
  const date = new Date();
  date.setHours(0, 0, 0, 0);

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

  console.log("✅ Sticky ATC conversion recorded");
}
