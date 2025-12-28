(function () {
  if (window.__BDM_STICKY_ATC__) return;
  window.__BDM_STICKY_ATC__ = true;

  const TRACK_URL =
    "https://sticky-add-to-cart-bar-pro.onrender.com/apps/bdm-sticky-atc/track";

  const PRODUCT = window.ShopifyAnalytics?.meta?.product;
  const VARIANTS = PRODUCT?.variants || [];
  if (!PRODUCT || !Array.isArray(VARIANTS) || VARIANTS.length === 0) return;

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

  function findVariant(id) {
    return VARIANTS.find((v) => String(v.id) === String(id)) || null;
  }

  // ---------------------------
  // THE FIX:
  // Capture the TRUE variant ID from the real product form.
  // This works even when themes use custom variant pickers.
  // ---------------------------
  let lastKnownVariantId = String(VARIANTS[0]?.id || "");

  function getVariantFromAnyCartForm() {
    // Find the first add-to-cart form on page
    const form =
      document.querySelector('form[action*="/cart/add"]') ||
      document.querySelector('form[action="/cart/add"]') ||
      document.querySelector('form[action^="/cart/add"]') ||
      document.querySelector("product-form form") ||
      document.querySelector("form");

    if (!form) return null;

    // Variant id is ALWAYS in name="id" somewhere if the form is real
    const idField =
      form.querySelector('[name="id"]') ||
      document.querySelector('[name="id"]');

    if (!idField || !idField.value) return null;
    return String(idField.value);
  }

  // Intercept real form submits to capture correct variant
  function installFormIntercept() {
    document.addEventListener(
      "submit",
      (e) => {
        const form = e.target;
        if (!form || !(form instanceof HTMLFormElement)) return;

        const action = (form.getAttribute("action") || "").toLowerCase();
        const isCartAdd =
          action.includes("/cart/add") ||
          form.querySelector('[name="id"]')?.value;

        if (!isCartAdd) return;

        const idField = form.querySelector('[name="id"]');
        if (idField?.value) {
          lastKnownVariantId = String(idField.value);
          syncStickySelectToVariant(lastKnownVariantId);
        }
      },
      true
    );
  }

  // Also capture when variant controls change (works for normal themes too)
  function installChangeListeners() {
    document.addEventListener(
      "change",
      (e) => {
        const t = e.target;
        if (!t) return;

        // If any input/select with name="id" changes, that's the variant
        if (t.matches && t.matches('[name="id"]')) {
          if (t.value) {
            lastKnownVariantId = String(t.value);
            syncStickySelectToVariant(lastKnownVariantId);
          }
        }

        // Many themes keep the variant id in a hidden input updated by JS
        const maybe = getVariantFromAnyCartForm();
        if (maybe) {
          lastKnownVariantId = maybe;
          syncStickySelectToVariant(lastKnownVariantId);
        }
      },
      true
    );
  }

  // ---------------------------
  // Sticky UI
  // ---------------------------
  let barEl = null;
  let selectEl = null;

  function formatPriceCents(cents) {
    const currency = window.Shopify?.currency?.active || "USD";
    return (Number(cents || 0) / 100).toLocaleString(undefined, {
      style: "currency",
      currency,
    });
  }

  function syncStickySelectToVariant(variantId) {
    if (!selectEl) return;
    if (selectEl.value !== String(variantId)) {
      selectEl.value = String(variantId);
    }
  }

  function setVariantInThemeForm(variantId) {
    // Set on ALL name="id" fields we can find (hidden/select/radio)
    const inputs = document.querySelectorAll('[name="id"]');
    inputs.forEach((el) => {
      if (el.tagName === "SELECT") {
        el.value = String(variantId);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (el.type === "radio") {
        if (String(el.value) === String(variantId)) {
          el.checked = true;
          el.dispatchEvent(new Event("change", { bubbles: true }));
          el.dispatchEvent(new Event("click", { bubbles: true }));
        }
      } else {
        el.value = String(variantId);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    // Update URL as a nice-to-have
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("variant", String(variantId));
      window.history.replaceState({}, "", url.toString());
    } catch (e) {}
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

  function getQuantity() {
    const qty =
      document.querySelector('form[action*="/cart"] [name="quantity"]') ||
      document.querySelector('input[name="quantity"]');
    return qty ? Math.max(1, parseInt(qty.value, 10) || 1) : 1;
  }

  function buildVariantSelect() {
    const s = document.createElement("select");
    s.style.cssText = `
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
      s.appendChild(opt);
    });

    s.addEventListener("change", () => {
      const nextId = String(s.value);
      lastKnownVariantId = nextId;

      // Force theme form to match (so cart/add.js uses correct variant)
      setVariantInThemeForm(nextId);

      const v = findVariant(nextId);
      track("variant_change", {
        variantId: nextId,
        price: v ? v.price / 100 : null,
      });
    });

    return s;
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
      // Pull the true variant from the real form if possible
      const fromForm = getVariantFromAnyCartForm();
      const variantId = fromForm || lastKnownVariantId || String(VARIANTS[0]?.id || "");
      const qty = getQuantity();
      const v = findVariant(variantId);

      // Ensure theme state is aligned before adding
      setVariantInThemeForm(variantId);

      track("add_to_cart", {
        variantId: String(variantId),
        quantity: qty,
        price: v ? v.price / 100 : null,
      });

      try {
        await addToCart(variantId, qty);
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

  function init() {
    barEl = createStickyBar();

    // Initialize lastKnownVariantId from the actual cart form
    const initial = getVariantFromAnyCartForm();
    if (initial) lastKnownVariantId = String(initial);

    syncStickySelectToVariant(lastKnownVariantId);

    track("page_view", { variantId: String(lastKnownVariantId) });

    installFormIntercept();
    installChangeListeners();

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
