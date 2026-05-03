(() => {
  if (window.__BDM_STICKY_ATC_INIT__) return;
  window.__BDM_STICKY_ATC_INIT__ = true;

  const TRACK_ENDPOINT =
  "https://sticky-add-to-cart-bar-pro.onrender.com/api/track";

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
      sessionStorage.setItem("bdm_sticky_atc_event", JSON.stringify(payload));
    } catch {}
  }

  function logStickyView() {
    try {
      if (document.body.dataset.__bdmStickyViewLogged) return;
      document.body.dataset.__bdmStickyViewLogged = "1";
      track("page_view", { source: "bdm_sticky_atc" });
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

    // FIX #3: also check aria-hidden="false" so the bar re-shows after drawer closes
    function __bdm_isCartOpen() {
      const drawer =
        document.querySelector("cart-drawer") ||
        document.getElementById("CartDrawer")?.closest("cart-drawer");

      if (drawer) {
        return (
          drawer.classList.contains("active") ||
          drawer.hasAttribute("open") ||
          drawer.getAttribute("aria-hidden") === "false"
        );
      }

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

    document.addEventListener("click", (e) => {
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
    }, true);

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

    const showDesktop  = bar.hasAttribute("data-enable-desktop");
    const showMobile   = bar.hasAttribute("data-enable-mobile");
    const showOnScroll = bar.hasAttribute("data-show-on-scroll");
    const scrollOffset = parseInt(bar.dataset.scrollOffset || "250", 10);
    const showTitle    = bar.hasAttribute("data-show-title");
    const showPrice    = bar.hasAttribute("data-show-price");
    const showQty      = bar.hasAttribute("data-show-qty");

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

    const titleEl    = bar.querySelector("#bdm-title");
    const priceEl    = bar.querySelector("#bdm-price");
    const qtyWrapper = bar.querySelector(".bdm-qty");
    const qtyEl      = bar.querySelector("#bdm-qty");
    const atcBtn     = bar.querySelector("#bdm-atc");

    if (!atcBtn) return;
    atcBtn.dataset.originalText = atcBtn.textContent;

    if (titleEl)    titleEl.style.display    = showTitle ? "" : "none";
    if (priceEl)    priceEl.style.display    = showPrice ? "" : "none";
    if (qtyWrapper) qtyWrapper.style.display = showQty   ? "inline-flex" : "none";

    const handle = location.pathname.split("/products/")[1];
    if (!handle) return;

    // FIX #1: store product data and watch the variant input via multiple
    // strategies so the button/price always reflects the selected variant.
    let productData = null;

    function updateVariantUI(id) {
      if (!productData) return;
      const v = productData.variants.find(v => String(v.id) === String(id));
      if (!v) return;

      if (showPrice && priceEl) {
        const currency = productData.currency ||
          window.Shopify?.currency?.active || "USD";
        priceEl.textContent = (v.price / 100).toLocaleString(undefined, {
          style: "currency",
          currency
        });
      }

      // Also check Dawn's own submit button for "Unavailable" state
      const formSubmitBtn = productForm.querySelector('[type="submit"]');
      const formSaysUnavailable =
        formSubmitBtn && /unavailable/i.test(formSubmitBtn.textContent);

      if (!v.available || formSaysUnavailable) {
        atcBtn.textContent = "Sold Out";
        atcBtn.disabled = true;
      } else {
        atcBtn.textContent = atcBtn.dataset.originalText;
        atcBtn.disabled = false;
      }
    }

    fetch(`/products/${handle}.js`)
      .then(r => r.json())
      .then(product => {
        productData = product;
        if (showTitle && titleEl) titleEl.textContent = product.title;

        // Initial render
        updateVariantUI(variantInput.value);

        // Strategy 1: standard change event (select-based themes)
        variantInput.addEventListener("change", e => updateVariantUI(e.target.value));

        // Strategy 2: Dawn 8 custom event with variant detail
        document.addEventListener("variant:changed", e => {
          const id = e.detail?.variant?.id || variantInput.value;
          updateVariantUI(id);
        });

        // Strategy 3: MutationObserver on the attribute (some themes)
        new MutationObserver(() => {
          if (variantInput.value) updateVariantUI(variantInput.value);
        }).observe(variantInput, { attributes: true, attributeFilter: ["value"] });

        // Strategy 4: Polling fallback — Dawn sets .value without firing
        // attribute mutations when it updates the hidden input via JS property
        let lastId = variantInput.value;
        setInterval(() => {
          if (variantInput.value && variantInput.value !== lastId) {
            lastId = variantInput.value;
            updateVariantUI(lastId);
          }
        }, 150);
      });

    let currentQty = 1;
    if (qtyEl) qtyEl.value = currentQty;

    /* ===========================
       QTY SYNC ENGINE
    =========================== */
    let __bdm_qtyLock = false;

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

    function __bdm_pushQtyToTheme() {
      const input = __bdm_findThemeQtyInput();
      if (!input) return;
      __bdm_qtyLock = true;
      input.value = currentQty;
      ["input", "change", "blur"].forEach(evt =>
        input.dispatchEvent(new Event(evt, { bubbles: true }))
      );
      requestAnimationFrame(() => { __bdm_qtyLock = false; });
    }

    function __bdm_pullQtyFromTheme(el) {
      if (__bdm_qtyLock) return;
      if (!el) return;
      const val = parseInt(el.value || "1", 10);
      if (!isNaN(val) && val > 0) {
        currentQty = val;
        if (qtyEl) qtyEl.value = currentQty;
      }
    }

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

    productForm.addEventListener("input", e => {
      const t = e.target;
      if (t.name === "quantity" || t.closest?.("quantity-input") || t.hasAttribute?.("data-quantity-input"))
        __bdm_pullQtyFromTheme(t);
    }, true);

    productForm.addEventListener("change", e => {
      const t = e.target;
      if (t.name === "quantity" || t.closest?.("quantity-input") || t.hasAttribute?.("data-quantity-input"))
        __bdm_pullQtyFromTheme(t);
    }, true);

    const __bdm_qtyObserver = new MutationObserver(() => {
      const input = __bdm_findThemeQtyInput();
      if (input) __bdm_pullQtyFromTheme(input);
    });

    document.addEventListener("click", e => {
      const btn = e.target.closest(
        ".js-qty__adjust, .qty__adjust, [data-qty-btn], button[name='plus'], button[name='minus']"
      );
      if (!btn) return;
      setTimeout(() => {
        const input = __bdm_findThemeQtyInput();
        if (input) __bdm_pullQtyFromTheme(input);
      }, 40);
    }, true);

    __bdm_qtyObserver.observe(productForm, {
      subtree: true, childList: true, attributes: true,
      attributeFilter: ["value"]
    });

    /* Fetch patch */
    (function __bdm_patchFetchCartAdd() {
      const origFetch = window.fetch;
      window.fetch = function(input, init) {
        try {
          const url = typeof input === "string" ? input : input?.url;
          if (!url || !url.includes("/cart/add")) return origFetch.apply(this, arguments);
          if (/\/cart\/add(\.js)?/i.test(url) && init?.body) {
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

    /* jQuery patch */
    (function __bdm_patchJqueryAjax() {
      if (!window.jQuery || !jQuery.ajax) return;
      const origAjax = jQuery.ajax;
      jQuery.ajax = function(options) {
        try {
          if (options?.url && /\/cart\/add(\.js)?/i.test(options.url)) {
            if (options.data instanceof FormData) {
              options.data.set("quantity", String(currentQty));
            } else if (typeof options.data === "string") {
              if (!options.data.includes("quantity="))
                options.data += "&quantity=" + encodeURIComponent(currentQty);
            } else if (typeof options.data === "object" && options.data) {
              options.data.quantity = currentQty;
            }
          }
        } catch {}
        return origAjax.apply(this, arguments);
      };
    })();

    /* ===========================
       ATC BUTTON HANDLER
       FIX #2: use sections from /cart/add.js response directly
       FIX #4: call drawer.open() for full Dawn lifecycle
    =========================== */
    atcBtn.addEventListener("click", async e => {
      e.preventDefault();
      if (atcBtn.disabled) return;

      markStickyATC({
        productId: window.ShopifyAnalytics?.meta?.product?.id,
        variantId: variantInput.value,
        quantity: currentQty
      });

      try {
        await fetch("/cart/update.js", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attributes: {
              bdm_sticky_atc: JSON.stringify({
                source: "bdm_sticky_atc",
                variantId: variantInput.value,
                quantity: currentQty,
                ts: Date.now()
              })
            }
          })
        });
      } catch {}

      track("add_to_cart", {
        source: "bdm_sticky_atc",
        variantId: variantInput.value,
        quantity: currentQty
      });

      const activeDrawer =
        document.querySelector("cart-drawer") ||
        document.querySelector("cart-notification") ||
        document.getElementById("CartDrawer") ||
        null;

      if (activeDrawer) {
        atcBtn.disabled = true;

        // Use Dawn's own getSectionsToRender() to get correct dynamic
        // section IDs (e.g. template--xxxxx__cart-drawer). This is the
        // exact same approach Dawn's product-form.js uses internally.
        let sectionIds;
        if (typeof activeDrawer.getSectionsToRender === "function") {
          sectionIds = activeDrawer.getSectionsToRender().map(s => s.section || s.id);
        } else {
          sectionIds = ["cart-drawer", "cart-notification", "cart-icon-bubble"];
        }

        const body = JSON.stringify({
          id: variantInput.value,
          quantity: currentQty,
          sections: sectionIds,
          sections_url: window.location.pathname,
        });

        let parsedState = null;
        try {
          const res = await fetch("/cart/add.js", {
            method: "POST",
            body,
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          });
          atcBtn.disabled = false;
          if (!res.ok) return;
          parsedState = await res.json();
        } catch {
          atcBtn.disabled = false;
          return;
        }

        // Dawn's renderContents(parsedState) expects the raw /cart/add.js
        // response — sections HTML is already embedded in parsedState.sections.
        // This mirrors exactly how Dawn's own product-form.js calls it.
        if (typeof activeDrawer.renderContents === "function") {
          activeDrawer.renderContents(parsedState);
        } else {
          // Non-Dawn fallback: surgical DOM patching to preserve listeners
          const sectionsData = parsedState?.sections || {};
          const sectionKey = activeDrawer.tagName.toLowerCase() === "cart-drawer"
            ? "cart-drawer" : "cart-notification";
          const sectionHtml = sectionsData[sectionKey];

          if (sectionHtml) {
            const doc = new DOMParser().parseFromString(sectionHtml, "text/html");
            [
              ".cart-drawer__form",
              ".cart-drawer__footer",
              "#CartDrawer-CartItems",
              ".cart-items",
              ".totals",
              ".cart-drawer__warnings",
            ].forEach(sel => {
              const fresh = doc.querySelector(sel);
              const existing = activeDrawer.querySelector(sel);
              if (fresh && existing) existing.innerHTML = fresh.innerHTML;
            });
          }

          requestAnimationFrame(() => {
            if (typeof activeDrawer.open === "function") {
              activeDrawer.open();
            } else {
              activeDrawer.classList.add("active");
              activeDrawer.setAttribute("open", "");
              activeDrawer.setAttribute("aria-hidden", "false");
              activeDrawer.dispatchEvent(new Event("open", { bubbles: true }));
            }
          });
        }

        // Update cart icon bubble separately
        const bubble = document.getElementById("cart-icon-bubble");
        const bubbleHtml = parsedState?.sections?.["cart-icon-bubble"];
        if (bubble && bubbleHtml) bubble.innerHTML = bubbleHtml;

        document.dispatchEvent(new CustomEvent("cart:updated"));
        document.dispatchEvent(new CustomEvent("cart:refresh"));
        document.dispatchEvent(new CustomEvent("cart:change"));

        return;
      }

      productForm.requestSubmit();
    });

    /* ===========================
       AUTO REBIND ENGINE
    =========================== */
    function __bdm_rebindSticky() {
      const bar = document.getElementById("bdm-sticky-atc");
      if (!bar || bar.dataset.__bdmRebound) return;
      bar.dataset.__bdmRebound = "1";

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

    document.addEventListener("shopify:section:load", () => setTimeout(__bdm_rebindSticky, 60));
    document.addEventListener("variant:change",        () => setTimeout(__bdm_rebindSticky, 40));

    new MutationObserver(__bdm_rebindSticky).observe(document.body, {
      childList: true, subtree: true
    });

    setTimeout(__bdm_rebindSticky, 100);

  });
})();