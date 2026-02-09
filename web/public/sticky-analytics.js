(function () {
  /* ---------------- Tracking (FIXED) ---------------- */

  function getShopDomain() {
    try {
      // 1) Shopify global (sometimes missing in themes)
      if (window.Shopify && window.Shopify.shop) return window.Shopify.shop;

      // 2) Injected by Liquid (guaranteed)
      if (window.__SHOP_DOMAIN__) return window.__SHOP_DOMAIN__;

      // 3) Fallback: your block container attribute
      var el = document.getElementById("bdm-sticky-atc");
      if (el && el.getAttribute("data-shop")) return el.getAttribute("data-shop");
    } catch (e) {}
    return "";
  }

  function getSessionId() {
    try {
      var KEY = "bdm_sticky_atc_session_id";
      var id = localStorage.getItem(KEY);
      if (!id) {
        id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + "_" + String(Math.random()).slice(2);
        localStorage.setItem(KEY, id);
      }
      return id;
    } catch (e) {
      return "no_localstorage";
    }
  }

  function track(eventName, extra) {
    if (!extra) extra = {};
    var shop = getShopDomain();

    // If shop exists, ALWAYS attach it to the endpoint so server stores it correctly
    var endpoint = shop
      ? "/apps/bdm-sticky-atc/track?shop=" + encodeURIComponent(shop)
      : "/apps/bdm-sticky-atc/track";

    try {
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify(
          Object.assign(
            {
              event: eventName,
              shop: shop || undefined,          // ✅ also send in body as backup
              sessionId: getSessionId(),        // ✅ helps grouping/dedupe
              ts: Date.now(),                   // ✅ matches backend expectation
              timestamp: Date.now(),            // ✅ keep legacy field
              productId: window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.product
                ? window.ShopifyAnalytics.meta.product.id
                : undefined
            },
            extra
          )
        )
      });
    } catch (e) {}
  }

  track("page_view");

  /* ---------------- Existing logic (unchanged) ---------------- */

  async function refreshCartUI() {
    let updated = false;

    try {
      const root = (window.Shopify && Shopify.routes && Shopify.routes.root) || "/";
      const resp = await fetch(`${root}?sections=cart-drawer,cart-icon-bubble`);
      let json = null;
      try {
        json = await resp.json();
      } catch {}

      if (json) {
        const payload = { id: Date.now(), sections: json };
        const drawer = document.querySelector("cart-drawer");

        if (drawer && typeof drawer.renderContents === "function" && json["cart-drawer"]) {
          drawer.renderContents(payload);
          try {
            const cart = await fetch("/cart.js").then((a) => a.json());
            drawer.classList.toggle("is-empty", cart.item_count === 0);
          } catch {}
          updated = true;
        }

        const bubble = document.getElementById("cart-icon-bubble");
        if (bubble && json["cart-icon-bubble"]) {
          const tmp = document.createElement("div");
          tmp.innerHTML = json["cart-icon-bubble"];
          const next = tmp.querySelector("#cart-icon-bubble");
          if (next) bubble.replaceWith(next);
          updated = true;
        }
      }
    } catch {}

    try {
      const cart = await fetch("/cart.js").then((i) => i.json());
      const count = cart.item_count;

      document
        .querySelectorAll(".cart-count, .cart-count-bubble, [data-cart-count]")
        .forEach((i) => {
          i.textContent = count;
          i.dataset.cartCount = count;

          if (count > 0) {
            i.removeAttribute("hidden");
            i.classList.remove("is-empty");
            i.setAttribute("aria-hidden", "false");
          } else {
            i.classList.add("is-empty");
            i.setAttribute("aria-hidden", "true");
          }
        });

      document.dispatchEvent(new CustomEvent("cart:refresh", { detail: { cart } }));
      document.dispatchEvent(new CustomEvent("cartcount:update", { detail: { count } }));
      document.dispatchEvent(new CustomEvent("ajaxProduct:added", { detail: { cart } }));

      if (typeof window.fetchCart === "function") window.fetchCart();
      if (typeof window.updateCart === "function") window.updateCart();
      if (typeof window.refreshCart === "function") window.refreshCart();
    } catch {}

    try {
      const toggle =
        document.querySelector("[data-cart-toggle]") ||
        document.querySelector("[data-drawer-toggle]") ||
        document.querySelector(".js-cart-toggle") ||
        document.querySelector(".js-drawer-open-cart") ||
        document.querySelector('[aria-controls="CartDrawer"]') ||
        document.querySelector("#cart-icon-bubble");

      if (toggle) toggle.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
    } catch {}
  }

  function initStickyBar() {
    const rootEl = document.getElementById("bdm-sticky-atc-bar-root");
    if (!rootEl) return;

    const form = document.querySelector('form[action*="/cart/add"]');
    if (!form) return;

    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const title = rootEl.dataset.productTitle || document.title;
    const variants = (window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.product && window.ShopifyAnalytics.meta.product.variants) || [];
    const hasVariants = variants.length > 1;
    const select = form.querySelector("select[name='id']");

    let variantId = select ? select.value : (variants[0] ? variants[0].id : null);
    if (!variantId) {
      const input = form.querySelector("[name='id']");
      if (input) variantId = input.value;
    }

    const findVariant = (id) => variants.find((v) => String(v.id) === String(id));
    const fmtMoney = (cents) =>
      ((typeof cents === "number" ? cents : 0) / 100).toLocaleString(undefined, {
        style: "currency",
        currency: (window.Shopify && Shopify.currency && Shopify.currency.active) || "USD"
      });

    let price = findVariant(variantId) ? findVariant(variantId).price : undefined;

    const container = document.createElement("div");
    container.className = "bdm-sticky-atc-bar-container";

    const inner = document.createElement("div");
    inner.className = "bdm-sticky-atc-bar-inner";

    const product = document.createElement("div");
    product.className = "bdm-sticky-atc-product";

    const titleEl = document.createElement("div");
    titleEl.className = "bdm-sticky-atc-title";
    titleEl.textContent = title;

    const priceEl = document.createElement("div");
    priceEl.className = "bdm-sticky-atc-price";
    priceEl.textContent = fmtMoney(price);

    product.appendChild(titleEl);
    product.appendChild(priceEl);

    const variantWrap = document.createElement("div");
    variantWrap.className = "bdm-sticky-atc-variant";

    if (hasVariants) {
      const dd = document.createElement("select");
      dd.className = "bdm-sticky-atc-variant-select";

      variants.forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v.id;
        opt.textContent = v.public_title || v.title || `Variant ${v.id}`;
        dd.appendChild(opt);
      });

      dd.value = variantId;

      dd.addEventListener("change", () => {
        variantId = dd.value;
        const v = findVariant(variantId);
        if (v) {
          price = v.price;
          priceEl.textContent = fmtMoney(price);
        }

        track("variant_change", { variantId: variantId });

        if (select) {
          select.value = variantId;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });

      if (isMobile) {
        titleEl.style.display = "none";
        const row = document.createElement("div");
        row.className = "bdm-variant-mobile-row";
        row.appendChild(dd);
        product.insertBefore(row, priceEl);
      } else {
        variantWrap.appendChild(dd);
      }
    }

    const qty = document.createElement("div");
    qty.className = "bdm-sticky-atc-qty";

    const minus = document.createElement("button");
    minus.className = "bdm-qty-btn";
    minus.textContent = "−";

    const qtyInput = document.createElement("input");
    qtyInput.className = "bdm-qty-input";
    qtyInput.type = "number";
    qtyInput.min = "1";
    qtyInput.value = "1";

    const plus = document.createElement("button");
    plus.className = "bdm-qty-btn";
    plus.textContent = "+";

    minus.addEventListener("click", () => {
      qtyInput.value = Math.max(1, Number(qtyInput.value) - 1);
    });

    plus.addEventListener("click", () => {
      qtyInput.value = Number(qtyInput.value) + 1;
    });

    qty.append(minus, qtyInput, plus);

    const btn = document.createElement("button");
    btn.className = "bdm-sticky-atc-button";
    btn.textContent = "Add to cart";

    btn.addEventListener("click", async () => {
      if (!variantId) {
        const input = form.querySelector("[name='id']");
        if (input) variantId = input.value;
      }
      if (!variantId) return alert("Unable to determine variant.");

      const quantity = Math.max(1, Number(qtyInput.value) || 1);

      sessionStorage.setItem(
        "bdm_sticky_atc_last_event",
        JSON.stringify({
          product: window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.product
            ? window.ShopifyAnalytics.meta.product.id
            : undefined,
          variant: variantId,
          time: Date.now()
        })
      );

      track("add_to_cart", { variantId: variantId, quantity: quantity, price: price });

      const resp = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ id: variantId, quantity: quantity })
      });

      if (!resp.ok) {
        try {
          console.error("Cart add error", await resp.text());
        } catch {}
        return alert("Could not add to cart. Please try again.");
      }

      sessionStorage.setItem("bdm_sticky_last_atc", Date.now());
      sessionStorage.setItem("bdm_sticky_variant", variantId);
      sessionStorage.setItem(
        "bdm_sticky_product",
        window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.product
          ? window.ShopifyAnalytics.meta.product.id
          : undefined
      );

      refreshCartUI();
    });

    const controls = document.createElement("div");
    controls.className = "bdm-sticky-atc-controls";

    if (!isMobile && hasVariants) controls.append(variantWrap, qty, btn);
    else controls.append(qty, btn);

    inner.append(product, controls);
    container.appendChild(inner);
    document.body.appendChild(container);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initStickyBar);
  else initStickyBar();
})();
