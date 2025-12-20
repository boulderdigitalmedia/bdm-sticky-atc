import prisma from "../web/prisma/client.js";

async function run() {
  // yesterday in UTC
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

  // Get all shops with events yesterday
  const shops = await prisma.stickyEvent.findMany({
    where: { timestamp: { gte: start, lt: end } },
    select: { shop: true },
    distinct: ["shop"]
  });

  for (const s of shops) {
    const shop = s.shop;

    const [pageViews, addToCart, conversionsAgg, conversionsCount] = await Promise.all([
      prisma.stickyEvent.count({ where: { shop, event: "page_view", timestamp: { gte: start, lt: end } } }),
      prisma.stickyEvent.count({ where: { shop, event: "add_to_cart", timestamp: { gte: start, lt: end } } }),
      prisma.stickyConversion.aggregate({ where: { shop, occurredAt: { gte: start, lt: end } }, _sum: { revenue: true } }),
      prisma.stickyConversion.count({ where: { shop, occurredAt: { gte: start, lt: end } } })
    ]);

    await prisma.stickyMetricsDaily.upsert({
      where: {
        // You don't have a unique compound key, so use id-less upsert workaround:
        // We'll find then update/create below.
        id: "__dummy__"
      },
      update: {},
      create: {}
    }).catch(() => {});

    // manual upsert
    const existing = await prisma.stickyMetricsDaily.findFirst({
      where: { shop, date: start }
    });

    if (existing) {
      await prisma.stickyMetricsDaily.update({
        where: { id: existing.id },
        data: {
          pageViews,
          addToCart,
          conversions: conversionsCount,
          revenue: conversionsAgg._sum.revenue || 0
        }
      });
    } else {
      await prisma.stickyMetricsDaily.create({
        data: {
          shop,
          date: start,
          pageViews,
          addToCart,
          conversions: conversionsCount,
          revenue: conversionsAgg._sum.revenue || 0
        }
      });
    }
  }

  console.log("✅ Daily analytics rollup complete", { start, end });
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
