(() => {
  const BAR_ID = "bdm-sticky-atc";
  const TRACK_ENDPOINT = "/apps/bdm-sticky-atc/track";

  let product = null;
  let selectedVariantId = null;
  let selectedSellingPlanId = null;

  /* ───────────────────────── HELPERS ───────────────────────── */

  const $ = (sel, root = document) => root.querySelector(sel);

  const formatMoney = (cents) =>
    typeof cents === "number" ? `$${(cents / 100).toFixed(2)}` : "";

  const getProductHandle = () =>
    window.location.pathname.match(/\/products\/([^/]+)/)?.[1] || null;

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

    return res.ok ? res.json() : null;
  }

  const getVariantById = (id) =>
    product?.variants?.find((v) => Number(v.id) === Number(id)) || null;

  const getFirstAvailableVariant = () =>
    product?.variants?.find((v) => v.available) || product?.variants?.[0] || null;

  const getSellingPlansFlat = () => {
    const plans = [];
    for (const g of product?.selling_plan_groups || []) {
      for (const p of g.selling_plans || []) {
        plans.push({ id: String(p.id), name: p.name, group: g.name });
      }
    }
    return plans;
  };

  const track = (event, payload) => {
    fetch(TRACK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, ...payload }),
    }).catch(() => {});
  };

  /* ───────────── CART REFRESH (SAFE – NO DOM REPLACE) ───────────── */

  async function refreshCartState() {
    try {
      const res = await fetch("/cart.js", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const cart = await res.json();

      document.dispatchEvent(new CustomEvent("cart:updated", { detail: cart }));
      document.dispatchEvent(new CustomEvent("cart:change", { detail: cart }));
      document.dispatchEvent(new CustomEvent("cart:refresh", { detail: cart }));

      return cart;
    } catch {
      return null;
    }
  }

  function openCartDrawerThemeSafe(cart) {
    const drawer =
      document.querySelector("cart-drawer") ||
      document.getElementById("CartDrawer");

    if (!drawer) return;

    // Dawn / OS 2.0 official API
    if (typeof drawer.renderContents === "function" && cart) {
      drawer.renderContents(cart);
      drawer.open?.();
      return;
    }

    if (typeof drawer.open === "function") {
      drawer.open();
      return;
    }

    // Last-resort triggers
    document.dispatchEvent(new CustomEvent("cart:open"));
    document.dispatchEvent(new CustomEvent("cart:toggle", { detail: { open: true } }));
  }

  async function refreshAndOpenCart() {
    const cart = await refreshCartState();
    openCartDrawerThemeSafe(cart);
  }

  /* ───────────────────────── UI ───────────────────────── */

  function ensureBar() {
    let bar = document.getElementById(BAR_ID);
    if (bar) return bar;

    bar = document.createElement("div");
    bar.id = BAR_ID;
    bar.style.cssText = `
      position:fixed;
      left:0; right:0; bottom:0;
      z-index:99999;
      background:#111;
      color:#fff;
      padding:12px;
      display:flex;
      gap:12px;
      align-items:center;
      justify-content:space-between;
    `;
    document.body.appendChild(bar);
    return bar;
  }

  function renderBar() {
    const bar = ensureBar();
    const variant = getVariantById(selectedVariantId);
    const plans = getSellingPlansFlat();

    bar.innerHTML = `
      <div style="min-width:200px">
        <div style="font-weight:700">${product.title}</div>
        <div style="opacity:.85">
          ${formatMoney(variant?.price)}
          ${selectedSellingPlanId ? " · Subscription" : ""}
        </div>
      </div>

      <div style="display:flex;gap:10px;align-items:center">
        <select id="bdm-variant">
          ${product.variants
            .map(
              (v) =>
                `<option value="${v.id}" ${
                  Number(v.id) === selectedVariantId ? "selected" : ""
                } ${v.available ? "" : "disabled"}>
                  ${v.public_title || v.title}
                </option>`
            )
            .join("")}
        </select>

        ${
          plans.length
            ? `
          <select id="bdm-plan">
            <option value="">One-time</option>
            ${plans
              .map(
                (p) =>
                  `<option value="${p.id}" ${
                    p.id === selectedSellingPlanId ? "selected" : ""
                  }>${p.group}: ${p.name}</option>`
              )
              .join("")}
          </select>`
            : ""
        }

        <input id="bdm-qty" type="number" min="1" value="1" style="width:60px"/>

        <button id="bdm-add" style="font-weight:700">Add to cart</button>
      </div>
    `;

    $("#bdm-variant", bar).onchange = (e) => {
      selectedVariantId = Number(e.target.value);
      renderBar();
    };

    $("#bdm-plan", bar)?.addEventListener("change", (e) => {
      selectedSellingPlanId = e.target.value || null;
    });

    $("#bdm-add", bar).onclick = async () => {
      const qty = Number($("#bdm-qty", bar).value || 1);
      const v = getVariantById(selectedVariantId);

      track("add_to_cart", {
        productId: String(v.product_id),
        variantId: String(selectedVariantId),
        quantity: qty,
        price: v.price / 100,
        sellingPlanId: selectedSellingPlanId,
      });

      const fd = new FormData();
      fd.append("id", selectedVariantId);
      fd.append("quantity", qty);
      if (selectedSellingPlanId) fd.append("selling_plan", selectedSellingPlanId);

      const res = await fetch("/cart/add.js", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });

      if (res.ok) {
        await refreshAndOpenCart();
      }
    };
  }

  /* ───────────────────────── INIT ───────────────────────── */

  async function init() {
    if (!location.pathname.includes("/products/")) return;

    product = await loadProductJson();
    if (!product) return;

    selectedVariantId = Number(getFirstAvailableVariant()?.id);

    track("page_view", {
      productId: String(product.id),
      variantId: String(selectedVariantId),
    });

    renderBar();
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init)
    : init();
})();
