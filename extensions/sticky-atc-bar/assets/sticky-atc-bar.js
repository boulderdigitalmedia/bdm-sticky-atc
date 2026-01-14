(function () {
  const bar = document.getElementById("bdm-sticky-atc");
  if (!bar) return;

  const stickyATC = document.getElementById("bdm-atc");
  const stickyQty = document.getElementById("bdm-qty");
  const stickyVariant = document.getElementById("bdm-variant");
  const stickyTitle = document.getElementById("bdm-title");
  const stickyPrice = document.getElementById("bdm-price");

  /* -------------------------------------------------
     WAIT FOR PRODUCT FORM (CRITICAL FIX)
  -------------------------------------------------- */
  function waitForProductForm(cb) {
    const maxWait = 5000;
    const start = Date.now();

    const tick = () => {
      const form = document.querySelector('form[action*="/cart/add"]');
      const variantInput =
        form?.querySelector('input[name="id"], select[name="id"]');

      if (form && variantInput) {
        cb(form);
      } else if (Date.now() - start < maxWait) {
        requestAnimationFrame(tick);
      }
    };

    tick();
  }

  /* -------------------------------------------------
     HELPERS (LIVE DOM READS ONLY)
  -------------------------------------------------- */
  function getVariantInput() {
    return document.querySelector(
      'form[action*="/cart/add"] input[name="id"], form[action*="/cart/add"] select[name="id"]'
    );
  }

  function getSellingPlan() {
    return document.querySelector(
      'form[action*="/cart/add"] select[name="selling_plan"]'
    )?.value;
  }

  function getPriceEl() {
    return (
      document.querySelector("[data-product-price]") ||
      document.querySelector(".price") ||
      document.querySelector(".price-item")
    );
  }

  /* -------------------------------------------------
     INIT AFTER PRODUCT READY
  -------------------------------------------------- */
  waitForProductForm((form) => {
    /* TITLE */
    const titleEl = document.querySelector("h1");
    if (titleEl) stickyTitle.textContent = titleEl.textContent;

    /* PRICE */
    const priceEl = getPriceEl();
    if (priceEl) stickyPrice.textContent = priceEl.textContent;

    if (priceEl) {
      new MutationObserver(() => {
        stickyPrice.textContent = priceEl.textContent;
      }).observe(priceEl, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    /* VARIANTS */
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
      stickyVariant.style.display = "none";
    }
  });

  /* -------------------------------------------------
     CART REFRESH (REQUIRED FOR SELLING PLANS)
  -------------------------------------------------- */
  async function refreshCartUI() {
    const res = await fetch(
      `${window.Shopify?.routes?.root || "/"}?sections=cart-drawer,cart-icon-bubble`
    );
    const text = await res.text();

    const html = document.createElement("div");
    html.innerHTML = text;

    html.querySelectorAll("[id]").forEach((el) => {
      const existing = document.getElementById(el.id);
      if (existing) existing.replaceWith(el);
    });
  }

  function openCartDrawer() {
    const drawer = document.querySelector("cart-drawer");
    if (drawer?.open) drawer.open();
    else
      document
        .querySelector('[data-cart-drawer-toggle], [aria-controls*="cart"]')
        ?.click();
  }

  /* -------------------------------------------------
     ADD TO CART (LIVE PAYLOAD)
  -------------------------------------------------- */
  stickyATC.addEventListener("click", async () => {
    const variantId = getVariantInput()?.value;
    if (!variantId) return;

    const sellingPlan = getSellingPlan();
    const originalText = stickyATC.textContent;

    stickyATC.disabled = true;
    stickyATC.textContent = "Adding…";

    try {
      const payload = {
        id: Number(variantId),
        quantity: Number(stickyQty.value || 1),
      };

      if (sellingPlan) payload.selling_plan = sellingPlan;

      const res = await fetch("/cart/add.js", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Add failed");

      await refreshCartUI();
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
     SHOW ON SCROLL
  -------------------------------------------------- */
  window.addEventListener("scroll", () => {
    bar.classList.toggle("visible", window.scrollY > 400);
  });
})();
