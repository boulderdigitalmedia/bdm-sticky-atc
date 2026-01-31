(() => {
  const BAR_ID = "bdm-sticky-atc";
  const TRACK_ENDPOINT = "/apps/bdm-sticky-atc/track";

  let product = null;
  let selectedVariantId = null;
  let selectedSellingPlanId = null;

  /* ────────────────────────────────────────────── */
  /* HELPERS */
  /* ────────────────────────────────────────────── */

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function formatMoney(cents) {
    if (typeof cents !== "number") return "";
    return `$${(cents / 100).toFixed(2)}`;
  }

  function getProductHandle() {
    const m = window.location.pathname.match(/\/products\/([^\/]+)/);
    return m?.[1] || null;
  }

  async function loadProductJson() {
    const embedded =
      document.querySelector('script[type="application/json"][data-product-json]') ||
      document.querySelector('script[type="application/json"][id^="ProductJson"]') ||
      document.querySelector("#ProductJson");

    if (embedded) {
      try {
        return JSON.parse(embedded.textContent);
      } catch (_) {}
    }

    const handle = getProductHandle();
    if (!handle) return null;

    try {
      const res = await fetch(`/products/${handle}.js`);
      if (!res.ok) return null;
      return await res.json();
    } catch (_) {
      return null;
    }
  }

  /* ────────────────────────────────────────────── */
  /* 🔥 ANALYTICS TRACKING (FIXED) */
  /* ────────────────────────────────────────────── */

  function track(event, payload = {}) {
    try {
      fetch(TRACK_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          event,
          ...payload,
          ts: Date.now(),
        }),
        keepalive: true, // critical for unload events
      });
    } catch (_) {}
  }

  /* ────────────────────────────────────────────── */
  /* INIT */
  /* ────────────────────────────────────────────── */

  document.addEventListener("DOMContentLoaded", async () => {
    product = await loadProductJson();
    if (!product) return;

    selectedVariantId = product.variants?.[0]?.id || null;

    track("page_view", {
      productHandle: product.handle,
    });

    setupVariantListeners();
    setupAddToCart();
  });

  /* ────────────────────────────────────────────── */
  /* VARIANTS */
  /* ────────────────────────────────────────────── */

  function setupVariantListeners() {
    document.addEventListener("change", (e) => {
      if (!e.target.name || !e.target.name.includes("option")) return;

      const selectedOptions = Array.from(
        document.querySelectorAll('[name^="option"]')
      ).map((el) => el.value);

      const match = product.variants.find((v) =>
        v.options.every((opt, i) => opt === selectedOptions[i])
      );

      if (match) {
        selectedVariantId = match.id;

        track("variant_change", {
          variantId: selectedVariantId,
        });
      }
    });
  }

  /* ────────────────────────────────────────────── */
  /* ADD TO CART */
  /* ────────────────────────────────────────────── */

  function setupAddToCart() {
    document.addEventListener("click", async (e) => {
      const btn = e.target.closest(`[data-bdm-atc]`);
      if (!btn || !selectedVariantId) return;

      e.preventDefault();

      track("add_to_cart", {
        variantId: selectedVariantId,
      });

      try {
        await fetch("/cart/add.js", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: [
              {
                id: selectedVariantId,
                quantity: 1,
                selling_plan: selectedSellingPlanId || undefined,
              },
            ],
          }),
        });
      } catch (_) {}
    });
  }
})();
