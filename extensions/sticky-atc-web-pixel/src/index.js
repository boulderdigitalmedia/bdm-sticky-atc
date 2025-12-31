export default function register({ analytics, browser }) {
  const endpointBase = "https://sticky-add-to-cart-bar-pro.onrender.com";

  // ADD TO CART
  analytics.subscribe("product_added_to_cart", (event) => {
    try {
      const line = event.data?.cartLine;
      if (!line) return;

      fetch(`${endpointBase}/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: browser?.location?.host,
          event: "add_to_cart",
          productId: line.merchandise?.product?.id,
          variantId: line.merchandise?.id,
          quantity: line.quantity,
          price: line.cost?.totalAmount?.amount
            ? Number(line.cost.totalAmount.amount)
            : null,
        }),
      }).catch(() => {});
    } catch (_) {}
  });

  // CHECKOUT COMPLETED
  analytics.subscribe("checkout_completed", (event) => {
    try {
      fetch(`${endpointBase}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: browser?.location?.host,
          checkoutToken: event.data?.checkout?.token,
          occurredAt: new Date().toISOString(),
        }),
      }).catch(() => {});
    } catch (_) {}
  });
}
