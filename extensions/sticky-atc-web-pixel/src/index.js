import { register } from "@shopify/web-pixels-extension";

register(({ analytics, browser }) => {
  analytics.subscribe("checkout_completed", async (event) => {
    try {
      const checkout = event.data.checkout;

      const shop = event.context?.document?.location?.hostname;
      const checkoutToken = checkout?.token;

      // Custom attributes (cart attributes carried into checkout)
      const attrs = checkout?.attributes || {};
      const stickyFlag = attrs?.bdm_sticky_atc;

      if (!stickyFlag || !checkoutToken) return;

      const productId = attrs?.bdm_sticky_product || null;
      const variantId = attrs?.bdm_sticky_variant || null;

      await fetch("https://sticky-add-to-cart-bar-pro.onrender.com/api/analytics/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop,
          checkoutToken,
          productId,
          variantId,
          occurredAt: new Date().toISOString()
        })
      });
    } catch (e) {
      // Pixel should fail silently
    }
  });
});
