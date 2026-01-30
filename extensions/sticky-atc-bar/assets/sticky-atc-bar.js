(() => {
  console.log("[BDM Sticky ATC] JS file loaded");

  const BAR_ID = "bdm-sticky-atc";
  const CONFIG = window.BDM_STICKY_ATC_CONFIG || {};

  console.log("[BDM Sticky ATC] Config detected:", CONFIG);

  /* ---------------- Helpers ---------------- */

  function isMobile() {
    const mobile = window.matchMedia("(max-width: 768px)").matches;
    console.log("[BDM Sticky ATC] isMobile:", mobile);
    return mobile;
  }

  function shouldRender() {
    const result =
      !(isMobile() && CONFIG.enableMobile === false) &&
      !(!isMobile() && CONFIG.enableDesktop === false);

    console.log("[BDM Sticky ATC] shouldRender result:", {
      enableMobile: CONFIG.enableMobile,
      enableDesktop: CONFIG.enableDesktop,
      result
    });

    return result;
  }

  function formatMoney(cents) {
    if (typeof cents !== "number") return "";
    return `$${(cents / 100).toFixed(2)}`;
  }

  function getProductJson() {
    const script =
      document.querySelector('script[type="application/json"][data-product-json]') ||
      document.querySelector("#ProductJson");

    if (!script) {
      console.error("[BDM Sticky ATC] Product JSON script NOT found");
      return null;
    }

    try {
      const parsed = JSON.parse(script.textContent);
      console.log("[BDM Sticky ATC] Product JSON loaded:", parsed);
      return parsed;
    } catch (err) {
      console.error("[BDM Sticky ATC] Failed to parse product JSON", err);
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
    console.log("[BDM Sticky ATC] track()", event, data);
    try {
      fetch("/api/track", {
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
      }).catch((err) => {
        console.warn("[BDM Sticky ATC] track fetch failed", err);
      });
    } catch (err) {
      console.error("[BDM Sticky ATC] track exception", err);
    }
  }

  async function getCartToken() {
    console.log("[BDM Sticky ATC] Fetching cart token");
    const res = await fetch("/cart.js", {
      credentials: "same-origin",
      keepalive: true
    });
    const cart = await res.json();
    console.log("[BDM Sticky ATC] Cart token:", cart.token);
    return cart.token;
  }

  async function sendStickyAttribution({ cartToken, productId, variantId }) {
    console.log("[BDM Sticky ATC] sendStickyAttribution()", {
      cartToken,
      productId,
      variantId
    });

    try {
      fetch("/apps/bdm-sticky-atc/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Shop-Domain": window.Shopify?.shop
        },
        credentials: "same-origin",
        keepalive: true,
        body: JSON.stringify({
          cartToken,
          productId,
          variantId
        })
      }).catch((err) => {
        console.warn("[BDM Sticky ATC] attribution fetch failed", err);
      });
    } catch (err) {
      console.error("[BDM Sticky ATC] attribution exception", err);
    }
  }

  /* ---------------- Abort if disabled ---------------- */

  if (!shouldRender()) {
    console.warn("[BDM Sticky ATC] shouldRender() returned false — aborting");
    return;
  }

  const product = getProductJson();
  if (!product) {
    console.warn("[BDM Sticky ATC] No product — aborting");
    return;
  }

  /* ---------------- DOM ---------------- */

  console.log("[BDM Sticky ATC] Creating bar DOM");

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

  console.log("[BDM Sticky ATC] Bar appended to DOM");

  /* ---------------- Impression tracking ---------------- */

  track("sticky_atc_impression", { productId: product.id });

  /* ---------------- Styles ---------------- */

  if (CONFIG.backgroundColor) bar.style.backgroundColor = CONFIG.backgroundColor;
  if (CONFIG.textColor) bar.style.color = CONFIG.textColor;

  const button = bar.querySelector(".bdm-atc-button");
  if (!button) {
    console.error("[BDM Sticky ATC] Button not found");
    return;
  }

  if (CONFIG.buttonColor) button.style.backgroundColor = CONFIG.buttonColor;

  /* ---------------- Controls ---------------- */

  const controls = bar.querySelector(".bdm-atc-controls");

  let quantity = 1;
  let selectedVariantId = product.variants[0]?.id;
  let selectedSellingPlanId = null;

  console.log("[BDM Sticky ATC] Initial variant ID:", selectedVariantId);

  if (CONFIG.showQuantity !== false) {
    const qty = document.createElement("input");
    qty.type = "number";
    qty.min = "1";
    qty.value = "1";
    qty.className = "bdm-atc-qty";

    qty.addEventListener("change", () => {
      quantity = Math.max(1, parseInt(qty.value, 10) || 1);
      console.log("[BDM Sticky ATC] Quantity changed:", quantity);
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
      selectedVariantId = Number(select.value);
      console.log("[BDM Sticky ATC] Variant changed:", selectedVariantId);
    });

    controls.appendChild(select);
  }

  /* ---------------- Add to cart ---------------- */

  button.addEventListener("click", async () => {
    console.log("[BDM Sticky ATC] Add to cart clicked", {
      selectedVariantId,
      quantity
    });

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

    console.log("[BDM Sticky ATC] cart/add payload:", payload);

    const res = await fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload)
    });

    console.log("[BDM Sticky ATC] /cart/add.js response:", res.status);

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
      console.error("[BDM Sticky ATC] Add to cart failed");
    }

    console.log("[BDM Sticky ATC] Redirecting to /cart");
    window.location.href = "/cart";
  });
})();
