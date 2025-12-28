// Sticky Add to Cart Bar – Universal Version (Variant-Safe + Analytics + Drawer Fix)
(function () {
  /* ----------------------------------------
     CONFIG
  -----------------------------------------*/
  const TRACK_URL =
    "https://sticky-add-to-cart-bar-pro.onrender.com/apps/bdm-sticky-atc/track";

  const ROOT =
    (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) ||
    "/";

  /* ----------------------------------------
     ANALYTICS (per-shop metrics)
  -----------------------------------------*/
  function sendAnalytics(event, payload = {}) {
    try {
      fetch(TRACK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event,
          shop: Shopify?.shop,
          product: payload.productId || window.ShopifyAnalytics?.meta?.product?.id,
          variant: payload.variantId,
          timestamp: Date.now(),
          ...payload,
        }),
      }).catch(() => {});
    } catch (err) {
      console.warn("Analytics error:", err);
    }
  }

  // Fire pageview immediately (best-effort)
  sendAnalytics("page_view", {
    productId: window.ShopifyAnalytics?.meta?.product?.id,
    variantId: getVariantIdFromUrl(),
  });

  /* ----------------------------------------
     HELPERS: product handle + product JSON
  -----------------------------------------*/
  function getHandleFromUrl() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("products");
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    return null;
  }

  async function fetchProductJson(handle) {
    if (!handle) return null;
    try {
      const res = await fetch(`${ROOT}products/${handle}.js`, {
        credentials: "same-origin",
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  function getVariantIdFromUrl() {
    try {
      const u = new URL(window.location.href);
      return u.searchParams.get("variant");
    } catch {
      return null;
    }
  }

  /* ----------------------------------------
     FIND PRODUCT FORM + VARIANT INPUTS
  -----------------------------------------*/
  function findProductForm() {
    // Most themes: product form posts to /cart/add
    const forms = [...document.querySelectorAll('form[action*="/cart/add"]')];
    if (forms.length) return forms[0];

    // fallback: any form that contains an input/select named id
    const any = [...document.querySelectorAll("form")].find((f) =>
      f.querySelector('[name="id"]')
    );
    return any || null;
  }

  function findVariantField(form) {
    if (!form) return null;
    // Could be select, hidden input, or radios
    const fields = [...form.querySelectorAll('[name="id"]')];
    if (!fields.length) return null;

    // Prefer a visible selector if present
    const visible = fields.find(
      (el) =>
        el.tagName === "SELECT" ||
        (el.type !== "hidden" && el.type !== "submit" && el.type !== "button")
    );
    return visible || fields[0];
  }

  function getVariantIdFromForm(form) {
    if (!form) return null;

    // If radios, the checked one wins
    const checkedRadio = form.querySelector('input[name="id"][type="radio"]:checked');
    if (checkedRadio?.value) return checkedRadio.value;

    // Select or hidden input
    const field = findVariantField(form);
    if (field?.value) return field.value;

    return null;
  }

  function setVariantOnForm(form, variantId) {
    if (!form || !variantId) return;

    // radios
    const radio = form.querySelector(`input[name="id"][type="radio"][value="${variantId}"]`);
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    // select / input
    const field = findVariantField(form);
    if (field) {
      field.value = variantId;
      field.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  /* ----------------------------------------
     CART REFRESH (Dawn + Universal)
  -----------------------------------------*/
  async function updateCartIconAndDrawer() {
    let handledByThemeDrawer = false;

    // TIER 1: Dawn/cart-drawer section refresh
    try {
      const sectionsRes = await fetch(
        `${ROOT}?sections=cart-drawer,cart-icon-bubble`,
        { credentials: "same-origin" }
      );

      let sections = null;
      try {
        sections = await sectionsRes.json();
      } catch {
        sections = null;
      }

      if (sections) {
        const parsedState = { id: Date.now(), sections };
        const cartDrawer = document.querySelector("cart-drawer");

        if (
          cartDrawer &&
          typeof cartDrawer.renderContents === "function" &&
          sections["cart-drawer"]
        ) {
          cartDrawer.renderContents(parsedState);

          try {
            const cart = await fetch(`${ROOT}cart.js`, { credentials: "same-origin" }).then((r) =>
              r.json()
            );
            cartDrawer.classList.toggle("is-empty", cart.item_count === 0);
          } catch {}
          handledByThemeDrawer = true;
        }

        const bubbleContainer = document.getElementById("cart-icon-bubble");
        if (bubbleContainer && sections["cart-icon-bubble"]) {
          const temp = document.createElement("div");
          temp.innerHTML = sections["cart-icon-bubble"];
          const newBubble = temp.querySelector("#cart-icon-bubble");
          if (newBubble) bubbleContainer.replaceWith(newBubble);
          handledByThemeDrawer = true;
        }
      }
    } catch (err) {
      console.warn("Theme drawer refresh failed:", err);
    }

    // TIER 2: UNIVERSAL CART COUNT + EVENTS
    try {
      const cart = await fetch(`${ROOT}cart.js`, { credentials: "same-origin" }).then((r) =>
        r.json()
      );
      const count = cart.item_count;

      document
        .querySelectorAll(".cart-count, .cart-count-bubble, [data-cart-count]")
        .forEach((el) => {
          el.textContent = count;
          el.dataset.cartCount = count;

          if (count > 0) {
            el.removeAttribute("hidden");
            el.classList.remove("is-empty");
            el.setAttribute("aria-hidden", "false");
          } else {
            el.classList.add("is-empty");
            el.setAttribute("aria-hidden", "true");
          }
        });

      document.dispatchEvent(new CustomEvent("cart:refresh", { detail: { cart } }));
      document.dispatchEvent(new CustomEvent("cartcount:update", { detail: { count } }));
      document.dispatchEvent(new CustomEvent("ajaxProduct:added", { detail: { cart } }));

      if (typeof window.fetchCart === "function") window.fetchCart();
      if (typeof window.updateCart === "function") window.updateCart();
      if (typeof window.refreshCart === "function") window.refreshCart();
    } catch (err) {
      console.warn("Universal cart update failed:", err);
    }

    // TIER 3: attempt to open cart drawer (non-dawn)
    try {
      const drawerToggle =
        document.querySelector('[data-cart-toggle]') ||
        document.querySelector('[data-drawer-toggle]') ||
        document.querySelector(".js-cart-toggle") ||
        document.querySelector(".js-drawer-open-cart") ||
        document.querySelector('[aria-controls="CartDrawer"]') ||
        document.querySelector("#cart-icon-bubble");

      if (drawerToggle) {
        drawerToggle.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
      }
    } catch (err) {
      console.warn("Fallback drawer open failed:", err);
    }

    return handledByThemeDrawer;
  }

  /* ----------------------------------------
     OPTIONAL: Attribution via cart attributes (best-effort)
  -----------------------------------------*/
  async function setCartAttributes(attrs) {
    try {
      const res = await fetch(`${ROOT}cart/update.js`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ attributes: attrs }),
      });
      if (!res.ok) throw new Error(await res.text());
      return true;
    } catch (e) {
      console.warn("Failed to set cart attributes for attribution:", e);
      return false;
    }
  }

  /* ----------------------------------------
     STICKY BAR INITIALIZATION (Variant-Safe)
  -----------------------------------------*/
  async function initStickyBar() {
    const rootEl = document.getElementById("bdm-sticky-atc-bar-root");
    if (!rootEl) return;

    const productForm = findProductForm();
    if (!productForm) return;

    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    const productTitle = rootEl.dataset.productTitle || document.title;

    // Get variants reliably
    const handle = getHandleFromUrl() || window.ShopifyAnalytics?.meta?.product?.handle;
    const productJson = await fetchProductJson(handle);

    const variants = Array.isArray(productJson?.variants) ? productJson.variants : [];
    const hasVariants = variants.length > 1;

    const findVariantById = (id) =>
      variants.find((v) => String(v.id) === String(id));

    const formatMoney = (cents) => {
      const safe = typeof cents === "number" ? cents : 0;
      return (safe / 100).toLocaleString(undefined, {
        style: "currency",
        currency: Shopify?.currency?.active || "USD",
      });
    };

    // Determine current variant (URL > form > first variant)
    let currentVariantId =
      getVariantIdFromUrl() ||
      getVariantIdFromForm(productForm) ||
      (variants[0] ? String(variants[0].id) : null);

    // Keep current price in cents
    let currentPriceCents = findVariantById(currentVariantId)?.price || null;

    // Build bar
    const bar = document.createElement("div");
    bar.className = "bdm-sticky-atc-bar-container";

    const inner = document.createElement("div");
    inner.className = "bdm-sticky-atc-bar-inner";

    const productInfo = document.createElement("div");
    productInfo.className = "bdm-sticky-atc-product";

    const titleEl = document.createElement("div");
    titleEl.className = "bdm-sticky-atc-title";
    titleEl.textContent = productTitle;

    const priceEl = document.createElement("div");
    priceEl.className = "bdm-sticky-atc-price";
    priceEl.textContent =
      typeof currentPriceCents === "number" ? formatMoney(currentPriceCents) : "";

    productInfo.appendChild(titleEl);
    productInfo.appendChild(priceEl);

    /* --------------------------
       VARIANT SELECTOR (Sticky)
    ---------------------------*/
    const variantWrapper = document.createElement("div");
    variantWrapper.className = "bdm-sticky-atc-variant";

    let stickyVariantSelect = null;

    if (hasVariants) {
      stickyVariantSelect = document.createElement("select");
      stickyVariantSelect.className = "bdm-sticky-atc-variant-select";

      variants.forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v.id;
        opt.textContent = v.public_title || v.title || `Variant ${v.id}`;
        stickyVariantSelect.appendChild(opt);
      });

      stickyVariantSelect.value = currentVariantId || stickyVariantSelect.value;

      stickyVariantSelect.addEventListener("change", () => {
        currentVariantId = stickyVariantSelect.value;

        const v = findVariantById(currentVariantId);
        if (v) {
          currentPriceCents = v.price;
          priceEl.textContent = formatMoney(currentPriceCents);
        }

        // Push to the real product form (this is the key)
        setVariantOnForm(productForm, currentVariantId);

        sendAnalytics("variant_change", {
          productId: productJson?.id ? String(productJson.id) : undefined,
          variantId: String(currentVariantId),
          price: typeof currentPriceCents === "number" ? currentPriceCents / 100 : null,
        });
      });

      if (isMobile) {
        titleEl.style.display = "none";
        const mobileVariantRow = document.createElement("div");
        mobileVariantRow.className = "bdm-variant-mobile-row";
        mobileVariantRow.appendChild(stickyVariantSelect);
        productInfo.insertBefore(mobileVariantRow, priceEl);
      } else {
        variantWrapper.appendChild(stickyVariantSelect);
      }
    }

    /* --------------------------
       QUANTITY CONTROLS
    ---------------------------*/
    const qtyWrapper = document.createElement("div");
    qtyWrapper.className = "bdm-sticky-atc-qty";

    const minusBtn = document.createElement("button");
    minusBtn.className = "bdm-qty-btn";
    minusBtn.type = "button";
    minusBtn.textContent = "−";

    const qtyInput = document.createElement("input");
    qtyInput.className = "bdm-qty-input";
    qtyInput.type = "number";
    qtyInput.min = "1";
    qtyInput.value = "1";

    const plusBtn = document.createElement("button");
    plusBtn.className = "bdm-qty-btn";
    plusBtn.type = "button";
    plusBtn.textContent = "+";

    minusBtn.addEventListener("click", () => {
      qtyInput.value = Math.max(1, Number(qtyInput.value) - 1);
    });

    plusBtn.addEventListener("click", () => {
      qtyInput.value = Number(qtyInput.value) + 1;
    });

    qtyWrapper.append(minusBtn, qtyInput, plusBtn);

    /* --------------------------
       ADD TO CART BUTTON
    ---------------------------*/
    const atcButton = document.createElement("button");
    atcButton.className = "bdm-sticky-atc-button";
    atcButton.type = "button";
    atcButton.textContent = "Add to cart";

    atcButton.addEventListener("click", async () => {
      // Re-read from the form at click-time (important for theme changes)
      const formVariantId =
        getVariantIdFromUrl() || getVariantIdFromForm(productForm) || currentVariantId;

      if (!formVariantId) {
        alert("Unable to determine variant.");
        return;
      }

      currentVariantId = String(formVariantId);

      const v = findVariantById(currentVariantId);
      if (v) {
        currentPriceCents = v.price;
        priceEl.textContent = formatMoney(currentPriceCents);
        if (stickyVariantSelect) stickyVariantSelect.value = currentVariantId;
      }

      const quantity = Math.max(1, Number(qtyInput.value) || 1);

      // Save last event locally
      sessionStorage.setItem(
        "bdm_sticky_atc_last_event",
        JSON.stringify({
          product: productJson?.id ? String(productJson.id) : undefined,
          variant: currentVariantId,
          time: Date.now(),
        })
      );

      // Optional: set cart attribute for attribution (best-effort)
      await setCartAttributes({
        bdm_sticky_variant: currentVariantId,
        bdm_sticky_product: productJson?.id ? String(productJson.id) : "",
        bdm_sticky_ts: String(Date.now()),
      });

      // Track ATC
      sendAnalytics("add_to_cart", {
        productId: productJson?.id ? String(productJson.id) : undefined,
        variantId: currentVariantId,
        quantity,
        price: typeof currentPriceCents === "number" ? currentPriceCents / 100 : null,
      });

      // Add to cart
      const res = await fetch(`${ROOT}cart/add.js`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({ id: Number(currentVariantId), quantity }),
      });

      if (!res.ok) {
        console.error("Cart add error", await res.text());
        alert("Could not add to cart. Please try again.");
        return;
      }

      sessionStorage.setItem("bdm_sticky_last_atc", String(Date.now()));
      sessionStorage.setItem("bdm_sticky_variant", currentVariantId);
      sessionStorage.setItem("bdm_sticky_product", productJson?.id ? String(productJson.id) : "");

      await updateCartIconAndDrawer();
    });

    /* --------------------------
       LAYOUT (desktop/mobile)
    ---------------------------*/
    const controls = document.createElement("div");
    controls.className = "bdm-sticky-atc-controls";

    if (!isMobile && hasVariants) {
      controls.append(variantWrapper, qtyWrapper, atcButton);
    } else {
      controls.append(qtyWrapper, atcButton);
    }

    inner.append(productInfo, controls);
    bar.appendChild(inner);
    document.body.appendChild(bar);

    /* ----------------------------------------
       SYNC: page variant changes → sticky updates
    -----------------------------------------*/
    function syncStickyFromPage() {
      const id =
        getVariantIdFromUrl() || getVariantIdFromForm(productForm) || currentVariantId;
      if (!id) return;

      if (String(id) === String(currentVariantId)) return;

      currentVariantId = String(id);
      const v = findVariantById(currentVariantId);
      if (v) {
        currentPriceCents = v.price;
        priceEl.textContent = formatMoney(currentPriceCents);
      }
      if (stickyVariantSelect) stickyVariantSelect.value = currentVariantId;
    }

    // Listen to changes in the product form
    productForm.addEventListener("change", (e) => {
      const t = e.target;
      if (!t) return;

      // Any change to the variant field should trigger sync
      if (t.name === "id") syncStickyFromPage();

      // Some themes update a different variant selector but still update URL
      setTimeout(syncStickyFromPage, 0);
    });

    // Listen to history navigation / URL changes
    window.addEventListener("popstate", syncStickyFromPage);

    // If theme uses pushState without popstate, poll lightly
    let lastVariant = currentVariantId;
    setInterval(() => {
      const v = getVariantIdFromUrl() || getVariantIdFromForm(productForm);
      if (v && String(v) !== String(lastVariant)) {
        lastVariant = String(v);
        syncStickyFromPage();
      }
    }, 600);

    // Initial sync
    syncStickyFromPage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initStickyBar);
  } else {
    initStickyBar();
  }
})();
