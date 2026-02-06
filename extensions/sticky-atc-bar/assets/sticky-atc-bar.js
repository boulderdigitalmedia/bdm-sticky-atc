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

    /* ======================
       READ SETTINGS (FIXED)
    ====================== */
    const showDesktop = bar.dataset.enableDesktop === "true";
    const showMobile = bar.dataset.enableMobile === "true";
    const showOnScroll = bar.dataset.showOnScroll === "true";
    const scrollOffset = parseInt(bar.dataset.scrollOffset || "250", 10);

    const showTitle = bar.dataset.showTitle === "true";
    const showPrice = bar.dataset.showPrice === "true";
    const showQty = bar.dataset.showQty === "true";
    const showVariant = bar.dataset.showVariant === "true";
    const showSellingPlan = bar.dataset.showSellingPlan === "true";

    /* ======================
       DEVICE VISIBILITY
    ====================== */
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

    /* ======================
       FIND PRODUCT FORM
    ====================== */
    const productForm =
      document.querySelector('form[action*="/cart/add"]') ||
      document.querySelector("product-form form");

    if (!productForm) return;

    const variantInput = productForm.querySelector('[name="id"]');
    const sellingPlanInput = productForm.querySelector('[name="selling_plan"]');
    const qtyInputMain = productForm.querySelector('[name="quantity"]');

    /* ======================
       BAR ELEMENTS
    ====================== */
    const titleEl = bar.querySelector("#bdm-title");
    const priceEl = bar.querySelector("#bdm-price");
    const qtyEl = bar.querySelector("#bdm-qty");
    const atcBtn = bar.querySelector("#bdm-atc");

    /* ======================
       PRODUCT DATA
    ====================== */
    const handle = window.location.pathname.split("/products/")[1];
    if (!handle) return;

    fetch(`/products/${handle}.js`)
      .then(r => r.json())
      .then(product => {
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

    /* ======================
       QUANTITY
    ====================== */
    if (qtyEl && qtyInputMain && showQty) {
      qtyEl.value = qtyInputMain.value || 1;
      qtyEl.style.display = "";

      qtyEl.addEventListener("change", () => {
        qtyInputMain.value = qtyEl.value;
      });
    } else if (qtyEl) {
      qtyEl.style.display = "none";
    }

    /* ======================
       VARIANT / SELLING PLAN
    ====================== */
    if (!showVariant && variantInput) {
      variantInput.setAttribute("hidden", "");
    }

    if (!showSellingPlan && sellingPlanInput) {
      sellingPlanInput.setAttribute("hidden", "");
    }

    /* ======================
       ADD TO CART
    ====================== */
    atcBtn.addEventListener("click", () => {
      if (!variantInput?.value) return;

      const formData = new FormData();
      formData.append("id", variantInput.value);
      formData.append(
        "quantity",
        qtyEl?.value || qtyInputMain?.value || 1
      );

      if (sellingPlanInput?.value && showSellingPlan) {
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
