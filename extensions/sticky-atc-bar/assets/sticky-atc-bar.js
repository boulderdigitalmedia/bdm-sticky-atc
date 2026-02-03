/**
 * BDM Sticky Add To Cart Bar
 * Safe init, theme-config driven, scroll aware
 */

(function () {
  if (window.__BDM_STICKY_ATC_INIT__) return;
  window.__BDM_STICKY_ATC_INIT__ = true;

  function init() {
    const bar = document.getElementById("bdm-sticky-atc");
    if (!bar) return;

    /* ---------------- Settings ---------------- */

    const bool = (v) => v === "" || v === "true";

    const showOnScroll   = bool(bar.dataset.showOnScroll);
    const scrollOffset   = parseInt(bar.dataset.scrollOffset || "0", 10);
    const enableDesktop  = bool(bar.dataset.enableDesktop);
    const enableMobile   = bool(bar.dataset.enableMobile);
    const showTitle      = bool(bar.dataset.showTitle);
    const showPrice      = bool(bar.dataset.showPrice);
    const showQty        = bool(bar.dataset.showQty);

    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    if ((isMobile && !enableMobile) || (!isMobile && !enableDesktop)) {
      return;
    }

    /* ---------------- Elements ---------------- */

    const titleEl = bar.querySelector("#bdm-title");
    const priceEl = bar.querySelector("#bdm-price");
    const qtyEl   = bar.querySelector("#bdm-qty");
    const atcBtn  = bar.querySelector("#bdm-atc");

    /* ---------------- Populate Data ---------------- */

    const product = window.ShopifyAnalytics?.meta?.product;

    if (product) {
      if (titleEl && showTitle) {
        titleEl.textContent = product.title;
        titleEl.style.display = "";
      }

      if (priceEl && showPrice) {
        fetch(`/products/${product.handle}.js`)
          .then(r => r.json())
          .then(p => {
            const v = p.variants?.[0];
            if (!v) return;
            priceEl.textContent =
              (v.price / 100).toLocaleString(undefined, {
                style: "currency",
                currency: Shopify.currency.active
              });
            priceEl.style.display = "";
          });
      }
    }

    if (qtyEl && showQty) {
      qtyEl.style.display = "";
    }

    /* ---------------- Visibility ---------------- */

    function showBar() {
      bar.classList.add("is-visible");
      bar.setAttribute("aria-hidden", "false");
    }

    if (!showOnScroll) {
      showBar();
    } else {
      window.addEventListener(
        "scroll",
        () => {
          if (window.scrollY >= scrollOffset) showBar();
        },
        { passive: true }
      );
    }

    /* ---------------- Add To Cart ---------------- */

    if (atcBtn) {
      atcBtn.addEventListener("click", async () => {
        try {
          const form =
            document.querySelector('form[action*="/cart/add"]') ||
            document.querySelector("form[action='/cart/add']");

          if (!form) return;

          const data = new FormData(form);
          if (qtyEl) data.set("quantity", qtyEl.value || 1);

          await fetch("/cart/add.js", {
            method: "POST",
            body: data,
            headers: { Accept: "application/json" }
          });

          document.dispatchEvent(
            new CustomEvent("bdm:atc", { detail: { source: "sticky-bar" } })
          );
        } catch (e) {
          console.error("[BDM Sticky ATC]", e);
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
