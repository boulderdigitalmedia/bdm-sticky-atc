export async function ordersPaidHandler(shop, body) {
  const order = JSON.parse(body);

  const usedSticky =
    order.note_attributes?.some(
      (a) => a.name === "sticky_atc_clicked" && a.value === "true"
    ) ||
    order.note_attributes?.some(
      (a) => a.name === "sticky_atc_checkout"
    );

  if (!usedSticky) return;

  await fetch(
    "https://sticky-add-to-cart-bar-pro.onrender.com/apps/bdm-sticky-atc/track",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "purchase_attributed",
        shop,
        order_id: order.id,
        revenue: Number(order.total_price),
        currency: order.currency,
        timestamp: Date.now(),
      }),
    }
  );
}
