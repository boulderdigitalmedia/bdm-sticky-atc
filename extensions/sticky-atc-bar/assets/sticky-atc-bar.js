(() => {
  if (window.__BDM_STICKY_ATC_INIT__) return;
  window.__BDM_STICKY_ATC_INIT__ = true;

  const BAR_ID = "bdm-sticky-atc";

  function ready(fn) {
    if (document.readyState === "complete") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(() => {
    const bar = document.getElementById(BAR_ID);
    if (!bar) return;

    const titleEl = bar.querySelector("#bdm-title");
    const priceEl = bar.querySelector("#bdm-price");
    const qtyEl = bar.querySelector("#bdm-qty");
    const atcBtn = bar.querySelector("#bdm-atc");

    const productForm =
      document.querySelector('form[action*="/cart/add"]') ||
      document.querySelector("product-form form");

    if (!productForm) return;

    const variantInput = productForm.querySelector('[name="id"]');
    const sellingPlanInput = productForm.querySelector('[name="selling_plan"]');
    const qtyInputMain = productForm.querySelector('[name="quantity"]');

    /* ---------------------------
       APPLY SETTINGS (CORE FIX)
    ---------------------------- */
    function applySettings() {
      const showTitle = bar.hasAttribute("data-show-title");
      const showPrice = bar.hasAttribute("data-show-price");
      const showQty = bar.hasAttribute("data-show-qty");

      if (titleEl) titleEl.style.display = showTitle ? "" : "none";
      if (priceEl) priceEl.style.display = showPrice ? "" : "none";
      if (qtyEl) qtyEl.style.display = showQty ? "" : "none";
    }

    applySettings();

    /* ---------------------------
       OBSERVE EDITOR CHANGES
    ---------------------------- */
    const observer = new MutationObserver(applySettings);
    observer.observe(bar, { attributes: true });

    /* ---------------------------
       SCROLL VISIBILITY
    ---------------------------- */
    const showOnScroll = bar.hasAttribute("data-show-on-scroll");
    const scrollOffset = parseInt(bar.dataset.scrollOffset || "250", 10);

    function updateScroll() {
      if (!showOnScroll || window.scrollY >= scrollOffset) {
        bar.classList.add("is-visible");
        bar.setAttribute("aria-hidden", "false");
      } else {
        bar.classList.remove("is-visible");
        bar.setAttribute("aria-hidden", "true");
      }
    }

    updateScroll();
    window.addEventListener("scroll", updateScroll);

    /* ---------------------------
       PRODUCT DATA
    ---------------------------- */
    fetch(`/products/${location.pathname.split("/products/")[1]}.js`)
      .then(r => r.json())
      .then(product => {
        if (!product) return;

        if (titleEl) titleEl.textContent = product.title;

        function updatePrice(variantId) {
          const variant = product.variants.find(v => v.id == variantId);
          if (!variant || !priceEl) return;

          priceEl.textContent =
            (variant.price / 100).toLocaleString(undefined, {
              style: "currency",
              currency: product.currency || "USD"
            });
        }

        if (variantInput) {
          updatePrice(variantInput.value);
          variantInput.addEventListener("change", e =>
            updatePrice(e.target.value)
          );
        }
      });

    /* ---------------------------
       QTY SYNC
    ---------------------------- */
    if (qtyEl && qtyInputMain) {
      qtyEl.value = qtyInputMain.value || 1;
      qtyEl.addEventListener("change", () => {
        qtyInputMain.value = qtyEl.value;
      });
    }

    /* ---------------------------
       ADD TO CART
    ---------------------------- */
    atcBtn.addEventListener("click", () => {
      if (!variantInput?.value) return;

      const data = new FormData();
      data.append("id", variantInput.value);
      data.append("quantity", qtyEl?.value || qtyInputMain?.value || 1);

      if (sellingPlanInput?.value) {
        data.append("selling_plan", sellingPlanInput.value);
      }

      fetch("/cart/add.js", {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" }
      }).then(() =>
        document.dispatchEvent(
          new CustomEvent("bdm:sticky-atc:added")
        )
      );
    });
  });
})();
