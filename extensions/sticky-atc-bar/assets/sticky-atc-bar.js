(() => {
  const TRACK_ENDPOINT = "/apps/bdm-sticky-atc/track";

  let currentVariantId = null;
  let currentSellingPlanId = null;
  let quantity = 1;
  let productJson = null;

  /* ────────────────────────────────────────────── */
  /* PRODUCT JSON */
  /* ────────────────────────────────────────────── */

  function loadProductJson() {
    if (productJson) return productJson;

    const script =
      document.querySelector('script[type="application/json"][data-product-json]') ||
      document.querySelector("#ProductJson");

    if (!script) return null;

    try {
      productJson = JSON.parse(script.textContent);
      return productJson;
    } catch {
      return null;
    }
  }

  /* ────────────────────────────────────────────── */
  /* VARIANT + SELLING PLAN STATE */
  /* ────────────────────────────────────────────── */

  function getVariantId() {
    if (window.ShopifyAnalytics?.meta?.selectedVariantId) {
      return Number(window.ShopifyAnalytics.meta.selectedVariantId);
    }

    if (window.meta?.product?.selectedVariantId) {
      return Number(window.meta.product.selectedVariantId);
    }

    const legacy = document.querySelector('form[action*="/cart/add"] [name="id"]');
    return legacy ? Number(legacy.value) : null;
  }

  function getSellingPlanId() {
    const input =
      document.querySelector('[name="selling_plan"]:checked') ||
      document.querySelector('[name="selling_plan_id"]:checked') ||
      document.querySelector('[name="selling_plan"]');

    return input?.value || null;
  }

  function syncState() {
    currentVariantId = getVariantId();
    currentSellingPlanId = getSellingPlanId();
  }

  /* ────────────────────────────────────────────── */
  /* PRICE RESOLUTION */
  /* ────────────────────────────────────────────── */

  function resolvePriceCents(variantId, sellingPlanId) {
    const product = loadProductJson();
    if (!product) return null;

    const variant = product.variants.find(v => v.id === variantId);
    if (!variant) return null;

    let price = variant.price;

    if (sellingPlanId && product.selling_plan_groups) {
      for (const group of product.selling_plan_groups) {
        for (const plan of group.selling_plans) {
          if (String(plan.id) === String(sellingPlanId)) {
            const adj = plan.price_adjustments?.[0];
            if (!adj) continue;

            if (adj.value_type === "percentage") {
              price = Math.round(price * (1 - adj.value / 100));
            }

            if (adj.value_type === "price") {
              price = adj.value;
            }
          }
        }
      }
    }

    return price;
  }

  /* ────────────────────────────────────────────── */
  /* EVENTS */
  /* ────────────────────────────────────────────── */

  document.addEventListener("change", e => {
    if (
      e.target.closest('[data-option-position]') ||
      e.target.name === "id" ||
      e.target.name === "selling_plan" ||
      e.target.name === "selling_plan_id"
    ) {
      setTimeout(syncState, 0);
    }
  });

  document.addEventListener("variant:change", e => {
    currentVariantId = e.detail?.variant?.id || currentVariantId;
  });

  /* ────────────────────────────────────────────── */
  /* ANALYTICS */
  /* ────────────────────────────────────────────── */

  function track(event, payload) {
    fetch(TRACK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, ...payload }),
    }).catch(() => {});
  }

  /* ────────────────────────────────────────────── */
  /* ADD TO CART */
  /* ────────────────────────────────────────────── */

  async function handleAddToCart() {
    syncState();

    if (!currentVariantId) {
      console.warn("Sticky ATC: no variant selected");
      return;
    }

    const priceCents = resolvePriceCents(
      currentVariantId,
      currentSellingPlanId
    );

    track("add_to_cart", {
      variantId: currentVariantId,
      sellingPlanId: currentSellingPlanId,
      quantity,
      price: priceCents ? priceCents / 100 : null,
    });

    const payload = {
      id: currentVariantId,
      quantity,
    };

    if (currentSellingPlanId) {
      payload.selling_plan = currentSellingPlanId;
    }

    await fetch("/cart/add.js", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });
  }

  /* ────────────────────────────────────────────── */
  /* INIT */
  /* ────────────────────────────────────────────── */

  function init() {
    syncState();

    const button = document.querySelector("[data-sticky-atc-button]");
    if (!button) return;

    button.addEventListener("click", handleAddToCart);
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init)
    : init();
})();
