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

  /* =====================================================
     STICKY VIEW LOGGER (UPDATED — DIRECT TRACK)
  ===================================================== */
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

    /* ================================
       ONLY SHOW ON PRODUCT PAGES
    ================================= */
    if (!location.pathname.includes("/products/")) {
      bar.setAttribute("hidden", "");
      return;
    }

    /* ================================
       SETTINGS
    ================================= */
    const showDesktop = bar.hasAttribute("data-enable-desktop");
    const showMobile = bar.hasAttribute("data-enable-mobile");
    const showOnScroll = bar.hasAttribute("data-show-on-scroll");
    const scrollOffset = parseInt(bar.dataset.scrollOffset || "250", 10);

    const showTitle = bar.hasAttribute("data-show-title");
    const showPrice = bar.hasAttribute("data-show-price");
    const showQty = bar.hasAttribute("data-show-qty");

    /* ================================
       DEVICE VISIBILITY
    ================================= */
    const isMobile = matchMedia("(max-width: 768px)").matches;
    if ((isMobile && !showMobile) || (!isMobile && !showDesktop)) {
      bar.setAttribute("hidden", "");
      return;
    }
    bar.removeAttribute("hidden");

    /* ================================
       SCROLL VISIBILITY
    ================================= */
    const updateScrollVisibility = () => {
      const visible = !showOnScroll || scrollY >= scrollOffset;
      bar.classList.toggle("is-visible", visible);
      bar.setAttribute("aria-hidden", String(!visible));

      // 🔥 VIEW EVENT
      if (visible && !bar.dataset.__viewLogged) {
        bar.dataset.__viewLogged = "1";
        logStickyView();
      }
    };

    updateScrollVisibility();
    addEventListener("scroll", updateScrollVisibility);

    /* ================================
       PRODUCT FORM (SAFE)
    ================================= */
    const productForm =
      document.querySelector('form[action*="/cart/add"]') ||
      document.querySelector("product-form form");

    if (!productForm) return;

    const variantInput = productForm.querySelector('[name="id"]');
    if (!variantInput) return;

    /* ================================
       BAR ELEMENTS
    ================================= */
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

    /* ================================
       PRODUCT DATA
    ================================= */
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

    /* ================================
       QTY
    ================================= */
    let currentQty = 1;
    if (qtyEl) qtyEl.value = currentQty;

    qtyEl?.addEventListener("change", () => {
      currentQty = Math.max(1, parseInt(qtyEl.value || "1", 10));
      qtyEl.value = currentQty;
    });

    bar.querySelectorAll(".bdm-qty-btn").forEach(btn => {
      btn.addEventListener("click", e => {
        e.preventDefault();
        if (btn.dataset.action === "increase") currentQty++;
        if (btn.dataset.action === "decrease") {
          currentQty = Math.max(1, currentQty - 1);
        }
        qtyEl.value = currentQty;
      });
    });

    /* ================================
       SUBMIT-TIME QUANTITY INJECTION
    ================================= */
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

    /* ================================
       ADD TO CART
    ================================= */
    atcBtn.addEventListener("click", async e => {
      e.preventDefault();
      if (atcBtn.disabled) return;

      markStickyATC({
        productId: window.ShopifyAnalytics?.meta?.product?.id,
        variantId: variantInput.value,
        quantity: currentQty
      });

      // 🔥 ATC EVENT
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

        const res = await fetch("/cart/add.js", {
          method: "POST",
          body: fd,
          headers: { Accept: "application/json" }
        });

        atcBtn.disabled = false;
        if (!res.ok) return;

        try {
          const marker = sessionStorage.getItem("bdm_sticky_atc_event");
          if (marker) {
            await fetch("/cart/update.js", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                attributes: { bdm_sticky_atc: marker }
              })
            });
          }
        } catch {}

        const sections = ["cart-drawer", "cart-icon-bubble"];
        const sectionRes = await fetch(`/?sections=${sections.join(",")}`);
        const data = await sectionRes.json();

        if (data["cart-icon-bubble"]) {
          const bubble = document.getElementById("cart-icon-bubble");
          if (bubble) bubble.innerHTML = data["cart-icon-bubble"];
        }

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

        return;
      }

      try {
        const marker = sessionStorage.getItem("bdm_sticky_atc_event");
        if (marker) {
          fetch("/cart/update.js", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              attributes: { bdm_sticky_atc: marker }
            })
          });
        }
      } catch {}

      productForm.requestSubmit();
    });
  });
})();
