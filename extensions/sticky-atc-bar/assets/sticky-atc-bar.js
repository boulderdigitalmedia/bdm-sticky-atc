(() => {
  if (window.__BDM_STICKY_ATC_INIT__) return;
  window.__BDM_STICKY_ATC_INIT__ = true;

  const BAR_ID = "bdm-sticky-atc";

  document.addEventListener("DOMContentLoaded", () => {
    const bar = document.getElementById(BAR_ID);
    if (!bar) return;

    /* ------------------------
       READ SETTINGS (CORRECT)
    ------------------------- */
    const showDesktop = bar.hasAttribute("data-enable-desktop");
    const showMobile = bar.hasAttribute("data-enable-mobile");
    const showOnScroll = bar.hasAttribute("data-show-on-scroll");
    const scrollOffset = parseInt(bar.dataset.scrollOffset || "250", 10);

    const showTitle = bar.hasAttribute("data-show-title");
    const showPrice = bar.hasAttribute("data-show-price");
    const showQty = bar.hasAttribute("data-show-qty");
    const showVariant = bar.hasAttribute("data-show-variant");
    const showSellingPlan = bar.hasAttribute("data-show-selling-plan");

    /* ------------------------
       DEVICE FILTER
    ------------------------- */
    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    if ((isMobile && !showMobile) || (!isMobile && !showDesktop)) {
      bar.remove();
      return;
    }

    /* ------------------------
       VISIBILITY
    ------------------------- */
    function updateVisibility() {
      if (!showOnScroll || window.scrollY >= scrollOffset) {
        bar.classList.add("is-visible");
        bar.setAttribute("aria-hidden", "false");
      } else {
        bar.classList.remove("is-visible");
        bar.setAttribute("aria-hidden", "true");
      }
    }

    updateVisibility();
    window.addEventListener("scroll", updateVisibility);

    /* ------------------------
       FIND PRODUCT FORM
    ------------------------- */
    const productForm =
      document.querySelector('form[action*="/cart/add"]') ||
      document.querySelector("product-form form");

    if (!productForm) return;

    const variantInput = productForm.querySelector('[name="id"]');
    const sellingPlanInput = productForm.querySelector('[name="selling_plan"]');
    const mainQtyInput = productForm.querySelector('[name="quantity"]');

    /* ------------------------
       BAR ELEMENTS
    ------------------------- */
    const titleEl = bar.querySelector("#bdm-title");
    const priceEl = bar.querySelector("#bdm-price");
    const qtyEl = bar.querySelector("#bdm-qty");
    const atcBtn = bar.querySelector("#bdm-atc");

    /* ------------------------
       PRODUCT DATA
    ------------------------- */
    const handle = window.location.pathname.split("/products/")[1];
    if (!handle) return;

    fetch(`/products/${handle}.js`)
      .then(r => r.json())
      .then(product => {
        if (!product) return;

        if (showTitle && titleEl) {
          titleEl.textContent = product.title;
          titleEl.hidden = false;
        }

        function updatePrice(variantId) {
          const variant = product.variants.find(v => v.id == variantId);
          if (!variant || !showPrice || !priceEl) return;

          priceEl.textContent = (variant.price / 100).toLocaleString(undefined, {
            style: "currency",
            currency: product.currency || "USD"
          });
          priceEl.hidden = false;
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
    if (showQty && qtyEl && mainQtyInput) {
      qtyEl.hidden = false;
      qtyEl.value = mainQtyInput.value || 1;

      qtyEl.addEventListener("change", () => {
        mainQtyInput.value = qtyEl.value;
      });
    }

    /* ------------------------
       ADD TO CART
    ------------------------- */
    atcBtn.addEventListener("click", () => {
      if (!variantInput?.value) return;

      const formData = new FormData();
      formData.append("id", variantInput.value);
      formData.append(
        "quantity",
        qtyEl?.value || mainQtyInput?.value || 1
      );

      if (showSellingPlan && sellingPlanInput?.value) {
        formData.append("selling_plan", sellingPlanInput.value);
      }

      fetch("/cart/add.js", {
        method: "POST",
        body: formData,
        headers: { Accept: "application/json" }
      });
    });
  });
})();
