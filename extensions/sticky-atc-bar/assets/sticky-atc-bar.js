(() => {
  // Prevent double init (theme reloads, section renders)
  if (window.__BDM_STICKY_ATC_INIT__) return;
  window.__BDM_STICKY_ATC_INIT__ = true;

  document.addEventListener("DOMContentLoaded", () => {
    const bar = document.getElementById("bdm-sticky-atc");
    if (!bar) return;

    /* ================================
       ONLY SHOW ON PRODUCT PAGES
    ================================= */
    if (!window.location.pathname.includes("/products/")) {
      bar.setAttribute("hidden", "");
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
       DEVICE VISIBILITY (SAFE)
    ================================= */
    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    if ((isMobile && !showMobile) || (!isMobile && !showDesktop)) {
      bar.setAttribute("hidden", "");
      return;
    }
    bar.removeAttribute("hidden");

    /* ================================
       SCROLL VISIBILITY
    ================================= */
    const updateScrollVisibility = () => {
      if (!showOnScroll || window.scrollY >= scrollOffset) {
        bar.classList.add("is-visible");
        bar.setAttribute("aria-hidden", "false");
      } else {
        bar.classList.remove("is-visible");
        bar.setAttribute("aria-hidden", "true");
      }
    };

    updateScrollVisibility();
    window.addEventListener("scroll", updateScrollVisibility);

    /* ================================
       FIND MAIN PRODUCT FORM
    ================================= */
    const productForm =
      document.querySelector('form[action*="/cart/add"]') ||
      document.querySelector("product-form form");

    if (!productForm) return;

    const variantInput = productForm.querySelector('[name="id"]');
    const sellingPlanInput = productForm.querySelector('[name="selling_plan"]');
    const qtyInputMain = productForm.querySelector('[name="quantity"]');

    if (!variantInput) return;

    /* ================================
       BAR ELEMENTS
    ================================= */
    const titleEl = bar.querySelector("#bdm-title");
    const priceEl = bar.querySelector("#bdm-price");
    const qtyWrapper = bar.querySelector(".bdm-qty");
    const qtyEl = bar.querySelector("#bdm-qty");
    const atcBtn = bar.querySelector("#bdm-atc");

    if (!atcBtn) return;

    // Save original button text for Sold Out toggle
    atcBtn.dataset.originalText = atcBtn.textContent;

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
    if (!handle) return;

    fetch(`/products/${handle}.js`)
      .then(r => r.json())
      .then(product => {
        if (!product) return;

        if (showTitle && titleEl) {
          titleEl.textContent = product.title;
        }

        const updateVariantUI = (variantId) => {
          const variant = product.variants.find(v => v.id == variantId);
          if (!variant) return;

          if (showPrice && priceEl) {
            priceEl.textContent = (variant.price / 100).toLocaleString(undefined, {
              style: "currency",
              currency: product.currency || "USD"
            });
          }

          if (!variant.available) {
            atcBtn.textContent = "Sold Out";
            atcBtn.disabled = true;
            atcBtn.classList.add("is-sold-out");
          } else {
            atcBtn.textContent = atcBtn.dataset.originalText;
            atcBtn.disabled = false;
            atcBtn.classList.remove("is-sold-out");
          }
        };

        updateVariantUI(variantInput.value);
        variantInput.addEventListener("change", e => updateVariantUI(e.target.value));
      });

    /* ================================
       QTY SYNC + STEPPER
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
       ADD TO CART (THEME-NATIVE)
    ================================= */
    atcBtn.addEventListener("click", () => {
      if (!variantInput.value || atcBtn.disabled) return;

      // Sync quantity into real product form
      if (qtyInputMain) {
        qtyInputMain.value = currentQty;
        qtyInputMain.dispatchEvent(new Event("change", { bubbles: true }));
      }

      // Let theme handle cart, drawer, icon
      productForm.requestSubmit();
    });
  });
})();
