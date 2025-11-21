// Sticky Add To Cart Bar — Full Version With Cart Drawer + Icon auto-refresh + Safe z-index
(function () {

  /* ---------------------------------------------
      UNIVERSAL CART UPDATE HANDLER
  ---------------------------------------------- */
  async function refreshCartUI() {
    // 1. Update the cart bubble/icon (even when cart is empty)
    try {
      const cart = await fetch("/cart.js").then(r => r.json());

      const countEls = document.querySelectorAll(
        ".cart-count, .cart-count-bubble, [data-cart-count]"
      );

      countEls.forEach(el => {
        el.textContent = cart.item_count;
        el.dataset.cartCount = cart.item_count;
      });

      // Dawn theme triggers cart bubble refresh event
      document.dispatchEvent(
        new CustomEvent("cart:refresh", { detail: { cart } })
      );
    } catch (e) {
      console.warn("Cart icon refresh error:", e);
    }

    // 2. Update AJAX cart drawer (Dawn + most themes)
    const drawer = document.querySelector("cart-drawer, .cart-drawer, #CartDrawer");
    if (drawer) {
      try {
        // Dawn uses this method
        if (drawer.renderContents) {
          const sections = await fetch("/?sections=cart-drawer");
          const html = await sections.json();
          drawer.renderContents(html["cart-drawer"]);
        }
      } catch (e) {
        console.warn("Cart drawer refresh failed:", e);
      }
    }
  }


  /* ---------------------------------------------
      INITIALIZATION
  ---------------------------------------------- */
  function initStickyBar() {
    const root = document.getElementById("bdm-sticky-atc-bar-root");
    if (!root) return;

    const productForm = document.querySelector('form[action*="/cart/add"]');
    if (!productForm) return;

    const productTitle = root.dataset.productTitle;
    let variants = window.ShopifyAnalytics?.meta?.product?.variants || [];

    const variantSelect = productForm.querySelector("select[name='id']");
    let currentVariantId = variantSelect ? variantSelect.value : variants[0]?.id;

    const findVariantById = id =>
      variants.find(v => String(v.id) === String(id));

    const formatMoney = cents =>
      (cents / 100).toLocaleString(undefined, {
        style: "currency",
        currency: Shopify.currency.active
      });

    let currentPrice = findVariantById(currentVariantId)?.price;

    /* ---------------------------------------------
        BUILD BAR HTML
    ---------------------------------------------- */
    const bar = document.createElement("div");
    bar.className = "bdm-sticky-atc-bar-container";

    const inner = document.createElement("div");
    inner.className = "bdm-sticky-atc-bar-inner";

    /* TITLE + PRICE */
    const productInfo = document.createElement("div");
    productInfo.className = "bdm-sticky-atc-product";
    productInfo.innerHTML = `
      <div class="bdm-sticky-atc-title">${productTitle}</div>
      <div class="bdm-sticky-atc-price">${formatMoney(currentPrice)}</div>
    `;

    /* CONTROLS WRAPPER */
    const controls = document.createElement("div");
    controls.className = "bdm-sticky-atc-controls";

    /* VARIANT SELECTOR */
    const variantWrapper = document.createElement("div");
    variantWrapper.className = "bdm-sticky-atc-variant";

    if (variants.length > 1) {
      const select = document.createElement("select");
      select.className = "bdm-sticky-atc-variant-select";

      variants.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v.id;
        opt.textContent = v.public_title || v.title;
        if (String(v.id) === String(currentVariantId)) opt.selected = true;
        select.appendChild(opt);
      });

      select.addEventListener("change", () => {
        currentVariantId = select.value;
        let v = findVariantById(currentVariantId);
        currentPrice = v.price;
        productInfo.querySelector(".bdm-sticky-atc-price").textContent =
          formatMoney(currentPrice);

        if (variantSelect) {
          variantSelect.value = currentVariantId;
          variantSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }

        // Hide title on mobile when variants exist
        document.body.classList.add("bdm-hide-title-mobile");
      });

      variantWrapper.appendChild(select);
    }

    /* QUANTITY */
    const qtyWrapper = document.createElement("div");
    qtyWrapper.className = "bdm-sticky-atc-qty";

    const minusBtn = document.createElement("button");
    minusBtn.className = "bdm-qty-btn";
    minusBtn.textContent = "−";

    const qtyInput = document.createElement("input");
    qtyInput.className = "bdm-qty-input";
    qtyInput.type = "number";
    qtyInput.min = "1";
    qtyInput.value = "1";

    const plusBtn = document.createElement("button");
    plusBtn.className = "bdm-qty-btn";
    plusBtn.textContent = "+";

    minusBtn.onclick = () => qtyInput.value = Math.max(1, qtyInput.value - 1);
    plusBtn.onclick = () => qtyInput.value = Number(qtyInput.value) + 1;

    qtyWrapper.append(minusBtn, qtyInput, plusBtn);

    /* ADD TO CART BUTTON */
    const atcButton = document.createElement("button");
    atcButton.className = "bdm-sticky-atc-button";
    atcButton.textContent = "Add to cart";

    atcButton.addEventListener("click", async () => {
      const payload = {
        id: currentVariantId,
        quantity: Number(qtyInput.value)
      };

      const res = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) return alert("Could not add to cart");

      refreshCartUI();
    });

    controls.append(variantWrapper, qtyWrapper, atcButton);
    inner.append(productInfo, controls);
    bar.appendChild(inner);
    document.body.appendChild(bar);

    // Apply mobile title hiding if variants exist
    if (variants.length > 1) {
      document.body.classList.add("bdm-hide-title-mobile");
    }
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", initStickyBar)
    : initStickyBar();

})();
