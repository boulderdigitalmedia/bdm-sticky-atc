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
        <div style="font-weight:700;font-size:16px;">${product?.title || "Product"}</div>
        <div style="opacity:.9;font-size:14px;">
          ${priceCents ? formatMoney(priceCents) : ""}
          ${selectedSellingPlanId ? `<span style="opacity:.85;"> · Subscription</span>` : ""}
        </div>
      </div>

      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <label style="font-size:12px;">
          Variant
          <select id="bdm-variant" style="padding:8px;border-radius:8px;">
            ${product.variants.map(v => `
              <option value="${v.id}" ${v.id === selectedVariantId ? "selected" : ""} ${!v.available ? "disabled" : ""}>
                ${v.public_title || v.title || "Default"}
              </option>
            `).join("")}
          </select>
        </label>

        ${
          plans.length ? `
          <label style="font-size:12px;">
            Purchase
            <select id="bdm-plan" style="padding:8px;border-radius:8px;">
              <option value="">One-time</option>
              ${plans.map(p => `
                <option value="${p.id}" ${p.id === selectedSellingPlanId ? "selected" : ""}>
                  ${p.groupName}: ${p.name}
                </option>
              `).join("")}
            </select>
          </label>` : ""
        }

        <input id="bdm-qty" type="number" min="1" value="1"
          style="width:70px;padding:8px;border-radius:8px;" />

        <button id="bdm-add"
          style="background:#48d17f;color:#000;font-weight:700;border:none;padding:10px 16px;border-radius:999px;cursor:pointer;">
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
      if (!v) return;

      track("add_to_cart", {
        productId: String(v.product_id),
        variantId: String(v.id),
        quantity: qty,
        price: v.price / 100,
        sellingPlanId: selectedSellingPlanId,
      });

      const form = new FormData();
      form.append("id", v.id);
      form.append("quantity", qty);
      if (selectedSellingPlanId) {
        form.append("selling_plan", selectedSellingPlanId);
      }

      const res = await fetch("/cart/add", {
        method: "POST",
        body: form,
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) return;

      /* ───── FORCE CART UPDATE (CRITICAL FIX) ───── */

      const cart = await fetch("/cart.js").then(r => r.json());

      document.dispatchEvent(new CustomEvent("cart:updated", { detail: { cart } }));
      document.dispatchEvent(new CustomEvent("cart:refresh", { detail: { cart } }));
      document.dispatchEvent(new CustomEvent("ajaxProduct:added", { detail: { cart } }));

      try {
        const sections = await fetch(
          "/?sections=cart-drawer,cart-icon-bubble",
          { credentials: "same-origin" }
        ).then(r => r.json());

        const drawer = document.querySelector("cart-drawer");
        if (drawer && sections["cart-drawer"]) {
          drawer.innerHTML = sections["cart-drawer"];
        }

        const bubble = document.querySelector("#cart-icon-bubble");
        if (bubble && sections["cart-icon-bubble"]) {
          bubble.innerHTML = sections["cart-icon-bubble"];
        }
      } catch {}

      const toggle =
        document.querySelector('[aria-controls="CartDrawer"]') ||
        document.querySelector("#cart-icon-bubble");

      toggle?.dispatchEvent(new Event("click", { bubbles: true }));

// ─── CLEANUP AFTER DRAWER CLOSE ───
setTimeout(() => {
  const drawer =
    document.querySelector("cart-drawer") ||
    document.querySelector(".cart-drawer");

  if (!drawer) return;

  const observer = new MutationObserver(() => {
    const isOpen =
      drawer.hasAttribute("open") ||
      drawer.classList.contains("active") ||
      drawer.classList.contains("is-open");

    if (!isOpen) {
      unlockPageScroll();
      observer.disconnect();
    }
  });

  observer.observe(drawer, {
    attributes: true,
    attributeFilter: ["class", "open"],
  });
}, 300);

    });
  }

  /* ────────────────────────────────────────────── */
  /* INIT */
  /* ────────────────────────────────────────────── */

  async function init() {
    if (!location.pathname.includes("/products/")) return;

    product = await loadProductJson();
    if (!product) return;

    const initial = getFirstAvailableVariant();
    selectedVariantId = Number(initial?.id);

    track("page_view", {
      productId: String(initial?.product_id),
      variantId: String(selectedVariantId),
    });

    renderBar();
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init)
    : init();
})();
