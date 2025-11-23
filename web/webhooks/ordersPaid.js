import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export default async function ordersPaid(topic, shop, body) {
  const payload = JSON.parse(body);

  const token = payload.checkout_id || payload.checkout?.token;
  if (!token) return;

  // Find attribution record
  const attribution = await prisma.stickyAttribution.findFirst({
    where: { checkoutToken: token }
  });

  if (!attribution) return;

  // Save conversion
  await prisma.stickyConversion.create({
    data: {
      shop,
      orderId: payload.id,
      productId: attribution.productId,
      variantId: attribution.variantId,
      revenue: payload.total_price,
      timestamp: Date.now()
    }
  });

  return true;
}
