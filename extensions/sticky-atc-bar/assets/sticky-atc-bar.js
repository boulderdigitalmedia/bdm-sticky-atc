(() => {
  if (window.__BDM_STICKY_ATC_INIT__) return;
  window.__BDM_STICKY_ATC_INIT__ = true;

  document.addEventListener("DOMContentLoaded", () => {
    const bar = document.getElementById("bdm-sticky-atc");
    if (!bar) return;

    /* ================================
       VISIBILITY SETTINGS
    ================================= */
    const showDesktop = bar.hasAttribute("data-enable-desktop");
    const showMobile = bar.hasAttribute("data-enable-mobile");
    const showOnScroll = bar.hasAttribute("data-show-on-scroll");
    const scrollOffset = parseInt(bar.dataset.scrollOffset || "250", 10);

    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    if ((isMobile && !showMobile) || (!isMobile && !showDesktop)) {
      bar.hidden = true;
      return;
    }

    const updateScrollVisibility = () => {
      if (!showOnScroll || window.scrollY >= scrollOffset) {
        bar.classList.add("is-visible");
      } else {
        bar.classList.remove("is-visible");
      }
    };

    updateScrollVisibility();
    window.addEventListener("scroll", updateScrollVisibility);

    /* ================================
       FIND REAL PRODUCT FORM
    ================================= */
    const productForm =
      document.querySelector('form[action*="/cart/add"]') ||
      document.querySelector("product-form form");

    if (!productForm) return;

    const variantInput = productForm.querySelector('[name="id"]');
    const qtyInputMain = productForm.querySelector('[name="quantity"]');
    const sellingPlanInput = productForm.querySelector('[name="selling_plan"]');

    if (!variantInput) return;

    /* ================================
       BAR ELEMENTS
    ================================= */
    const qtyEl = bar.querySelector("#bdm-qty");
    const atcBtn = bar.querySelector("#bdm-atc");

    if (!atcBtn) return;

    /* ================================
       QTY SYNC
    ================================= */
    let currentQty = parseInt(qtyInputMain?.value || "1", 10);

    if (qtyEl) {
      qtyEl.value = currentQty;

      qtyEl.addEventListener("change", () => {
        currentQty = Math.max(1, parseInt(qtyEl.value || "1", 10));
        qtyEl.value = currentQty;
        if (qtyInputMain) qtyInputMain.value = currentQty;
      });

      bar.querySelectorAll(".bdm-qty-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          if (btn.dataset.action === "increase") currentQty++;
          if (btn.dataset.action === "decrease") {
            currentQty = Math.max(1, currentQty - 1);
          }
          qtyEl.value = currentQty;
          if (qtyInputMain) qtyInputMain.value = currentQty;
        });
      });
    }

    /* ================================
       ADD TO CART (CORRECT WAY)
    ================================= */
    atcBtn.addEventListener("click", () => {
      // sync values into real form
      variantInput.value = variantInput.value;
      if (qtyInputMain) qtyInputMain.value = currentQty;
      if (sellingPlanInput) sellingPlanInput.value = sellingPlanInput.value;

      // 🔑 Let the THEME handle everything
      productForm.requestSubmit();
    });
  });
})();
