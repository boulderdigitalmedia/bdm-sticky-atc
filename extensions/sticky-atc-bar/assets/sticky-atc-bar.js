(() => {
  if (window.__BDM_STICKY_ATC_INIT__) return;
  window.__BDM_STICKY_ATC_INIT__ = true;

  const bar = document.querySelector('[data-bdm-sticky-atc]');
  if (!bar) return;

  const isMobile = () => window.matchMedia("(max-width: 768px)").matches;

  if (isMobile() && bar.dataset.enableMobile === "false") return;
  if (!isMobile() && bar.dataset.enableDesktop === "false") return;

  const showOnScroll = bar.dataset.showOnScroll === "true";
  const offset = Number(bar.dataset.scrollOffset || 300);

  if (!showOnScroll) {
    bar.classList.add("is-visible");
  } else {
    const onScroll = () => {
      if (window.scrollY >= offset) {
        bar.classList.add("is-visible");
        window.removeEventListener("scroll", onScroll);
      }
    };
    window.addEventListener("scroll", onScroll);
  }

  fetch(`${location.pathname}.js`)
    .then(r => r.json())
    .then(product => {
      if (!product) return;

      if (bar.dataset.showTitle !== "true") {
        bar.querySelector("#bdm-title")?.remove();
      } else {
        bar.querySelector("#bdm-title").textContent = product.title;
      }

      if (bar.dataset.showPrice !== "true") {
        bar.querySelector("#bdm-price")?.remove();
      } else {
        bar.querySelector("#bdm-price").textContent = `$${(product.price / 100).toFixed(2)}`;
      }
    });

  bar.querySelector("#bdm-atc")?.addEventListener("click", async () => {
    const qty = Number(bar.querySelector("#bdm-qty")?.value || 1);

    await fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ id: window.meta?.product?.variants[0]?.id, quantity: qty }] })
    });

    window.location.href = "/cart";
  });
})();
