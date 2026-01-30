(() => {
  console.log("[BDM Sticky ATC] JS file loaded");

  const BAR_ID = "bdm-sticky-atc";
  const CONFIG = window.BDM_STICKY_ATC_CONFIG || {};

  console.log("[BDM Sticky ATC] Config detected:", CONFIG);

  /* ---------------- Helpers ---------------- */

  function isMobile() {
    return window.matchMedia("(max-width: 768px)").matches;
  }

  function shouldRender() {
    const result =
      !(isMobile() && CONFIG.enableMobile === false) &&
      !(!isMobile() && CONFIG.enableDesktop === false);

    console.log("[BDM Sticky ATC] shouldRender:", result);
    return result;
  }

  function getVariantsFromBar(bar) {
    try {
      const raw = bar.dataset.variants;
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      console.log("[BDM Sticky ATC] Variants from Liquid:", parsed);
      return parsed;
    } catch (err) {
      console.error("[BDM Sticky ATC] Failed to parse data-variants", err);
      return [];
    }
  }

  /* ---------------- Attribution helpers ---------------- */

  function getStickyAtcSessionId() {
    const KEY = "bdm_sticky_atc_session_id";
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  }

  /* ---------------- Analytics ---------------- */

  function track(event, data = {}) {
    console.log("[BDM Sticky ATC] track()", event, data);
    try {
      fetch("/apps/bdm-sticky-atc/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        keepalive: true,
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
    const res = await fetch("/cart.js", {
      credentials: "same-origin",
      keepalive: true
    });
    const cart = await res.json();
    return cart.token;
  }

  async function sendStickyAttribution({ cartToken, productId, variantId }) {
    try {
      const res = await fetch("/apps/bdm-sticky-atc/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Shop-Domain": window.Shopify?.shop
        },
        credentials: "same-origin",
        keepalive: true,
        body: JSON.stringify({ cartToken, productId, variantId })
      });

      if (!res.ok) {
        console.warn(
          "[BDM Sticky ATC] Attribution endpoint missing or rejected:",
          res.status
        );
      }
    } catch (err) {
      console.warn("[BDM Sticky ATC] Attribution failed safely", err);
    }
  }

  /* ---------------- Init ---------------- */

  document.addEventListener("DOMContentLoaded", () => {
    const bar = document.getElementById(BAR_ID);
    if (!bar) {
      console.warn("[BDM Sticky ATC] Bar not found");
      return;
    }

    if (!shouldRender()) {
      bar.style.display = "none";
      return;
    }

    const variants = getVariantsFromBar(bar);
    if (!variants.length) {
      console.warn("[BDM Sticky ATC] No variants found — aborting");
      return;
    }

    const productId = variants[0].product_id;
    let selectedVariantId = variants[0].id;
    let quantity = 1;

    const button = bar.querySelector("#bdm-atc");
    const qtyInput = bar.querySelector("#bdm-qty");
    const variantSelect = bar.querySelector("#bdm-variant");

    if (!button) {
      console.error("[BDM Sticky ATC] Button not found");
      return;
    }

    /* ---------------- Apply settings ---------------- */

    if (CONFIG.backgroundColor) bar.style.backgroundColor = CONFIG.backgroundColor;
    if (CONFIG.textColor) bar.style.color = CONFIG.textColor;
    if (CONFIG.buttonColor) button.style.backgroundColor = CONFIG.buttonColor;
    if (CONFIG.buttonText) button.textContent = CONFIG.buttonText;

    if (qtyInput && CONFIG.showQuantity === false) qtyInput.style.display = "none";
    if (variantSelect && CONFIG.showVariants === false) variantSelect.style.display = "none";

    /* ---------------- Variant selector ---------------- */

    if (variantSelect && CONFIG.showVariants !== false && variants.length > 1) {
      variantSelect.innerHTML = "";
      variants.forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v.id;
        opt.textContent = v.public_title || v.title;
        variantSelect.appendChild(opt);
      });

      variantSelect.addEventListener("change", () => {
        selectedVariantId = Number(variantSelect.value);
        console.log("[BDM Sticky ATC] Variant changed:", selectedVariantId);
      });
    }

    if (qtyInput) {
      qtyInput.addEventListener("change", () => {
        quantity = Math.max(1, Number(qtyInput.value || 1));
        console.log("[BDM Sticky ATC] Quantity:", quantity);
      });
    }

    /* ---------------- Impression ---------------- */

    track("sticky_atc_impression", { productId });

    /* ---------------- Add to cart ---------------- */

    button.addEventListener("click", async () => {
      console.log("[BDM Sticky ATC] Click", { selectedVariantId, quantity });

      track("sticky_atc_click", {
        productId,
        variantId: selectedVariantId
      });

      const payload = {
        items: [
          {
            id: selectedVariantId,
            quantity
          }
        ]
      };

      const res = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload)
      });

      console.log("[BDM Sticky ATC] /cart/add.js status:", res.status);

      if (res.ok) {
        track("sticky_atc_success", {
          productId,
          variantId: selectedVariantId
        });

        const cartToken = await getCartToken();
        sendStickyAttribution({
          cartToken,
          productId,
          variantId: selectedVariantId
        });
      }

      requestAnimationFrame(() => {
        window.location.href = "/cart";
      });
    });
  });
})();
