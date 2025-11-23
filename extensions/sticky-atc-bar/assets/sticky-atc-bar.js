// Sticky Add to Cart Bar – Desktop vA + Compact Mobile (Universal-Compatible)
(function () {
  /* =========================================
       CART REFRESH: theme-aware + universal fallback
       ========================================= */
  async function updateCartIconAndDrawer() {
    let handledByThemeDrawer = false;

    let isEmpty = false;

    // ----- TIER 1: Dawn-style theme refresh (cart drawer + icon bubble) -----
    try {
      const rootPath =
        (window.Shopify &&
          window.Shopify.routes &&
          window.Shopify.routes.root) ||
        "/";

      const sectionsRes = await fetch(
        `${rootPath}?sections=cart-drawer,cart-icon-bubble`
      );

      let sections = null;
      try {
        sections = await sectionsRes.json();
      } catch (e) {
        sections = null;
      }

      if (sections) {
        // Determine empty status
        try {
          const cart = await fetch("/cart.js").then((r) => r.json());
          isEmpty = cart.item_count === 0;
        } catch (e) {}

        // === Always render drawer contents (important!) ===
        const cartDrawer = document.querySelector("cart-drawer");

        if (
          cartDrawer &&
          typeof cartDrawer.renderContents === "function" &&
          sections["cart-drawer"]
        ) {
          cartDrawer.renderContents({
            id: Date.now(),
            sections,
          });
          handledByThemeDrawer = true;
        }

        // === Cart icon bubble ===
        const bubbleContainer = document.getElementById("cart-icon-bubble");
        if (bubbleContainer && sections["cart-icon-bubble"]) {
          const temp = document.createElement("div");
          temp.innerHTML = sections["cart-icon-bubble"];
          const newBubble = temp.querySelector("#cart-icon-bubble");
          if (newBubble) bubbleContainer.replaceWith(newBubble);
          handledByThemeDrawer = true;
        }

        // === NEW FIX: Do not auto-open on mobile if empty ===
        if (isEmpty && window.matchMedia("(max-width: 768px)").matches) {
          return; // drawer updated, but do NOT open it
        }
      }
    } catch (err) {
      console.warn("Theme drawer refresh failed:", err);
    }

    // ----- TIER 2: Universal fallback cart counters -----
    try {
      const cart = await fetch("/cart.js").then((r) => r.json());
      const count = cart.item_count;

      const countEls = document.querySelectorAll(
        ".cart-count, .cart-count-bubble, [data-cart-count]"
      );
      countEls.forEach((el) => {
        el.textContent = count;
        el.dataset.cartCount = count;

        if (count > 0) {
          el.removeAttribute("hidden");
          el.setAttribute("aria-hidden", "false");
          el.classList.remove("is-empty");
        } else {
          el.setAttribute("aria-hidden", "true");
          el.classList.add("is-empty");
        }
      });

      document.dispatchEvent(
        new CustomEvent("cart:refresh", { detail: { cart } })
      );
      if (typeof window.updateCart === "function") window.updateCart();
      if (typeof window.refreshCart === "function") window.refreshCart();
    } catch (err) {
      console.warn("Universal cart refresh failed:", err);
    }

    // ----- TIER 3: Non-Dawn fallback (mini-cart/drawer) -----
    try {
      if (handledByThemeDrawer) return;

      const drawerToggle =
        document.querySelector('[data-cart-toggle]') ||
        document.querySelector('[data-drawer-toggle]') ||
        document.querySelector(".js-cart-toggle") ||
        document.querySelector(".js-drawer-open-cart") ||
        document.querySelector('[aria-controls="CartDrawer"]') ||
        document.querySelector("#cart-icon-bubble");

      if (drawerToggle) {
        drawerToggle.dispatchEvent(
          new Event("click", { bubbles: true, cancelable: true })
        );
      }
    } catch (err) {
      console.warn("Mini-cart open failed:", err);
    }
  }

  /* =========================================
       STICKY BAR INITIALIZATION
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

    // Fallback for single variant
    if (!currentVariantId) {
      const fallback = productForm.querySelector("[name='id']");
      if (fallback) currentVariantId = fallback.value;
    }

    const findVariantById = (id) =>
      variants.find((v) => String(v.id) === String(id));

    const formatMoney = (cents) =>
      ((typeof cents === "number" ? cents : 0) / 100).toLocaleString(
        undefined,
        {
          style: "currency",
          currency: Shopify?.currency?.active || "USD",
        }
      );

    let currentPrice = findVariantById(currentVariantId)?.price;

    // ========= Bar container =========
    const bar = document.createElement("div");
    bar.className = "bdm-sticky-atc-bar-container";

    const inner = document.createElement("div");
    inner.className = "bdm-sticky-atc-bar-inner";

    // ========= Product info =========
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

    // ========= Variant selector =========
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

        if (variantSelectOnPage) {
          variantSelectOnPage.value = currentVariantId;
          variantSelectOnPage.dispatchEvent(
            new Event("change", { bubbles: true })
          );
        }
      });

      if (isMobile) {
        titleEl.style.display = "none";
        const mobileVariantRow = document.createElement("div");
        mobileVariantRow.className = "bdm-variant-mobile-row";
        mobileVariantRow.appendChild(select);
        productInfo.insertBefore(mobileVariantRow, priceEl);
      } else {
        variantWrapper.appendChild(select);
      }
    }

    // ========= Quantity controls =========
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

    // ========= Add to cart =========
    const atcButton = document.createElement("button");
    atcButton.className = "bdm-sticky-atc-button";
    atcButton.textContent = "Add to cart";

    atcButton.addEventListener("click", async () => {
      if (!currentVariantId) {
        const fallback = productForm.querySelector("[name='id']");
        if (fallback) currentVariantId = fallback.value;
      }
      if (!currentVariantId) return alert("Unable to determine variant.");

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
        console.error("ATC error:", await res.text());
        return alert("Could not add to cart.");
      }

      updateCartIconAndDrawer();
    });

    // ========= Layout =========
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initStickyBar);
  } else {
    initStickyBar();
  }
})();
