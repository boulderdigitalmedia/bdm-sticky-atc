// Sticky Add to Cart Bar – Full Universal Version w/ Analytics + Conversion Attribution
(function () {
  /* ----------------------------------------
     ANALYTICS (per-shop metrics)
  -----------------------------------------*/
  function sendAnalytics(event, payload = {}) {
    try {
      fetch("https://sticky-add-to-cart-bar-pro.onrender.com/apps/bdm-sticky-atc/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event,
          shop: Shopify?.shop,
          product: window.ShopifyAnalytics?.meta?.product?.id,
          timestamp: Date.now(),
          ...payload,
        }),
      });
    } catch (err) {
      console.warn("Analytics error:", err);
    }
  }

  // Fire pageview immediately
  sendAnalytics("page_view");

  /* ----------------------------------------
     CART REFRESH (Dawn + Universal)
  -----------------------------------------*/
  async function updateCartIconAndDrawer() {
    let handledByThemeDrawer = false;

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
        const parsedState = {
          id: Date.now(),
          sections,
        };

        const cartDrawer = document.querySelector("cart-drawer");

        if (
          cartDrawer &&
          typeof cartDrawer.renderContents === "function" &&
          sections["cart-drawer"]
        ) {
          cartDrawer.renderContents(parsedState);

          try {
            const cart = await fetch("/cart.js").then((r) => r.json());
            cartDrawer.classList.toggle("is-empty", cart.item_count === 0);
          } catch (e) {}

          handledByThemeDrawer = true;
        }

        const bubbleContainer = document.getElementById("cart-icon-bubble");
        if (bubbleContainer && sections["cart-icon-bubble"]) {
          const temp = document.createElement("div");
          temp.innerHTML = sections["cart-icon-bubble"];
          const newBubble = temp.querySelector("#cart-icon-bubble");
          if (newBubble) {
            bubbleContainer.replaceWith(newBubble);
          }
          handledByThemeDrawer = true;
        }
      }
    } catch (err) {}

    try {
      const cart = await fetch("/cart.js").then((r) => r.json());
      const count = cart.item_count;

      document
        .querySelectorAll(".cart-count, .cart-count-bubble, [data-cart-count]")
        .forEach((el) => {
          el.textContent = count;
          el.dataset.cartCount = count;

          if (count > 0) {
            el.removeAttribute("hidden");
            el.classList.remove("is-empty");
          } else {
            el.classList.add("is-empty");
          }
        });

      document.dispatchEvent(
        new CustomEvent("cart:refresh", { detail: { cart } })
      );
    } catch (err) {}

    try {
      const drawerToggle =
        document.querySelector('[data-cart-toggle]') ||
        document.querySelector(".js-cart-toggle") ||
        document.querySelector('[aria-controls="CartDrawer"]') ||
        document.querySelector("#cart-icon-bubble");

      if (drawerToggle) {
        drawerToggle.dispatchEvent(
          new Event("click", { bubbles: true, cancelable: true })
        );
      }
    } catch (err) {}
  }

  /* ----------------------------------------
     STICKY BAR INITIALIZATION
  -----------------------------------------*/
  function initStickyBar() {
    const root = document.getElementById("bdm-sticky-atc-bar-root");
    if (!root) return;

    const productForm = document.querySelector('form[action*="/cart/add"]');
    if (!productForm) return;

    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    const productTitle = root.dataset.productTitle || document.title;
    const variants = window.ShopifyAnalytics?.meta?.product?.variants || [];
    const hasVariants = variants.length > 1;

    const variantSelectOnPage = productForm.querySelector("select[name='id']");
    let currentVariantId =
      variantSelectOnPage?.value || variants[0]?.id;

    const findVariantById = (id) =>
      variants.find((v) => String(v.id) === String(id));

    const formatMoney = (cents) =>
      (cents / 100).toLocaleString(undefined, {
        style: "currency",
        currency: Shopify?.currency?.active || "USD",
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

    productInfo.append(titleEl, priceEl);

    const qtyWrapper = document.createElement("div");
    qtyWrapper.className = "bdm-sticky-atc-qty";

    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.min = "1";
    qtyInput.value = "1";

    qtyWrapper.append(qtyInput);

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

      // Track click (your raw event)
  sendAnalytics("add_to_cart", {
    productId: window.ShopifyAnalytics?.meta?.product?.id,
    variantId: currentVariantId,
    quantity,
    price: typeof currentPrice === "number" ? currentPrice / 100 : null
  });

      /* ----------------------------------------
         🔥 CONVERSION ATTRIBUTION (THIS IS KEY)
      -----------------------------------------*/
     // ✅ Persist attribution into checkout using cart attributes
  // These attributes are accessible in checkout + web pixel
  try {
    await fetch("/cart/update.js", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        attributes: {
          bdm_sticky_atc: "1",
          bdm_sticky_product: String(window.ShopifyAnalytics?.meta?.product?.id || ""),
          bdm_sticky_variant: String(currentVariantId),
          bdm_sticky_ts: String(Date.now())
        }
      })
    });
  } catch (e) {
    console.warn("Failed to set cart attributes for attribution:", e);
  }

      // Add to cart
  const res = await fetch("/cart/add.js", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({ id: currentVariantId, quantity })
  });

  if (!res.ok) {
    console.error("Cart add error", await res.text());
    alert("Could not add to cart. Please try again.");
    return;
  }

  updateCartIconAndDrawer();
});


    const controls = document.createElement("div");
    controls.className = "bdm-sticky-atc-controls";
    controls.append(qtyWrapper, atcButton);

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
