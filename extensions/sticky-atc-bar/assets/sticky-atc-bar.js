// Sticky Add to Cart Bar – Desktop vA + Compact Mobile (Final Stable Version)
(function () {

  /* ===========================================================
     UNIVERSAL CART UPDATE (works on almost all Shopify themes)
     =========================================================== */
  function updateCartIconAndDrawer() {
    try {
      // Trigger common theme events
      document.dispatchEvent(new CustomEvent("cart:refresh"));
      document.dispatchEvent(new CustomEvent("cart:update"));
      document.dispatchEvent(new CustomEvent("cart:changed"));

      if (window.fetchCart) window.fetchCart();
      if (window.updateCart) window.updateCart();
      if (window.refreshCart) window.refreshCart();

      // Refresh cart count bubbles
      fetch("/cart.js")
        .then((res) => res.json())
        .then((cart) => {
          const countEls = document.querySelectorAll(
            ".cart-count, .cart-count-bubble, [data-cart-count]"
          );

          countEls.forEach((el) => {
            el.textContent = cart.item_count;
            el.dataset.cartCount = cart.item_count;
          });
        });

      // Try to open/update drawer if present
      const cartToggle =
        document.querySelector("[data-cart-toggle]") ||
        document.querySelector("[data-drawer-toggle]") ||
        document.querySelector('[aria-controls="CartDrawer"]') ||
        document.querySelector(".js-cart-toggle");

      if (cartToggle) cartToggle.click();
    } catch (e) {
      console.warn("Universal cart update failed", e);
    }
  }

  /* ===============================
       MAIN BAR INITIALIZATION
     =============================== */
  function initStickyBar() {
    const root = document.getElementById("bdm-sticky-atc-bar-root");
    if (!root) return;

    const productForm = document.querySelector('form[action*="/cart/add"]');
    if (!productForm) return;

    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    const productTitle = root.dataset.productTitle || document.title;

    let variants = window.ShopifyAnalytics?.meta?.product?.variants || [];
    const hasVariants = variants.length > 1;

    const variantSelectOnPage = productForm.querySelector("select[name='id']");
    let currentVariantId = variantSelectOnPage
      ? variantSelectOnPage.value
      : variants[0]?.id;

    // === Strong fallback for single-variant products ===
    if (!currentVariantId) {
      const fallback = productForm.querySelector("input[name='id'], select[name='id']");
      if (fallback) currentVariantId = fallback.value;
    }
    if (!currentVariantId && variants.length === 1) {
      currentVariantId = variants[0].id;
    }

    const findVariantById = (id) =>
      variants.find((v) => String(v.id) === String(id));

    const formatMoney = (cents) => {
      const safe = typeof cents === "number" ? cents : 0;
      return (safe / 100).toLocaleString(undefined, {
        style: "currency",
        currency: Shopify?.currency?.active || "USD",
      });
    };

    let currentPrice = findVariantById(currentVariantId)?.price;

    /* ===============================
         BAR STRUCTURE
       =============================== */

    const bar = document.createElement("div");
    bar.className = "bdm-sticky-atc-bar-container";

    const inner = document.createElement("div");
    inner.className = "bdm-sticky-atc-bar-inner";

    /* PRODUCT INFO */
    const productInfo = document.createElement("div");
    productInfo.className = "bdm-sticky-atc-product";

    const titleEl = document.createElement("div");
    titleEl.className = "bdm-sticky-atc-title";
    titleEl.textContent = productTitle;

    const priceEl = document.createElement("div");
    priceEl.className = "bdm-sticky-atc-price";
    priceEl.textContent = formatMoney(currentPrice);

    productInfo.append(titleEl, priceEl);

    /* VARIANT SELECTOR */
    const variantWrapper = document.createElement("div");
    variantWrapper.className = "bdm-sticky-atc-variant";

    if (hasVariants) {
      const select = document.createElement("select");
      select.className = "bdm-sticky-atc-variant-select";

      variants.forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v.id;
        opt.textContent = v.public_title || v.title;
        select.appendChild(opt);
      });

      select.value = currentVariantId;

      select.addEventListener("change", () => {
        currentVariantId = select.value;
        const v = findVariantById(currentVariantId);
        if (v) priceEl.textContent = formatMoney(v.price);

        if (variantSelectOnPage) {
          variantSelectOnPage.value = currentVariantId;
          variantSelectOnPage.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });

      if (isMobile) {
        titleEl.style.display = "none"; // mobile hide title
        const mobileVariantRow = document.createElement("div");
        mobileVariantRow.className = "bdm-variant-mobile-row";
        mobileVariantRow.appendChild(select);
        productInfo.insertBefore(mobileVariantRow, priceEl);
      } else {
        variantWrapper.appendChild(select);
      }
    }

    /* QUANTITY CONTROLS */
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

    minusBtn.onclick = () => {
      qtyInput.value = Math.max(1, Number(qtyInput.value) - 1);
    };
    plusBtn.onclick = () => {
      qtyInput.value = Number(qtyInput.value) + 1;
    };

    qtyWrapper.append(minusBtn, qtyInput, plusBtn);

    /* ADD TO CART BUTTON */
    const atcButton = document.createElement("button");
    atcButton.className = "bdm-sticky-atc-button";
    atcButton.textContent = "Add to cart";

    atcButton.addEventListener("click", async () => {
      // FINAL UNIVERSAL VARIANT FALLBACK
      if (!currentVariantId) {
        const fallback1 = productForm.querySelector("input[name='id'], select[name='id']");
        if (fallback1) currentVariantId = fallback1.value;
      }
      if (!currentVariantId && variants.length === 1) {
        currentVariantId = variants[0].id;
      }

      if (!currentVariantId) {
        alert("Unable to determine variant.");
        return;
      }

      const quantity = Math.max(1, Number(qtyInput.value));

      const res = await fetch("/cart/add.js", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ id: currentVariantId, quantity }),
      });

      if (!res.ok) {
        console.error(await res.text());
        alert("Could not add to cart.");
        return;
      }

      updateCartIconAndDrawer();
    });

    /* CONTROLS ROW */
    const controls = document.createElement("div");
    controls.className = "bdm-sticky-atc-controls";

    if (!isMobile && hasVariants) {
      controls.append(variantWrapper, qtyWrapper, atcButton);
    } else {
      controls.append(qtyWrapper, atcButton);
    }

    inner.append(productInfo, controls);
    bar.appendChild(inner);
    document.body.appendChild(bar);
  }

  /* INIT */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initStickyBar);
  } else {
    initStickyBar();
  }
})();
