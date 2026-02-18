(() => {
  if (window.__BDM_STICKY_ATC_INIT__) return;
  window.__BDM_STICKY_ATC_INIT__ = true;

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
  const drawer =
    document.querySelector("cart-drawer") ||
    document.getElementById("CartDrawer")?.closest("cart-drawer");

  // Dawn-style custom element
  if (drawer) {
    return drawer.classList.contains("active") ||
           drawer.hasAttribute("open");
  }

  // Generic drawer fallback
  const container = __bdm_findCartContainer();
  if (!container) return false;

  return (
    container.classList.contains("is-open") ||
    container.classList.contains("active") ||
    container.getAttribute("aria-hidden") === "false"
  );
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

   /* ===============================
   TRUE UNIVERSAL QTY SYNC ENGINE
   =============================== */

let __bdm_qtyLock = false;

// Find ANY quantity input across themes
function __bdm_findThemeQtyInput() {
  return (
    productForm.querySelector('[name="quantity"]') ||
    productForm.querySelector('input[name="quantity"]') ||
    productForm.querySelector('quantity-input input') ||
    productForm.querySelector('[data-quantity-input]') ||
    document.querySelector('quantity-input input') ||
    document.querySelector('[name="quantity"]')
  );
}

// PUSH sticky qty → theme
function __bdm_pushQtyToTheme() {
  const input = __bdm_findThemeQtyInput();
  if (!input) return;

  __bdm_qtyLock = true;
  input.value = currentQty;

  ["input", "change", "blur"].forEach(evt =>
    input.dispatchEvent(new Event(evt, { bubbles: true }))
  );

  requestAnimationFrame(() => {
    __bdm_qtyLock = false;
  });
}

// PULL theme qty → sticky
function __bdm_pullQtyFromTheme(el) {
  if (__bdm_qtyLock) return;
  if (!el) return;

  const val = parseInt(el.value || "1", 10);
  if (!isNaN(val) && val > 0) {
    currentQty = val;
    if (qtyEl) qtyEl.value = currentQty;
  }
}

/* Sticky → Theme */
qtyEl?.addEventListener("input", () => {
  currentQty = Math.max(1, parseInt(qtyEl.value || "1", 10));
  qtyEl.value = currentQty;
  __bdm_pushQtyToTheme();
});

bar.querySelectorAll(".bdm-qty-btn").forEach(btn => {
  btn.addEventListener("click", e => {
    e.preventDefault();

    if (btn.dataset.action === "increase") currentQty++;
    if (btn.dataset.action === "decrease")
      currentQty = Math.max(1, currentQty - 1);

    qtyEl.value = currentQty;
    __bdm_pushQtyToTheme();
  });
});

/* Theme → Sticky */
productForm.addEventListener(
  "input",
  e => {
    const t = e.target;
    if (
      t.name === "quantity" ||
      t.closest?.("quantity-input") ||
      t.hasAttribute?.("data-quantity-input")
    ) {
      __bdm_pullQtyFromTheme(t);
    }
  },
  true
);

productForm.addEventListener(
  "change",
  e => {
    const t = e.target;
    if (
      t.name === "quantity" ||
      t.closest?.("quantity-input") ||
      t.hasAttribute?.("data-quantity-input")
    ) {
      __bdm_pullQtyFromTheme(t);
    }
  },
  true
);

/* Mutation observer fallback */
const __bdm_qtyObserver = new MutationObserver(() => {
  const input = __bdm_findThemeQtyInput();
  if (!input) return;
  __bdm_pullQtyFromTheme(input);
});

/* ===============================
   DEBUT THEME BUTTON PATCH
   Debut +/- buttons don't fire events
================================*/
document.addEventListener(
  "click",
  e => {
    const btn = e.target.closest(
      ".js-qty__adjust, .qty__adjust, [data-qty-btn], button[name='plus'], button[name='minus']"
    );

    if (!btn) return;

    // wait for theme to update DOM value
    setTimeout(() => {
      const input = __bdm_findThemeQtyInput();
      if (input) __bdm_pullQtyFromTheme(input);
    }, 40);
  },
  true
);


__bdm_qtyObserver.observe(productForm, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ["value"]
});


    /* ===============================
       FORCE QUANTITY INTO AJAX ATC (fetch)
       Fixes themes using fetch("/cart/add")
    ================================ */
    (function __bdm_patchFetchCartAdd() {
      const origFetch = window.fetch;

      window.fetch = function(input, init) {
        try {
          const url = typeof input === "string" ? input : input?.url;

          if (url && /\/cart\/add(\.js)?/i.test(url) && init?.body) {
            if (init.body instanceof FormData) {
              init.body.set("quantity", String(currentQty));
            } else if (typeof init.body === "string") {
              const data = JSON.parse(init.body);
              if (data && typeof data === "object") {
                data.quantity = currentQty;
                init.body = JSON.stringify(data);
              }
            }
          }
        } catch {}
        return origFetch.apply(this, arguments);
      };
    })();

    /* ===============================
       DEBUT JQUERY AJAX QTY PATCH
       Fixes Debut using $.ajax("/cart/add")
    ================================ */
    (function __bdm_patchJqueryAjax() {
      if (!window.jQuery || !jQuery.ajax) return;

      const origAjax = jQuery.ajax;

      jQuery.ajax = function(options) {
        try {
          if (options && options.url && /\/cart\/add(\.js)?/i.test(options.url)) {
            if (options.data instanceof FormData) {
              options.data.set("quantity", String(currentQty));
            } else if (typeof options.data === "string") {
              if (!options.data.includes("quantity=")) {
                options.data += "&quantity=" + encodeURIComponent(currentQty);
              }
            } else if (typeof options.data === "object" && options.data) {
              options.data.quantity = currentQty;
            }
          }
        } catch {}
        return origAjax.apply(this, arguments);
      };
    })();

    // ✅ DO NOT MOVE THIS — it stays after the patches
  
    atcBtn.addEventListener("click", async e => {
      e.preventDefault();
      if (atcBtn.disabled) return;

      markStickyATC({
        productId: window.ShopifyAnalytics?.meta?.product?.id,
        variantId: variantInput.value,
        quantity: currentQty
      });

      /* ✅ WRITE STICKY MARKER INTO CHECKOUT */
try {
  await fetch("/cart/update.js", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      note_attributes: [
        {
          name: "bdm_sticky_atc",
          value: JSON.stringify({
            source: "bdm_sticky_atc",
            variantId: variantInput.value,
            quantity: currentQty,
            ts: Date.now()
          })
        }
      ]
    })
  });
} catch {}


      track("add_to_cart", {
        source: "bdm_sticky_atc",
        variantId: variantInput.value,
        quantity: currentQty
      });

      const drawer =
        document.querySelector("cart-drawer") ||
        document.getElementById("CartDrawer")?.closest("cart-drawer") ||
        null;

      if (drawer) {
        atcBtn.disabled = true;

        const fd = new FormData();
        fd.append("id", variantInput.value);
        fd.append("quantity", currentQty);
        fd.append("sections", "cart-drawer,cart-icon-bubble");
        fd.append("sections_url", window.location.pathname);

        const res = await fetch("/cart/add.js", {
          method: "POST",
          body: fd,
          headers: { Accept: "application/json" }
        });

        atcBtn.disabled = false;
        if (!res.ok) return;

        await res.json();

        let attempts = 0;
        while (attempts < 8) {
          const cartCheck = await fetch("/cart.js", { credentials: "same-origin" });
          const cartData = await cartCheck.json();
          if (cartData.item_count > 0) break;
          await new Promise(r => setTimeout(r, 80));
          attempts++;
        }

        let sectionsData = {};
        const sectionRes = await fetch(
          `/?sections=cart-drawer,cart-icon-bubble,header,cart-live-region-text&ts=${Date.now()}`,
          { credentials: "same-origin" }
        );

        if (sectionRes.ok) {
          sectionsData = await sectionRes.json();
        }

        if (sectionsData?.["cart-icon-bubble"]) {
          const bubble = document.getElementById("cart-icon-bubble");
          if (bubble) bubble.innerHTML = sectionsData["cart-icon-bubble"];
        }

        if (sectionsData?.["cart-drawer"] && typeof drawer.renderContents === "function") {
          requestAnimationFrame(() => {
            requestAnimationFrame(async () => {
              try {
                const cartStateRes = await fetch("/cart.js", {
                  credentials: "same-origin"
                });

                if (cartStateRes.ok) {
                  const cartState = await cartStateRes.json();
                  drawer.renderContents(cartState); // ⭐ ONLY CHANGE
                }
              } catch {
                try {
                  const doc = new DOMParser().parseFromString(
                    sectionsData["cart-drawer"],
                    "text/html"
                  );
                  const fresh =
                    doc.querySelector("cart-drawer") ||
                    doc.getElementById("CartDrawer") ||
                    doc.querySelector('[id*="CartDrawer"]') ||
                    doc.querySelector('[class*="cart-drawer"]');
                  if (fresh) drawer.innerHTML = fresh.innerHTML;
                } catch {}
              }
            });
          });
        } else if (sectionsData?.["cart-drawer"]) {
          try {
            const doc = new DOMParser().parseFromString(
              sectionsData["cart-drawer"],
              "text/html"
            );
            const fresh =
              doc.querySelector("cart-drawer") ||
              doc.getElementById("CartDrawer") ||
              doc.querySelector('[id*="CartDrawer"]') ||
              doc.querySelector('[class*="cart-drawer"]');
            if (fresh) drawer.innerHTML = fresh.innerHTML;
          } catch {}
        }

        drawer.classList.add("active");
        drawer.setAttribute("open", "");
        drawer.dispatchEvent(new Event("open", { bubbles: true }));

        document.dispatchEvent(new CustomEvent("cart:updated"));
        document.dispatchEvent(new CustomEvent("cart:refresh"));
        document.dispatchEvent(new CustomEvent("cart:change"));

        return;
      }

      productForm.requestSubmit();
    });
 /* ===============================
   🔥 AUTO REBIND ENGINE (OS2 SAFE)
   Keeps Sticky ATC alive after
   theme re-renders / variant swaps
================================*/

function __bdm_rebindSticky() {
  const bar = document.getElementById("bdm-sticky-atc");
  if (!bar) return;

  if (bar.dataset.__bdmRebound) return;
  bar.dataset.__bdmRebound = "1";

  // Re-sync qty when form reappears
  const form =
    document.querySelector('form[action*="/cart/add"]') ||
    document.querySelector("product-form form");

  if (!form) return;

  const input =
    form.querySelector('[name="quantity"]') ||
    document.querySelector('[name="quantity"]');

  if (input) {
    const val = parseInt(input.value || "1", 10);
    if (!isNaN(val) && val > 0) {
      const stickyQty = bar.querySelector("#bdm-qty");
      if (stickyQty) stickyQty.value = val;
    }
  }
}

/* --- Shopify Section Reloads --- */
document.addEventListener("shopify:section:load", () => {
  setTimeout(__bdm_rebindSticky, 60);
});

/* --- Variant Change (many themes emit this) --- */
document.addEventListener("variant:change", () => {
  setTimeout(__bdm_rebindSticky, 40);
});

/* --- DOM Mutation Fallback (Horizon / AJAX swaps) --- */
const __bdm_globalObserver = new MutationObserver(() => {
  __bdm_rebindSticky();
});

__bdm_globalObserver.observe(document.body, {
  childList: true,
  subtree: true
});

/* Initial run */
setTimeout(__bdm_rebindSticky, 100);

  });
})();
