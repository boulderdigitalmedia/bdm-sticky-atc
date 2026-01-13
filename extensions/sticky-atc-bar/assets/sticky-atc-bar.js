(function () {
  const bar = document.getElementById("bdm-sticky-atc");
  if (!bar) return;

  const stickyATC = document.getElementById("bdm-atc");
  const stickyQty = document.getElementById("bdm-qty");
  const stickyVariant = document.getElementById("bdm-variant");
  const stickyTitle = document.getElementById("bdm-title");
  const stickyPrice = document.getElementById("bdm-price");

  /* --------------------------------
     PRODUCT INFO (safe selectors)
  -------------------------------- */
  const titleEl = document.querySelector("h1");
  if (titleEl) stickyTitle.textContent = titleEl.textContent;

  const priceEl =
    document.querySelector("[data-product-price]") ||
    document.querySelector(".price") ||
    document.querySelector(".price-item");

  if (priceEl) stickyPrice.textContent = priceEl.textContent;

  /* --------------------------------
     GET CURRENT VARIANT ID (theme-safe)
  -------------------------------- */
  function getCurrentVariantId() {
    // Modern themes (hidden input)
    const input = document.querySelector('input[name="id"]');
    if (input && input.value) return input.value;

    // Legacy themes
    const select = document.querySelector('select[name="id"]');
    if (select && select.value) return select.value;

    return null;
  }

  // If theme controls variants, hide sticky selector
  if (getCurrentVariantId()) {
    stickyVariant.style.display = "none";
  }

  /* --------------------------------
     ADD TO CART
  -------------------------------- */
  stickyATC.addEventListener("click", async () => {
    const variantId = getCurrentVariantId();
    if (!variantId) {
      console.warn("Sticky ATC: No variant ID found");
      return;
    }

    stickyATC.disabled = true;
    stickyATC.textContent = "Adding…";

    try {
      const res = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: Number(variantId),
          quantity: Number(stickyQty.value || 1),
        }),
      });

      const item = await res.json();

      /* --------------------------------
         CART REFRESH EVENTS (important)
      -------------------------------- */
      document.dispatchEvent(new CustomEvent("cart:updated", { detail: item }));
      document.dispatchEvent(new Event("cart:refresh"));
      document.dispatchEvent(new Event("cart:change"));

      // Fetch full cart as fallback
      fetch("/cart.js")
        .then(r => r.json())
        .then(cart => {
          document.dispatchEvent(
            new CustomEvent("cart:updated", { detail: cart })
          );
        });

      /* --------------------------------
         AUTO-OPEN CART DRAWER
      -------------------------------- */

      // Dawn theme
      const drawer = document.querySelector("cart-drawer");
      if (drawer && typeof drawer.open === "function") {
        drawer.open();
      }

      // Generic fallback
      document
        .querySelector('[data-cart-drawer-toggle], a[href="/cart"]')
        ?.click();

      /* --------------------------------
         BUTTON FEEDBACK
      -------------------------------- */
      stickyATC.textContent = "Added ✓";
      setTimeout(() => {
        stickyATC.textContent = "Add to cart";
        stickyATC.disabled = false;
      }, 1400);

    } catch (e) {
      console.error("Sticky ATC error", e);
      stickyATC.textContent = "Error";
      stickyATC.disabled = false;
    }
  });

  /* --------------------------------
     SHOW ON SCROLL
  -------------------------------- */
  const triggerOffset = 400;

  window.addEventListener("scroll", () => {
    bar.classList.toggle("visible", window.scrollY > triggerOffset);
  });
})();
