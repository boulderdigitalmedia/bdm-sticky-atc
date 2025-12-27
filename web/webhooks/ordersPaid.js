import prisma from "../prisma/client.js";

export async function ordersPaidHandler(shop, payload) {
  if (!payload?.checkout_token) return;

  const checkoutToken = payload.checkout_token;

  // Find attribution
  const attribution = await prisma.stickyAttribution.findUnique({
    where: { checkoutToken },
  });

  if (!attribution) return;

  const revenue = Number(payload.total_price || 0);

  // Record conversion
  await prisma.stickyConversion.create({
    data: {
      shop,
      orderId: String(payload.id),
      revenue,
      currency: payload.currency,
      occurredAt: new Date(payload.created_at),
    },
  });

  // Update daily metrics
  const date = new Date();
  date.setHours(0, 0, 0, 0);

  await prisma.stickyMetricsDaily.upsert({
    where: {
      shop_date: { shop, date },
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
}
