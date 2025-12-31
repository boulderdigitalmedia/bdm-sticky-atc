import prisma from "../prisma.js";

export async function ordersPaidHandler(shop, payload) {
  if (!shop || !payload?.id) return;

  const orderId = String(payload.id);
  const currency = payload.currency;
  const occurredAt = new Date(payload.processed_at);

  const revenue =
    typeof payload.total_price === "string"
      ? parseFloat(payload.total_price)
      : payload.total_price;

  // 1️⃣ Write conversion record
  await prisma.stickyConversion.create({
    data: {
      shop,
      orderId,
      revenue,
      currency,
      occurredAt,
    },
  });

  // 2️⃣ Optional: write per-product events
  for (const item of payload.line_items || []) {
    await prisma.stickyEvent.create({
      data: {
        shop,
        event: "purchase",
        productId: item.product_id ? String(item.product_id) : null,
        variantId: item.variant_id ? String(item.variant_id) : null,
        quantity: item.quantity,
        price: item.price ? Number(item.price) : null,
        timestamp: occurredAt,
      },
    });
  }
}
