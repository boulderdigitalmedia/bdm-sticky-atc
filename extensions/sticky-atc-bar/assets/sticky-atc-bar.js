(() => {
  const BAR_ID = "bdm-sticky-atc";
  const CONFIG = window.BDM_STICKY_ATC_CONFIG || {};

  // Prevent double-init (Shopify themes can re-render sections)
  if (window.__BDM_STICKY_ATC_INIT__) return;
  window.__BDM_STICKY_ATC_INIT__ = true;

  window.__BDM_STICKY_ATC_LOADED__ = false;

  /* ---------------- Helpers ---------------- */

  function isMobile() {
    return window.matchMedia("(max-width: 768px)").matches;
  }

  function shouldRenderByConfig() {
    if (isMobile() && CONFIG.enableMobile === false) return false;
    if (!isMobile() && CONFIG.enableDesktop === false) return false;
    return true;
  }

  function formatMoney(cents) {
    if (typeof cents !== "number") return "";
    return `$${(cents / 100).toFixed(2)}`;
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

  function getShop() {
    // Best-effort: different themes expose shop differently
    return (
      window.Shopify?.shop ||
      document.documentElement.getAttribute("data-shop") ||
      document.querySelector('meta[name="shopify-shop-domain"]')?.content ||
      null
    );
  }

  function isProductPage() {
    // Set by your liquid: data-product-page="true"
    return Boolean(document.querySelector('[data-product-page="true"]'));
  }

  async function getProductSafe() {
    // Try theme JSON
    const script =
      document.querySelector('script[type="application/json"][data-product-json]') ||
      document.querySelector("#ProductJson");

    if (script) {
      try {
        const parsed = JSON.parse(script.textContent);
        if (parsed?.id) return parsed;
      } catch {}
    }

    // Fallback to Shopify product endpoint: /products/<handle>.js
    try {
      const parts = window.location.pathname.split("/products/");
      if (parts.length < 2) return null;

      const handleWithExtras = parts[1] || "";
      const handle = handleWithExtras.split("/")[0].split("?")[0];
      if (!handle) return null;

      const res = await fetch(`/products/${handle}.js`, { credentials: "same-origin" });
      if (!res.ok) return null;

      const product = await res.json();
      if (product?.id) return product;
      return null;
    } catch {
      return null;
    }
  }

  function track(event, data = {}) {
    // ✅ Always try to include shop, but backend now also accepts header fallback
    const shop = getShop();

    fetch("/apps/bdm-sticky-atc/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(shop ? { "X-Shopify-Shop-Domain": shop } : {})
      },
      body: JSON.stringify({
        shop: shop || undefined,
        event,
        data: {
          ...data,
          sessionId: getSessionId()
        }
      }),
      keepalive: true
    }).catch(() => {});
  }

  /* ---------------- Start ---------------- */

  if (!shouldRenderByConfig()) return;
  if (!isProductPage()) return;

  const bar = document.getElementById(BAR_ID);
  if (!bar) return;

  (async () => {
    const product = await getProductSafe();
    if (!product || !product.id || !Array.isArray(product.variants) || product.variants.length === 0) {
      return;
    }

    const title = bar.querySelector("#bdm-title");
    const price = bar.querySelector("#bdm-price");
    const button = bar.querySelector("#bdm-atc");
    const qtyInput = bar.querySelector("#bdm-qty");
    const controls = bar.querySelector(".bdm-right");

    if (!controls || !button || !title || !price) return;

    // Apply text + price
    title.textContent = product.title;
    price.textContent = formatMoney(product.price);

    // Show bar via class (CSS should handle transitions)
    bar.classList.add("is-visible");
    bar.setAttribute("aria-hidden", "false");

    /* ---------------- Controls ---------------- */

    let quantity = 1;
    let selectedVariantId = String(product.variants[0].id);

    if (CONFIG.showQuantity !== false && qtyInput) {
      qtyInput.addEventListener("change", () => {
        quantity = Math.max(1, parseInt(qtyInput.value, 10) || 1);
      });
    } else if (qtyInput) {
      qtyInput.remove();
    }

    if (CONFIG.showVariants !== false && product.variants.length > 1) {
      const select = document.createElement("select");
      select.className = "bdm-atc-variants";

      product.variants.forEach((v) => {
        const opt = document.createElement("option");
        opt.value = String(v.id);
        opt.textContent = v.title;
        select.appendChild(opt);
      });

      select.addEventListener("change", () => {
        selectedVariantId = select.value;
      });

      controls.insertBefore(select, button);
    }

    // ✅ Impression AFTER visible (more reliable)
    requestAnimationFrame(() => {
      track("sticky_atc_impression", {
        productId: product.id,
        variantId: selectedVariantId
      });
    });

    /* ---------------- Add to cart ---------------- */

    button.addEventListener("click", async () => {
      track("sticky_atc_click", {
        productId: product.id,
        variantId: selectedVariantId
      });

      // ✅ Explicit "attempted add-to-cart" event (dashboards often expect this)
      track("sticky_atc_add_to_cart", {
        productId: product.id,
        variantId: selectedVariantId,
        quantity
      });

      const res = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
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
      } else {
        track("sticky_atc_error", {
          productId: product.id,
          variantId: selectedVariantId,
          quantity
        });
      }

      // Keep existing behavior
      window.location.href = "/cart";
    });

    window.__BDM_STICKY_ATC_LOADED__ = true;
  })();
})();
