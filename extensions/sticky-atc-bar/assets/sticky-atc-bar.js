(() => {
  if (window.__BDM_STICKY_ATC_INIT__) return;
  window.__BDM_STICKY_ATC_INIT__ = true;

  const bar = document.getElementById("bdm-sticky-atc");
  if (!bar) return;

  if (!bar.hasAttribute("data-product-page")) return;

  const titleEl = bar.querySelector("#bdm-title");
  const priceEl = bar.querySelector("#bdm-price");
  const qtyEl = bar.querySelector("#bdm-qty");
  const button = bar.querySelector("#bdm-atc");

  /* ---------------- Product JSON ---------------- */

  const jsonScript = document.querySelector("script[data-product-json]");
  if (!jsonScript) {
    console.warn("BDM Sticky ATC: product JSON missing");
    return;
  }

  let product;
  try {
    product = JSON.parse(jsonScript.textContent);
  } catch {
    console.warn("BDM Sticky ATC: invalid product JSON");
    return;
  }

  if (!product?.variants?.length) return;

  let selectedVariant = product.variants[0];

  /* ---------------- Populate ---------------- */

  if (titleEl) {
    titleEl.textContent = product.title;
  }

  if (priceEl) {
    priceEl.textContent = formatMoney(selectedVariant.price * 100);
  }

  /* ---------------- Variant syncing ---------------- */

  document.addEventListener("change", (e) => {
    const input = e.target;
    if (!input.name || input.name !== "id") return;

    const match = product.variants.find(
      (v) => String(v.id) === String(input.value)
    );

    if (!match) return;

    selectedVariant = match;

    if (priceEl) {
      priceEl.textContent = formatMoney(match.price * 100);
    }
  });

  /* ---------------- Visibility ---------------- */

  bar.classList.add("is-visible");
  bar.setAttribute("aria-hidden", "false");

  /* ---------------- Add to cart ---------------- */

  if (button) {
    button.addEventListener("click", async () => {
      const quantity = qtyEl ? Math.max(1, parseInt(qtyEl.value, 10) || 1) : 1;

      await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          items: [{ id: selectedVariant.id, quantity }]
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
