(() => {
  if (window.__BDM_STICKY_ATC_INIT__) return;
  window.__BDM_STICKY_ATC_INIT__ = true;

  const bar = document.getElementById("bdm-sticky-atc");
  if (!bar) return;

  /* ------------------------
     ELEMENTS
  ------------------------- */
  const titleEl = bar.querySelector("#bdm-title");
  const priceEl = bar.querySelector("#bdm-price");
  const qtyEl = bar.querySelector("#bdm-qty");
  const atcBtn = bar.querySelector("#bdm-atc");

  /* ------------------------
     SETTINGS (ATTRIBUTES)
  ------------------------- */
  const showDesktop = bar.hasAttribute("data-enable-desktop");
  const showMobile = bar.hasAttribute("data-enable-mobile");
  const showOnScroll = bar.hasAttribute("data-show-on-scroll");
  const scrollOffset = parseInt(bar.dataset.scrollOffset || "250", 10);

  const showTitle = bar.hasAttribute("data-show-title");
  const showPrice = bar.hasAttribute("data-show-price");
  const showQty = bar.hasAttribute("data-show-qty");

  /* ------------------------
     DEVICE VISIBILITY
  ------------------------- */
  const isMobile = window.matchMedia("(max-width: 768px)").matches;

  if ((isMobile && !showMobile) || (!isMobile && !showDesktop)) {
    bar.style.display = "none";
    return;
  }

  /* ------------------------
     SCROLL VISIBILITY
  ------------------------- */
  function updateScrollVisibility() {
    if (!showOnScroll || window.scrollY >= scrollOffset) {
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
     MAIN PRODUCT FORM
  ------------------------- */
  const productForm =
    document.querySelector('form[action*="/cart/add"]') ||
    document.querySelector("product-form form");

  if (!productForm) return;

  const variantInput = productForm.querySelector('[name="id"]');
  const sellingPlanInput = productForm.querySelector('[name="selling_plan"]');
  const qtyInputMain = productForm.querySelector('[name="quantity"]');

  /* ------------------------
     INITIAL UI VISIBILITY
  ------------------------- */
  if (showTitle && titleEl) titleEl.style.display = "";
  if (showPrice && priceEl) priceEl.style.display = "";
  if (showQty && qtyEl) qtyEl.style.display = "";

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
      }

      function updatePrice(variantId) {
        const variant = product.variants.find(v => v.id == variantId);
        if (!variant || !showPrice || !priceEl) return;

        priceEl.textContent = (variant.price / 100).toLocaleString(undefined, {
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

  /* ------------------------
     QTY SYNC
  ------------------------- */
  const qtyWrapper = bar.querySelector(".bdm-qty");

if (qtyWrapper && qtyEl && qtyInputMain) {
  qtyEl.value = qtyInputMain.value || 1;
  qtyWrapper.style.display = showQty ? "" : "none";

  qtyEl.addEventListener("change", () => {
    qtyInputMain.value = qtyEl.value;
  });
}

bar.querySelectorAll(".bdm-qty-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    let value = parseInt(qtyEl.value || "1", 10);

    if (btn.dataset.action === "increase") value++;
    if (btn.dataset.action === "decrease") value = Math.max(1, value - 1);

    qtyEl.value = value;
    qtyInputMain.value = value;
  });
});


  /* ------------------------
     ADD TO CART
  ------------------------- */
  atcBtn.addEventListener("click", () => {
    if (!variantInput?.value) return;

    const fd = new FormData();
    fd.append("id", variantInput.value);
    fd.append("quantity", qtyEl?.value || qtyInputMain?.value || 1);

    if (sellingPlanInput?.value) {
      fd.append("selling_plan", sellingPlanInput.value);
    }

    fetch("/cart/add.js", {
      method: "POST",
      body: fd,
      headers: { Accept: "application/json" }
    });
  });
})();
