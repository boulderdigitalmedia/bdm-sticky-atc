// Sticky Add to Cart Bar — FINAL (Variant Selector Enabled)

(function () {
  if (window.__BDM_STICKY_ATC__) return;
  window.__BDM_STICKY_ATC__ = true;

  const PRODUCT = window.ShopifyAnalytics?.meta?.product;
  if (!PRODUCT || !PRODUCT.variants) return;

  let activeVariantId = null;

  function getQuantity() {
    const qty =
      document.querySelector('form[action*="/cart"] [name="quantity"]') ||
      document.querySelector('input[name="quantity"]');
    return qty ? parseInt(qty.value, 10) || 1 : 1;
  }

  function addToCart(variantId, quantity) {
    return fetch("/cart/add.js", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ id: variantId, quantity }),
    }).then((r) => r.json());
  }

  function track(event, data = {}) {
    fetch(
      "https://sticky-add-to-cart-bar-pro.onrender.com/apps/bdm-sticky-atc/track",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: Shopify.shop,
          event,
          ...data,
        }),
      }
    ).catch(() => {});
  }

  function buildVariantSelect() {
    const select = document.createElement("select");
    select.style.cssText = `
      width: 100%;
      margin-bottom: 8px;
      padding: 10px;
      font-size: 14px;
    `;

    PRODUCT.variants.forEach((variant) => {
      const option = document.createElement("option");
      option.value = variant.id;
      option.textContent = `${variant.public_title || variant.title} — ${
        Shopify.currency.active
      } ${(variant.price / 100).toFixed(2)}`;
      select.appendChild(option);
    });

    select.addEventListener("change", () => {
      activeVariantId = select.value;

      track("variant_change", {
        variantId: activeVariantId,
        price:
          PRODUCT.variants.find((v) => String(v.id) === String(activeVariantId))
            ?.price / 100,
      });

      // Sync main product form
      const mainVariantInput =
        document.querySelector('form[action*="/cart"] [name="id"]') ||
        document.querySelector('input[name="id"]');

      if (mainVariantInput) {
        mainVariantInput.value = activeVariantId;
        mainVariantInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    return select;
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

    const variantSelect = buildVariantSelect();

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
      const quantity = getQuantity();
      if (!activeVariantId) return;

      const variant = PRODUCT.variants.find(
        (v) => String(v.id) === String(activeVariantId)
      );

      await addToCart(activeVariantId, quantity);

      track("add_to_cart", {
        productId: PRODUCT.id,
        variantId: activeVariantId,
        quantity,
        price: variant.price / 100,
      });
    });

    bar.appendChild(variantSelect);
    bar.appendChild(button);
    document.body.appendChild(bar);

    return bar;
  }

  function init() {
    const bar = createStickyBar();

    // Default variant
    const defaultVariant =
      document.querySelector('form[action*="/cart"] [name="id"]')?.value ||
      PRODUCT.variants[0].id;

    activeVariantId = defaultVariant;
    bar.querySelector("select").value = defaultVariant;

    // Track page view
    track("page_view", {
      productId: PRODUCT.id,
      variantId: activeVariantId,
    });

    window.addEventListener("scroll", () => {
      bar.style.display = window.scrollY > 300 ? "block" : "none";
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
