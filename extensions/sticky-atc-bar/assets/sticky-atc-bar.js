(() => {
  const BAR_ID = "bdm-sticky-atc";
  const TRACK_ENDPOINT = "/apps/bdm-sticky-atc/track";

  let product = null;
  let selectedVariantId = null;
  let selectedSellingPlanId = null;

  /* ────────────────────────────────────────────── */
  /* HELPERS */
  /* ────────────────────────────────────────────── */

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function formatMoney(cents) {
    if (typeof cents !== "number") return "";
    return `$${(cents / 100).toFixed(2)}`;
  }

  function getProductHandle() {
    const m = window.location.pathname.match(/\/products\/([^\/]+)/);
    return m?.[1] || null;
  }

  async function loadProductJson() {
    const embedded =
      document.querySelector('script[type="application/json"][data-product-json]') ||
      document.querySelector('script[type="application/json"][id^="ProductJson"]') ||
      document.querySelector("#ProductJson");

    if (embedded) {
      try {
        return JSON.parse(embedded.textContent);
      } catch {}
    }

    const handle = getProductHandle();
    if (!handle) return null;

    const res = await fetch(`/products/${handle}.js`, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return res.json();
  }

  function getVariantById(id) {
    return product?.variants?.find((v) => Number(v.id) === Number(id)) || null;
  }

  function getFirstAvailableVariant() {
    return product?.variants?.find((v) => v.available) || product?.variants?.[0] || null;
  }

  function getSellingPlansFlat() {
    const groups = product?.selling_plan_groups || [];
    const plans = [];
    for (const g of groups) {
      for (const p of g.selling_plans || []) {
        plans.push({ id: String(p.id), name: p.name, groupName: g.name });
      }
    }
    return plans;
  }

  function resolveDisplayedPriceCents(variantId) {
    const v = getVariantById(variantId);
    return typeof v?.price === "number" ? v.price : null;
  }

  function track(event, payload) {
    fetch(TRACK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, ...payload }),
    }).catch(() => {});
  }

  /* ────────────────────────────────────────────── */
  /* THEME CART HELPERS (OPEN + REFRESH) */
  /* ────────────────────────────────────────────── */

  async function fetchCart() {
    const res = await fetch("/cart.js", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error("Failed to fetch cart");
    return res.json();
  }

  /**
   * Dawn / many OS2 themes update cart UI by re-rendering "sections"
   * Common section ids:
   * - cart-drawer
   * - cart-icon-bubble
   * - cart-notification
   *
   * We request all and apply what exists on the page.
   */
  async function refreshCartSections() {
    const sectionIds = ["cart-drawer", "cart-icon-bubble", "cart-notification"];
    const url = `${window.location.pathname}?sections=${encodeURIComponent(sectionIds.join(","))}`;

    const res = await fetch(url, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) return false;

    const data = await res.json().catch(() => null);
    if (!data || typeof data !== "object") return false;

    let updated = false;

    // cart drawer
    if (data["cart-drawer"]) {
      const current = document.querySelector("cart-drawer") || document.getElementById("CartDrawer");
      if (current) {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = data["cart-drawer"];
        const next =
          wrapper.querySelector("cart-drawer") ||
          wrapper.querySelector("#CartDrawer") ||
          wrapper.firstElementChild;
        if (next) {
          current.replaceWith(next);
          updated = true;
        }
      }
    }

    // cart icon bubble
    if (data["cart-icon-bubble"]) {
      const current =
        document.getElementById("cart-icon-bubble") ||
        document.querySelector("[id*='cart-icon-bubble']");
      if (current) {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = data["cart-icon-bubble"];
        const next = wrapper.querySelector("#cart-icon-bubble") || wrapper.firstElementChild;
        if (next) {
          current.replaceWith(next);
          updated = true;
        }
      }
    }

    // cart notification
    if (data["cart-notification"]) {
      const current = document.querySelector("cart-notification") || document.getElementById("CartNotification");
      if (current) {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = data["cart-notification"];
        const next =
          wrapper.querySelector("cart-notification") ||
          wrapper.querySelector("#CartNotification") ||
          wrapper.firstElementChild;
        if (next) {
          current.replaceWith(next);
          updated = true;
        }
      }
    }

    return updated;
  }

  /**
   * Try to open the cart drawer in a theme-safe way.
   * We:
   *  1) dispatch common events
   *  2) call known drawer APIs (Dawn has a cart-drawer element)
   *  3) click common cart triggers (without navigating if possible)
   */
  function openCartDrawer() {
    // 1) common events (some themes listen)
    document.dispatchEvent(new CustomEvent("cart:open"));
    document.dispatchEvent(new CustomEvent("cart:toggle", { detail: { open: true } }));
    document.dispatchEvent(new CustomEvent("cart:refresh"));

    // 2) Dawn cart drawer element often exposes .open() / setAttribute
    const drawerEl = document.querySelector("cart-drawer") || document.getElementById("CartDrawer");
    if (drawerEl) {
      try {
        if (typeof drawerEl.open === "function") {
          drawerEl.open();
          return true;
        }
      } catch {}
      try {
        drawerEl.setAttribute("open", "");
        drawerEl.classList.add("active");
        document.body.classList.add("overflow-hidden"); // some themes use this
        return true;
      } catch {}
    }

    // 3) click cart icon / button triggers
    const triggers = [
      "#cart-icon-bubble a",
      'a[href="/cart"]',
      'button[name="open-cart"]',
      '[data-cart-toggle]',
      '[aria-controls*="CartDrawer"]',
      '[data-drawer-trigger]',
    ];

    for (const sel of triggers) {
      const el = document.querySelector(sel);
      if (!el) continue;

      // avoid hard navigation to /cart if possible
      if (el.tagName === "A" && el.getAttribute("href") === "/cart") {
        // only click if it looks like a drawer trigger (aria-controls / data attribute)
        const hasDrawerHint =
          el.getAttribute("aria-controls") ||
          el.hasAttribute("data-cart-toggle") ||
          el.closest("[data-cart-toggle]") ||
          el.closest("[aria-controls*='CartDrawer']");
        if (!hasDrawerHint) continue;
      }

      try {
        el.click();
        return true;
      } catch {}
    }

    return false;
  }

  /**
   * After add, do the “real” refresh path first (sections),
   * then open drawer, then fire generic events as a backup.
   */
  async function refreshAndOpenCart() {
    // try section refresh first (most reliable)
    await refreshCartSections().catch(() => {});

    // then open
    openCartDrawer();

    // finally, send updated cart object to any listeners
    try {
      const cart = await fetchCart();
      document.dispatchEvent(new CustomEvent("cart:updated", { detail: cart }));
      document.dispatchEvent(new CustomEvent("cart:change", { detail: cart }));
      document.dispatchEvent(new CustomEvent("cart:refresh", { detail: cart }));
    } catch {}
  }

  /* ────────────────────────────────────────────── */
  /* UI */
  /* ────────────────────────────────────────────── */

  function ensureBar() {
    let bar = document.getElementById(BAR_ID);
    if (bar) return bar;

    bar = document.createElement("div");
    bar.id = BAR_ID;

    // minimal inline styles
    bar.style.position = "fixed";
    bar.style.left = "0";
    bar.style.right = "0";
    bar.style.bottom = "0";
    bar.style.zIndex = "99999";
    bar.style.padding = "12px";
    bar.style.background = "#111";
    bar.style.color = "#fff";
    bar.style.display = "flex";
    bar.style.gap = "12px";
    bar.style.alignItems = "center";
    bar.style.justifyContent = "space-between";

    document.body.appendChild(bar);
    return bar;
  }

  function renderBar() {
    const bar = ensureBar();
    const plans = getSellingPlansFlat();
    const priceCents = resolveDisplayedPriceCents(selectedVariantId);

    bar.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:4px;min-width:200px;">
        <div style="font-weight:700;font-size:16px;line-height:1.1;">
          ${product?.title || "Product"}
        </div>
        <div style="opacity:.9;font-size:14px;">
          <span id="bdm-price">${priceCents ? formatMoney(priceCents) : ""}</span>
          ${selectedSellingPlanId ? `<span style="opacity:.85;"> · Subscription</span>` : ""}
        </div>
      </div>

      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
        <label style="display:flex;flex-direction:column;font-size:12px;gap:4px;color:#ddd;">
          Variant
          <select id="bdm-variant" style="padding:8px;border-radius:8px;">
            ${(product?.variants || [])
              .map((v) => {
                const name = v.public_title || v.title || "Default";
                const disabled = v.available ? "" : "disabled";
                const sel = Number(v.id) === Number(selectedVariantId) ? "selected" : "";
                return `<option value="${v.id}" ${sel} ${disabled}>${name}</option>`;
              })
              .join("")}
          </select>
        </label>

        ${
          plans.length
            ? `
          <label style="display:flex;flex-direction:column;font-size:12px;gap:4px;color:#ddd;">
            Purchase option
            <select id="bdm-plan" style="padding:8px;border-radius:8px;">
              <option value="">One-time purchase</option>
              ${plans
                .map((p) => {
                  const sel = String(p.id) === String(selectedSellingPlanId) ? "selected" : "";
                  return `<option value="${p.id}" ${sel}>${p.groupName}: ${p.name}</option>`;
                })
                .join("")}
            </select>
          </label>
        `
            : ""
        }

        <label style="display:flex;flex-direction:column;font-size:12px;gap:4px;color:#ddd;">
          Qty
          <input id="bdm-qty" type="number" min="1" value="1"
            style="width:70px;padding:8px;border-radius:8px;" />
        </label>

        <button id="bdm-add"
          style="background:#48d17f;color:#000;font-weight:700;border:none;padding:10px 16px;border-radius:999px;cursor:pointer;">
          Add to cart
        </button>
      </div>
    `;

    // variant change
    $("#bdm-variant", bar)?.addEventListener("change", (e) => {
      selectedVariantId = Number(e.target.value);
      // keep plan selection if possible; otherwise reset
      selectedSellingPlanId = $("#bdm-plan", bar)?.value || null;
      renderBar();
    });

    // plan change
    $("#bdm-plan", bar)?.addEventListener("change", (e) => {
      selectedSellingPlanId = e.target.value ? String(e.target.value) : null;
      renderBar();
    });

    // add to cart
    $("#bdm-add", bar)?.addEventListener("click", async () => {
      const qty = Number($("#bdm-qty", bar)?.value || 1) || 1;
      const v = getVariantById(selectedVariantId);

      if (!selectedVariantId) {
        console.warn("Sticky ATC: no variant selected");
        return;
      }

      track("add_to_cart", {
        variantId: String(selectedVariantId),
        productId: v?.product_id ? String(v.product_id) : null,
        quantity: qty,
        price: typeof v?.price === "number" ? v.price / 100 : null,
        sellingPlanId: selectedSellingPlanId || null,
      });

      const formData = new FormData();
      formData.append("id", String(selectedVariantId));
      formData.append("quantity", String(qty));
      if (selectedSellingPlanId) {
        formData.append("selling_plan", String(selectedSellingPlanId));
      }

      try {
        const res = await fetch("/cart/add.js", {
          method: "POST",
          body: formData,
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });

        if (!res.ok) {
          console.warn("Sticky ATC: add failed", await res.text());
          return;
        }

        // ✅ refresh + open drawer without page refresh
        await refreshAndOpenCart();
      } catch (err) {
        console.error("Sticky ATC: network error", err);
      }
    });
  }

  /* ────────────────────────────────────────────── */
  /* INIT */
  /* ────────────────────────────────────────────── */

  async function init() {
    if (!window.location.pathname.includes("/products/")) return;

    product = await loadProductJson();
    if (!product) return;

    const initial = getFirstAvailableVariant();
    selectedVariantId = Number(initial?.id);
    selectedSellingPlanId = null;

    track("page_view", {
      productId: initial?.product_id ? String(initial.product_id) : null,
      variantId: String(selectedVariantId),
    });

    renderBar();
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init)
    : init();
})();
