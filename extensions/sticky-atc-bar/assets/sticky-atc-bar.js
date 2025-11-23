// Sticky Add to Cart Bar – Universal + Analytics + Empty Drawer Fix
(function () {

  /* -------------------------------------------------------------
     UNIVERSAL CART REFRESH (fixes empty mobile drawer!)
  ------------------------------------------------------------- */
  async function updateCartIconAndDrawer() {
    let handledByThemeDrawer = false;

    try {
      const rootPath =
        (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) ||
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
        const parsedState = {
          id: Date.now(),
          sections
        };

        const cartDrawer = document.querySelector("cart-drawer");

        if (cartDrawer && typeof cartDrawer.renderContents === "function") {
          // ⭐ FIX: Render entire section (including .drawer__inner-empty)
          const html = sections["cart-drawer"];
          const temp = document.createElement("div");
          temp.innerHTML = html;

          const newInner = temp.querySelector(".drawer__inner");
          const newEmpty = temp.querySelector(".drawer__inner-empty");

          const drawerContainer = document.querySelector("#CartDrawer");

          if (newInner && drawerContainer.querySelector(".drawer__inner")) {
            drawerContainer.querySelector(".drawer__inner").innerHTML =
              newInner.innerHTML;
          }

          if (newEmpty && drawerContainer.querySelector(".drawer__inner-empty")) {
            drawerContainer.querySelector(".drawer__inner-empty").innerHTML =
              newEmpty.innerHTML;
          }

          cartDrawer.open();
          handledByThemeDrawer = true;
        }

        // Update header bubble
        const bubbleContainer = document.getElementById("cart-icon-bubble");
        if (bubbleContainer && sections["cart-icon-bubble"]) {
          const temp = document.createElement("div");
          temp.innerHTML = sections["cart-icon-bubble"];
          const newBubble = temp.querySelector("#cart-icon-bubble");
          if (newBubble) {
            bubbleContainer.replaceWith(newBubble);
          }
        }
      }
    } catch (err) {
      console.warn("Theme drawer refresh failed:", err);
    }

    /* fallback item-count update */
    try {
      const cart = await fetch("/cart.js").then(res => res.json());
      const count = cart.item_count;

      document.querySelectorAll(".cart-count, .cart-count-bubble, [data-cart-count]")
        .forEach(el => { el.textContent = count; });

    } catch (err) {
      console.warn("Fallback cart count update failed:", err);
    }

    /* Non-Dawn fallback drawer open */
    if (!handledByThemeDrawer) {
      const drawerToggle =
        document.querySelector('[data-cart-toggle]') ||
        document.querySelector('[data-drawer-toggle]') ||
        document.querySelector('.js-cart-toggle') ||
        document.querySelector('.js-drawer-open-cart') ||
        document.querySelector('[aria-controls="CartDrawer"]') ||
        document.querySelector('#cart-icon-bubble');

      if (drawerToggle) {
        drawerToggle.dispatchEvent(new Event("click", { bubbles: true }));
      }
    }
  }


  /* -------------------------------------------------------------
     STICKY BAR (unchanged from working version)
  ------------------------------------------------------------- */

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

    const formatMoney = (cents) =>
      (cents / 100).toLocaleString(undefined, {
        style: "currency",
        currency: Shopify?.currency?.active || "USD"
      });

    let currentPrice = findVariantById(currentVariantId)?.price;

    const bar = document.createElement("div");
    bar.className = "bdm-sticky-atc-bar-container";
    const inner = document.createElement("div");
    inner.className = "bdm-sticky-atc-bar-inner";

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
        titleEl.style.display = "none";
        const mobileVariantRow = document.createElement("div");
        mobileVariantRow.className = "bdm-variant-mobile-row";
        mobileVariantRow.appendChild(select);
        productInfo.insertBefore(mobileVariantRow, priceEl);
      } else {
        variantWrapper.appendChild(select);
      }
    }

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

    minusBtn.addEventListener("click", () =>
      (qtyInput.value = Math.max(1, Number(qtyInput.value) - 1))
    );
    plusBtn.addEventListener("click", () =>
      (qtyInput.value = Number(qtyInput.value) + 1)
    );

    qtyWrapper.append(minusBtn, qtyInput, plusBtn);

    const atcButton = document.createElement("button");
    atcButton.className = "bdm-sticky-atc-button";
    atcButton.textContent = "Add to cart";

    atcButton.addEventListener("click", async () => {
      if (!currentVariantId) return alert("Unable to determine variant.");

      const res = await fetch("/cart/add.js", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          id: currentVariantId,
          quantity: Number(qtyInput.value) || 1
        })
      });

      if (!res.ok) return alert("Add to cart failed.");

      updateCartIconAndDrawer();
    });

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
