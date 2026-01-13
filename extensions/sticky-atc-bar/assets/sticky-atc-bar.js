(function () {
  const bar = document.getElementById("bdm-sticky-atc");
  if (!bar) return;

  const stickyATC = document.getElementById("bdm-atc");
  const stickyQty = document.getElementById("bdm-qty");
  const stickyVariant = document.getElementById("bdm-variant");
  const stickyTitle = document.getElementById("bdm-title");
  const stickyPrice = document.getElementById("bdm-price");

  /* --------------------------------
     PRODUCT TITLE + PRICE
  -------------------------------- */
  const titleEl = document.querySelector("h1");
  if (titleEl) stickyTitle.textContent = titleEl.textContent;

  const priceEl =
    document.querySelector("[data-product-price]") ||
    document.querySelector(".price") ||
    document.querySelector(".price-item");

  if (priceEl) stickyPrice.textContent = priceEl.textContent;

  /* --------------------------------
     GET CURRENT VARIANT ID (SAFE)
  -------------------------------- */
  function getCurrentVariantId() {
    const input = document.querySelector('input[name="id"]');
    if (input && input.value) return input.value;

    const select = document.querySelector('select[name="id"]');
    if (select && select.value) return select.value;

    return null;
  }

  // Hide variant selector if theme controls variants
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
      /* Add item */
      const res = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: Number(variantId),
          quantity: Number(stickyQty.value || 1),
        }),
      });

      await res.json();

      /* --------------------------------
         REFRESH CART DATA
      -------------------------------- */
      const cart = await fetch("/cart.js").then(r => r.json());

      /* --------------------------------
         UPDATE CART ICON / BADGE
      -------------------------------- */
      const count = cart.item_count;

      const badgeSelectors = [
        ".cart-count-bubble span",
        ".cart-count",
        "[data-cart-count]",
        ".header__cart-count",
        ".site-header__cart-count"
      ];

      badgeSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          el.textContent = count;
          el.classList.remove("hidden");
          el.style.display = "";
        });
      });

      // Dawn cart-count element
      document.querySelectorAll("cart-count").forEach(el => {
        el.textContent = count;
      });

      /* --------------------------------
         OPEN CART DRAWER
      -------------------------------- */
      const drawer = document.querySelector("cart-drawer");
      if (drawer && typeof drawer.open === "function") {
        drawer.open();
      } else {
        document
          .querySelector('[data-cart-drawer-toggle], a[href="/cart"]')
          ?.click();
      }

      /* --------------------------------
         BUTTON FEEDBACK
      -------------------------------- */
      stickyATC.textContent = "Added ✓";
      setTimeout(() => {
        stickyATC.textContent = "Add to cart";
        stickyATC.disabled = false;
      }, 1400);

    } catch (err) {
      console.error("Sticky ATC error", err);
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
