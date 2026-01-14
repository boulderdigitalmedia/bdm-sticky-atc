(function () {
  const bar = document.getElementById("bdm-sticky-atc");
  if (!bar) return;

  const stickyATC = document.getElementById("bdm-atc");
  const stickyQty = document.getElementById("bdm-qty");
  const stickyVariant = document.getElementById("bdm-variant");
  const stickyTitle = document.getElementById("bdm-title");
  const stickyPrice = document.getElementById("bdm-price");

  /* -------------------------------------------------
     WAIT FOR PRODUCT FORM (avoids variants/selling plan race)
  -------------------------------------------------- */
  function waitForProductForm(cb) {
    const maxWait = 8000;
    const start = Date.now();

    const tick = () => {
      const form = document.querySelector('form[action*="/cart/add"]');
      const variantInput =
        form?.querySelector('input[name="id"], select[name="id"]');

      if (form && variantInput) return cb(form);
      if (Date.now() - start < maxWait) return requestAnimationFrame(tick);
    };

    tick();
  }

  /* -------------------------------------------------
     LIVE READS
  -------------------------------------------------- */
  function getForm() {
    return document.querySelector('form[action*="/cart/add"]');
  }

  function getVariantInput() {
    return document.querySelector(
      'form[action*="/cart/add"] input[name="id"], form[action*="/cart/add"] select[name="id"]'
    );
  }

  function getVariantId() {
    return getVariantInput()?.value || null;
  }

  function getSellingPlanId() {
    // Most subscription UIs end up with this select in the product form
    return (
      document.querySelector('form[action*="/cart/add"] select[name="selling_plan"]')
        ?.value || ""
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
     INIT (title/price/variants)
  -------------------------------------------------- */
  waitForProductForm((form) => {
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

    // Build sticky variants ONLY if theme has <select name="id">
    const themeSelect = form.querySelector('select[name="id"]');
    if (themeSelect) {
      stickyVariant.innerHTML = "";
      themeSelect.querySelectorAll("option").forEach((opt) => {
        if (!opt.value) return;
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.textContent;
        stickyVariant.appendChild(o);
      });

      stickyVariant.value = themeSelect.value;

      stickyVariant.addEventListener("change", () => {
        themeSelect.value = stickyVariant.value;
        themeSelect.dispatchEvent(new Event("change", { bubbles: true }));
      });

      themeSelect.addEventListener("change", () => {
        stickyVariant.value = themeSelect.value;
      });

      stickyVariant.style.display = "";
    } else {
      // radio-based variant UI: we still add correctly via hidden input[name=id]
      stickyVariant.style.display = "none";
    }
  });

  /* -------------------------------------------------
     CART UI REFRESH (Dawn-friendly)
  -------------------------------------------------- */
  async function fetchCart() {
    const r = await fetch("/cart.js", { headers: { Accept: "application/json" } });
    return r.json();
  }

  function updateBadges(count) {
    const selectors = [
      ".cart-count-bubble span",
      ".cart-count",
      "[data-cart-count]",
      ".header__cart-count",
      ".site-header__cart-count",
      "#cart-icon-bubble span", // common
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

  async function fetchSections(sectionIds) {
    const root = (window.Shopify?.routes?.root || "/").replace(/\/?$/, "/");
    const url = `${root}?sections=${encodeURIComponent(sectionIds.join(","))}`;
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    return r.json(); // IMPORTANT: this is JSON section HTML
  }

  function replaceHTMLByIdFromString(id, htmlString) {
    const existing = document.getElementById(id);
    if (!existing) return false;

    const doc = new DOMParser().parseFromString(htmlString, "text/html");
    const incoming = doc.getElementById(id);
    if (!incoming) return false;

    existing.replaceWith(incoming);
    return true;
  }

  function replaceCartIconFromSectionHTML(htmlString) {
    // prefer bubble id replacement if present
    const doc = new DOMParser().parseFromString(htmlString, "text/html");
    const incomingBubble =
      doc.querySelector("#cart-icon-bubble") || doc.getElementById("cart-icon-bubble");
    const existingBubble =
      document.querySelector("#cart-icon-bubble") || document.getElementById("cart-icon-bubble");

    if (incomingBubble && existingBubble) {
      existingBubble.replaceWith(incomingBubble);
      return true;
    }
    return false;
  }

  async function refreshCartUI() {
    // 1) update counts
    const cart = await fetchCart();
    updateBadges(cart.item_count);

    // 2) refresh drawer + icon sections (Dawn)
    try {
      const sections = await fetchSections(["cart-drawer", "cart-icon-bubble"]);

      // cart drawer section usually contains the wrapper id:
      // #shopify-section-cart-drawer OR a <cart-drawer> element
      const drawerHTML = sections["cart-drawer"];
      if (drawerHTML) {
        // Try wrapper replacement first
        const replacedWrapper = replaceHTMLByIdFromString("shopify-section-cart-drawer", drawerHTML);

        if (!replacedWrapper) {
          // Fallback: replace cart-drawer element
          const existingDrawer = document.querySelector("cart-drawer");
          const doc = new DOMParser().parseFromString(drawerHTML, "text/html");
          const incomingDrawer = doc.querySelector("cart-drawer");
          if (existingDrawer && incomingDrawer) existingDrawer.replaceWith(incomingDrawer);
        }
      }

      const iconHTML = sections["cart-icon-bubble"];
      if (iconHTML) {
        // Often the section wrapper id differs per theme, so replace the bubble itself
        replaceCartIconFromSectionHTML(iconHTML);
      }
    } catch (e) {
      // Even if sections fail, at least badge updated
      console.warn("Sticky ATC: section refresh failed (non-fatal)", e);
    }

    return cart;
  }

  function openCartDrawer() {
    const drawer = document.querySelector("cart-drawer");
    if (drawer && typeof drawer.open === "function") {
      drawer.open();
      return true;
    }

    const toggle =
      document.querySelector('[data-cart-drawer-toggle]') ||
      document.querySelector('button[name="open-cart"], [aria-controls*="cart"]');

    if (toggle) {
      toggle.click();
      return true;
    }

    return false;
  }

  /* -------------------------------------------------
     ADD TO CART (variant + selling plan together)
  -------------------------------------------------- */
  stickyATC.addEventListener("click", async () => {
    const variantId =
      stickyVariant.style.display === "none" ? getVariantId() : stickyVariant.value;

    if (!variantId) return;

    const sellingPlanId = getSellingPlanId(); // may be "" if none selected

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
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Add failed (${res.status})`);

      // Make sure the UI updates (badge + drawer + icon)
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
