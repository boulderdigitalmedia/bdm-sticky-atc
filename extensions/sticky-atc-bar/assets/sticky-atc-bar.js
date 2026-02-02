(() => {
  // Avoid double init on theme editor nav
  if (window.__BDM_STICKY_ATC_INIT__) return;
  window.__BDM_STICKY_ATC_INIT__ = true;

  const bar = document.querySelector("[data-bdm-sticky-atc]");
  if (!bar) return;

  // Helpers
  const isMobile = () => window.matchMedia("(max-width: 768px)").matches;
  const isTrue = (v) => String(v).toLowerCase() === "true";

  // Device gating (now that Option A passes real values)
  if (isMobile() && !isTrue(bar.dataset.enableMobile)) return;
  if (!isMobile() && !isTrue(bar.dataset.enableDesktop)) return;

  // Show/hide elements based on settings
  const showTitle = isTrue(bar.dataset.showTitle);
  const showPrice = isTrue(bar.dataset.showPrice);
  const showQty = isTrue(bar.dataset.showQty);
  const showVariant = isTrue(bar.dataset.showVariant);

  const titleEl = bar.querySelector("#bdm-title");
  const priceEl = bar.querySelector("#bdm-price");
  const qtyEl = bar.querySelector("#bdm-qty");
  const button = bar.querySelector("#bdm-atc");
  const variantWrap = bar.querySelector("#bdm-variant-wrap");

  if (titleEl) titleEl.style.display = showTitle ? "" : "none";
  if (priceEl) priceEl.style.display = showPrice ? "" : "none";
  if (qtyEl) qtyEl.style.display = showQty ? "" : "none";
  if (variantWrap) variantWrap.style.display = showVariant ? "" : "none";

  // Load product JSON from liquid (Option A: this will exist)
  const productScript = document.querySelector("script[data-bdm-product-json]");
  if (!productScript) {
    console.warn("BDM Sticky ATC: missing product json script");
    return;
  }

  let product;
  try {
    product = JSON.parse(productScript.textContent);
  } catch {
    console.warn("BDM Sticky ATC: invalid product json");
    return;
  }

  if (!product?.id || !Array.isArray(product.variants) || !product.variants.length) return;

  // Main product form variant input (keeps in sync with theme pickers)
  const mainVariantInput =
    document.querySelector('input[name="id"]') ||
    document.querySelector('select[name="id"]');

  const getSelectedVariantId = () => {
    const v = mainVariantInput?.value;
    return v ? String(v) : String(product.variants[0].id);
  };

  const findVariant = (id) =>
    product.variants.find((v) => String(v.id) === String(id)) || product.variants[0];

  const moneyFromCents = (cents) => `$${(cents / 100).toFixed(2)}`;

  // Variant price normalization (theme JSON can vary)
  const normalizePriceCents = (v) => {
    if (typeof v.price === "number") return v.price > 9999 ? v.price : Math.round(v.price * 100);
    const n = Number(v.price);
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  };

  // ---- Analytics ----
  const SESSION_KEY = "bdm_sticky_atc_session_id";
  const getSessionId = () => {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  };

  const getShop = () =>
    window.Shopify?.shop ||
    document.querySelector('meta[name="shopify-shop-domain"]')?.content ||
    document.documentElement.getAttribute("data-shop") ||
    null;

  // Use your preferred endpoint; fallback covers either mounting.
  const TRACK_PRIMARY = "/apps/bdm-sticky-atc/track";
  const TRACK_FALLBACK = "/api/track/track";

  const postTrack = async (url, payload) => {
    try {
      const res = await fetch(url, payload);
      return res.ok;
    } catch {
      return false;
    }
  };

  const track = (event, data = {}) => {
    const shop = getShop();
    const payload = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(shop ? { "X-Shopify-Shop-Domain": shop } : {})
      },
      body: JSON.stringify({
        shop: shop || undefined,
        event,
        data: { ...data, sessionId: getSessionId(), ts: Date.now() }
      }),
      keepalive: true
    };

    // Try primary; if 404/mis-mounted, fallback
    postTrack(TRACK_PRIMARY, payload).then((ok) => {
      if (!ok) postTrack(TRACK_FALLBACK, payload);
    });
  };

  // Render title/price
  const render = () => {
    const variantId = getSelectedVariantId();
    const variant = findVariant(variantId);

    if (titleEl && showTitle) titleEl.textContent = product.title;

    if (priceEl && showPrice) {
      const cents = normalizePriceCents(variant);
      if (cents != null) priceEl.textContent = moneyFromCents(cents);
    }

    return { variantId };
  };

  // Optional in-bar variant selector
  let barVariantSelect = null;
  if (showVariant && variantWrap && product.variants.length > 1) {
    const select = document.createElement("select");
    product.variants.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = String(v.id);
      opt.textContent = v.title;
      select.appendChild(opt);
    });
    variantWrap.appendChild(select);
    barVariantSelect = select;

    barVariantSelect.value = getSelectedVariantId();
    barVariantSelect.addEventListener("change", () => {
      if (mainVariantInput) {
        mainVariantInput.value = barVariantSelect.value;
        mainVariantInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
      render();
    });
  }

  // Keep in sync if theme changes variant
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t && t.name === "id") {
      if (barVariantSelect) barVariantSelect.value = String(t.value);
      render();
    }
  });

  // Visibility behavior
  const showOnScroll = isTrue(bar.dataset.showOnScroll);
  const scrollOffset = Number(bar.dataset.scrollOffset || 250);

  const showBar = () => {
    bar.classList.add("is-visible");
    bar.setAttribute("aria-hidden", "false");
  };

  const setupVisibility = () => {
    if (!showOnScroll) {
      showBar();
      const { variantId } = render();
      track("sticky_atc_impression", { productId: product.id, variantId });
      return;
    }

    const onScroll = () => {
      if (window.scrollY >= scrollOffset) {
        showBar();
        const { variantId } = render();
        track("sticky_atc_impression", { productId: product.id, variantId });
        window.removeEventListener("scroll", onScroll);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  };

  // Initial render & setup
  render();
  setupVisibility();

  // Add to cart
  if (button) {
    button.addEventListener("click", async () => {
      const quantity = showQty && qtyEl ? Math.max(1, parseInt(qtyEl.value, 10) || 1) : 1;
      const variantId = getSelectedVariantId();

      track("sticky_atc_click", { productId: product.id, variantId, quantity });

      const originalText = button.textContent || "Add to cart";
      button.disabled = true;
      button.textContent = "Adding…";

      try {
        const res = await fetch("/cart/add.js", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ items: [{ id: variantId, quantity }] })
        });

        if (!res.ok) {
          track("sticky_atc_error", { productId: product.id, variantId, quantity });
          return;
        }

        track("sticky_atc_success", { productId: product.id, variantId, quantity });
        window.location.href = "/cart";
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    });
  }
})();
