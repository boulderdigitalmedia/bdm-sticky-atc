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

    /* -----------------------------------
       SETTINGS FROM CUSTOMIZER
    ----------------------------------- */
    const showVariant = bar.hasAttribute("data-show-variant");
    const showSellingPlan = bar.hasAttribute("data-show-selling-plan");
    const showQty = bar.hasAttribute("data-show-qty");

    /* -----------------------------------
       FIND MAIN PRODUCT FORM
    ----------------------------------- */
    const productForm =
      document.querySelector('form[action*="/cart/add"]') ||
      document.querySelector("product-form form");

    if (!productForm) return;

    const variantInput = productForm.querySelector('[name="id"]');
    const sellingPlanInput =
      productForm.querySelector('[name="selling_plan"]');

    /* -----------------------------------
       BAR ELEMENTS
    ----------------------------------- */
    const right = bar.querySelector(".bdm-right");
    const qtyEl = bar.querySelector("#bdm-qty");
    const atcBtn = bar.querySelector("#bdm-atc");

    /* -----------------------------------
       VARIANT SELECTOR
    ----------------------------------- */
    if (showVariant) {
      const sourceVariantSelector =
        productForm.querySelector("select[name='id']") ||
        productForm.querySelector("[data-variant-picker] select");

      if (sourceVariantSelector) {
        const clone = sourceVariantSelector.cloneNode(true);
        clone.removeAttribute("id");
        clone.classList.add("bdm-variant");

        clone.value = variantInput.value;

        clone.addEventListener("change", () => {
          variantInput.value = clone.value;
          variantInput.dispatchEvent(new Event("change", { bubbles: true }));
        });

        variantInput.addEventListener("change", () => {
          clone.value = variantInput.value;
        });

        right.prepend(clone);
      }
    }

    /* -----------------------------------
       SELLING PLAN SELECTOR
    ----------------------------------- */
    if (showSellingPlan && sellingPlanInput) {
      const sourcePlan =
        productForm.querySelector("[name='selling_plan']");

      if (sourcePlan) {
        const clone = sourcePlan.cloneNode(true);
        clone.removeAttribute("id");
        clone.classList.add("bdm-selling-plan");

        clone.value = sellingPlanInput.value;

        clone.addEventListener("change", () => {
          sellingPlanInput.value = clone.value;
          sellingPlanInput.dispatchEvent(
            new Event("change", { bubbles: true })
          );
        });

        sellingPlanInput.addEventListener("change", () => {
          clone.value = sellingPlanInput.value;
        });

        right.prepend(clone);
      }
    }

    /* -----------------------------------
       QUANTITY
    ----------------------------------- */
    if (qtyEl && showQty) {
      const mainQty = productForm.querySelector('[name="quantity"]');
      qtyEl.style.display = "";

      qtyEl.value = mainQty?.value || 1;

      qtyEl.addEventListener("change", () => {
        if (mainQty) mainQty.value = qtyEl.value;
      });
    }

    /* -----------------------------------
       ADD TO CART
    ----------------------------------- */
    atcBtn.addEventListener("click", () => {
      if (!variantInput?.value) return;

      const formData = new FormData();
      formData.append("id", variantInput.value);
      formData.append(
        "quantity",
        qtyEl?.value || productForm.querySelector('[name="quantity"]')?.value || 1
      );

      if (sellingPlanInput?.value) {
        formData.append("selling_plan", sellingPlanInput.value);
      }

      fetch("/cart/add.js", {
        method: "POST",
        body: formData,
        headers: { Accept: "application/json" }
      }).then(() => {
        document.dispatchEvent(
          new CustomEvent("bdm:sticky-atc:added")
        );
      });
    });
  });
})();
