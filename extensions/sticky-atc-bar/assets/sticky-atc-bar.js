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
        plans.push({ id: String(p.id), name: p.name, groupName: g.name });
      }
    }
    return plans;
  }

  function track(event, payload) {
    fetch(TRACK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, ...payload }),
    }).catch(() => {});
  }

  /* ────────────────────────────────────────────── */
  /* DAWN CART REFRESH + FIXED CLEANUP */
  /* ────────────────────────────────────────────── */

  function cleanupBodyAfterDrawerClose() {
    document.body.classList.remove(
      "overflow-hidden",
      "cart-open",
      "drawer-open",
      "modal-open"
    );
  }

  async function refreshAndOpenCart() {
    let cart;

    try {
      const res = await fetch("/cart.js", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      cart = await res.json();
    } catch {
      return;
    }

    const drawer =
      document.querySelector("cart-drawer") ||
      document.getElementById("CartDrawer");

    // ✅ Official Dawn API
    if (drawer && typeof drawer.renderContents === "function") {
      drawer.renderContents(cart);
      drawer.open?.();

      drawer.addEventListener(
        "close",
        cleanupBodyAfterDrawerClose,
        { once: true }
      );
      return;
    }

    // ✅ Section fallback
    try {
      const sections = ["cart-drawer", "cart-icon-bubble"];
      const res = await fetch(
        `${window.location.pathname}?sections=${sections.join(",")}`,
        { credentials: "same-origin" }
      );

      const html = await res.json();

      if (html["cart-drawer"] && drawer) {
        const wrap = document.createElement("div");
        wrap.innerHTML = html["cart-drawer"];
        const next = wrap.querySelector("cart-drawer") || wrap.firstElementChild;
        if (next) drawer.replaceWith(next);
      }

      if (html["cart-icon-bubble"]) {
        const bubble =
          document.getElementById("cart-icon-bubble") ||
          document.querySelector("[id*='cart-icon-bubble']");
        if (bubble) {
          const wrap = document.createElement("div");
          wrap.innerHTML = html["cart-icon-bubble"];
          bubble.replaceWith(wrap.firstElementChild);
        }
      }
    } catch {}

    drawer?.open?.();
    drawer?.addEventListener("close", cleanupBodyAfterDrawerClose, { once: true });
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
    bar.style.justifyContent = "space-between";
    bar.style.gap = "12px";

    document.body.appendChild(bar);
    return bar;
  }

  function renderBar() {
    const bar = ensureBar();
    const plans = getSellingPlansFlat();
    const variant = getVariantById(selectedVariantId);

    bar.innerHTML = `
      <div>
        <strong>${product.title}</strong><br>
        ${variant ? formatMoney(variant.price) : ""}
      </div>

      <div style="display:flex;gap:8px;align-items:center;">
        <select id="bdm-variant">
          ${product.variants.map(v =>
            `<option value="${v.id}" ${v.id == selectedVariantId ? "selected" : ""}>
              ${v.public_title || v.title}
            </option>`
          ).join("")}
        </select>

        ${
          plans.length ? `
          <select id="bdm-plan">
            <option value="">One-time</option>
            ${plans.map(p =>
              `<option value="${p.id}" ${p.id === selectedSellingPlanId ? "selected" : ""}>
                ${p.groupName}: ${p.name}
              </option>`
            ).join("")}
          </select>` : ""
        }

        <input id="bdm-qty" type="number" min="1" value="1" style="width:60px;">
        <button id="bdm-add">Add to cart</button>
      </div>
    `;

    $("#bdm-variant").onchange = e => {
      selectedVariantId = Number(e.target.value);
      renderBar();
    };

    $("#bdm-plan")?.addEventListener("change", e => {
      selectedSellingPlanId = e.target.value || null;
    });

    $("#bdm-add").onclick = async () => {
      const qty = Number($("#bdm-qty").value || 1);

      track("add_to_cart", {
        variantId: String(selectedVariantId),
        sellingPlanId: selectedSellingPlanId,
        quantity: qty,
      });

      const fd = new FormData();
      fd.append("id", selectedVariantId);
      fd.append("quantity", qty);
      if (selectedSellingPlanId) {
        fd.append("selling_plan", selectedSellingPlanId);
      }

      await fetch("/cart/add.js", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });

      await refreshAndOpenCart();
    };
  }

  /* ────────────────────────────────────────────── */
  /* INIT */
  /* ────────────────────────────────────────────── */

  async function init() {
    if (!location.pathname.includes("/products/")) return;

    product = await loadProductJson();
    if (!product) return;

    const initial = getFirstAvailableVariant();
    selectedVariantId = Number(initial.id);

    renderBar();
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init)
    : init();
})();
