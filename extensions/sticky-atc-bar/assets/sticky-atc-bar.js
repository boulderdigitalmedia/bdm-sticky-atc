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

  function formatMoney(cents) {
    if (typeof cents !== "number") return "";
    return `$${(cents / 100).toFixed(2)}`;
  }

  function getProductJson() {
    const script =
      document.querySelector('script[type="application/json"][data-product-json]') ||
      document.querySelector("#ProductJson");

    if (!script) return null;
    try {
      return JSON.parse(script.textContent);
    } catch {
      return null;
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

  function track(event, data = {}) {
    try {
      fetch("/apps/bdm-sticky-atc/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  // 🔑 NEW: get cart token
  async function getCartToken() {
    const res = await fetch("/cart.js", { credentials: "same-origin" });
    const cart = await res.json();
    return cart.token;
  }

  // 🔑 NEW: send attribution (fire-and-forget)
  async function sendStickyAttribution({ cartToken, productId, variantId }) {
    try {
      await fetch("/apps/bdm-sticky-atc/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Shop-Domain": window.Shopify?.shop
        },
        body: JSON.stringify({
          cartToken,
          productId,
          variantId
        })
      });
    } catch (err) {
      // never block checkout
      console.warn("Sticky attribution failed", err);
    }
  }

  /* ---------------- Abort if disabled ---------------- */

  if (!shouldRender()) return;

  const product = getProductJson();
  if (!product) return;

  /* ---------------- DOM ---------------- */

  const bar = document.getElementById(BAR_ID);
  if (!bar) return;

  bar.setAttribute("aria-hidden", "false");
  const title = bar.querySelector("#bdm-title");
  const price = bar.querySelector("#bdm-price");
  const button = bar.querySelector("#bdm-atc");
  const qtyInput = bar.querySelector("#bdm-qty");
  const controls = bar.querySelector(".bdm-right");

  if (!controls || !button || !title || !price) return;

  title.textContent = product.title;
  price.textContent = formatMoney(product.price);

  /* ---------------- Impression tracking ---------------- */

  track("sticky_atc_impression", {
    productId: product.id
  });

  /* ---------------- Styles ---------------- */

  if (CONFIG.backgroundColor) bar.style.backgroundColor = CONFIG.backgroundColor;
  if (CONFIG.textColor) bar.style.color = CONFIG.textColor;

  if (CONFIG.buttonColor) {
    button.style.backgroundColor = CONFIG.buttonColor;
  }

  /* ---------------- Controls ---------------- */

  let quantity = 1;
  let selectedVariantId = product.variants[0]?.id;
  let selectedSellingPlanId = null;

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
      opt.value = v.id;
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
    // click intent
    track("sticky_atc_click", {
      productId: product.id,
      variantId: selectedVariantId
    });

    const payload = {
      items: [
        {
          id: selectedVariantId,
          quantity,
          selling_plan: selectedSellingPlanId
        }
      ]
    };

    const res = await fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      track("sticky_atc_success", {
        productId: product.id,
        variantId: selectedVariantId
      });

      // 🔑 NEW: capture cart token + write StickyAttribution
      const cartToken = await getCartToken();
      sendStickyAttribution({
        cartToken,
        productId: product.id,
        variantId: selectedVariantId
      });
    }

    window.location.href = "/cart";
  });
})();
