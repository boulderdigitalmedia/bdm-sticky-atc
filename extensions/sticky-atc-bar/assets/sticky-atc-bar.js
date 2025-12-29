(() => {
  const BAR_ID = "bdm-sticky-atc";
  const TRACK_ENDPOINT = "/apps/bdm-sticky-atc/track";

  let product = null;
  let selectedVariantId = null;
  let selectedSellingPlanId = null;

  /* ───────────────── HELPERS ───────────────── */

  const $ = (s, r = document) => r.querySelector(s);

  const formatMoney = (c) =>
    typeof c === "number" ? `$${(c / 100).toFixed(2)}` : "";

  async function loadProductJson() {
    const handle = location.pathname.match(/\/products\/([^/]+)/)?.[1];
    if (!handle) return null;

    const res = await fetch(`/products/${handle}.js`, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });

    return res.ok ? res.json() : null;
  }

  const getVariantById = (id) =>
    product?.variants?.find(v => Number(v.id) === Number(id)) || null;

  const getFirstAvailableVariant = () =>
    product?.variants?.find(v => v.available) ||
    product?.variants?.[0] ||
    null;

  const getSellingPlansFlat = () =>
    (product?.selling_plan_groups || []).flatMap(g =>
      (g.selling_plans || []).map(p => ({
        id: String(p.id),
        name: p.name,
        groupName: g.name,
      }))
    );

  function track(event, payload) {
    fetch(TRACK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, ...payload }),
    }).catch(() => {});
  }

  /* ───────────── CART REFRESH (STABLE + SAFE) ───────────── */

  async function refreshCartUI() {
    const sections = ["cart-drawer", "cart-icon-bubble", "cart-notification"];

    // IMPORTANT: must be "/" not "/cart"
    const res = await fetch(`/?sections=${sections.join(",")}`, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) return;
    const html = await res.json();

    /* ─── CART DRAWER ─── */
    if (html["cart-drawer"]) {
      const current =
        document.querySelector("cart-drawer") ||
        document.getElementById("CartDrawer");

      if (current) {
        const wrap = document.createElement("div");
        wrap.innerHTML = html["cart-drawer"];
        const next =
          wrap.querySelector("cart-drawer") ||
          wrap.querySelector("#CartDrawer");

        if (next) current.replaceWith(next);
      }
    }

    /* ─── CART ICON BUBBLE (FIXED: NO DISPLACEMENT) ─── */
    if (html["cart-icon-bubble"]) {
      const bubble =
        document.getElementById("cart-icon-bubble") ||
        document.querySelector("[id*='cart-icon-bubble']");

      if (bubble) {
        const wrap = document.createElement("div");
        wrap.innerHTML = html["cart-icon-bubble"];
        const next = wrap.firstElementChild;

        if (next) {
          // ✅ ONLY update contents — preserves layout & position
          bubble.innerHTML = next.innerHTML;
        }
      }
    }

    /* ─── OPEN DRAWER ─── */
    const drawer =
      document.querySelector("cart-drawer") ||
      document.getElementById("CartDrawer");

    drawer?.open?.();
    drawer?.setAttribute?.("open", "");
  }

  /* ───────────────── UI ───────────────── */

  function ensureBar() {
    let bar = document.getElementById(BAR_ID);
    if (bar) return bar;

    bar = document.createElement("div");
    bar.id = BAR_ID;
    bar.style.position = "fixed";
    bar.style.bottom = "0";
    bar.style.left = "0";
    bar.style.right = "0";
    bar.style.zIndex = "9999";
    bar.style.background = "#111";
    bar.style.color = "#fff";
    bar.style.padding = "12px";
    bar.style.display = "flex";
    bar.style.gap = "10px";
    bar.style.alignItems = "center";
    bar.style.justifyContent = "space-between";

    document.body.appendChild(bar);
    return bar;
  }

  function renderBar() {
    const bar = ensureBar();
    const v = getVariantById(selectedVariantId);
    const plans = getSellingPlansFlat();

    bar.innerHTML = `
      <div>
        <strong>${product.title}</strong><br>
        ${formatMoney(v?.price)}
      </div>

      <select id="bdm-variant">
        ${product.variants.map(v =>
          `<option value="${v.id}" ${v.id == selectedVariantId ? "selected" : ""}>
            ${v.public_title || v.title}
          </option>`
        ).join("")}
      </select>

      ${plans.length ? `
        <select id="bdm-plan">
          <option value="">One-time</option>
          ${plans.map(p =>
            `<option value="${p.id}" ${p.id == selectedSellingPlanId ? "selected" : ""}>
              ${p.groupName}: ${p.name}
            </option>`
          ).join("")}
        </select>
      ` : ""}

      <input id="bdm-qty" type="number" min="1" value="1" style="width:60px" />
      <button id="bdm-add">Add to cart</button>
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
        variantId: selectedVariantId,
        quantity: qty,
        sellingPlanId: selectedSellingPlanId,
      });

      const fd = new FormData();
      fd.append("id", selectedVariantId);
      fd.append("quantity", qty);
      if (selectedSellingPlanId) fd.append("selling_plan", selectedSellingPlanId);

      await fetch("/cart/add.js", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });

      await refreshCartUI();
    };
  }

  /* ───────────────── INIT ───────────────── */

  async function init() {
    if (!location.pathname.includes("/products/")) return;

    product = await loadProductJson();
    if (!product) return;

    selectedVariantId = getFirstAvailableVariant()?.id;
    renderBar();
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init)
    : init();
})();
