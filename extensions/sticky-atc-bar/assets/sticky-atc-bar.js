(() => {
  const BAR_ID = "bdm-sticky-atc";

  // Prevent double init (Shopify navigation / sections)
  if (window.__BDM_STICKY_ATC_INIT__) return;
  window.__BDM_STICKY_ATC_INIT__ = true;

  /* ---------------- Helpers ---------------- */

  function isMobile() {
    return window.matchMedia("(max-width: 768px)").matches;
  }

  function getShop() {
    return (
      window.Shopify?.shop ||
      document.querySelector('meta[name="shopify-shop-domain"]')?.content ||
      null
    );
  }

  function getSessionId() {
    const KEY = "bdm_sticky_atc_session_id";
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  }

  function track(event, data = {}) {
    const shop = getShop();
    if (!shop) return;

    fetch("/apps/bdm-sticky-atc/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        shop,
        event,
        data: {
          ...data,
          sessionId: getSessionId()
        }
      })
    }).catch(() => {});
  }

  async function getProduct() {
    try {
      const handle = window.location.pathname.split("/products/")[1]?.split("/")[0];
      if (!handle) return null;
      const res = await fetch(`/products/${handle}.js`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /* ---------------- Start ---------------- */

  const bar = document.getElementById(BAR_ID);
  if (!bar) return;

  const {
    showTitle,
    showPrice,
    showQty,
    showVariant,
    enableDesktop,
    enableMobile,
    showOnScroll,
    scrollOffset
  } = bar.dataset;

  if (
    (isMobile() && enableMobile === "false") ||
    (!isMobile() && enableDesktop === "false")
  ) {
    return;
  }

  (async () => {
    const product = await getProduct();
    if (!product || !product.variants?.length) return;

    const titleEl = bar.querySelector("#bdm-title");
    const priceEl = bar.querySelector("#bdm-price");
    const qtyEl = bar.querySelector("#bdm-qty");
    const btn = bar.querySelector("#bdm-atc");
    const controls = bar.querySelector(".bdm-right");

    if (titleEl && showTitle === "false") titleEl.remove();
    if (priceEl && showPrice === "false") priceEl.remove();
    if (qtyEl && showQty === "false") qtyEl.remove();

    if (titleEl) titleEl.textContent = product.title;
    if (priceEl) priceEl.textContent = `$${(product.price / 100).toFixed(2)}`;

    let selectedVariantId = String(product.variants[0].id);
    let quantity = 1;

    if (showVariant !== "false" && product.variants.length > 1) {
      const select = document.createElement("select");
      select.className = "bdm-atc-variants";

      product.variants.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v.id;
        opt.textContent = v.title;
        select.appendChild(opt);
      });

      select.addEventListener("change", () => {
        selectedVariantId = select.value;
      });

      controls.insertBefore(select, btn);
    }

    if (qtyEl) {
      qtyEl.addEventListener("change", () => {
        quantity = Math.max(1, parseInt(qtyEl.value, 10) || 1);
      });
    }

    if (showOnScroll === "true") {
      const offset = Number(scrollOffset || 300);
      const onScroll = () => {
        if (window.scrollY >= offset) {
          bar.classList.add("is-visible");
          window.removeEventListener("scroll", onScroll);
        }
      };
      window.addEventListener("scroll", onScroll);
    } else {
      bar.classList.add("is-visible");
    }

    track("sticky_atc_impression", {
      productId: product.id,
      variantId: selectedVariantId
    });

    btn.addEventListener("click", async () => {
      track("sticky_atc_click", {
        productId: product.id,
        variantId: selectedVariantId,
        quantity
      });

      const res = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ id: selectedVariantId, quantity }]
        })
      });

      if (res.ok) {
        track("sticky_atc_success", {
          productId: product.id,
          variantId: selectedVariantId,
          quantity
        });
        window.location.href = "/cart";
      }
    });
  })();
})();
