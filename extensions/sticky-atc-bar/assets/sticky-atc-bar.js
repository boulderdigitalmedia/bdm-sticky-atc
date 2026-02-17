(() => {
  if (window.__BDM_STICKY_ATC_INIT__) return;
  window.__BDM_STICKY_ATC_INIT__ = true;

  /* =====================================================
     DIRECT ANALYTICS ENDPOINT (NO APP PROXY)
  ===================================================== */
  const TRACK_ENDPOINT =
  "https://sticky-add-to-cart-bar-pro.onrender.com/api/track/track";

  function track(event, payload = {}) {
    try {
      fetch(TRACK_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Shop-Domain":
            window.__SHOP_DOMAIN__ || window.Shopify?.shop
        },
        body: JSON.stringify({
          event,
          shop: window.__SHOP_DOMAIN__ || window.Shopify?.shop,
          ts: Date.now(),
          ...payload
        }),
        keepalive: true
      });
    } catch {}
  }

  /* =====================================================
     STICKY ATC MARKER (UNCHANGED)
  ===================================================== */
  function markStickyATC({ productId, variantId, quantity }) {
    try {
      const payload = {
        source: "bdm_sticky_atc",
        productId,
        variantId,
        quantity,
        ts: Date.now()
      };

      sessionStorage.setItem(
        "bdm_sticky_atc_event",
        JSON.stringify(payload)
      );
    } catch {}
  }

  function logStickyView() {
    try {
      if (document.body.dataset.__bdmStickyViewLogged) return;
      document.body.dataset.__bdmStickyViewLogged = "1";

      track("page_view", {
        source: "bdm_sticky_atc"
      });
    } catch {}
  }

  document.addEventListener("DOMContentLoaded", () => {
    const bar = document.getElementById("bdm-sticky-atc");
    if (!bar) return;

    /* =====================================================
       ⭐ FIX BLOCK — CART DRAWER + EMPTY CART REFRESH
       (UNCHANGED)
    ===================================================== */

    function __bdm_isVisible(el) {
      if (!el) return false;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0")
        return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }

    function __bdm_findCartContainer() {
      const selectors = [
        "cart-drawer",
        "#CartDrawer",
        "[data-cart-drawer]",
        ".cart-drawer",
        ".drawer--cart",
        ".drawer.cart",
        ".drawer",
        "[id*='CartDrawer']",
        "[class*='CartDrawer']",
        "[data-drawer*='cart']",
      ];

      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el;
      }

      const dialogs = Array.from(
        document.querySelectorAll("dialog, [role='dialog'], [aria-modal='true']")
      );

      return dialogs.find((d) =>
        /your cart/i.test((d.textContent || "").trim())
      );
    }

    function __bdm_isCartOpen() {
      const container = __bdm_findCartContainer();
      if (!container) return false;
      if (!__bdm_isVisible(container)) return false;
      return true;
    }

    function __bdm_setStickyHidden(hidden) {
      bar.style.display = hidden ? "none" : "";
    }

    function __bdm_syncStickyWithCartUI() {
      __bdm_setStickyHidden(__bdm_isCartOpen());
    }

    async function __bdm_refreshWhenCartEmpty() {
      try {
        const r = await fetch("/cart.js", { credentials: "same-origin" });
        if (!r.ok) return;
        const cart = await r.json();
        if (cart && cart.item_count === 0) {
          __bdm_syncStickyWithCartUI();
        }
      } catch {}
    }

    __bdm_syncStickyWithCartUI();

    const __bdm_observer = new MutationObserver(() => {
      __bdm_syncStickyWithCartUI();
    });

    __bdm_observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "style", "open", "aria-hidden"],
    });

    document.addEventListener(
      "click",
      (e) => {
        const t = e.target;

        const looksLikeCartControl =
          t.closest("a[href='/cart']") ||
          t.closest("[data-cart]") ||
          t.closest("[aria-controls*='CartDrawer']") ||
          t.closest("button");

        if (!looksLikeCartControl) return;

        setTimeout(() => {
          __bdm_syncStickyWithCartUI();
          __bdm_refreshWhenCartEmpty();
        }, 350);
      },
      true
    );

    ["cart:updated", "ajaxCart:updated", "cart:change", "cart:refresh"].forEach((evt) =>
      document.addEventListener(evt, () => {
        __bdm_syncStickyWithCartUI();
        __bdm_refreshWhenCartEmpty();
      })
    );

    /* =====================================================
       ORIGINAL SCRIPT BELOW — UNCHANGED
    ===================================================== */

    if (!location.pathname.includes("/products/")) {
      bar.setAttribute("hidden", "");
      return;
    }

    const showDesktop = bar.hasAttribute("data-enable-desktop");
    const showMobile = bar.hasAttribute("data-enable-mobile");
    const showOnScroll = bar.hasAttribute("data-show-on-scroll");
    const scrollOffset = parseInt(bar.dataset.scrollOffset || "250", 10);

    const showTitle = bar.hasAttribute("data-show-title");
    const showPrice = bar.hasAttribute("data-show-price");
    const showQty = bar.hasAttribute("data-show-qty");

    const isMobile = matchMedia("(max-width: 768px)").matches;
    if ((isMobile && !showMobile) || (!isMobile && !showDesktop)) {
      bar.setAttribute("hidden", "");
      return;
    }
    bar.removeAttribute("hidden");

    const updateScrollVisibility = () => {
      const visible = !showOnScroll || scrollY >= scrollOffset;
      bar.classList.toggle("is-visible", visible);
      bar.setAttribute("aria-hidden", String(!visible));

      if (visible && !bar.dataset.__viewLogged) {
        bar.dataset.__viewLogged = "1";
        logStickyView();
      }
    };

    updateScrollVisibility();
    addEventListener("scroll", updateScrollVisibility);

    const productForm =
      document.querySelector('form[action*="/cart/add"]') ||
      document.querySelector("product-form form");

    if (!productForm) return;

    const variantInput = productForm.querySelector('[name="id"]');
    if (!variantInput) return;

    const titleEl = bar.querySelector("#bdm-title");
    const priceEl = bar.querySelector("#bdm-price");
    const qtyWrapper = bar.querySelector(".bdm-qty");
    const qtyEl = bar.querySelector("#bdm-qty");
    const atcBtn = bar.querySelector("#bdm-atc");

    if (!atcBtn) return;
    atcBtn.dataset.originalText = atcBtn.textContent;

    if (titleEl) titleEl.style.display = showTitle ? "" : "none";
    if (priceEl) priceEl.style.display = showPrice ? "" : "none";
    if (qtyWrapper) qtyWrapper.style.display = showQty ? "inline-flex" : "none";

    const handle = location.pathname.split("/products/")[1];
    if (!handle) return;

    fetch(`/products/${handle}.js`)
      .then(r => r.json())
      .then(product => {
        if (showTitle && titleEl) titleEl.textContent = product.title;

        const updateVariantUI = id => {
          const v = product.variants.find(v => v.id == id);
          if (!v) return;

          if (showPrice && priceEl) {
            priceEl.textContent = (v.price / 100).toLocaleString(undefined, {
              style: "currency",
              currency: product.currency || "USD"
            });
          }

          if (!v.available) {
            atcBtn.textContent = "Sold Out";
            atcBtn.disabled = true;
          } else {
            atcBtn.textContent = atcBtn.dataset.originalText;
            atcBtn.disabled = false;
          }
        };

        updateVariantUI(variantInput.value);
        variantInput.addEventListener("change", e =>
          updateVariantUI(e.target.value)
        );
      });

    let currentQty = 1;
    if (qtyEl) qtyEl.value = currentQty;

    qtyEl?.addEventListener("change", () => {
      currentQty = Math.max(1, parseInt(qtyEl.value || "1", 10));
      qtyEl.value = currentQty;
    });

    bar.querySelectorAll(".bdm-qty-btn").forEach(btn => {
      btn.addEventListener("click", e => {
        e.preventDefault();
e.stopImmediatePropagation();
        if (btn.dataset.action === "increase") currentQty++;
        if (btn.dataset.action === "decrease") {
          currentQty = Math.max(1, currentQty - 1);
        }
        qtyEl.value = currentQty;
      });
    });

    productForm.addEventListener(
      "submit",
      () => {
        let q = productForm.querySelector('[name="quantity"]');
        if (!q) {
          q = document.createElement("input");
          q.type = "hidden";
          q.name = "quantity";
          productForm.appendChild(q);
        }
        q.value = currentQty;
      },
      true
    );

    atcBtn.addEventListener("click", async e => {
      e.preventDefault();
      if (atcBtn.disabled) return;

      markStickyATC({
        productId: window.ShopifyAnalytics?.meta?.product?.id,
        variantId: variantInput.value,
        quantity: currentQty
      });

      track("add_to_cart", {
        source: "bdm_sticky_atc",
        variantId: variantInput.value,
        quantity: currentQty
      });

      const drawer =
        document.querySelector("cart-drawer") ||
        document.getElementById("CartDrawer");

      if (drawer) {
        atcBtn.disabled = true;

        const fd = new FormData();
        fd.append("id", variantInput.value);
        fd.append("quantity", currentQty);

        /* ⭐⭐⭐ FIX APPLIED HERE — SINGLE SHOPIFY SECTIONS REQUEST ⭐⭐⭐ */
        fd.append("sections", "cart-drawer,cart-icon-bubble");
        fd.append("sections_url", window.location.pathname);

       const addResponse = await res.json();


        atcBtn.disabled = false;
        if (!res.ok) return;

        await res.json(); // keep response consumed

await res.json();

// ⭐ Wait for cart to actually update before pulling drawer HTML
let attempts = 0;
while (attempts < 5) {
  const cartCheck = await fetch('/cart.js', { credentials: 'same-origin' });
  const cartData = await cartCheck.json();
  if (cartData.item_count > 0) break;
  await new Promise(r => setTimeout(r, 80));
  attempts++;
}

// Now request fresh drawer HTML
const sectionRes = await fetch(
  `/?sections=cart-drawer,cart-icon-bubble&ts=${Date.now()}`
);

const data = await sectionRes.json();


        if (data.sections?.["cart-icon-bubble"]) {
          const bubble = document.getElementById("cart-icon-bubble");
          if (bubble) bubble.innerHTML = data.sections["cart-icon-bubble"];
        }

        if (data.sections?.["cart-drawer"]) {
          const doc = new DOMParser().parseFromString(
            data.sections["cart-drawer"],
            "text/html"
          );
          const fresh =
            doc.querySelector("cart-drawer") ||
            doc.getElementById("CartDrawer");

          if (fresh) {
  drawer.innerHTML = fresh.innerHTML;

  // ⭐ Force Shopify to re-upgrade <cart-drawer> element
  if (drawer.tagName.toLowerCase() === "cart-drawer") {
    const clone = drawer.cloneNode(true);
    drawer.replaceWith(clone);
  }
}

        }

        drawer.classList.add("active");
        drawer.setAttribute("open", "");
        drawer.dispatchEvent(new Event("open", { bubbles: true }));
// ⭐ Force theme drawer controllers to re-open correctly
setTimeout(() => {
  try {
    // Dawn / OS2 custom element
    if (typeof drawer.open === "function") {
      drawer.open();
      return;
    }

    // Some themes expose JS instance
    if (window.theme?.cartDrawer?.open) {
      window.theme.cartDrawer.open();
      return;
    }

    // Generic fallback click
    const cartToggle =
      document.querySelector('[aria-controls="CartDrawer"]') ||
      document.querySelector('[data-cart-drawer-toggle]');

    cartToggle?.click();
  } catch {}
}, 30);

        document.dispatchEvent(new CustomEvent("cart:updated"));
document.dispatchEvent(new CustomEvent("cart:refresh"));
document.dispatchEvent(new CustomEvent("cart:change"));


        return;
      }

      productForm.requestSubmit();
    });
  });
})();