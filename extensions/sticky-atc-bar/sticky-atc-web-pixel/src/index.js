import { register } from "@shopify/web-pixels-extension";

register(({ analytics }) => {
  analytics.subscribe("checkout_completed", async (event) => {
    try {
      const checkout = event.data.checkout;
      const attrs = checkout.attributes || {};

      if (attrs.bdm_sticky_atc !== "1") return;

      await fetch("https://sticky-add-to-cart-bar-pro.onrender.com/api/analytics/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: checkout.shop?.domain,
          checkoutToken: checkout.token,
          productId: attrs.bdm_sticky_product,
          variantId: attrs.bdm_sticky_variant,
          occurredAt: new Date().toISOString()
        })
      });
    } catch (e) {
      // fail silently — required for pixels
    }
  });
});
