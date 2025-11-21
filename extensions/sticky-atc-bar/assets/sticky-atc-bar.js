// Sticky Add to Cart Bar JS (mobile-optimized)
(function () {
  function updateCartIconAndDrawer() {
    document.dispatchEvent(new CustomEvent("cart:refresh"));
    if (window.fetchCart) window.fetchCart();
    if (window.updateCart) window.updateCart();

    fetch("/cart.js")
      .then(res => res.json())
      .then(cart => {
        const els = document.querySelectorAll(".cart-count, .cart-count-bubble, [data-cart-count]");
        els.forEach(el => {
          el.textContent = cart.item_count;
          el.dataset.cartCount = cart.item_count;
        });
      });
  }

  function initStickyBar() {
    const root = document.getElementById("bdm-sticky-atc-bar-root");
    if (!root) return;

    const productForm = document.querySelector('form[action*="/cart/add"]');
    if (!productForm) return;

    const productTitle = root.dataset.productTitle;
    let variants = window.ShopifyAnalytics?.meta?.product?.variants || [];
    const variantSelect = productForm.querySelector("select[name='id']");
    let currentVariantId = variantSelect ? variantSelect.value : variants[0]?.id;
    const findVariantById = id => variants.find(v => String(v.id) === String(id));
    const formatMoney = cents => (cents / 100).toLocaleString(undefined, { style: "currency", currency: Shopify.currency.active });

    let currentPrice = findVariantById(currentVariantId)?.price;

    // BAR CONTAINER
    const bar = document.createElement("div");
    bar.className = "bdm-sticky-atc-bar-container";

    const inner = document.createElement("div");
    inner.className = "bdm-sticky-atc-bar-inner";

    // PRODUCT INFO
    const productInfo = document.createElement("div");
    productInfo.className = "bdm-sticky-atc-product";
    productInfo.innerHTML = `
      <div class="bdm-sticky-atc-title">${productTitle}</div>
      <div class="bdm-sticky-atc-price">${formatMoney(currentPrice)}</div>
    `;

    // CONTROLS
    const controls = document.createElement("div");
    controls.className = "bdm-sticky-atc-controls";

    // VARIANT SELECTOR (mobile fix: ALWAYS render when > 1 variant)
    const variantWrapper = document.createElement("div");
    variantWrapper.className = "bdm-sticky-atc-variant";

    if (variants.length > 1) {
      const mobileSelect = document.createElement("select");
      mobileSelect.className = "bdm-sticky-atc-variant-select";

      variants.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v.id;
        opt.textContent = v.public_title || v.title;
        if (String(v.id) === String(currentVariantId)) opt.selected = true;
        mobileSelect.appendChild(opt);
      });

      mobileSelect.addEventListener("change", () => {
        currentVariantId = mobileSelect.value;
        const v = findVariantById(currentVariantId);
        currentPrice = v?.price;
        productInfo.querySelector(".bdm-sticky-atc-price").textContent = formatMoney(currentPrice);

        if (variantSelect) {
          variantSelect.value = currentVariantId;
          variantSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });

      variantWrapper.appendChild(mobileSelect);
    }

    // QUANTITY
    const qtyWrapper = document.createElement("div");
    qtyWrapper.className = "bdm-sticky-atc-qty";

    const minusBtn = document.createElement("button");
    minusBtn.className = "bdm-qty-btn";
    minusBtn.textContent = "−";

    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.min = "1";
    qtyInput.value = "1";
    qtyInput.className = "bdm-qty-input";

    const plusBtn = document.createElement("button");
    plusBtn.className = "bdm-qty-btn";
    plusBtn.textContent = "+";

    minusBtn.onclick = () => qtyInput.value = Math.max(1, qtyInput.value - 1);
    plusBtn.onclick = () => qtyInput.value = Number(qtyInput.value) + 1;

    qtyWrapper.append(minusBtn, qtyInput, plusBtn);

    // ADD TO CART BUTTON
    const atcButton = document.createElement("button");
    atcButton.className = "bdm-sticky-atc-button";
    atcButton.textContent = "Add to cart";

    atcButton.addEventListener("click", async () => {
      const res = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          id: currentVariantId,
          quantity: Number(qtyInput.value)
        })
      });

      if (res.ok) updateCartIconAndDrawer();
    });

    controls.append(variantWrapper, qtyWrapper, atcButton);

    inner.append(productInfo, controls);
    bar.appendChild(inner);
    document.body.appendChild(bar);
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", initStickyBar)
    : initStickyBar();
})();
