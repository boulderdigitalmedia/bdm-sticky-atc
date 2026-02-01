(() => {
  const BAR_ID = "bdm-sticky-atc";

  // Prevent double init (important for Shopify)
  if (window.__BDM_STICKY_ATC_INIT__) return;
  window.__BDM_STICKY_ATC_INIT__ = true;

  /* ---------------- Helpers ---------------- */

  function isProductPage() {
    return Boolean(document.querySelector('[data-product-page="true"]'));
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
    return (
      window.Shopify?.shop ||
      document.documentElement.getAttribute("data-shop") ||
      document.querySelector('meta[name="shopify-shop-domain"]')?.content ||
      null
    );
  }

  async function getProductSafe() {
    const script =
      document.querySelector('script[type="application/json"][data-product-json]') ||
      document.querySelector("#ProductJson");

    if (script) {
      try {
        const parsed = JSON.parse(script.textContent);
        if (parsed?.id) return parsed;
      } catch {}
    }

    try {
      const parts = window.location.pathname.split("/products/");
      if (parts.length < 2) return null;

      const handle = parts[1].split("/")[0].split("?")[0];
      const res = await fetch(`/products/${handle}.js`, {
        credentials: "same-origin"
      });
      if (!res.ok) return null;

      return await res.json();
    } catch {
      return null;
    }
  }

  function track(event, data = {}) {
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

  if (!isProductPage()) return;

  const bar = document.getElementById(BAR_ID);
  if (!bar) return;

  (async () => {
    const product = await getProductSafe();
    if (!product || !product.variants?.length) return;

    const title = bar.querySelector("#bdm-title");
    const price = bar.querySelector("#bdm-price");
    const button = bar.querySelector("#bdm-atc");
    const qtyInput = bar.querySelector("#bdm-qty");
    const variantSelect = bar.querySelector("#bdm-variant");

    if (!button) return;

    // Populate content (only if present — Liquid controls visibility)
    if (title) title.textContent = product.title;
    if (price) price.textContent = formatMoney(product.price);

    let quantity = qtyInput ? Number(qtyInput.value) || 1 : 1;
    let selectedVariantId =
      (variantSelect && variantSelect.value) ||
      String(product.variants[0].id);

    if (qtyInput) {
      qtyInput.addEventListener("change", () => {
        quantity = Math.max(1, parseInt(qtyInput.value, 10) || 1);
      });
    }

    if (variantSelect) {
      variantSelect.addEventListener("change", () => {
        selectedVariantId = variantSelect.value;
      });
    }

    // Show bar
    bar.classList.add("is-visible");

    // Impression
    requestAnimationFrame(() => {
      track("sticky_atc_impression", {
        productId: product.id,
        variantId: selectedVariantId
      });
    });

    // Add to cart
    button.addEventListener("click", async () => {
      track("sticky_atc_click", {
        productId: product.id,
        variantId: selectedVariantId
      });

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
      }

      window.location.href = "/cart";
    });
  })();
})();
