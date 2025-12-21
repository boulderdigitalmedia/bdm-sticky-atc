import { register } from "@shopify/web-pixels-extension";

register((api) => {
  api.analytics.subscribe("checkout_completed", (event) => {
    fetch("https://sticky-add-to-cart-bar-pro.onrender.com/apps/bdm-sticky-atc/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "checkout_completed",
        shop: event.context.shop?.domain,
        orderId: event.data?.checkout?.order?.id,
        revenue: event.data?.checkout?.totalPrice?.amount,
        currency: event.data?.checkout?.totalPrice?.currencyCode,
        timestamp: Date.now(),
      }),
    });
  });
});
