import {
  reactExtension,
  useApi,
} from "@shopify/ui-extensions-react/checkout";

export default reactExtension(
  "purchase.thank-you.block.render",
  () => <StickyATCTracker />
);

function StickyATCTracker() {
  const { order, attributes, shop } = useApi();

  // Only fire if Sticky ATC was used
  if (!attributes?.sticky_atc_clicked) return null;

  fetch("https://sticky-add-to-cart-bar-pro.onrender.com/api/analytics/conversion", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      shop: shop.myshopifyDomain,
      orderId: order.id,
      revenue: order.totalPrice.amount,
      currency: order.totalPrice.currencyCode,
      occurredAt: new Date().toISOString(),
    }),
  });

  return null; // invisible
}
