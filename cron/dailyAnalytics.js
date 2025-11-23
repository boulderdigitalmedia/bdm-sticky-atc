import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function runDailyAggregation() {
  try {
    // Yesterday
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    // Find all events from yesterday
    const events = await prisma.stickyEvent.findMany({
      where: {
        timestamp: {
          gte: start,
          lte: end
        }
      }
    });

    // Group by shop
    const shops = [...new Set(events.map((e) => e.shop))];

    for (const shop of shops) {
      const shopEvents = events.filter((e) => e.shop === shop);

      const pageViews = shopEvents.filter((e) => e.event === "page_view").length;
      const addToCart = shopEvents.filter((e) => e.event === "add_to_cart").length;

      const revenue = shopEvents
        .filter((e) => e.event === "add_to_cart" && e.price)
        .reduce((sum, e) => sum + e.price * (e.quantity || 1), 0);

      await prisma.stickyMetricsDaily.create({
        data: {
          shop,
          date: start,
          pageViews,
          addToCart,
          conversions: addToCart, // You can update later if you want actual conversions
          revenue
        }
      });
    }

    console.log("Daily analytics aggregation complete.");
  } catch (err) {
    console.error("Daily analytics aggregation failed:", err);
  }
}
