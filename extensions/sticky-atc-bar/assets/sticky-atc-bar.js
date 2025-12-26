/**
 * Sticky Add To Cart – Conversion Attribution
 * Runs on the storefront
 * Safe to fail (never blocks checkout)
 */

(function () {
  if (!window.Shopify || !window.fetch) return;

  const API_BASE =
    "https://sticky-add-to-cart-bar-pro.onrender.com/apps/bdm-sticky-atc";

  /**
   * Send checkout attribution to backend
   */
  async function sendAttribution({ productId, variantId }) {
    try {
      const cartRes = await fetch("/cart.js", { credentials: "same-origin" });
      const cart = await cartRes.json();

      if (!cart || !cart.token) return;

      await fetch(`${API_BASE}/attribution`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shop: Shopify.shop,
          checkoutToken: cart.token,
          productId: String(productId),
          variantId: String(variantId),
        }),
      });
    } catch (err) {
      console.warn("Sticky ATC attribution failed", err);
    }
  }

  /**
   * Track Add To Cart events
   */
  async function trackAddToCart({ productId, variantId, quantity, price }) {
    try {
      await fetch(`${API_BASE}/track`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shop: Shopify.shop,
          event: "add_to_cart",
          productId: String(productId),
          variantId: String(variantId),
          quantity,
          price,
        }),
      });
    } catch (err) {
      console.warn("Sticky ATC tracking failed", err);
    }
  }

  /**
   * Hook into checkout buttons
   */
  function bindCheckoutTracking() {
    const checkoutSelectors = [
      'button[name="checkout"]',
      'input[name="checkout"]',
      'a[href="/checkout"]',
      'form[action="/checkout"]',
    ];

    checkoutSelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        if (el.dataset.stickyBound) return;
        el.dataset.stickyBound = "true";

        el.addEventListener("click", async () => {
          const variantInput =
            document.querySelector('input[name="id"]') ||
            document.querySelector('[data-variant-id]');

          const productInput =
            document.querySelector('[data-product-id]');

          const variantId =
            variantInput?.value || variantInput?.dataset?.variantId;

          const productId =
            productInput?.dataset?.productId ||
            window.meta?.product?.id;

          if (!variantId || !productId) return;

          await sendAttribution({ productId, variantId });
        });
      });
    });
  }

  /**
   * Hook into Add To Cart forms
   */
  function bindAddToCartTracking() {
    document.querySelectorAll('form[action^="/cart/add"]').forEach((form) => {
      if (form.dataset.stickyBound) return;
      form.dataset.stickyBound = "true";

      form.addEventListener("submit", async () => {
        const variantId = form.querySelector('[name="id"]')?.value;
        const quantity =
          parseInt(form.querySelector('[name="quantity"]')?.value, 10) || 1;

        if (!variantId) return;

        const price =
          window.meta?.product?.variants?.find(
            (v) => String(v.id) === String(variantId)
          )?.price || null;

        const productId = window.meta?.product?.id;

        await trackAddToCart({
          productId,
          variantId,
          quantity,
          price,
        });
      });
    });
  }

  /**
   * Init
   */
  function init() {
    bindAddToCartTracking();
    bindCheckoutTracking();
  }

  // Run immediately + after theme loads
  init();
  document.addEventListener("shopify:section:load", init);
})();
