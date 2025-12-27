(() => {
  const API_BASE = "https://sticky-add-to-cart-bar-pro.onrender.com/apps/bdm-sticky-atc";

  // --------------------------------------------------
  // HELPERS
  // --------------------------------------------------
  function getShop() {
    return Shopify?.shop || window.ShopifyAnalytics?.meta?.shop;
  }

  function getProductData() {
    const meta = window.ShopifyAnalytics?.meta?.product;
    if (!meta) return null;

    return {
      productId: String(meta.id),
      variantId: String(meta.selectedVariantId),
      price: meta.variants?.find(v => v.id === meta.selectedVariantId)?.price / 100
    };
  }

  function sendEvent(payload) {
    fetch(`${API_BASE}/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(() => {});
  }

  // --------------------------------------------------
  // PAGE VIEW
  // --------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    sendEvent({
      shop: getShop(),
      event: "page_view"
    });
  });

  // --------------------------------------------------
  // ADD TO CART (STICKY BUTTON)
  // --------------------------------------------------
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-sticky-atc]");
    if (!btn) return;

    const product = getProductData();
    if (!product) return;

    // Capture checkout token BEFORE redirect
    try {
      const cartRes = await fetch("/cart.js");
      const cart = await cartRes.json();

      if (cart?.token) {
        localStorage.setItem("bdm_checkout_token", cart.token);
      }
    } catch (_) {}

    sendEvent({
      shop: getShop(),
      event: "add_to_cart",
      productId: product.productId,
      variantId: product.variantId,
      quantity: 1,
      price: product.price
    });
  });

  // --------------------------------------------------
  // CHECKOUT ATTRIBUTION (FIRES ON CHECKOUT PAGE)
  // --------------------------------------------------
  if (window.location.pathname.includes("/checkouts/")) {
    const token = localStorage.getItem("bdm_checkout_token");
    if (token) {
      sendEvent({
        shop: getShop(),
        event: "checkout_started",
        checkoutToken: token
      });
    }
  }
})();
