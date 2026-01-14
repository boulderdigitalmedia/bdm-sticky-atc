(function () {
  const bar = document.getElementById("bdm-sticky-atc");
  if (!bar) return;

  const stickyATC = document.getElementById("bdm-atc");
  const stickyQty = document.getElementById("bdm-qty");
  const stickyVariant = document.getElementById("bdm-variant");
  const stickyTitle = document.getElementById("bdm-title");
  const stickyPrice = document.getElementById("bdm-price");

  let product = null;

  /* -------------------------------------------------
     LOAD PRODUCT JSON (THIS IS THE KEY PART YOU LOST)
  -------------------------------------------------- */
  async function loadProductJson() {
    const handle = location.pathname.match(/\/products\/([^/]+)/)?.[1];
    if (!handle) return null;

    try {
      const res = await fetch(`/products/${handle}.js`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      return res.ok ? res.json() : null;
    } catch {
      return null;
    }
  }

  /* -------------------------------------------------
     TITLE
  -------------------------------------------------- */
  const titleEl = document.querySelector("h1");
  if (titleEl) stickyTitle.textContent = titleEl.textContent;

  /* -------------------------------------------------
     VARIANT + PRICE HELPERS
  -------------------------------------------------- */
  function setThemeVariant(id) {
    const input =
      document.querySelector('input[name="id"]') ||
      document.querySelector('select[name="id"]');

    if (!input) return;
    input.value = String(id);
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function updatePriceForVariant(variant) {
    if (!variant) return;
    stickyPrice.textContent =
      typeof variant.price === "number"
        ? `$${(variant.price / 100).toFixed(2)}`
        : variant.price;
  }

  /* -------------------------------------------------
     BUILD VARIANT SELECT FROM PRODUCT JSON
  -------------------------------------------------- */
  function buildVariantSelect() {
    stickyVariant.innerHTML = "";

    product.variants.forEach((variant) => {
      const opt = document.createElement("option");
      opt.value = variant.id;
      opt.textContent = variant.public_title || variant.title;
      stickyVariant.appendChild(opt);
    });

    const initialVariant =
      product.variants.find((v) => v.available) || product.variants[0];

    stickyVariant.value = initialVariant.id;
    updatePriceForVariant(initialVariant);
    setThemeVariant(initialVariant.id);

    stickyVariant.addEventListener("change", () => {
      const selected = product.variants.find(
        (v) => String(v.id) === stickyVariant.value
      );
      updatePriceForVariant(selected);
      setThemeVariant(selected.id);
    });
  }

  /* -------------------------------------------------
     CART BADGE
  -------------------------------------------------- */
  async function updateCartBadge() {
    const cart = await fetch("/cart.js").then((r) => r.json());
    const count = cart.item_count;

    document
      .querySelectorAll(
        ".cart-count-bubble span, .cart-count, [data-cart-count]"
      )
      .forEach((el) => {
        el.textContent = count;
        el.classList.remove("hidden");
        el.style.display = "";
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

  /* -------------------------------------------------
     ADD TO CART
  -------------------------------------------------- */
  stickyATC.addEventListener("click", async () => {
    const variantId = stickyVariant.value;
    if (!variantId) return;

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

      await updateCartBadge();
      openCartDrawer();

      stickyATC.textContent = "Added ✓";
      setTimeout(() => {
        stickyATC.textContent = originalText;
        stickyATC.disabled = false;
      }, 1400);
    } catch (err) {
      console.error(err);
      stickyATC.textContent = "Error";
      stickyATC.disabled = false;
      setTimeout(() => {
        stickyATC.textContent = originalText;
      }, 1400);
    }
  });

  /* -------------------------------------------------
     SHOW ON SCROLL
  -------------------------------------------------- */
  const triggerOffset = 400;
  window.addEventListener("scroll", () => {
    bar.classList.toggle("visible", window.scrollY > triggerOffset);
  });

  /* -------------------------------------------------
     INIT
  -------------------------------------------------- */
  (async function init() {
    product = await loadProductJson();
    if (!product || !product.variants?.length) {
      stickyVariant.style.display = "none";
      return;
    }
    buildVariantSelect();
  })();
})();
