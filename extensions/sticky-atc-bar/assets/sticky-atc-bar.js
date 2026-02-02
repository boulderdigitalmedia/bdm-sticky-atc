(() => {
  // Prevent double init on theme editor navigations
  if (window.__BDM_STICKY_ATC_INIT__) return;
  window.__BDM_STICKY_ATC_INIT__ = true;

  const bar = document.getElementById("bdm-sticky-atc");
  if (!bar) return;

  // Device toggles
  const isMobile = () => window.matchMedia("(max-width: 768px)").matches;
  const enableMobile = bar.getAttribute("data-enable-mobile") !== "false";
  const enableDesktop = bar.getAttribute("data-enable-desktop") !== "false";
  if (isMobile() && !enableMobile) return;
  if (!isMobile() && !enableDesktop) return;

  const titleEl = bar.querySelector("#bdm-title");
  const priceEl = bar.querySelector("#bdm-price");
  const qtyEl = bar.querySelector("#bdm-qty");
  const button = bar.querySelector("#bdm-atc");

  const variantWrap = bar.querySelector("#bdm-variant-wrap");
  const sellingWrap = bar.querySelector("#bdm-selling-plan-wrap");

  const showTitle = bar.getAttribute("data-show-title") !== "false";
  const showPrice = bar.getAttribute("data-show-price") !== "false";
  const showQty = bar.getAttribute("data-show-qty") !== "false";
  const showVariant = bar.getAttribute("data-show-variant") !== "false";
  const showSellingPlan = bar.getAttribute("data-show-selling-plan") !== "false";

  if (titleEl) titleEl.style.display = showTitle ? "" : "none";
  if (priceEl) priceEl.style.display = showPrice ? "" : "none";
  if (qtyEl) qtyEl.style.display = showQty ? "" : "none";
  if (variantWrap) variantWrap.style.display = showVariant ? "" : "none";
  if (sellingWrap) sellingWrap.style.display = showSellingPlan ? "" : "none";

  // Product JSON from Liquid
  const productScript = document.querySelector("script[data-bdm-product-json]");
  if (!productScript) return;

  let product;
  try {
    product = JSON.parse(productScript.textContent);
  } catch {
    return;
  }

  if (!product?.id || !Array.isArray(product.variants) || product.variants.length === 0) return;

  // Try to bind to main product form inputs
  const mainVariantInput =
    document.querySelector('input[name="id"]') ||
    document.querySelector('select[name="id"]');

  const getSelectedVariantId = () => {
    const fromMain = mainVariantInput?.value;
    return fromMain ? String(fromMain) : String(product.variants[0].id);
  };

  const getSelectedSellingPlanId = () => {
    // common patterns
    const checkedRadio = document.querySelector('input[name="selling_plan"]:checked');
    if (checkedRadio?.value) return String(checkedRadio.value);

    const select = document.querySelector('select[name="selling_plan"]');
    if (select?.value) return String(select.value);

    return null;
  };

  const moneyFromCents = (cents) => `$${(cents / 100).toFixed(2)}`;

  // In product JSON, variant.price can be string dollars or integer cents depending on source.
  const normalizeVariantPriceCents = (v) => {
    if (typeof v.price === "number") {
      // Some theme JSON outputs dollars as number. Some outputs cents as number.
      // Heuristic: if it's > 9999, it's probably cents.
      return v.price > 9999 ? v.price : Math.round(v.price * 100);
    }
    const n = Number(v.price);
    if (Number.isFinite(n)) return Math.round(n * 100);
    return null;
  };

  const findVariant = (variantId) =>
    product.variants.find((v) => String(v.id) === String(variantId)) || product.variants[0];

  // Session + analytics
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

  const TRACK_ENDPOINT = "/apps/bdm-sticky-atc/track";

  const track = (event, data = {}) => {
    const shop = getShop();
    fetch(TRACK_ENDPOINT, {
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
          sessionId: getSessionId(),
          ts: Date.now()
        }
      }),
      keepalive: true
    }).catch(() => {});
  };

  // Populate
  const render = () => {
    const variantId = getSelectedVariantId();
    const variant = findVariant(variantId);

    if (titleEl) titleEl.textContent = product.title;

    const cents = normalizeVariantPriceCents(variant);
    if (priceEl && cents != null) priceEl.textContent = moneyFromCents(cents);

    return { variantId, variant };
  };

  // Build variant selector (optional)
  let barVariantSelect = null;
  if (showVariant && variantWrap && product.variants.length > 1) {
    const select = document.createElement("select");
    select.className = "bdm-variant-select";
    product.variants.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = String(v.id);
      opt.textContent = v.title;
      select.appendChild(opt);
    });
    variantWrap.appendChild(select);
    barVariantSelect = select;

    // Initialize selection
    barVariantSelect.value = getSelectedVariantId();

    // When user changes variant in bar, update main input if present
    barVariantSelect.addEventListener("change", () => {
      if (mainVariantInput) {
        mainVariantInput.value = barVariantSelect.value;
        mainVariantInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
      render();
    });
  }

  // Build selling plan selector (optional)
  let barSellingSelect = null;
  if (showSellingPlan && sellingWrap) {
    // We don't always have plan data in product JSON (depends on theme).
    // So we mirror whatever is on the page, if present.
    const pageSelect = document.querySelector('select[name="selling_plan"]');
    const pageRadios = Array.from(document.querySelectorAll('input[name="selling_plan"]'));

    if (pageSelect) {
      const clone = document.createElement("select");
      clone.className = "bdm-selling-select";
      Array.from(pageSelect.options).forEach((o) => {
        const opt = document.createElement("option");
        opt.value = o.value;
        opt.textContent = o.textContent;
        clone.appendChild(opt);
      });
      sellingWrap.appendChild(clone);
      barSellingSelect = clone;

      barSellingSelect.value = pageSelect.value;

      barSellingSelect.addEventListener("change", () => {
        pageSelect.value = barSellingSelect.value;
        pageSelect.dispatchEvent(new Event("change", { bubbles: true }));
      });
    } else if (pageRadios.length) {
      // If radios exist, we don’t rebuild UI; we just keep it hidden (or you can implement later).
      // For now: leave wrap empty but visible only if wanted.
    } else {
      // No selling plan UI on page
      sellingWrap.style.display = "none";
    }
  }

  // Keep in sync when main variant changes (theme variant pickers)
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (!t) return;
    if (t.name === "id") {
      if (barVariantSelect) barVariantSelect.value = String(t.value);
      render();
    }
    if (t.name === "selling_plan") {
      if (barSellingSelect && t.tagName === "SELECT") barSellingSelect.value = String(t.value);
    }
  });

  // Visibility behavior
  const showOnScroll = bar.getAttribute("data-show-on-scroll") === "true";
  const scrollOffset = Number(bar.getAttribute("data-scroll-offset") || "250");

  const showBar = () => {
    bar.classList.add("is-visible");
    bar.setAttribute("aria-hidden", "false");
  };

  const setupVisibility = () => {
    if (!showOnScroll) {
      showBar();
      return;
    }
    const onScroll = () => {
      if (window.scrollY >= scrollOffset) {
        showBar();
        window.removeEventListener("scroll", onScroll);
        // Impression when shown
        const { variantId } = render();
        track("sticky_atc_impression", { productId: product.id, variantId });
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    // If already scrolled
    onScroll();
  };

  // Initial render
  const { variantId } = render();

  // If not show-on-scroll, impression right away
  if (!showOnScroll) {
    track("sticky_atc_impression", { productId: product.id, variantId });
  }

  setupVisibility();

  // Add to cart
  if (button) {
    button.addEventListener("click", async () => {
      const variantIdNow = getSelectedVariantId();
      const sellingPlanId = getSelectedSellingPlanId();
      const quantity = showQty && qtyEl ? Math.max(1, parseInt(qtyEl.value, 10) || 1) : 1;

      track("sticky_atc_click", {
        productId: product.id,
        variantId: variantIdNow,
        quantity,
        sellingPlanId: sellingPlanId || null
      });

      button.disabled = true;
      const originalText = button.textContent;
      button.textContent = "Adding…";

      try {
        const payload = {
          items: [
            {
              id: variantIdNow,
              quantity,
              ...(sellingPlanId ? { selling_plan: sellingPlanId } : {})
            }
          ]
        };

        const res = await fetch("/cart/add.js", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          track("sticky_atc_error", { productId: product.id, variantId: variantIdNow });
          return;
        }

        track("sticky_atc_success", {
          productId: product.id,
          variantId: variantIdNow,
          quantity,
          sellingPlanId: sellingPlanId || null
        });

        window.location.href = "/cart";
      } finally {
        button.disabled = false;
        button.textContent = originalText || "Add to cart";
      }
    });
  }
})();
