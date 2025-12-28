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
    return product?.variants?.find(v => Number(v.id) === Number(id)) || null;
  }

  function getFirstAvailableVariant() {
    return product?.variants?.find(v => v.available) || product?.variants?.[0] || null;
  }

  function getSellingPlansFlat() {
    const groups = product?.selling_plan_groups || [];
    const plans = [];
    for (const g of groups) {
      for (const p of g.selling_plans || []) {
        plans.push({
          id: String(p.id),
          name: p.name,
          groupName: g.name,
        });
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
  /* CART DRAWER REFRESH (THE FIX) */
  /* ────────────────────────────────────────────── */

  async function refreshCartUI() {
    try {
      // 1️⃣ Refresh cart data
      const cart = await fetch("/cart.js").then(r => r.json());

      // 2️⃣ Dawn / OS 2.0 events
      document.dispatchEvent(new CustomEvent("cart:refresh", { detail: { cart } }));
      document.dispatchEvent(new CustomEvent("cart:updated", { detail: { cart } }));
      document.dispatchEvent(new CustomEvent("ajaxProduct:added", { detail: { cart } }));

      // 3️⃣ Force drawer open (multiple fallbacks)
      const drawerToggle =
        document.querySelector('[aria-controls="CartDrawer"]') ||
        document.querySelector('[data-cart-toggle]') ||
        document.querySelector('.js-drawer-open-cart') ||
        document.querySelector('#cart-icon-bubble');

      if (drawerToggle) {
        drawerToggle.dispatchEvent(
          new Event("click", { bubbles: true, cancelable: true })
        );
      }
    } catch (err) {
      console.warn("Sticky ATC: cart refresh failed", err);
    }
  }

  /* ────────────────────────────────────────────── */
  /* UI */
  /* ────────────────────────────────────────────── */

  function ensureBar() {
    let bar = document.getElementById(BAR_ID);
    if (bar) return bar;

    bar = document.createElement("div");
    bar.id = BAR_ID;

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
    const variant = getVariantById(selectedVariantId);
    const plans = getSellingPlansFlat();
    const priceCents = resolveDisplayedPriceCents(selectedVariantId);

    bar.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:4px;min-width:200px;">
        <div style="font-weight:700;font-size:16px;">
          ${product?.title || "Product"}
        </div>
        <div style="opacity:.9;font-size:14px;">
          ${priceCents ? formatMoney(priceCents) : ""}
          ${selectedSellingPlanId ? `<span style="opacity:.8;"> · Subscription</span>` : ""}
        </div>
      </div>

      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <select id="bdm-variant">
          ${(product?.variants || [])
            .map(v => {
              const sel = Number(v.id) === Number(selectedVariantId) ? "selected" : "";
              return `<option value="${v.id}" ${sel}>${v.public_title || v.title || "Default"}</option>`;
            })
            .join("")}
        </select>

        ${
          plans.length
            ? `<select id="bdm-plan">
                <option value="">One-time purchase</option>
                ${plans
                  .map(p => {
                    const sel = p.id === selectedSellingPlanId ? "selected" : "";
                    return `<option value="${p.id}" ${sel}>${p.groupName}: ${p.name}</option>`;
                  })
                  .join("")}
              </select>`
            : ""
        }

        <input id="bdm-qty" type="number" min="1" value="1" style="width:70px;" />

        <button id="bdm-add" style="background:#48d17f;font-weight:700;border:none;padding:10px 16px;border-radius:999px;">
          Add to cart
        </button>
      </div>
    `;

    $("#bdm-variant", bar)?.addEventListener("change", e => {
      selectedVariantId = Number(e.target.value);
      selectedSellingPlanId = null;
      renderBar();
    });

    $("#bdm-plan", bar)?.addEventListener("change", e => {
      selectedSellingPlanId = e.target.value || null;
      renderBar();
    });

    $("#bdm-add", bar)?.addEventListener("click", async () => {
      const qty = Number($("#bdm-qty", bar)?.value || 1);
      const v = getVariantById(selectedVariantId);
      if (!selectedVariantId) return;

      track("add_to_cart", {
        productId: String(v?.product_id || ""),
        variantId: String(selectedVariantId),
        quantity: qty,
        price: v?.price ? v.price / 100 : null,
        sellingPlanId: selectedSellingPlanId,
      });

      const fd = new FormData();
      fd.append("id", selectedVariantId);
      fd.append("quantity", qty);
      if (selectedSellingPlanId) fd.append("selling_plan", selectedSellingPlanId);

      const res = await fetch("/cart/add", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });

      if (res.ok) {
        await refreshCartUI();
      } else {
        console.warn("Sticky ATC: add failed", await res.text());
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
      productId: String(initial?.product_id || ""),
      variantId: String(selectedVariantId),
    });

    renderBar();
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init)
    : init();
})();
