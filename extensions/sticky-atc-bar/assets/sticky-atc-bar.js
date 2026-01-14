(function () {
  const bar = document.getElementById("bdm-sticky-atc");
  if (!bar) return;

  const stickyATC = document.getElementById("bdm-atc");
  const stickyQty = document.getElementById("bdm-qty");
  const stickyVariant = document.getElementById("bdm-variant");
  const stickyTitle = document.getElementById("bdm-title");
  const stickyPrice = document.getElementById("bdm-price");

  /* -----------------------------
     PRODUCT JSON (SOURCE OF TRUTH)
  ------------------------------ */
  const product =
    window.Shopify?.product ||
    (() => {
      try {
        return JSON.parse(
          document.querySelector("#ProductJson")?.textContent || "null"
        );
      } catch {
        return null;
      }
    })();

  if (!product || !product.variants?.length) {
    stickyVariant.style.display = "none";
  }

  const hiddenIdInput = document.querySelector('input[name="id"]');

  /* -----------------------------
     TITLE
  ------------------------------ */
  const titleEl = document.querySelector("h1");
  if (titleEl) stickyTitle.textContent = titleEl.textContent;

  /* -----------------------------
     PRICE SYNC
  ------------------------------ */
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

  /* -----------------------------
     BUILD VARIANT DROPDOWN (CORRECT)
  ------------------------------ */
  if (product?.variants?.length > 1 && hiddenIdInput) {
    stickyVariant.innerHTML = "";

    product.variants.forEach((variant) => {
      if (!variant.available) return;

      const o = document.createElement("option");
      o.value = variant.id;
      o.textContent = variant.options.join(" / ");
      stickyVariant.appendChild(o);
    });

    // Default to current variant
    stickyVariant.value = hiddenIdInput.value;

    // Sticky → Theme
    stickyVariant.addEventListener("change", () => {
      hiddenIdInput.value = stickyVariant.value;
      hiddenIdInput.dispatchEvent(new Event("change", { bubbles: true }));
      syncPriceFromTheme();
    });

    // Theme → Sticky
    document.addEventListener("change", () => {
      stickyVariant.value = hiddenIdInput.value;
      syncPriceFromTheme();
    });

    stickyVariant.style.display = "";
  } else {
    stickyVariant.style.display = "none";
  }

  /* -----------------------------
     CART BADGE
  ------------------------------ */
  async function updateCartBadge() {
    const cart = await fetch("/cart.js").then((r) => r.json());

    const selectors = [
      ".cart-count-bubble span",
      ".cart-count",
      "[data-cart-count]",
      ".header__cart-count",
      ".site-header__cart-count",
    ];

    selectors.forEach((s) => {
      document.querySelectorAll(s).forEach((el) => {
        el.textContent = cart.item_count;
        el.classList.remove("hidden");
        el.style.display = "";
      });
    });

    document.querySelectorAll("cart-count").forEach((el) => {
      el.textContent = cart.item_count;
    });
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

  /* -----------------------------
     ADD TO CART
  ------------------------------ */
  stickyATC.addEventListener("click", async () => {
    const variantId = hiddenIdInput?.value;
    if (!variantId) return;

    const originalText = stickyATC.textContent;
    stickyATC.disabled = true;
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
    }
  });

  /* -----------------------------
     SHOW ON SCROLL
  ------------------------------ */
  const triggerOffset = 400;
  window.addEventListener("scroll", () => {
    bar.classList.toggle("visible", window.scrollY > triggerOffset);
  });
})();
