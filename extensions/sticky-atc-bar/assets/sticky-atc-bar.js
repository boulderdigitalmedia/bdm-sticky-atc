/**
 * Sticky Add to Cart Bar – Final Attribution + Analytics
 * Boulder Digital Media
 */

/* -----------------------------------------------------
   CONFIG
----------------------------------------------------- */
const TRACK_ENDPOINT =
  "https://sticky-add-to-cart-bar-pro.onrender.com/apps/bdm-sticky-atc/track";

/* -----------------------------------------------------
   HELPERS
----------------------------------------------------- */

/**
 * Safely get the active product form
 */
function getProductForm() {
  return document.querySelector('form[action*="/cart/add"]');
}

/**
 * Get active variant, quantity, and price (CORRECT SOURCE)
 */
function getActiveVariantData() {
  const form = getProductForm();
  if (!form) return {};

  const variantInput = form.querySelector('input[name="id"]');
  const qtyInput = form.querySelector('input[name="quantity"]');

  const variantId = variantInput ? variantInput.value : null;
  const quantity = Number(qtyInput?.value || 1);

  let price = null;

  // Match variant price from ShopifyAnalytics (fallback-safe)
  if (
    window.ShopifyAnalytics?.meta?.product?.variants &&
    variantId
  ) {
    const variant = window.ShopifyAnalytics.meta.product.variants.find(
      (v) => String(v.id) === String(variantId)
    );
    if (variant?.price) {
      price = variant.price / 100;
    }
  }

  return { variantId, quantity, price };
}

/**
 * Persist attribution for checkout → orders/paid webhook
 */
function persistStickyAttribution(variantId) {
  try {
    localStorage.setItem("bdm_sticky_atc_variant", variantId);
    localStorage.setItem("bdm_sticky_atc_time", Date.now());
  } catch (e) {
    // Silent fail (Safari private mode etc.)
  }
}

/**
 * Fire analytics event
 */
function trackEvent(payload) {
  fetch(TRACK_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

/* -----------------------------------------------------
   CORE TRACKING
----------------------------------------------------- */

/**
 * Track Add to Cart from Sticky Bar
 */
function trackAddToCart() {
  const { variantId, quantity, price } = getActiveVariantData();

  if (!variantId || !window.Shopify?.shop) return;

  trackEvent({
    event: "add_to_cart",
    shop: Shopify.shop,
    variantId,
    quantity,
    price,
    timestamp: Date.now(),
  });

  persistStickyAttribution(variantId);
}

/**
 * Track Page View
 */
function trackPageView() {
  if (!window.Shopify?.shop) return;

  trackEvent({
    event: "page_view",
    shop: Shopify.shop,
    timestamp: Date.now(),
  });
}

/* -----------------------------------------------------
   INIT
----------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  trackPageView();

  // Attach to Sticky ATC button (supports dynamic themes)
  document.body.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-bdm-sticky-atc-button]");
    if (!btn) return;

    trackAddToCart();
  });
});
