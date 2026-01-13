(function () {
  const bar = document.getElementById("bdm-sticky-atc");
  if (!bar) return;

  const stickyATC = document.getElementById("bdm-atc");
  const stickyQty = document.getElementById("bdm-qty");
  const stickyVariant = document.getElementById("bdm-variant");
  const stickyTitle = document.getElementById("bdm-title");
  const stickyPrice = document.getElementById("bdm-price");

  // --- Title + Price (best-effort, never fatal)
  const titleEl = document.querySelector("h1");
  if (titleEl) stickyTitle.textContent = titleEl.textContent;

  const priceEl =
    document.querySelector("[data-product-price]") ||
    document.querySelector(".price") ||
    document.querySelector(".price-item");

  const syncPriceFromTheme = () => {
    if (priceEl) stickyPrice.textContent = priceEl.textContent;
  };
  syncPriceFromTheme();

  // --- Find theme variant controls (covers most themes)
  const themeIdInput = () =>
    document.querySelector('input[name="id"]') ||
    document.querySelector('select[name="id"]');

  const themeSelect = () => document.querySelector('select[name="id"]');

  function getCurrentVariantId() {
    const el = themeIdInput();
    return el?.value || null;
  }

  function setThemeVariantId(id) {
    const sel = themeSelect();
    if (sel) {
      sel.value = String(id);
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    const input = document.querySelector('input[name="id"]');
    if (input) {
      input.value = String(id);
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    return false;
  }

  // --- Populate sticky variant selector if possible
  function populateStickyVariants() {
    stickyVariant.innerHTML = "";

    const sel = themeSelect();
    if (sel) {
      // Build from <select name="id">
      sel.querySelectorAll("option").forEach((opt) => {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.textContent;
        stickyVariant.appendChild(o);
      });

      stickyVariant.value = sel.value;

      // Sticky -> Theme
      stickyVariant.addEventListener("change", () => {
        setThemeVariantId(stickyVariant.value);
        syncPriceFromTheme();
      });

      // Theme -> Sticky
      sel.addEventListener("change", () => {
        stickyVariant.value = sel.value;
        syncPriceFromTheme();
      });

      stickyVariant.style.display = "";
      return;
    }

    // If no select exists, many themes use radios + hidden input[name=id]
    // In that case we *can’t reliably list all variants* without product JSON,
    // so we hide the dropdown and rely on the theme’s own variant UI.
    stickyVariant.style.display = "none";
  }

  populateStickyVariants();

  // Keep sticky price in sync if theme updates it dynamically
  if (priceEl) {
    new MutationObserver(syncPriceFromTheme).observe(priceEl, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  // --- Add to cart + open drawer + update badge
  async function updateCartBadge() {
    const cart = await fetch("/cart.js").then((r) => r.json());
    const count = cart.item_count;

    const badgeSelectors = [
      ".cart-count-bubble span",
      ".cart-count",
      "[data-cart-count]",
      ".header__cart-count",
      ".site-header__cart-count",
    ];

    badgeSelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        el.textContent = count;
        el.classList.remove("hidden");
        el.style.display = "";
      });
    });

    // Dawn custom element sometimes used
    document.querySelectorAll("cart-count").forEach((el) => {
      el.textContent = count;
    });

    return cart;
  }

  function openCartDrawer() {
    // Dawn
    const drawer = document.querySelector("cart-drawer");
    if (drawer && typeof drawer.open === "function") {
      drawer.open();
      return true;
    }

    // Common toggles
    const toggle =
      document.querySelector('[data-cart-drawer-toggle]') ||
      document.querySelector('button[name="open-cart"], [aria-controls*="cart"]');

    if (toggle) {
      toggle.click();
      return true;
    }

    return false;
  }

  stickyATC.addEventListener("click", async () => {
    const variantId = stickyVariant.style.display === "none"
      ? getCurrentVariantId()
      : stickyVariant.value;

    if (!variantId) {
      console.warn("Sticky ATC: No variant ID found");
      return;
    }

    stickyATC.disabled = true;
    const originalText = stickyATC.textContent;
    stickyATC.textContent = "Adding…";

    try {
      await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: Number(variantId),
          quantity: Number(stickyQty.value || 1),
        }),
      });

      // Theme hooks (best-effort)
      document.dispatchEvent(new Event("cart:refresh"));
      document.dispatchEvent(new Event("cart:change"));

      await updateCartBadge();
      openCartDrawer();

      stickyATC.textContent = "Added ✓";
      setTimeout(() => {
        stickyATC.textContent = originalText || "Add to cart";
        stickyATC.disabled = false;
      }, 1400);
    } catch (err) {
      console.error("Sticky ATC error", err);
      stickyATC.textContent = "Error";
      stickyATC.disabled = false;
      setTimeout(() => {
        stickyATC.textContent = originalText || "Add to cart";
      }, 1400);
    }
  });

  // --- Show on scroll (never depends on product JSON)
  const triggerOffset = 400;
  window.addEventListener("scroll", () => {
    bar.classList.toggle("visible", window.scrollY > triggerOffset);
  });
})();
