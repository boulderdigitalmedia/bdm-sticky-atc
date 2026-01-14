(function () {
  const bar = document.getElementById("bdm-sticky-atc");
  if (!bar) return;

  const stickyATC = document.getElementById("bdm-atc");
  const stickyQty = document.getElementById("bdm-qty");
  const stickyVariant = document.getElementById("bdm-variant");
  const stickyTitle = document.getElementById("bdm-title");
  const stickyPrice = document.getElementById("bdm-price");

  /* -------------------------------------------------
     WAIT FOR PRODUCT FORM (avoids race conditions)
  -------------------------------------------------- */
  function waitForProductForm(cb) {
    const start = Date.now();
    const maxWait = 8000;

    (function tick() {
      const form = document.querySelector('form[action*="/cart/add"]');
      const idInput = form?.querySelector('input[name="id"], select[name="id"]');
      if (form && idInput) return cb(form);
      if (Date.now() - start < maxWait) requestAnimationFrame(tick);
    })();
  }

  /* -------------------------------------------------
     LIVE READ HELPERS
  -------------------------------------------------- */
  function getVariantInput() {
    return document.querySelector(
      'form[action*="/cart/add"] input[name="id"], form[action*="/cart/add"] select[name="id"]'
    );
  }

  function getVariantId() {
    return getVariantInput()?.value || null;
  }

  function getSellingPlanId() {
    return (
      document.querySelector(
        'form[action*="/cart/add"] select[name="selling_plan"]'
      )?.value || ""
    );
  }

  function getPriceEl() {
    return (
      document.querySelector("[data-product-price]") ||
      document.querySelector(".price") ||
      document.querySelector(".price-item")
    );
  }

  /* -------------------------------------------------
     INIT (title / price / variants)
  -------------------------------------------------- */
  waitForProductForm((form) => {
    // Title
    const titleEl = document.querySelector("h1");
    if (titleEl) stickyTitle.textContent = titleEl.textContent;

    // Price sync
    const priceEl = getPriceEl();
    const syncPrice = () => {
      if (priceEl) stickyPrice.textContent = priceEl.textContent;
    };
    syncPrice();

    if (priceEl) {
      new MutationObserver(syncPrice).observe(priceEl, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    /* ---------------------------------------------
       VARIANT UI DECISION (THIS IS THE FIX)
    ---------------------------------------------- */

    const themeSelect = form.querySelector('select[name="id"]');
    const themeRadios = form.querySelectorAll(
      'input[type="radio"][name^="options"], input[type="radio"][name*="option"]'
    );

    // ✅ Only show sticky variant dropdown for <select name="id">
    if (themeSelect && !themeRadios.length) {
      stickyVariant.innerHTML = "";

      [...themeSelect.options].forEach((opt) => {
        if (!opt.value) return;
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.textContent;
        stickyVariant.appendChild(o);
      });

      stickyVariant.value = themeSelect.value;

      // Sticky → Theme
      stickyVariant.addEventListener("change", () => {
        themeSelect.value = stickyVariant.value;
        themeSelect.dispatchEvent(new Event("change", { bubbles: true }));
      });

      // Theme → Sticky
      themeSelect.addEventListener("change", () => {
        stickyVariant.value = themeSelect.value;
      });

      stickyVariant.style.display = "";
    } else {
      // 🚫 Dawn / radio variants → hide selector
      stickyVariant.style.display = "none";
    }
  });

  /* -------------------------------------------------
     CART UI REFRESH (Dawn-safe)
  -------------------------------------------------- */
  async function fetchCart() {
    const r = await fetch("/cart.js", {
      headers: { Accept: "application/json" },
    });
    return r.json();
  }

  function updateBadges(count) {
    [
      ".cart-count-bubble span",
      ".cart-count",
      "[data-cart-count]",
      ".header__cart-count",
      ".site-header__cart-count",
      "#cart-icon-bubble span",
    ].forEach((s) => {
      document.querySelectorAll(s).forEach((el) => {
        el.textContent = count;
        el.classList.remove("hidden");
        el.style.display = "";
      });
    });
  }

  async function refreshCartUI() {
    const cart = await fetchCart();
    updateBadges(cart.item_count);

    try {
      const root = (window.Shopify?.routes?.root || "/").replace(/\/?$/, "/");
      const r = await fetch(
        `${root}?sections=cart-drawer,cart-icon-bubble`,
        { headers: { Accept: "application/json" } }
      );
      const sections = await r.json();

      if (sections["cart-drawer"]) {
        const doc = new DOMParser().parseFromString(
          sections["cart-drawer"],
          "text/html"
        );
        const incoming = doc.querySelector("cart-drawer");
        const existing = document.querySelector("cart-drawer");
        if (incoming && existing) existing.replaceWith(incoming);
      }

      if (sections["cart-icon-bubble"]) {
        const doc = new DOMParser().parseFromString(
          sections["cart-icon-bubble"],
          "text/html"
        );
        const incoming = doc.querySelector("#cart-icon-bubble");
        const existing = document.querySelector("#cart-icon-bubble");
        if (incoming && existing) existing.replaceWith(incoming);
      }
    } catch (e) {
      console.warn("Sticky ATC: section refresh failed", e);
    }

    return cart;
  }

  function openCartDrawer() {
    const drawer = document.querySelector("cart-drawer");
    if (drawer?.open) return drawer.open();
    document
      .querySelector('[data-cart-drawer-toggle], [aria-controls*="cart"]')
      ?.click();
  }

  /* -------------------------------------------------
     ADD TO CART (variant + selling plan)
  -------------------------------------------------- */
  stickyATC.addEventListener("click", async () => {
    const variantId =
      stickyVariant.style.display === "none"
        ? getVariantId()
        : stickyVariant.value;

    if (!variantId) return;

    const sellingPlanId = getSellingPlanId();

    const originalText = stickyATC.textContent;
    stickyATC.disabled = true;
    stickyATC.textContent = "Adding…";

    try {
      const payload = {
        id: Number(variantId),
        quantity: Number(stickyQty.value || 1),
      };
      if (sellingPlanId) payload.selling_plan = sellingPlanId;

      const res = await fetch("/cart/add.js", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Add failed");

      await refreshCartUI();
      openCartDrawer();
      stickyATC.textContent = "Added ✓";
    } catch (err) {
      console.error("Sticky ATC error", err);
      stickyATC.textContent = "Error";
    } finally {
      setTimeout(() => {
        stickyATC.textContent = originalText || "Add to cart";
        stickyATC.disabled = false;
      }, 1200);
    }
  });

  /* -------------------------------------------------
     SHOW ON SCROLL
  -------------------------------------------------- */
  window.addEventListener("scroll", () => {
    bar.classList.toggle("visible", window.scrollY > 400);
  });
})();
