// Sticky Add to Cart Bar — FINAL VERSION
// Correctly tracks variants, price, and quantity

(function () {
  if (window.__BDM_STICKY_ATC_LOADED__) return;
  window.__BDM_STICKY_ATC_LOADED__ = true;

  function getVariantId() {
    const variantInput =
      document.querySelector('form[action*="/cart"] [name="id"]') ||
      document.querySelector('input[name="id"]');

    return variantInput ? variantInput.value : null;
  }

  function getQuantity() {
    const qtyInput =
      document.querySelector('form[action*="/cart"] [name="quantity"]') ||
      document.querySelector('input[name="quantity"]');

    return qtyInput ? parseInt(qtyInput.value, 10) || 1 : 1;
  }

  function getPriceFromVariant(variantId) {
    if (!window.ShopifyAnalytics?.meta?.product?.variants) return null;

    const variant = window.ShopifyAnalytics.meta.product.variants.find(
      (v) => String(v.id) === String(variantId)
    );

    return variant ? variant.price / 100 : null;
  }

  function addToCart(variantId, quantity) {
    return fetch("/cart/add.js", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        id: variantId,
        quantity,
      }),
    }).then((r) => r.json());
  }

  function trackEvent(event, data = {}) {
    fetch(
      "https://sticky-add-to-cart-bar-pro.onrender.com/apps/bdm-sticky-atc/track",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shop: Shopify.shop,
          event,
          ...data,
        }),
      }
    ).catch(() => {});
  }

  function createStickyBar() {
    const bar = document.createElement("div");
    bar.id = "bdm-sticky-atc";
    bar.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #fff;
      border-top: 1px solid #eee;
      padding: 12px;
      z-index: 9999;
      display: none;
    `;

    const button = document.createElement("button");
    button.textContent = "Add to cart";
    button.style.cssText = `
      width: 100%;
      padding: 14px;
      font-size: 16px;
      background: black;
      color: white;
      border: none;
      cursor: pointer;
    `;

    button.addEventListener("click", async () => {
      const variantId = getVariantId();
      const quantity = getQuantity();

      if (!variantId) {
        alert("Please select a variant");
        return;
      }

      const price = getPriceFromVariant(variantId);

      await addToCart(variantId, quantity);

      trackEvent("add_to_cart", {
        variantId,
        quantity,
        price,
      });
    });

    bar.appendChild(button);
    document.body.appendChild(bar);

    return bar;
  }

  function observeScroll(bar) {
    let lastScroll = window.scrollY;

    window.addEventListener("scroll", () => {
      const current = window.scrollY;
      const show = current > 300;
      bar.style.display = show ? "block" : "none";
      lastScroll = current;
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const bar = createStickyBar();
    observeScroll(bar);

    // Track variant changes
    document.addEventListener("change", (e) => {
      if (e.target.name === "id") {
        trackEvent("variant_change", {
          variantId: e.target.value,
        });
      }
    });
  });
})();
