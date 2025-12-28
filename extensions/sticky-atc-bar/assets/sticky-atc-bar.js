// Sticky Add to Cart Bar — FINAL (Universal Variant Sync + Variant Selector + Correct ATC)
(function () {
  if (window.__BDM_STICKY_ATC__) return;
  window.__BDM_STICKY_ATC__ = true;

  const TRACK_URL =
    "https://sticky-add-to-cart-bar-pro.onrender.com/apps/bdm-sticky-atc/track";

  const PRODUCT = window.ShopifyAnalytics?.meta?.product;
  const VARIANTS = PRODUCT?.variants || [];

  // If we can't see variants, exit gracefully (non-product pages)
  if (!PRODUCT || !Array.isArray(VARIANTS) || VARIANTS.length === 0) return;

  // ---------------------------
  // Analytics
  // ---------------------------
  function track(event, data = {}) {
    try {
      fetch(TRACK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: window.Shopify?.shop,
          event,
          productId: String(PRODUCT?.id || ""),
          ...data,
          timestamp: Date.now(),
        }),
      });
    } catch (e) {}
  }

  // ---------------------------
  // Variant detection (universal)
  // Priority:
  // 1) URL ?variant=123
  // 2) checked radio input[name="id"]
  // 3) any input/select[name="id"] value
  // 4) first variant
  // ---------------------------
  function getVariantIdFromUrl() {
    try {
      const url = new URL(window.location.href);
      return url.searchParams.get("variant");
    } catch (e) {
      return null;
    }
  }

  function getVariantIdFromFormControls() {
    // Radio-style
    const checkedRadio = document.querySelector('input[name="id"][type="radio"]:checked');
    if (checkedRadio?.value) return checkedRadio.value;

    // Hidden/input/select
    const anyIdField =
      document.querySelector('form[action*="/cart"] [name="id"]') ||
      document.querySelector('[name="id"]');

    if (anyIdField?.value) return anyIdField.value;

    return null;
  }

  function getActiveVariantId() {
    return (
      getVariantIdFromUrl() ||
      getVariantIdFromFormControls() ||
      String(VARIANTS[0]?.id || "")
    );
  }

  function findVariant(variantId) {
    return VARIANTS.find((v) => String(v.id) === String(variantId)) || null;
  }

  // ---------------------------
  // Theme-compatible setter
  // This is the key: we update URL + update relevant controls + fire events
  // ---------------------------
  function setThemeVariant(variantId) {
    // 1) Update URL (many themes derive state from this)
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("variant", String(variantId));
      window.history.replaceState({}, "", url.toString());
    } catch (e) {}

    // 2) Update <select name="id"> if present
    const select = document.querySelector('select[name="id"]');
    if (select) {
      select.value = String(variantId);
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }

    // 3) Update radio inputs if present
    const radios = document.querySelectorAll('input[name="id"][type="radio"]');
    if (radios && radios.length) {
      radios.forEach((r) => {
        if (String(r.value) === String(variantId)) {
          r.checked = true;
          // some themes listen on click, some on change
          r.dispatchEvent(new Event("input", { bubbles: true }));
          r.dispatchEvent(new Event("change", { bubbles: true }));
          r.dispatchEvent(new Event("click", { bubbles: true }));
        }
      });
    }

    // 4) Update hidden input[name=id] (Dawn uses this pattern too)
    const idInputs = document.querySelectorAll('input[name="id"]');
    idInputs.forEach((inp) => {
      // avoid overwriting radios already handled
      if (inp.type === "radio") return;
      inp.value = String(variantId);
      inp.dispatchEvent(new Event("input", { bubbles: true }));
      inp.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // 5) Nudge themes that re-render on variant change
    document.dispatchEvent(
      new CustomEvent("bdm:variant:change", { detail: { variantId: String(variantId) } })
    );
  }

  // ---------------------------
  // ATC
  // ---------------------------
  function getQuantity() {
    const qty =
      document.querySelector('form[action*="/cart"] [name="quantity"]') ||
      document.querySelector('input[name="quantity"]');
    return qty ? Math.max(1, parseInt(qty.value, 10) || 1) : 1;
  }

  async function addToCart(variantId, quantity) {
    const res = await fetch("/cart/add.js", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ id: String(variantId), quantity }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Add to cart failed");
    }
    return res.json();
  }

  // ---------------------------
  // Sticky Bar UI
  // ---------------------------
  let activeVariantId = null;
  let barEl = null;
  let selectEl = null;

  function formatPriceCents(cents) {
    const n = typeof cents === "number" ? cents : 0;
    const currency = window.Shopify?.currency?.active || "USD";
    return (n / 100).toLocaleString(undefined, {
      style: "currency",
      currency,
    });
  }

  function buildVariantSelect() {
    const select = document.createElement("select");
    select.style.cssText = `
      width: 100%;
      margin-bottom: 10px;
      padding: 10px 12px;
      font-size: 14px;
      border: 1px solid #ddd;
      border-radius: 8px;
      background: #fff;
    `;

    VARIANTS.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = String(v.id);
      const title = v.public_title || v.title || "Default";
      opt.textContent = `${title} — ${formatPriceCents(v.price)}`;
      select.appendChild(opt);
    });

    select.addEventListener("change", () => {
      const nextId = select.value;
      activeVariantId = nextId;

      // force theme to switch (THIS is what fixes “still uses main variant”)
      setThemeVariant(nextId);

      const v = findVariant(nextId);
      track("variant_change", {
        variantId: String(nextId),
        price: v ? v.price / 100 : null,
      });
    });

    return select;
  }

  function createStickyBar() {
    const bar = document.createElement("div");
    bar.id = "bdm-sticky-atc";
    bar.style.cssText = `
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 999999;
      background: #fff;
      border-top: 1px solid #eaeaea;
      padding: 12px;
      box-shadow: 0 -6px 22px rgba(0,0,0,0.08);
      display: none;
    `;

    const title = document.createElement("div");
    title.textContent = PRODUCT?.title || document.title || "Product";
    title.style.cssText = `
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 8px;
    `;

    selectEl = buildVariantSelect();

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Add to cart";
    btn.style.cssText = `
      width: 100%;
      padding: 14px 16px;
      font-size: 16px;
      font-weight: 600;
      background: #111;
      color: #fff;
      border: none;
      border-radius: 10px;
      cursor: pointer;
    `;

    btn.addEventListener("click", async () => {
      const qty = getQuantity();
      const id = activeVariantId || getActiveVariantId();
      const v = findVariant(id);

      // Safety: ensure theme form controls are synced before ATC
      setThemeVariant(id);

      track("add_to_cart", {
        variantId: String(id),
        quantity: qty,
        price: v ? v.price / 100 : null,
      });

      try {
        await addToCart(id, qty);
      } catch (err) {
        console.error("Sticky ATC error:", err);
        alert("Could not add to cart. Please try again.");
      }
    });

    bar.appendChild(title);
    bar.appendChild(selectEl);
    bar.appendChild(btn);

    document.body.appendChild(bar);
    return bar;
  }

  // ---------------------------
  // Keep sticky bar synced with theme changes
  // - URL changes
  // - input[name=id] changes
  // - radio changes
  // - re-renders
  // ---------------------------
  function syncBarToTheme() {
    const id = getActiveVariantId();
    activeVariantId = String(id);

    if (selectEl && selectEl.value !== String(id)) {
      selectEl.value = String(id);
    }
  }

  function installVariantObservers() {
    // 1) Watch for input changes on variant controls
    document.addEventListener("change", (e) => {
      const t = e.target;
      if (!t) return;

      // select[name=id] or input[name=id] changes => sync sticky bar
      if (
        (t.matches && t.matches('select[name="id"]')) ||
        (t.matches && t.matches('input[name="id"]'))
      ) {
        syncBarToTheme();
      }
    });

    // 2) Watch URL changes (some themes update variant param)
    window.addEventListener("popstate", syncBarToTheme);

    // 3) MutationObserver: if theme swaps forms on variant change
    const obs = new MutationObserver(() => {
      syncBarToTheme();
    });
    obs.observe(document.documentElement, { subtree: true, childList: true });
  }

  function init() {
    barEl = createStickyBar();

    // initialize from current theme state
    syncBarToTheme();

    track("page_view", { variantId: String(activeVariantId || "") });

    installVariantObservers();

    // show bar after scrolling
    window.addEventListener("scroll", () => {
      if (!barEl) return;
      barEl.style.display = window.scrollY > 300 ? "block" : "none";
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
