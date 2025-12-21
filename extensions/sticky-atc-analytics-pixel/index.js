// extensions/sticky-atc-analytics-pixel/index.js

shopify.extend("WebPixel::Render", (api) => {
  const { analytics, browser } = api;

  analytics.subscribe("page_viewed", (event) => {
    send("page_view", {
      url: event.context.document.location.href,
    });
  });

  analytics.subscribe("product_added_to_cart", (event) => {
    send("add_to_cart", {
      productId: event.data?.cartLine?.merchandise?.product?.id,
      variantId: event.data?.cartLine?.merchandise?.id,
      quantity: event.data?.cartLine?.quantity,
      price:
        event.data?.cartLine?.cost?.totalAmount?.amount
          ? Number(event.data.cartLine.cost.totalAmount.amount)
          : null,
      currency:
        event.data?.cartLine?.cost?.totalAmount?.currencyCode || "USD",
    });
  });

  analytics.subscribe("checkout_completed", (event) => {
    send("checkout_completed", {
      orderId: event.data?.checkout?.order?.id,
      revenue: Number(
        event.data?.checkout?.totalPrice?.amount || 0
      ),
      currency:
        event.data?.checkout?.totalPrice?.currencyCode || "USD",
    });
  });

  function send(event, payload) {
    fetch("https://sticky-add-to-cart-bar-pro.onrender.com/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        shop: api.context.shop.domain,
        timestamp: Date.now(),
        ...payload,
      }),
    }).catch(() => {});
  }
});
