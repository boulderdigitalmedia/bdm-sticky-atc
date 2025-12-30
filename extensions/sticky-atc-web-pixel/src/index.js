import { register } from "@shopify/web-pixels-extension";

register(({ analytics, browser }) => {
  const send = async (event, payload) => {
    try {
      await fetch(
        "https://sticky-add-to-cart-bar-pro.onrender.com/api/events",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event,
            ...payload,
            userAgent: browser.userAgent,
          }),
        }
      );
    } catch {
      // never throw inside a pixel
    }
  };

  analytics.subscribe("page_viewed", ({ context, data }) => {
    send("page_view", {
      shop: context.shop.domain,
      url: context.document.location.href,
      productId: data?.product?.id ?? null,
      variantId: data?.variant?.id ?? null,
    });
  });

  analytics.subscribe("product_added_to_cart", ({ context, data }) => {
    send("add_to_cart", {
      shop: context.shop.domain,
      productId: data?.merchandise?.product?.id ?? null,
      variantId: data?.merchandise?.id ?? null,
      quantity: data?.quantity ?? 1,
      price: data?.merchandise?.price?.amount ?? null,
      currency: data?.merchandise?.price?.currencyCode ?? null,
    });
  });

  analytics.subscribe("checkout_started", ({ context, data }) => {
    send("checkout_started", {
      shop: context.shop.domain,
      checkoutToken: data?.checkout?.token ?? null,
    });
  });
});
