(() => {
  const BAR_ID = "bdm-sticky-atc";
  const CONFIG = window.BDM_STICKY_ATC_CONFIG || {};

  // Debug flag
  window.__BDM_STICKY_ATC_LOADED__ = false;

  /* ---------------- Helpers ---------------- */

  function isMobile() {
    return window.matchMedia("(max-width: 768px)").matches;
  }

  function shouldRender() {
    if (isMobile() && CONFIG.enableMobile === false) return false;
    if (!isMobile() && CONFIG.enableDesktop === false) return false;
    return true;
  }

  function formatMoney(cents) {
    if (typeof cents !== "number") return "";
    return `$${(cents / 100).toFixed(2)}`;
  }

  async function getProductSafe() {
    // Try theme JSON
    const script =
      document.querySelector('script[type="application/json"][data-product-json]') ||
      document.querySelector("#ProductJson");

    if (script) {
      try {
        return JSON.parse(script.textContent);
      } catch {}
    }

    // Fallback to Shopify product endpoint
    try {
      const handle = window.location.pathname.split("/products/")[1];
      if (!handle) return null;
      const res = await fetch(`/products/${handle}.js`);
      return await res.json();
    } catch {
      return null;
    }
  }

  /* ---------------- Attribution helpers ---------------- */

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
      null
    );
  }

  function track(event, data = {}) {
    const shop = getShop();
    if (!shop) {
      console.warn("BDM Sticky ATC: missing shop");
      return;
    }

    fetch("/apps/bdm-sticky-atc/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  /* ---------------- Start ---------------- */

  if (!shouldRender()) {
    console.warn("BDM Sticky ATC: render disabled by config");
    return;
  }

  const bar = document.getElementById(BAR_ID);
  if (!bar) {
    console.warn("BDM Sticky ATC: bar element not found");
    return;
  }

  // Force visible
  bar.style.display = "flex";
  bar.style.opacity = "1";
  bar.style.transform = "translateY(0)";
  bar.setAttribute("aria-hidden", "false");

  (async () => {
    const product = await getProductSafe();
    if (!product) {
      console.warn("BDM Sticky ATC: product data not found");
      return;
    }

    const title = bar.querySelector("#bdm-title");
    const price = bar.querySelector("#bdm-price");
    const button = bar.querySelector("#bdm-atc");
    const qtyInput = bar.querySelector("#bdm-qty");
    const controls = bar.querySelector(".bdm-right");

    if (!controls || !button || !title || !price) {
      console.warn("BDM Sticky ATC: missing child elements");
      return;
    }

    title.textContent = product.title;
    price.textContent = formatMoney(product.price);

    // Impression
    track("sticky_atc_impression", { productId: product.id });

    /* ---------------- Controls ---------------- */

    let quantity = 1;
    let selectedVariantId = String(product.variants[0]?.id || "");

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

    /* ---------------- Add to cart ---------------- */

    button.addEventListener("click", async () => {
      track("sticky_atc_click", {
        productId: product.id,
        variantId: selectedVariantId
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
          variantId: selectedVariantId
        });
      }

      window.location.href = "/cart";
    });

    window.__BDM_STICKY_ATC_LOADED__ = true;
    console.log("✅ BDM Sticky ATC initialized");
  })();
})();
