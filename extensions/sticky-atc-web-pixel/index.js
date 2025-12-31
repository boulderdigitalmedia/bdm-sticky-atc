import { register } from "@shopify/web-pixels-extension";

register(({ analytics, browser }) => {
  analytics.subscribe("product_added_to_cart", (event) => {
    browser.sendBeacon(
      "https://YOUR-RENDER-URL.onrender.com/pixel/atc",
      JSON.stringify({
        shop: event.context.shop.domain,
        productId: event.data?.cartLine?.merchandise?.product?.id,
        variantId: event.data?.cartLine?.merchandise?.id,
        quantity: event.data?.cartLine?.quantity,
        price: event.data?.cartLine?.cost?.totalAmount?.amount,
        currency: event.data?.cartLine?.cost?.totalAmount?.currencyCode,
      })
    );
  });
});
