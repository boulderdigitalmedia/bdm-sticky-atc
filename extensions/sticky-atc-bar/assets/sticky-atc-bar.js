(() => {
  if (window.__BDM_STICKY_ATC_INIT__) return;
  window.__BDM_STICKY_ATC_INIT__ = true;

  document.addEventListener("DOMContentLoaded", () => {
    const bar = document.getElementById("bdm-sticky-atc");
    if (!bar) return;

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
       DEVICE VISIBILITY (NON-DESTRUCTIVE)
    ------------------------- */
    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    if ((isMobile && !showMobile) || (!isMobile && !showDesktop)) {
      bar.setAttribute("hidden", "");
      return;
    } else {
      bar.removeAttribute("hidden");
    }

    /* ------------------------
       SCROLL VISIBILITY
    ------------------------- */
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
       BAR ELEMENTS
    ------------------------- */
    const titleEl = bar.querySelector("#bdm-title");
    const priceEl = bar.querySelector("#bdm-price");
    const qtyWrapper = bar.querySelector(".bdm-qty");
    const qtyEl = bar.querySelector("#bdm-qty");
    const atcBtn = bar.querySelector("#bdm-atc");

    /* ------------------------
       INITIAL VISIBILITY
    ------------------------- */
    if (titleEl) titleEl.style.display = showTitle ? "" : "none";
    if (priceEl) priceEl.style.display = showPrice ? "" : "none";
    if (qtyWrapper) qtyWrapper.style.display = showQty ? "inline-flex" : "none";

    /* ------------------------
       PRODUCT DATA (SOURCE OF TRUTH)
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

        const updatePrice = (variantId) => {
          const variant = product.variants.find(v => v.id == variantId);
          if (!variant || !showPrice || !priceEl) return;

          priceEl.textContent = (variant.price / 100).toLocaleString(undefined, {
            style: "currency",
            currency: product.currency || "USD"
          });
        };

        if (variantInput?.value) {
          updatePrice(variantInput.value);
        }

        variantInput?.addEventListener("change", e => {
          updatePrice(e.target.value);
        });
      });

    /* ------------------------
       QTY SYNC + STEPPER
    ------------------------- */
    let currentQty = 1;

if (qtyWrapper && qtyEl) {
  qtyWrapper.style.display = showQty ? "inline-flex" : "none";
  qtyEl.value = currentQty;

  qtyEl.addEventListener("change", () => {
    currentQty = Math.max(1, parseInt(qtyEl.value || "1", 10));
    qtyEl.value = currentQty;
  });

  bar.querySelectorAll(".bdm-qty-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.dataset.action === "increase") currentQty++;
      if (btn.dataset.action === "decrease") currentQty = Math.max(1, currentQty - 1);

      qtyEl.value = currentQty;
    });
  });
}


    /* ------------------------
       ADD TO CART
    ------------------------- */
atcBtn.addEventListener("click", async () => {
  if (!variantInput?.value) return;

  const fd = new FormData();
  fd.append("id", variantInput.value);
  fd.append("quantity", currentQty);

  if (sellingPlanInput?.value) {
    fd.append("selling_plan", sellingPlanInput.value);
  }

  const res = await fetch("/cart/add.js", {
    method: "POST",
    body: fd,
    headers: { Accept: "application/json" }
  });

  if (!res.ok) return;

  // 🔔 Let Shopify/theme know cart changed
  document.dispatchEvent(new CustomEvent("cart:refresh", { bubbles: true }));
  document.dispatchEvent(new CustomEvent("cart:updated", { bubbles: true }));

  // Dawn / modern themes
  document.dispatchEvent(new Event("cart-drawer-open", { bubbles: true }));
});
