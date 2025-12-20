import prisma from "../prisma/client.js";

/**
 * Called when Shopify sends orders/paid webhook.
 * This is where we FINALIZE conversions (real revenue).
 *
 * We treat an order as "attributed" if checkout token exists in StickyAttribution.
 */
export async function ordersPaidHandler(shop, payload) {
  try {
    if (!shop || !payload) return;

    const orderId = String(payload.id);
    const currency = payload.currency || payload.presentment_currency || "USD";

    // Total price can be string from Shopify
    const revenue = Number(payload.current_total_price || payload.total_price || 0);

    // Checkout token (key to attribution)
    const checkoutToken = payload.checkout_token || payload.token || null;
    if (!checkoutToken) return;

    // Does this order have sticky attribution?
    const attribution = await prisma.stickyAttribution.findUnique({
      where: { checkoutToken: String(checkoutToken) },
    });

    if (!attribution) {
      // not attributed, ignore
      return;
    }

    // Prevent duplicates
    const existing = await prisma.stickyConversion.findFirst({
      where: { shop: String(shop), orderId },
    });
    if (existing) return;

    await prisma.stickyConversion.create({
      data: {
        shop: String(shop),
        orderId,
        revenue,
        currency,
        occurredAt: new Date(payload.processed_at || payload.created_at || Date.now()),
      },
    });
  } catch (err) {
    console.error("ordersPaidHandler error:", err);
  }
}
