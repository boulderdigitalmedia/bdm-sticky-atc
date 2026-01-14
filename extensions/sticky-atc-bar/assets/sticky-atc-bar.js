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
     LOAD PRODUCT JSON (source of truth)
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
     HELPERS
  -------------------------------------------------- */
  function getThemeVariantInput() {
    return (
      document.querySelector('form[action*="/cart/add"] input[name="id"]') ||
      document.querySelector('input[name="id"]') ||
      document.querySelector('select[name="id"]')
    );
  }

  function setThemeVariant(id) {
    const input = getThemeVariantInput();
    if (!input) return;
    input.value = String(id);
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function getCurrentVariantId() {
    return getThemeVariantInput()?.value || null;
  }

  function getCurrentSellingPlan() {
    return document.querySelector('select[name="selling_plan"]')?.value || null;
  }

  function formatMoney(cents) {
    return typeof cents === "number"
      ? `$${(cents / 100).toFixed(2)}`
      : cents;
  }

  /* -------------------------------------------------
     TITLE + PRICE
  -------------------------------------------------- */
  const titleEl = document.querySelector("h1");
  if (titleEl) stickyTitle.textContent = titleEl.textContent;

  function setPriceFromVariant(variant) {
    if (variant) stickyPrice.textContent = formatMoney(variant.price);
  }

  /* -------------------------------------------------
     BUILD VARIANT DROPDOWN (from product JSON)
  -------------------------------------------------- */
  function buildVariantSelect() {
    if (!product?.variants?.length) {
      stickyVariant.style.display = "none";
      return;
    }

    if (product.variants.length === 1) {
      stickyVariant.style.display = "none";
      setThemeVariant(product.variants[0].id);
      setPriceFromVariant(product.variants[0]);
      return;
    }

    stickyVariant.innerHTML = "";

    product.variants.forEach((variant) => {
      const opt = document.createElement("option");
      opt.value = variant.id;
      opt.textContent = variant.public_title || variant.title;
      stickyVariant.appendChild(opt);
    });

    const initialId =
      getCurrentVariantId() ||
      product.variants.find((v) => v.available)?.id ||
      product.variants[0].id;

    stickyVariant.value = String(initialId);
    setThemeVariant(initialId);
    setPriceFromVariant(
      product.variants.find((v) => String(v.id) === String(initialId))
    );

    stickyVariant.addEventListener("change", () => {
      const selected = product.variants.find(
        (v) => String(v.id) === stickyVariant.value
      );
      setThemeVariant(selected.id);
      setPriceFromVariant(selected);
    });

    stickyVariant.style.display = "";
  }

  /* -------------------------------------------------
     CART HELPERS
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
     ADD TO CART (ATOMIC + FIXED)
  -------------------------------------------------- */
  stickyATC.addEventListener("click", async () => {
    const variantId = stickyVariant.value || getCurrentVariantId();
    const sellingPlan = getCurrentSellingPlan();

    if (!variantId) return;

    const originalText = stickyATC.textContent;
    stickyATC.disabled = true;
    stickyATC.textContent = "Adding…";

    try {
      const payload = {
        id: Number(variantId),
        quantity: Number(stickyQty.value || 1),
      };

      if (sellingPlan) {
        payload.selling_plan = sellingPlan;
      }

      const res = await fetch("/cart/add.js", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Add to cart failed");

      const addedItem = await res.json();

      /* ---- SHOPIFY CART LIFECYCLE ---- */
      document.dispatchEvent(
        new CustomEvent("cart:updated", { detail: { item: addedItem } })
      );
      document.dispatchEvent(new Event("cart:refresh"));
      document.dispatchEvent(new Event("cart:change"));

      await updateCartBadge();
      openCartDrawer();

      stickyATC.textContent = "Added ✓";
    } catch (e) {
      console.error("Sticky ATC error", e);
      stickyATC.textContent = "Error";
    } finally {
      setTimeout(() => {
        stickyATC.textContent = originalText;
        stickyATC.disabled = false;
      }, 1200);
    }
  });

  /* -------------------------------------------------
     SCROLL VISIBILITY
  -------------------------------------------------- */
  window.addEventListener("scroll", () => {
    bar.classList.toggle("visible", window.scrollY > 400);
  });

  /* -------------------------------------------------
     INIT
  -------------------------------------------------- */
  (async function init() {
    product = await loadProductJson();
    buildVariantSelect();
  })();
})();
