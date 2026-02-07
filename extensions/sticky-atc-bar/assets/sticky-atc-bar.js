(() => {
  if (window.__BDM_STICKY_ATC_INIT__) return;
  window.__BDM_STICKY_ATC_INIT__ = true;

  document.addEventListener("DOMContentLoaded", () => {
    const bar = document.getElementById("bdm-sticky-atc");
    if (!bar) return;

    /* ================================
       ONLY RUN ON PRODUCT PAGES
    ================================= */
    const productForm =
      document.querySelector('form[action*="/cart/add"]') ||
      document.querySelector("product-form form");

    if (!productForm) {
      bar.hidden = true;
      return;
    }

    /* ================================
       SETTINGS (DATA ATTRIBUTES)
    ================================= */
    const showDesktop = bar.hasAttribute("data-enable-desktop");
    const showMobile = bar.hasAttribute("data-enable-mobile");
    const showOnScroll = bar.hasAttribute("data-show-on-scroll");
    const scrollOffset = parseInt(bar.dataset.scrollOffset || "250", 10);

    const showTitle = bar.hasAttribute("data-show-title");
    const showPrice = bar.hasAttribute("data-show-price");
    const showQty = bar.hasAttribute("data-show-qty");

    /* ================================
       DEVICE VISIBILITY
    ================================= */
    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    if ((isMobile && !showMobile) || (!isMobile && !showDesktop)) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;

    /* ================================
       SCROLL VISIBILITY
    ================================= */
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
       PRODUCT FORM INPUTS
    ================================= */
    const variantInput = productForm.querySelector('[name="id"]');
    const sellingPlanInput = productForm.querySelector('[name="selling_plan"]');
    const qtyInputMain = productForm.querySelector('[name="quantity"]');

    if (!variantInput) {
      bar.hidden = true;
      return;
    }

    /* ================================
       BAR ELEMENTS
    ================================= */
    const titleEl = bar.querySelector("#bdm-title");
    const priceEl = bar.querySelector("#bdm-price");
    const qtyWrapper = bar.querySelector(".bdm-qty");
    const qtyEl = bar.querySelector("#bdm-qty");
    const atcBtn = bar.querySelector("#bdm-atc");

    if (!atcBtn) {
      bar.hidden = true;
      return;
    }

    /* ================================
       INITIAL VISIBILITY
    ================================= */
    if (titleEl) titleEl.style.display = showTitle ? "" : "none";
    if (priceEl) priceEl.style.display = showPrice ? "" : "none";
    if (qtyWrapper) qtyWrapper.style.display = showQty ? "inline-flex" : "none";

    /* ================================
       PRODUCT DATA
    ================================= */
    const handle = window.location.pathname.split("/products/")[1];
    if (!handle) {
      bar.hidden = true;
      return;
    }

    fetch(`/products/${handle}.js`)
      .then(r => r.json())
      .then(product => {
        if (!product) return;

        if (showTitle && titleEl) {
          titleEl.textContent = product.title;
        }

        const updatePrice = (variantId) => {
          const variant = product.variants.find(v => v.id == variantId);
          if (!variant || !showPrice || !priceEl) return;

          priceEl.textContent = (variant.price / 100).toLocaleString(undefined, {
            style: "currency",
            currency: product.currency || "USD"
          });
        };

        updatePrice(variantInput.value);
        variantInput.addEventListener("change", e => updatePrice(e.target.value));
      });

    /* ================================
       QTY SYNC
    ================================= */
    let currentQty = parseInt(qtyInputMain?.value || "1", 10);

    if (qtyEl && qtyWrapper) {
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
       ADD TO CART (THEME-SAFE)
    ================================= */
    atcBtn.addEventListener("click", () => {
      if (!variantInput.value) return;

      if (qtyInputMain) qtyInputMain.value = currentQty;

      // 🔑 Let Shopify theme handle cart + drawer
      productForm.requestSubmit();
    });
  });
})();
