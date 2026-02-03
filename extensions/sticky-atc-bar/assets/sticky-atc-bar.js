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

    /* ------------------------
       FIND REAL PRODUCT FORM
    ------------------------- */
    const productForm =
      document.querySelector('form[action*="/cart/add"]') ||
      document.querySelector("product-form form");

    if (!productForm) {
      console.warn("[BDM ATC] No product form found");
      return;
    }

    const variantInput =
      productForm.querySelector('[name="id"]');

    const sellingPlanInput =
      productForm.querySelector('[name="selling_plan"]');

    const qtyInputMain =
      productForm.querySelector('[name="quantity"]');

    /* ------------------------
       BAR ELEMENTS
    ------------------------- */
    const titleEl = bar.querySelector("#bdm-title");
    const priceEl = bar.querySelector("#bdm-price");
    const qtyEl = bar.querySelector("#bdm-qty");
    const atcBtn = bar.querySelector("#bdm-atc");

    /* ------------------------
       SETTINGS (DATA ATTRS)
    ------------------------- */
    const showDesktop = bar.hasAttribute("data-enable-desktop");
    const showMobile = bar.hasAttribute("data-enable-mobile");
    const showOnScroll = bar.hasAttribute("data-show-on-scroll");
    const scrollOffset = parseInt(bar.dataset.scrollOffset || "250", 10);

    const showTitle = bar.hasAttribute("data-show-title");
    const showPrice = bar.hasAttribute("data-show-price");
    const showQty = bar.hasAttribute("data-show-qty");

    /* ------------------------
       APPLY VISIBILITY
    ------------------------- */
    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    if ((isMobile && !showMobile) || (!isMobile && !showDesktop)) {
      bar.remove();
      return;
    }

    function updateScrollVisibility() {
      if (!showOnScroll) {
        bar.classList.add("is-visible");
        bar.setAttribute("aria-hidden", "false");
        return;
      }

      if (window.scrollY >= scrollOffset) {
        bar.classList.add("is-visible");
        bar.setAttribute("aria-hidden", "false");
      } else {
        bar.classList.remove("is-visible");
        bar.setAttribute("aria-hidden", "true");
      }
    }

    updateScrollVisibility();
    window.addEventListener("scroll", updateScrollVisibility);

    /* ------------------------
       SYNC PRODUCT DATA
    ------------------------- */
    function getProductJSON() {
      const handle = window.location.pathname.split("/products/")[1];
      if (!handle) return null;

      return fetch(`/products/${handle}.js`)
        .then(r => r.json())
        .catch(() => null);
    }

    getProductJSON().then(product => {
      if (!product) return;

      if (showTitle && titleEl) {
        titleEl.textContent = product.title;
        titleEl.style.display = "";
      }

      function updatePrice(variantId) {
        const variant = product.variants.find(v => v.id == variantId);
        if (!variant) return;

        if (showPrice && priceEl) {
          priceEl.textContent =
            (variant.price / 100).toLocaleString(undefined, {
              style: "currency",
              currency: product.currency || "USD"
            });
          priceEl.style.display = "";
        }
      }

      if (variantInput) {
        updatePrice(variantInput.value);
        variantInput.addEventListener("change", e =>
          updatePrice(e.target.value)
        );
      }
    });

    /* ------------------------
       QTY SYNC
    ------------------------- */
    if (qtyEl && qtyInputMain) {
      qtyEl.value = qtyInputMain.value || 1;
      qtyEl.style.display = showQty ? "" : "none";

      qtyEl.addEventListener("change", () => {
        qtyInputMain.value = qtyEl.value;
      });
    }

    /* ------------------------
       ADD TO CART
    ------------------------- */
    atcBtn.addEventListener("click", () => {
      if (!variantInput || !variantInput.value) return;

      const formData = new FormData();
      formData.append("id", variantInput.value);
      formData.append(
        "quantity",
        qtyEl?.value || qtyInputMain?.value || 1
      );

      if (sellingPlanInput?.value) {
        formData.append("selling_plan", sellingPlanInput.value);
      }

      fetch("/cart/add.js", {
        method: "POST",
        body: formData,
        headers: { Accept: "application/json" }
      })
        .then(() => {
          document.dispatchEvent(
            new CustomEvent("bdm:sticky-atc:added")
          );
        })
        .catch(console.error);
    });
  });
})();
