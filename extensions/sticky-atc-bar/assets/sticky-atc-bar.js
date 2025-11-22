// Sticky Add to Cart Bar – Desktop vA + Compact Mobile
(function () {
  /* =========================================
     CART REFRESH: use theme's CartDrawer
     ========================================= */
  async function updateCartIconAndDrawer() {
    try {
      const rootPath = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';

      // Fetch updated HTML for cart drawer + header cart icon section
      const sectionsRes = await fetch(
        `${rootPath}?sections=cart-drawer,cart-icon-bubble`
      );
      const sections = await sectionsRes.json();

      const parsedState = {
        id: Date.now(), // not really used by your CartDrawer, but required property
        sections
      };

      const cartDrawer = document.querySelector('cart-drawer');

      if (cartDrawer && typeof cartDrawer.renderContents === 'function') {
        // This will update #CartDrawer and #cart-icon-bubble and then open the drawer
        cartDrawer.renderContents(parsedState);
      } else {
        // Fallback: at least update the cart icon bubble HTML
        const bubbleContainer = document.getElementById('cart-icon-bubble');
        if (bubbleContainer && sections['cart-icon-bubble']) {
          const temp = document.createElement('div');
          temp.innerHTML = sections['cart-icon-bubble'];
          const newBubble = temp.querySelector('#cart-icon-bubble');
          if (newBubble) bubbleContainer.replaceWith(newBubble);
        }
      }
    } catch (err) {
      console.error('Error updating cart drawer/icon from sticky bar:', err);
    }
  }

  /* =========================================
     STICKY BAR INITIALISATION
     ========================================= */
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

    // Fallback for single-variant products
    if (!currentVariantId) {
      const fallback = productForm.querySelector("[name='id']");
      if (fallback) currentVariantId = fallback.value;
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

    // ========= BAR CONTAINER =========
    const bar = document.createElement("div");
    bar.className = "bdm-sticky-atc-bar-container";

    const inner = document.createElement("div");
    inner.className = "bdm-sticky-atc-bar-inner";

    // ========= PRODUCT INFO (Title + Price) =========
    const productInfo = document.createElement("div");
    productInfo.className = "bdm-sticky-atc-product";

    const titleEl = document.createElement("div");
    titleEl.className = "bdm-sticky-atc-title";
    titleEl.textContent = productTitle;

    const priceEl = document.createElement("div");
    priceEl.className = "bdm-sticky-atc-price";
    priceEl.textContent = formatMoney(currentPrice);

    productInfo.appendChild(titleEl);
    productInfo.appendChild(priceEl);

    // ========= VARIANT SELECTOR =========
    const variantWrapper = document.createElement("div");
    variantWrapper.className = "bdm-sticky-atc-variant";

    if (hasVariants) {
      const select = document.createElement("select");
      select.className = "bdm-sticky-atc-variant-select";

      variants.forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v.id;
        opt.textContent = v.public_title || v.title || `Variant ${v.id}`;
        select.appendChild(opt);
      });

      select.value = currentVariantId;

      select.addEventListener("change", () => {
        currentVariantId = select.value;
        const v = findVariantById(currentVariantId);
        if (v) {
          currentPrice = v.price;
          priceEl.textContent = formatMoney(currentPrice);
        }

        // Sync native product form
        if (variantSelectOnPage) {
          variantSelectOnPage.value = currentVariantId;
          variantSelectOnPage.dispatchEvent(
            new Event("change", { bubbles: true })
          );
        }
      });

      // Desktop: variant selector in controls row
      // Mobile: variant selector goes where the title was (to save vertical space)
      if (isMobile) {
        titleEl.style.display = "none"; // hide title on mobile when variants exist
        const mobileVariantRow = document.createElement("div");
        mobileVariantRow.className = "bdm-variant-mobile-row";
        mobileVariantRow.appendChild(select);
        // Insert variant row where title was
        productInfo.insertBefore(mobileVariantRow, priceEl);
      } else {
        variantWrapper.appendChild(select);
      }
    }

    // ========= QUANTITY CONTROLS =========
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

    minusBtn.addEventListener("click", () => {
      qtyInput.value = Math.max(1, Number(qtyInput.value) - 1);
    });

    plusBtn.addEventListener("click", () => {
      qtyInput.value = Number(qtyInput.value) + 1;
    });

    qtyWrapper.append(minusBtn, qtyInput, plusBtn);

    // ========= ADD TO CART BUTTON =========
    const atcButton = document.createElement("button");
    atcButton.className = "bdm-sticky-atc-button";
    atcButton.textContent = "Add to cart";

    atcButton.addEventListener("click", async () => {
      // Final safety fallback
      if (!currentVariantId) {
        const fallback = productForm.querySelector("[name='id']");
        if (fallback) currentVariantId = fallback.value;
      }
      if (!currentVariantId) {
        alert("Unable to determine variant.");
        return;
      }

      const quantity = Math.max(1, Number(qtyInput.value) || 1);

      const res = await fetch("/cart/add.js", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ id: currentVariantId, quantity }),
      });

      if (!res.ok) {
        console.error("Cart add error", await res.text());
        alert("Could not add to cart. Please try again.");
        return;
      }

      // Now refresh drawer + icon via theme's own CartDrawer
      updateCartIconAndDrawer();
    });

    // ========= CONTROLS LAYOUT =========
    const controls = document.createElement("div");
    controls.className = "bdm-sticky-atc-controls";

    if (!isMobile && hasVariants) {
      // Desktop Version A: variant + qty + button
      controls.append(variantWrapper, qtyWrapper, atcButton);
    } else {
      // Mobile (variant already moved up) or no variants
      controls.append(qtyWrapper, atcButton);
    }

    inner.append(productInfo, controls);
    bar.appendChild(inner);
    document.body.appendChild(bar);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initStickyBar);
  } else {
    initStickyBar();
  }
})();
