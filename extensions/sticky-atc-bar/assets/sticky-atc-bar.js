(function () {
  const bar = document.getElementById("bdm-sticky-atc");
  if (!bar) return;

  const stickyATC = document.getElementById("bdm-atc");
  const stickyQty = document.getElementById("bdm-qty");
  const stickyVariant = document.getElementById("bdm-variant");
  const stickyTitle = document.getElementById("bdm-title");
  const stickyPrice = document.getElementById("bdm-price");

  /* --------------------------------
     PRODUCT JSON (required for variants)
  -------------------------------- */
  const productJsonEl =
    document.querySelector('script[type="application/json"][data-product-json]') ||
    document.querySelector("#ProductJson");

  if (!productJsonEl) {
    console.warn("Sticky ATC: product JSON not found");
    return;
  }

  const product = JSON.parse(productJsonEl.textContent);

  stickyTitle.textContent = product.title;

  /* --------------------------------
     VARIANT SELECTOR (STICKY BAR)
  -------------------------------- */
  product.variants.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v.id;
    opt.textContent = v.title;
    stickyVariant.appendChild(opt);
  });

  function getThemeVariantInput() {
    return (
      document.querySelector('input[name="id"]') ||
      document.querySelector('select[name="id"]')
    );
  }

  function setThemeVariant(id) {
    const input = getThemeVariantInput();
    if (!input) return;
    input.value = id;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function getCurrentVariantId() {
    const input = getThemeVariantInput();
    return input ? input.value : product.variants[0].id;
  }

  stickyVariant.value = getCurrentVariantId();

  function updatePrice() {
    const variant = product.variants.find(v => v.id == stickyVariant.value);
    if (!variant) return;

    stickyPrice.textContent =
      (variant.price / 100).toLocaleString(undefined, {
        style: "currency",
        currency: product.currency || "USD",
      });
  }

  updatePrice();

  stickyVariant.addEventListener("change", () => {
    setThemeVariant(stickyVariant.value);
    updatePrice();
  });

  /* --------------------------------
     SYNC WHEN THEME VARIANT CHANGES
  -------------------------------- */
  const themeVariantInput = getThemeVariantInput();
  if (themeVariantInput) {
    themeVariantInput.addEventListener("change", () => {
      stickyVariant.value = themeVariantInput.value;
      updatePrice();
    });
  }

  /* --------------------------------
     ADD TO CART
  -------------------------------- */
  stickyATC.addEventListener("click", async () => {
    stickyATC.disabled = true;
    stickyATC.textContent = "Adding…";

    try {
      await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: Number(stickyVariant.value),
          quantity: Number(stickyQty.value || 1),
        }),
      });

      const cart = await fetch("/cart.js").then(r => r.json());

      /* Update cart badge */
      const count = cart.item_count;
      [
        ".cart-count-bubble span",
        ".cart-count",
        "[data-cart-count]",
        ".header__cart-count",
        ".site-header__cart-count",
      ].forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          el.textContent = count;
          el.classList.remove("hidden");
        });
      });

      document.querySelectorAll("cart-count").forEach(el => {
        el.textContent = count;
      });

      /* Open cart drawer */
      const drawer = document.querySelector("cart-drawer");
      if (drawer?.open) drawer.open();
      else document.querySelector('[data-cart-drawer-toggle]')?.click();

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
