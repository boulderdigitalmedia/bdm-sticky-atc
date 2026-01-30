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
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: window.Shopify?.shop,
          event,
          data: {
            ...data,
            sessionId: getStickyAtcSessionId()
          }
        }),
        credentials: "same-origin" // ✅ FIX
      }).catch(() => {});
    } catch {}
  }

  async function getCartToken() {
    const res = await fetch("/cart.js", {
      credentials: "same-origin" // ✅ FIX (consistency)
    });
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
        body: JSON.stringify({
          cartToken,
          productId,
          variantId
        }),
        credentials: "same-origin" // ✅ FIX
      });
    } catch (err) {
      console.warn("Sticky attribution failed", err);
    }
  }

  /* ---------------- Abort if disabled ---------------- */

  if (!shouldRender()) return;

  const product = getProductJson();
  if (!product) return;

  /* ---------------- DOM ---------------- */

  const bar = document.createElement("div");
  bar.id = BAR_ID;

  bar.innerHTML = `
    <div class="bdm-atc-inner">
      <div class="bdm-atc-info">
        <span class="bdm-atc-title">${product.title}</span>
        <span class="bdm-atc-price">${formatMoney(product.price)}</span>
      </div>
      <div class="bdm-atc-controls"></div>
      <button class="bdm-atc-button">Add to cart</button>
    </div>
  `;

  document.body.appendChild(bar);

  /* ---------------- Impression tracking ---------------- */

  track("sticky_atc_impression", {
    productId: product.id
  });

  /* ---------------- Styles ---------------- */

  if (CONFIG.backgroundColor) bar.style.backgroundColor = CONFIG.backgroundColor;
  if (CONFIG.textColor) bar.style.color = CONFIG.textColor;

  const button = bar.querySelector(".bdm-atc-button");
  if (button && CONFIG.buttonColor) {
    button.style.backgroundColor = CONFIG.buttonColor;
  }

  /* ---------------- Controls ---------------- */

  const controls = bar.querySelector(".bdm-atc-controls");

  let quantity = 1;
  let selectedVariantId = product.variants[0]?.id; // number
  let selectedSellingPlanId = null;

  if (CONFIG.showQuantity !== false) {
    const qty = document.createElement("input");
    qty.type = "number";
    qty.min = "1";
    qty.value = "1";
    qty.className = "bdm-atc-qty";

    qty.addEventListener("change", () => {
      quantity = Math.max(1, parseInt(qty.value, 10) || 1);
    });

    controls.appendChild(qty);
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
      selectedVariantId = Number(select.value); // ✅ FIX
    });

    controls.appendChild(select);
  }

  /* ---------------- Add to cart ---------------- */

  button.addEventListener("click", async () => {
    track("sticky_atc_click", {
      productId: product.id,
      variantId: selectedVariantId
    });

    const payload = {
      items: [
        {
          id: selectedVariantId,
          quantity,
          ...(selectedSellingPlanId
            ? { selling_plan: selectedSellingPlanId }
            : {})
        }
      ]
    };

    const res = await fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin" // ✅ FIX (THIS IS THE BIG ONE)
    });

    if (res.ok) {
      track("sticky_atc_success", {
        productId: product.id,
        variantId: selectedVariantId
      });

      const cartToken = await getCartToken();
      sendStickyAttribution({
        cartToken,
        productId: product.id,
        variantId: selectedVariantId
      });
    } else {
      console.error("Sticky ATC add failed", await res.text());
    }

    window.location.href = "/cart";
  });
})();
