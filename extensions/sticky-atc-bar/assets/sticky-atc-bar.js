(() => {
  const BAR_ID = "bdm-sticky-atc";
  const CONFIG = window.BDM_STICKY_ATC_CONFIG || {};

  /* ---------------- Helpers ---------------- */

  function isMobile() {
    return window.matchMedia("(max-width: 768px)").matches;
  }

  function shouldRender() {
    if (isMobile() && CONFIG.enableMobile === false) return false;
    if (!isMobile() && CONFIG.enableDesktop === false) return false;
    return true;
  }

  function getStickyAtcSessionId() {
    const KEY = "bdm_sticky_atc_session_id";
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  }

  function track(event, data = {}) {
    try {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          shop: window.Shopify?.shop,
          event,
          data: {
            ...data,
            sessionId: getStickyAtcSessionId()
          }
        })
      }).catch(() => {});
    } catch {}
  }

  async function getCartToken() {
    const res = await fetch("/cart.js", { credentials: "same-origin" });
    const cart = await res.json();
    return cart.token;
  }

  async function sendStickyAttribution({ cartToken, productId, variantId }) {
    try {
      await fetch("/apps/bdm-sticky-atc/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Shop-Domain": window.Shopify?.shop
        },
        credentials: "same-origin",
        body: JSON.stringify({ cartToken, productId, variantId })
      });
    } catch {}
  }

  /* ---------------- Init ---------------- */

  document.addEventListener("DOMContentLoaded", () => {
    const bar = document.getElementById(BAR_ID);
    if (!bar) return;

    if (!shouldRender()) {
      bar.style.display = "none";
      return;
    }

    const button = bar.querySelector("#bdm-atc");
    const qtyInput = bar.querySelector("#bdm-qty");
    const variantSelect = bar.querySelector("#bdm-variant");

    if (!button) return;

    /* ---------------- Apply settings ---------------- */

    if (CONFIG.backgroundColor) bar.style.backgroundColor = CONFIG.backgroundColor;
    if (CONFIG.textColor) bar.style.color = CONFIG.textColor;
    if (CONFIG.buttonColor) button.style.backgroundColor = CONFIG.buttonColor;
    if (CONFIG.buttonText) button.textContent = CONFIG.buttonText;

    if (qtyInput && CONFIG.showQuantity === false) qtyInput.style.display = "none";
    if (variantSelect && CONFIG.showVariants === false) variantSelect.style.display = "none";

    /* ---------------- Resolve variant ---------------- */

    function getVariantId() {
      if (variantSelect && variantSelect.value) {
        return Number(variantSelect.value);
      }

      try {
        const variants = JSON.parse(bar.dataset.variants || "[]");
        return variants[0]?.id || null;
      } catch {
        return null;
      }
    }

    function getQuantity() {
      if (CONFIG.showQuantity === false) return 1;
      return Math.max(1, Number(qtyInput?.value || 1));
    }

    /* ---------------- Impression ---------------- */

    track("sticky_atc_impression", {
      productId: window.ShopifyAnalytics?.meta?.product?.id
    });

    /* ---------------- Add to cart ---------------- */

    button.addEventListener("click", async () => {
      const variantId = getVariantId();
      if (!variantId) return;

      track("sticky_atc_click", {
        variantId
      });

      const payload = {
        items: [
          {
            id: variantId,
            quantity: getQuantity()
          }
        ]
      };

      const res = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        track("sticky_atc_success", { variantId });

        const cartToken = await getCartToken();
        sendStickyAttribution({
          cartToken,
          productId: window.ShopifyAnalytics?.meta?.product?.id,
          variantId
        });
      }

      window.location.href = "/cart";
    });
  });
})();
