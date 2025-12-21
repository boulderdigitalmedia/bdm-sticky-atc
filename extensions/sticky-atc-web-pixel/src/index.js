import { register } from "@shopify/web-pixels-extension";

register((analytics) => {
  analytics.subscribe("page_viewed", (event) => {
    fetch("https://sticky-add-to-cart-bar-pro.onrender.com/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shop: event.context.shop?.domain,
        event: "page_view",
        timestamp: Date.now(),
      }),
    });
  });

  analytics.subscribe("checkout_completed", (event) => {
    fetch("https://sticky-add-to-cart-bar-pro.onrender.com/api/analytics/conversion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shop: event.context.shop?.domain,
        orderId: event.data.checkout.order.id,
        revenue: event.data.checkout.totalPrice.amount,
        currency: event.data.checkout.totalPrice.currencyCode,
      }),
    });
  });
});
