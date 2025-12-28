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
    // Most product pages have /products/{handle}
    const m = window.location.pathname.match(/\/products\/([^\/]+)/);
    return m?.[1] || null;
  }

  async function loadProductJson() {
    // Try embedded JSON first
    const embedded =
      document.querySelector('script[type="application/json"][data-product-json]') ||
      document.querySelector('script[type="application/json"][id^="ProductJson"]') ||
      document.querySelector("#ProductJson");

    if (embedded) {
      try {
        return JSON.parse(embedded.textContent);
      } catch (e) {
        // fall through
      }
    }

    // Fallback: /products/{handle}.js
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
    if (!product?.variants) return null;
    return product.variants.find(v => Number(v.id) === Number(id)) || null;
  }

  function getFirstAvailableVariant() {
    return product?.variants?.find(v => v.available) || product?.variants?.[0] || null;
  }

  function getSellingPlansFlat() {
    // /products/{handle}.js includes selling_plan_groups only if subscriptions are set up
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

  function resolveDisplayedPriceCents(variantId, sellingPlanId) {
    const v = getVariantById(variantId);
    if (!v) return null;

    // /products/{handle}.js variant.price is cents
    let price = typeof v.price === "number" ? v.price : null;
    if (!price) return null;

    // If you want *discounted* subscription price: Shopify doesn’t expose final computed price
    // in all JSON forms consistently. We show variant price + indicate subscription.
    return price;
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

    // minimal inline style so it works even if theme css changes
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

    const priceCents = resolveDisplayedPriceCents(selectedVariantId, selectedSellingPlanId);

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
              .map(v => {
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
                .map(p => {
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
          <input id="bdm-qty" type="number" min="1" value="1" style="width:70px;padding:8px;border-radius:8px;" />
        </label>

        <button id="bdm-add" style="background:#48d17f;color:#000;font-weight:700;border:none;padding:10px 16px;border-radius:999px;cursor:pointer;">
          Add to cart
        </button>
      </div>
    `;

    // wire events
    $("#bdm-variant", bar)?.addEventListener("change", e => {
      selectedVariantId = Number(e.target.value);
      // reset plan if variant changes (many stores restrict plans per variant)
      selectedSellingPlanId = $("#bdm-plan", bar)?.value || null;
      renderBar();
    });

    $("#bdm-plan", bar)?.addEventListener("change", e => {
      selectedSellingPlanId = e.target.value ? String(e.target.value) : null;
      renderBar();
    });

    $("#bdm-add", bar)?.addEventListener("click", async () => {
      const qty = Number($("#bdm-qty", bar)?.value || 1) || 1;

      const payload = {
        id: selectedVariantId,
        quantity: qty,
      };

      if (selectedSellingPlanId) {
        payload.selling_plan = selectedSellingPlanId;
      }

      // Track BEFORE add so you get data even if add fails
      const v = getVariantById(selectedVariantId);
      track("add_to_cart", {
        variantId: selectedVariantId,
        productId: v?.product_id ? String(v.product_id) : null,
        quantity: qty,
        price: v?.price ? v.price / 100 : null,
        sellingPlanId: selectedSellingPlanId || null,
      });

      const res = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.warn("Sticky ATC: add failed", await res.text());
        return;
      }

      // Optional: open cart drawer refresh
      document.dispatchEvent(new CustomEvent("cart:refresh"));
    });
  }

  /* ────────────────────────────────────────────── */
  /* INIT */
  /* ────────────────────────────────────────────── */

  async function init() {
    // Only run on product pages
    if (!window.location.pathname.includes("/products/")) return;

    product = await loadProductJson();
    if (!product) return;

    const initial = getFirstAvailableVariant();
    selectedVariantId = Number(initial?.id);
    selectedSellingPlanId = null;

    track("page_view", {
      productId: initial?.product_id ? String(initial.product_id) : null,
      variantId: selectedVariantId,
    });

    renderBar();
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init)
    : init();
})();
