(() => {
  if (window.__BDM_STICKY_ATC_INIT__) return;
  window.__BDM_STICKY_ATC_INIT__ = true;

  const BAR_ID = "bdm-sticky-atc";

  const ready = (fn) =>
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", fn)
      : fn();

  ready(() => {
    const bar = document.getElementById(BAR_ID);
    if (!bar) return;

    /* ---------------------------
       BASIC VISIBILITY (NEVER FAIL)
    ---------------------------- */
    bar.classList.add("is-visible");
    bar.setAttribute("aria-hidden", "false");

    const right = bar.querySelector(".bdm-right");
    const titleEl = bar.querySelector("#bdm-title");
    const priceEl = bar.querySelector("#bdm-price");
    const qtyEl = bar.querySelector("#bdm-qty");
    const atcBtn = bar.querySelector("#bdm-atc");

    /* ---------------------------
       SETTINGS
    ---------------------------- */
    const showVariant = bar.hasAttribute("data-show-variant");
    const showSellingPlan = bar.hasAttribute("data-show-selling-plan");
    const showQty = bar.hasAttribute("data-show-qty");

    /* ---------------------------
       PRODUCT JSON (SAFE)
    ---------------------------- */
    const handle = location.pathname.split("/products/")[1]?.split("/")[0];
    if (handle) {
      fetch(`/products/${handle}.js`)
        .then(r => r.json())
        .then(product => {
          if (!product) return;

          if (titleEl && bar.hasAttribute("data-show-title")) {
            titleEl.textContent = product.title;
            titleEl.style.display = "";
          }

          if (priceEl && bar.hasAttribute("data-show-price")) {
            const v = product.variants[0];
            if (v) {
              priceEl.textContent =
                (v.price / 100).toLocaleString(undefined, {
                  style: "currency",
                  currency: product.currency || "USD"
                });
              priceEl.style.display = "";
            }
          }
        });
    }

    /* ---------------------------
       FIND PRODUCT FORM (LAZY)
    ---------------------------- */
    function findProductForm() {
      return (
        document.querySelector('form[action*="/cart/add"]') ||
        document.querySelector("product-form form")
      );
    }

    function attachWhenReady() {
      const productForm = findProductForm();
      if (!productForm) return false;

      const variantInput = productForm.querySelector('[name="id"]');
      const sellingPlanInput =
        productForm.querySelector('[name="selling_plan"]');
      const mainQty =
        productForm.querySelector('[name="quantity"]');

      /* ---------------------------
         VARIANT SELECTOR
      ---------------------------- */
      if (showVariant && variantInput && !bar.querySelector(".bdm-variant")) {
        const source =
          productForm.querySelector("select[name='id']");

        if (source) {
          const clone = source.cloneNode(true);
          clone.classList.add("bdm-variant");
          clone.value = variantInput.value;

          clone.addEventListener("change", () => {
            variantInput.value = clone.value;
            variantInput.dispatchEvent(
              new Event("change", { bubbles: true })
            );
          });

          right.prepend(clone);
        }
      }

      /* ---------------------------
         SELLING PLAN
      ---------------------------- */
      if (
        showSellingPlan &&
        sellingPlanInput &&
        !bar.querySelector(".bdm-selling-plan")
      ) {
        const clone = sellingPlanInput.cloneNode(true);
        clone.classList.add("bdm-selling-plan");

        clone.addEventListener("change", () => {
          sellingPlanInput.value = clone.value;
          sellingPlanInput.dispatchEvent(
            new Event("change", { bubbles: true })
          );
        });

        right.prepend(clone);
      }

      /* ---------------------------
         QTY
      ---------------------------- */
      if (qtyEl && showQty && mainQty) {
        qtyEl.style.display = "";
        qtyEl.value = mainQty.value || 1;
        qtyEl.addEventListener("change", () => {
          mainQty.value = qtyEl.value;
        });
      }

      /* ---------------------------
         ADD TO CART
      ---------------------------- */
      atcBtn.addEventListener("click", () => {
        if (!variantInput?.value) return;

        const fd = new FormData();
        fd.append("id", variantInput.value);
        fd.append("quantity", qtyEl?.value || mainQty?.value || 1);

        if (sellingPlanInput?.value) {
          fd.append("selling_plan", sellingPlanInput.value);
        }

        fetch("/cart/add.js", {
          method: "POST",
          body: fd,
          headers: { Accept: "application/json" }
        });
      });

      return true;
    }

    /* ---------------------------
       RETRY UNTIL FORM EXISTS
    ---------------------------- */
    const interval = setInterval(() => {
      if (attachWhenReady()) clearInterval(interval);
    }, 300);
  });
})();
