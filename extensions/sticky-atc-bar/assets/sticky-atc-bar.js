(() => {
  const BAR_ID = "bdm-sticky-atc";
  const CONFIG = window.BDM_STICKY_ATC_CONFIG || {};

  // Prevent double init (Shopify sections / navigation)
  if (window.__BDM_STICKY_ATC_INIT__) return;
  window.__BDM_STICKY_ATC_INIT__ = true;

  /* ---------------- Helpers ---------------- */

  function isMobile() {
    return window.matchMedia("(max-width: 768px)").matches;
  }

  function shouldRenderByDevice() {
    if (isMobile() && CONFIG.enableMobile === false) return false;
    if (!isMobile() && CONFIG.enableDesktop === false) return false;
    return true;
  }

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
      const res = await fetch(`/products/${handle}.js`, { credentials: "same-origin" });
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

  /* ---------------- Visibility ---------------- */

  function setupVisibility(bar) {
    if (!CONFIG.showOnScroll) {
      bar.classList.add("is-visible");
      return;
    }

    const offset = Number(CONFIG.scrollOffset || 300);

    const onScroll = () => {
      if (window.scrollY >= offset) {
        bar.classList.add("is-visible");
        window.removeEventListener("scroll", onScroll);
      }
    };

    window.addEventListener("scroll", onScroll);
  }

  /* ---------------- Start ---------------- */

  if (!isProductPage()) return;
  if (!shouldRenderByDevice()) return;

  const bar = document.getElementById(BAR_ID);
  if (!bar) return;

  (async () => {
    const product = await getProductSafe();
    if (!product || !product.id || !product.variants?.length) return;

    const title = bar.querySelector("#bdm-title");
    const price = bar.querySelector("#bdm-price");
    const button = bar.querySelector("#bdm-atc");
    const qtyInput = bar.querySelector("#bdm-qty");
    const controls = bar.querySelector(".bdm-right");

    if (!button || !controls) return;

    /* ---------------- Apply content ---------------- */

    if (title) title.textContent = product.title;
    if (price) price.textContent = formatMoney(product.price);

    /* ---------------- Apply styles from config ---------------- */

    bar.style.setProperty("--bdm-bg", CONFIG.backgroundColor || "#fff");
    bar.style.setProperty("--bdm-text", CONFIG.textColor || "#000");
    bar.style.setProperty("--bdm-font-size", `${CONFIG.fontSize || 14}px`);

    button.style.backgroundColor = CONFIG.buttonColor || "#111";
    button.style.color = CONFIG.buttonTextColor || "#fff";
    button.classList.add(`bdm-button--${CONFIG.buttonStyle || "solid"}`);
    button.classList.add(CONFIG.buttonSize || "medium");

    /* ---------------- Controls ---------------- */

    let quantity = 1;
    let selectedVariantId = String(product.variants[0].id);

    if (CONFIG.showQuantity === false && qtyInput) {
      qtyInput.remove();
    } else if (qtyInput) {
      qtyInput.addEventListener("change", () => {
        quantity = Math.max(1, parseInt(qtyInput.value, 10) || 1);
      });
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

    /* ---------------- Visibility + impression ---------------- */

    setupVisibility(bar);

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
