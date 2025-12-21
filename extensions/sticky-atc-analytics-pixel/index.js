import { register } from "@shopify/web-pixels-extension";

register(({ analytics, browser }) => {
  analytics.subscribe("checkout_completed", (event) => {
    const checkout = event.data.checkout;

    fetch("https://sticky-add-to-cart-bar-pro.onrender.com/api/analytics/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shop: browser?.shop?.domain,
        checkoutToken: checkout?.token,
        totalPrice: checkout?.totalPrice?.amount,
        currency: checkout?.currencyCode,
      }),
    });
  });
});
