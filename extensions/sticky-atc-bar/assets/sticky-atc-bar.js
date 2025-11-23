// Sticky Add to Cart Bar – Desktop vA + Compact Mobile (Universal-Compatible)
(function () {
  /* =========================================
     CART REFRESH: theme-aware + universal fallback
     ========================================= */
  async function updateCartIconAndDrawer() {
    let handledByThemeDrawer = false;

    // ----- TIER 1: Dawn-style theme with sections (cart-drawer + cart-icon-bubble) -----
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
        /* -----------------------------
           Detect EMPTY CART case
        ----------------------------- */
        const isEmpty =
          sections["cart-drawer"] &&
          sections["cart-drawer"].includes("is-empty");

        /* -----------------------------
           Update cart bubble
        ----------------------------- */
        const bubbleContainer = document.getElementById("cart-icon-bubble");
        if (bubbleContainer && sections["cart-icon-bubble"]) {
          const temp = document.createElement("div");
          temp.innerHTML = sections["cart-icon-bubble"];
          const newBubble = temp.querySelector("#cart-icon-bubble");
          if (newBubble) bubbleContainer.replaceWith(newBubble);
        }

        /* -----------------------------
           If EMPTY CART → DO NOT open drawer
        ----------------------------- */
        if (!isEmpty) {
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
        }
      }
    } catch (err) {
      console.warn(
        "Theme-specific cart drawer refresh via sections failed:",
        err
      );
    }

    // ----- TIER 2: Universal fallback (any theme) -----
    try {
      const cart = await fetch("/cart.js").then((r) => r.json());
      const count = cart.item_count;

      // Update cart counters
      const countEls = document.querySelectorAll(
        ".cart-count, .cart-count-bubble, [data-cart-count]"
      );

      countEls.forEach((el) => {
        el.textContent = count;
        el.dataset.cartCount = count;

        if (count > 0) {
          el.removeAttribute("hidden");
          el.classList.remove("is-empty");
        } else {
          el.classList.add("is-empty");
        }
      });

      // Trigger theme events many themes hook into
      document.dispatchEvent(
        new CustomEvent("cart:refresh", { detail: { cart } })
      );

      if (typeof window.fetchCart === "function") window.fetchCart();
      if (typeof window.updateCart === "function") window.updateCart();
    } catch (err) {
      console.warn("Universal cart refresh failed:", err);
    }

    // If theme drawer already handled → done
    if (handledByThemeDrawer) return;

    /* ----- TIER 3: Non-Dawn themes → open mini-cart IF NOT empty ----- */
    try {
      const cart = await fetch("/cart.js").then((r) => r.json());
      if (cart.item_count === 0) return; // Prevent blank drawer on mobile

      const toggle =
        document.querySelector('[data-cart-toggle]') ||
        document.querySelector('[data-drawer-toggle]') ||
        document.querySelector(".js-cart-toggle") ||
        document.querySelector(".js-drawer-open-cart") ||
        document.querySelector('[aria-controls="CartDrawer"]') ||
        document.querySelector("#cart-icon-bubble");

      if (toggle) {
        toggle.dispatchEvent(new Event("click", { bubbles: true }));
      }
    } catch (err) {
      console.warn("Fallback drawer open failed:", err);
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

      updateCartIconAndDrawer();
    });

    // ========= CONTROLS LAYOUT =========
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
