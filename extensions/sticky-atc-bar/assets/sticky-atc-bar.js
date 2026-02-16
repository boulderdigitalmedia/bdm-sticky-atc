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
            window.__SHOP_DOMAIN__ || window.Shopify?.shop,
        },
        body: JSON.stringify({
          event,
          shop: window.__SHOP_DOMAIN__ || window.Shopify?.shop,
          ts: Date.now(),
          ...payload,
        }),
        keepalive: true,
      });
    } catch {}
  }

  /* =====================================================
     ⭐ CART VISIBILITY SYNC (NEW)
  ===================================================== */
  function __bdm_syncStickyWithCartUI() {
    const bar = document.getElementById("bdm-sticky-atc");
    if (!bar) return;

    const drawer =
      document.querySelector("cart-drawer") ||
      document.getElementById("CartDrawer");

    if (!drawer) return;

    const isOpen =
      drawer.hasAttribute("open") ||
      drawer.classList.contains("active") ||
      drawer.classList.contains("is-active");

    if (isOpen) {
      bar.classList.remove("is-visible");
    } else {
      const offset = parseInt(bar.dataset.scrollOffset || "250", 10);
      if (!bar.hasAttribute("data-show-on-scroll") || scrollY >= offset) {
        bar.classList.add("is-visible");
      }
    }
  }

  /* =====================================================
     ⭐ EMPTY CART OBSERVER (NEW)
  ===================================================== */
  function __bdm_refreshWhenCartEmpty() {
    const drawer =
      document.querySelector("cart-drawer") ||
      document.getElementById("CartDrawer");
    const bar = document.getElementById("bdm-sticky-atc");

    if (!drawer || !bar) return;

    const observer = new MutationObserver(() => {
      __bdm_syncStickyWithCartUI();
    });

    observer.observe(drawer, { childList: true, subtree: true });
  }

  /* =====================================================
     ⭐ HARD CART STATE SYNC (FINAL FIX)
  ===================================================== */
  function __bdm_forceCartSync() {
    const bar = document.getElementById("bdm-sticky-atc");
    if (!bar) return;

    let tries = 0;

    const tick = async () => {
      tries++;

      try {
        const r = await fetch("/cart.js", { credentials: "same-origin" });
        if (!r.ok) return;
        const cart = await r.json();

        __bdm_syncStickyWithCartUI();

        // cart emptied
        if (cart.item_count === 0) {
          bar.classList.remove("is-visible");
          bar.dataset.__viewLogged = "";
        }

        // cart re-added after empty
        if (cart.item_count > 0) {
          setTimeout(() => {
            __bdm_syncStickyWithCartUI();
          }, 120);
        }
      } catch {}

      if (tries < 6) setTimeout(tick, 200);
    };

    tick();
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
        ts: Date.now(),
      };

      sessionStorage.setItem("bdm_sticky_atc_event", JSON.stringify(payload));
    } catch {}
  }

  function logStickyView() {
    try {
      if (document.body.dataset.__bdmStickyViewLogged) return;
      document.body.dataset.__bdmStickyViewLogged = "1";

      track("page_view", {
        source: "bdm_sticky_atc",
      });
    } catch {}
  }

  document.addEventListener("DOMContentLoaded", () => {
    const bar = document.getElementById("bdm-sticky-atc");
    if (!bar) return;

    /* ONLY SHOW ON PRODUCT PAGES */
    if (!location.pathname.includes("/products/")) {
      bar.setAttribute("hidden", "");
      return;
    }

    const showDesktop = bar.hasAttribute("data-enable-desktop");
    const showMobile = bar.hasAttribute("data-enable-mobile");
    const showOnScroll = bar.hasAttribute("data-show-on-scroll");
    const scrollOffset = parseInt(bar.dataset.scrollOffset || "250", 10);

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

    const atcBtn = bar.querySelector("#bdm-atc");
    if (!atcBtn) return;

    const handle = location.pathname.split("/products/")[1];
    if (!handle) return;

    let currentQty = 1;

    atcBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (atcBtn.disabled) return;

      markStickyATC({
        productId: window.ShopifyAnalytics?.meta?.product?.id,
        variantId: variantInput.value,
        quantity: currentQty,
      });

      track("add_to_cart", {
        source: "bdm_sticky_atc",
        variantId: variantInput.value,
        quantity: currentQty,
      });

      const drawer =
        document.querySelector("cart-drawer") ||
        document.getElementById("CartDrawer");

      if (drawer) {
        atcBtn.disabled = true;

        const fd = new FormData();
        fd.append("id", variantInput.value);
        fd.append("quantity", currentQty);

        const res = await fetch("/cart/add.js", {
          method: "POST",
          body: fd,
          headers: { Accept: "application/json" },
        });

        atcBtn.disabled = false;
        if (!res.ok) return;

        const sections = ["cart-drawer", "cart-icon-bubble"];
        const sectionRes = await fetch(`/?sections=${sections.join(",")}`);
        const data = await sectionRes.json();

        if (data["cart-drawer"]) {
          const doc = new DOMParser().parseFromString(
            data["cart-drawer"],
            "text/html"
          );
          const fresh =
            doc.querySelector("cart-drawer") ||
            doc.getElementById("CartDrawer");

          if (fresh) drawer.innerHTML = fresh.innerHTML;
        }

        drawer.classList.add("active");
        drawer.setAttribute("open", "");
        drawer.dispatchEvent(new Event("open", { bubbles: true }));

        /* ⭐ NEW FIXES */
        __bdm_forceCartSync();

        setTimeout(() => {
          __bdm_syncStickyWithCartUI();
          __bdm_refreshWhenCartEmpty();
          __bdm_forceCartSync();
        }, 350);

        return;
      }

      productForm.requestSubmit();
    });

    /* ⭐ GLOBAL LISTENERS (NEW) */
    document.addEventListener("click", () => {
      setTimeout(__bdm_syncStickyWithCartUI, 120);
    });

    new MutationObserver(() => {
      __bdm_syncStickyWithCartUI();
    }).observe(document.body, { childList: true, subtree: true });
  });
})();
