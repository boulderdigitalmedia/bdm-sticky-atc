import crypto from "crypto";
import prisma from "../prisma.js";

const generateId = () =>
  crypto.randomUUID
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString("hex");

export async function ordersCreate(req, res) {
  try {
    const order = req.body;
    const checkoutToken = order.checkout_token;
    const cartToken = order.cart_token;
    const attributionToken = checkoutToken || cartToken;

    if (!attributionToken) return res.sendStatus(200);

    const attribution = await prisma.stickyAttribution.findUnique({
      where: { checkoutToken: attributionToken }
    });

    if (!attribution) return res.sendStatus(200);

    // Prevent double conversions
    const existing = await prisma.stickyConversion.findFirst({
      where: { orderId: order.id.toString() }
    });

    if (existing) return res.sendStatus(200);

    await prisma.stickyConversion.create({
      data: {
        id: generateId(),
        shop: attribution.shop,
        orderId: order.id.toString(),
        revenue: parseFloat(order.total_price),
        currency: order.currency,
        occurredAt: new Date(order.created_at)
      }
    });

    res.sendStatus(200);
  } catch (err) {
    console.error("Order webhook error:", err);
    res.sendStatus(500);
  }
}
