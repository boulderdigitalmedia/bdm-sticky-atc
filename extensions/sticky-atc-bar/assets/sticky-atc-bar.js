(function () {
  const bar = document.getElementById("bdm-sticky-atc");
  if (!bar) return;

  const stickyATC = document.getElementById("bdm-atc");
  const stickyQty = document.getElementById("bdm-qty");
  const stickyVariant = document.getElementById("bdm-variant");
  const stickyTitle = document.getElementById("bdm-title");
  const stickyPrice = document.getElementById("bdm-price");

  /* -------------------------------------------------
     TITLE + PRICE (never fatal)
  -------------------------------------------------- */
  const titleEl = document.querySelector("h1");
  if (titleEl) stickyTitle.textContent = titleEl.textContent;

  const priceEl =
    document.querySelector("[data-product-price]") ||
    document.querySelector(".price") ||
    document.querySelector(".price-item");

  function syncPriceFromTheme() {
    if (priceEl) stickyPrice.textContent = priceEl.textContent;
  }
  syncPriceFromTheme();

  if (priceEl) {
    new MutationObserver(syncPriceFromTheme).observe(priceEl, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  /* -------------------------------------------------
     THEME VARIANT HELPERS
  -------------------------------------------------- */
  const themeSelect = () => document.querySelector('select[name="id"]');
  const themeIdInput = () =>
    document.querySelector('input[name="id"]') ||
    document.querySelector('select[name="id"]');

  function getCurrentVariantId() {
    return themeIdInput()?.value || null;
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

  /* -------------------------------------------------
     BUILD STICKY VARIANTS FROM <select name="id">
  -------------------------------------------------- */
  function populateFromSelect() {
    const sel = themeSelect();
    if (!sel) return false;

    stickyVariant.innerHTML = "";

    sel.querySelectorAll("option").forEach((opt) => {
      if (!opt.value) return;
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.textContent;
      stickyVariant.appendChild(o);
    });

    stickyVariant.value = sel.value;

    stickyVariant.addEventListener("change", () => {
      setThemeVariantId(stickyVariant.value);
      syncPriceFromTheme();
    });

    sel.addEventListener("change", () => {
      stickyVariant.value = sel.value;
      syncPriceFromTheme();
    });

    stickyVariant.style.display = "";
    return true;
  }

  /* -------------------------------------------------
     BUILD STICKY VARIANTS FROM RADIOS (Dawn-style)
  -------------------------------------------------- */
  function populateFromRadios() {
    const radios = document.querySelectorAll(
      'input[type="radio"][name^="options"], input[type="radio"][name*="option"]'
    );

    const hiddenId = document.querySelector('input[name="id"]');
    if (!radios.length || !hiddenId) return false;

    stickyVariant.innerHTML = "";
    const seen = new Set();

    radios.forEach((radio) => {
      if (!radio.value || seen.has(radio.value)) return;
      seen.add(radio.value);

      const label =
        document.querySelector(`label[for="${radio.id}"]`)?.innerText ||
        radio.value;

      const o = document.createElement("option");
      o.value = radio.value;
      o.textContent = label;
      stickyVariant.appendChild(o);
    });

    if (!stickyVariant.options.length) return false;

    stickyVariant.value = hiddenId.value;

    stickyVariant.addEventListener("change", () => {
      hiddenId.value = stickyVariant.value;
      hiddenId.dispatchEvent(new Event("change", { bubbles: true }));
      syncPriceFromTheme();
    });

    document.addEventListener("change", () => {
      stickyVariant.value = hiddenId.value;
      syncPriceFromTheme();
    });

    stickyVariant.style.display = "";
    return true;
  }

  /* -------------------------------------------------
     VARIANT INITIALIZATION (SAFE ORDER)
  -------------------------------------------------- */
  let variantsEnabled = populateFromSelect();
  if (!variantsEnabled) variantsEnabled = populateFromRadios();
  if (!variantsEnabled) stickyVariant.style.display = "none";

  /* -------------------------------------------------
     CART BADGE UPDATE
  -------------------------------------------------- */
  async function updateCartBadge() {
    const cart = await fetch("/cart.js").then((r) => r.json());
    const count = cart.item_count;

    [
      ".cart-count-bubble span",
      ".cart-count",
      "[data-cart-count]",
      ".header__cart-count",
      ".site-header__cart-count",
    ].forEach((s) => {
      document.querySelectorAll(s).forEach((el) => {
        el.textContent = count;
        el.classList.remove("hidden");
        el.style.display = "";
      });
    });

    document.querySelectorAll("cart-count").forEach((el) => {
      el.textContent = count;
    });

    return cart;
  }

  function openCartDrawer() {
    const drawer = document.querySelector("cart-drawer");
    if (drawer?.open) {
      drawer.open();
      return true;
    }

    document
      .querySelector('[data-cart-drawer-toggle], [aria-controls*="cart"]')
      ?.click();

    return false;
  }

  /* -------------------------------------------------
     ADD TO CART (FIXED + BULLETPROOF)
  -------------------------------------------------- */
  stickyATC.addEventListener("click", async () => {
    const variantId =
      stickyVariant.style.display === "none"
        ? getCurrentVariantId()
        : stickyVariant.value;

    if (!variantId) return;

    const originalText = stickyATC.textContent;
    stickyATC.disabled = true;
    stickyATC.textContent = "Adding…";

    try {
      const res = await fetch("/cart/add.js", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          id: Number(variantId),
          quantity: Number(stickyQty.value || 1),
        }),
      });

      if (!res.ok) throw new Error("Add to cart failed");

      const addedItem = await res.json();

      /* ---- THEME CART LIFECYCLE ---- */
      document.dispatchEvent(
        new CustomEvent("cart:updated", { detail: { item: addedItem } })
      );
      document.dispatchEvent(new Event("cart:refresh"));
      document.dispatchEvent(new Event("cart:change"));

      await updateCartBadge();
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
  const triggerOffset = 400;
  window.addEventListener("scroll", () => {
    bar.classList.toggle("visible", window.scrollY > triggerOffset);
  });
})();
