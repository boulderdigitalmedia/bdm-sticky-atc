(function () {
  const bar = document.getElementById("bdm-sticky-atc");
  if (!bar) return;

  const stickyATC = document.getElementById("bdm-atc");
  const stickyQty = document.getElementById("bdm-qty");
  const stickyVariant = document.getElementById("bdm-variant");
  const stickyTitle = document.getElementById("bdm-title");
  const stickyPrice = document.getElementById("bdm-price");

  /* -------------------------------------------------
     WAIT FOR PRODUCT FORM (variants + selling plans)
  -------------------------------------------------- */
  function waitForProductForm(cb) {
    const start = Date.now();
    const max = 8000;

    (function tick() {
      const form = document.querySelector('form[action*="/cart/add"]');
      const variantInput =
        form?.querySelector('input[name="id"], select[name="id"]');

      if (form && variantInput) return cb(form);
      if (Date.now() - start < max) requestAnimationFrame(tick);
    })();
  }

  /* -------------------------------------------------
     LIVE READ HELPERS (always source of truth)
  -------------------------------------------------- */
  function getForm() {
    return document.querySelector('form[action*="/cart/add"]');
  }

  function getVariantId() {
    return getForm()?.querySelector('input[name="id"], select[name="id"]')?.value || null;
  }

  function getSellingPlanId() {
    return (
      getForm()?.querySelector('select[name="selling_plan"]')?.value || ""
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
     INIT TITLE + PRICE
  -------------------------------------------------- */
  waitForProductForm(() => {
    const titleEl = document.querySelector("h1");
    if (titleEl) stickyTitle.textContent = titleEl.textContent;

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

    // IMPORTANT:
    // We do NOT allow variant/selling plan selection in the bar.
    // The bar mirrors the product form only.
    stickyVariant.style.display = "none";
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
    const selectors = [
      ".cart-count-bubble span",
      ".cart-count",
      "[data-cart-count]",
      ".header__cart-count",
      ".site-header__cart-count",
      "#cart-icon-bubble span",
    ];

    selectors.forEach((s) => {
      document.querySelectorAll(s).forEach((el) => {
        el.textContent = count;
        el.classList.remove("hidden");
        el.style.display = "";
      });
    });

    document.querySelectorAll("cart-count").forEach((el) => {
      el.textContent = count;
    });
  }

  async function fetchSections(ids) {
    const root = (window.Shopify?.routes?.root || "/").replace(/\/?$/, "/");
    const url = `${root}?sections=${encodeURIComponent(ids.join(","))}`;
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    return r.json();
  }

  async function refreshCartUI() {
    const cart = await fetchCart();
    updateBadges(cart.item_count);

    try {
      const sections = await fetchSections(["cart-drawer", "cart-icon-bubble"]);

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
    if (drawer?.open) {
      drawer.open();
      return;
    }

    document
      .querySelector('[data-cart-drawer-toggle], [aria-controls*="cart"]')
      ?.click();
  }

  /* -------------------------------------------------
     ADD TO CART (variant + selling plan together)
  -------------------------------------------------- */
  stickyATC.addEventListener("click", async () => {
    const variantId = getVariantId();
    if (!variantId) return;

    const sellingPlanId = getSellingPlanId();

    const originalText = stickyATC.textContent;
    stickyATC.disabled = true;
    stickyATC.textContent = "Adding…";

    let resetTimer;

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

      resetTimer = setTimeout(() => {
        stickyATC.textContent = originalText || "Add to cart";
        stickyATC.disabled = false;
      }, 1500);
    } catch (err) {
      console.error("Sticky ATC error", err);
      stickyATC.textContent = "Error";
      resetTimer = setTimeout(() => {
        stickyATC.textContent = originalText || "Add to cart";
        stickyATC.disabled = false;
      }, 1500);
    }

    // Safety reset if drawer re-renders
    document.addEventListener(
      "cart:refresh",
      () => {
        clearTimeout(resetTimer);
        stickyATC.textContent = originalText || "Add to cart";
        stickyATC.disabled = false;
      },
      { once: true }
    );
  });

  /* -------------------------------------------------
     SHOW ON SCROLL
  -------------------------------------------------- */
  window.addEventListener("scroll", () => {
    bar.classList.toggle("visible", window.scrollY > 400);
  });
})();
