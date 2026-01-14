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
     LOAD PRODUCT JSON (RESTORED – THIS IS THE KEY)
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
     PRICE
  -------------------------------------------------- */
  function formatMoney(cents) {
    return typeof cents === "number"
      ? `$${(cents / 100).toFixed(2)}`
      : cents;
  }

  function setPriceFromVariant(variant) {
    if (variant) stickyPrice.textContent = formatMoney(variant.price);
  }

  /* -------------------------------------------------
     THEME VARIANT SYNC
  -------------------------------------------------- */
  function setThemeVariant(id) {
    const input =
      document.querySelector('input[name="id"]') ||
      document.querySelector('select[name="id"]');

    if (!input) return;
    input.value = String(id);
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function getThemeVariantId() {
    return (
      document.querySelector('input[name="id"]')?.value ||
      document.querySelector('select[name="id"]')?.value ||
      null
    );
  }

  /* -------------------------------------------------
     BUILD VARIANT SELECT (FROM PRODUCT JSON)
  -------------------------------------------------- */
  function buildVariantSelect() {
    if (!product?.variants?.length) {
      stickyVariant.style.display = "none";
      return;
    }

    // Hide if single-variant product
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
      getThemeVariantId() || product.variants.find(v => v.available)?.id || product.variants[0].id;

    stickyVariant.value = String(initialId);
    setThemeVariant(initialId);

    const initialVariant = product.variants.find(
      (v) => String(v.id) === String(initialId)
    );
    setPriceFromVariant(initialVariant);

    // Sticky → Theme
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
     SELLING PLANS (DOM-BASED, SAFE)
  -------------------------------------------------- */
  const sellingPlanSelect = document.querySelector(
    'select[name="selling_plan"]'
  );
  let activeSellingPlan = null;

  if (sellingPlanSelect) {
    if (!sellingPlanSelect.value && sellingPlanSelect.options.length) {
      sellingPlanSelect.selectedIndex = 0;
      sellingPlanSelect.dispatchEvent(
        new Event("change", { bubbles: true })
      );
    }

    activeSellingPlan = sellingPlanSelect.value;

    sellingPlanSelect.addEventListener("change", () => {
      activeSellingPlan = sellingPlanSelect.value;
    });
  }

  /* -------------------------------------------------
     CART BADGE + DRAWER
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
     ADD TO CART (FIXED)
  -------------------------------------------------- */
  stickyATC.addEventListener("click", async () => {
    const variantId = stickyVariant.value || getThemeVariantId();
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
          ...(activeSellingPlan && { selling_plan: activeSellingPlan }),
        }),
      });

      if (!res.ok) throw new Error("Add failed");

      const addedItem = await res.json();

      document.dispatchEvent(
        new CustomEvent("cart:updated", { detail: addedItem })
      );
      document.dispatchEvent(new Event("cart:refresh"));
      document.dispatchEvent(new Event("cart:change"));

      await updateCartBadge();
      openCartDrawer();

      stickyATC.textContent = "Added ✓";
    } catch (e) {
      console.error(e);
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
