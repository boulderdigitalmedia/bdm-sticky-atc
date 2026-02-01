(() => {
  const BAR_ID = "bdm-sticky-atc";

  if (window.__BDM_STICKY_ATC_INIT__) return;
  window.__BDM_STICKY_ATC_INIT__ = true;

  /* ---------------- Guards ---------------- */

  if (!document.querySelector('[data-product-page="true"]')) return;

  const bar = document.getElementById(BAR_ID);
  if (!bar) return;

  const titleEl = bar.querySelector("#bdm-title");
  const priceEl = bar.querySelector("#bdm-price");
  const button = bar.querySelector("#bdm-atc");

  /* ---------------- Product JSON (CANONICAL) ---------------- */

  function getProductJson() {
    const script =
      document.querySelector('script[type="application/json"][data-product-json]') ||
      document.querySelector("#ProductJson");

    if (!script) return null;

    try {
      return JSON.parse(script.textContent);
    } catch {
      return null;
    }
  }

  const product = getProductJson();
  if (!product || !product.variants?.length) {
    console.warn("BDM Sticky ATC: product JSON not found");
    return;
  }

  /* ---------------- State ---------------- */

  let selectedVariantId = product.variants[0].id;

  /* ---------------- Populate content ---------------- */

  if (titleEl) {
    titleEl.textContent = product.title;
  }

  if (priceEl) {
    priceEl.textContent = formatMoney(
      product.variants[0].price * 100
    );
  }

  /* ---------------- Variant syncing ---------------- */

  document.addEventListener("change", (e) => {
    const input = e.target;
    if (!input.name || input.name !== "id") return;

    const variant = product.variants.find(
      (v) => String(v.id) === String(input.value)
    );

    if (!variant) return;

    selectedVariantId = variant.id;

    if (priceEl) {
      priceEl.textContent = formatMoney(variant.price * 100);
    }
  });

  /* ---------------- Visibility ---------------- */

  bar.classList.add("is-visible");
  bar.setAttribute("aria-hidden", "false");

  /* ---------------- Add to cart ---------------- */

  if (button) {
    button.addEventListener("click", async () => {
      await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          items: [{ id: selectedVariantId, quantity: 1 }]
        })
      });

      window.location.href = "/cart";
    });
  }

  /* ---------------- Utils ---------------- */

  function formatMoney(cents) {
    return `$${(cents / 100).toFixed(2)}`;
  }
})();
