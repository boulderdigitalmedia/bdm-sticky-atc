(() => {
  const BAR_ID = "bdm-sticky-atc";

  // Prevent double init
  if (window.__BDM_STICKY_ATC_INIT__) return;
  window.__BDM_STICKY_ATC_INIT__ = true;

  /* ---------------- Helpers ---------------- */

  function isProductPage() {
    return document.querySelector('[data-product-page="true"]');
  }

  function getSessionId() {
    const KEY = "bdm_sticky_atc_session_id";
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  }

  function track(event, data = {}) {
    fetch("/apps/bdm-sticky-atc/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        event,
        data: {
          ...data,
          sessionId: getSessionId()
        }
      })
    }).catch(() => {});
  }

  /* ---------------- Product DOM sync ---------------- */

  function findProductTitle() {
    return (
      document.querySelector('[data-product-title]') ||
      document.querySelector('h1.product__title') ||
      document.querySelector('h1')
    );
  }

  function findProductPrice() {
    return (
      document.querySelector('[data-product-price]') ||
      document.querySelector('.price-item--regular') ||
      document.querySelector('.price')
    );
  }

  function syncText(sourceEl, targetEl) {
    if (!sourceEl || !targetEl) return;
    targetEl.textContent = sourceEl.textContent;
  }

  function observePriceChanges(source, target) {
    if (!source || !target) return;

    const observer = new MutationObserver(() => {
      target.textContent = source.textContent;
    });

    observer.observe(source, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  /* ---------------- Init ---------------- */

  if (!isProductPage()) return;

  const bar = document.getElementById(BAR_ID);
  if (!bar) return;

  const titleTarget = bar.querySelector("#bdm-title");
  const priceTarget = bar.querySelector("#bdm-price");
  const button = bar.querySelector("#bdm-atc");

  const titleSource = findProductTitle();
  const priceSource = findProductPrice();

  // Initial sync
  syncText(titleSource, titleTarget);
  syncText(priceSource, priceTarget);

  // Keep price in sync (variant changes)
  observePriceChanges(priceSource, priceTarget);

  /* ---------------- Visibility ---------------- */

  bar.classList.add("is-visible");
  bar.setAttribute("aria-hidden", "false");

  /* ---------------- Add to cart ---------------- */

  if (button) {
    button.addEventListener("click", async () => {
      track("sticky_atc_click");

      const form =
        document.querySelector('form[action^="/cart/add"]') ||
        document.querySelector("form");

      if (!form) return;

      const formData = new FormData(form);

      await fetch("/cart/add.js", {
        method: "POST",
        body: formData,
        credentials: "same-origin"
      });

      track("sticky_atc_success");

      window.location.href = "/cart";
    });
  }

  // Impression
  requestAnimationFrame(() => {
    track("sticky_atc_impression");
  });

})();
