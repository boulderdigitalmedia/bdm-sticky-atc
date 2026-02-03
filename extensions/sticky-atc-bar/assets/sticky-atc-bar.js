(() => {
  const bar = document.querySelector("[data-bdm-sticky-atc]");
  if (!bar || window.__BDM_STICKY_ATC_INIT__) return;
  window.__BDM_STICKY_ATC_INIT__ = true;

  const isMobile = () => window.matchMedia("(max-width: 768px)").matches;

  // Device filtering
  if (isMobile() && bar.dataset.enableMobile === "false") return;
  if (!isMobile() && bar.dataset.enableDesktop === "false") return;

  const showOnScroll = bar.dataset.showOnScroll === "true";
  const scrollOffset = Number(bar.dataset.scrollOffset || 300);

  const titleEl = bar.querySelector("#bdm-title");
  const priceEl = bar.querySelector("#bdm-price");
  const qtyEl = bar.querySelector("#bdm-qty");
  const button = bar.querySelector("#bdm-atc");
  const controls = bar.querySelector(".bdm-right");

  async function getProduct() {
    const handle = location.pathname.split("/products/")[1]?.split("/")[0];
    if (!handle) return null;
    const res = await fetch(`/products/${handle}.js`);
    return res.ok ? res.json() : null;
  }

  (async () => {
    const product = await getProduct();
    if (!product) return;

    if (titleEl) titleEl.textContent = product.title;
    if (priceEl) priceEl.textContent = `$${(product.price / 100).toFixed(2)}`;

    let variantId = product.variants[0].id;
    let qty = 1;

    if (qtyEl) {
      qtyEl.addEventListener("change", () => {
        qty = Math.max(1, Number(qtyEl.value || 1));
      });
    }

    if (bar.dataset.showVariant === "true" && product.variants.length > 1) {
      const select = document.createElement("select");
      select.className = "bdm-atc-variants";
      product.variants.forEach(v => {
        const o = document.createElement("option");
        o.value = v.id;
        o.textContent = v.title;
        select.appendChild(o);
      });
      select.addEventListener("change", () => {
        variantId = select.value;
      });
      controls.insertBefore(select, button);
    }

    if (showOnScroll) {
      const onScroll = () => {
        if (window.scrollY >= scrollOffset) {
          bar.classList.add("is-visible");
          window.removeEventListener("scroll", onScroll);
        }
      };
      window.addEventListener("scroll", onScroll);
    } else {
      bar.classList.add("is-visible");
    }

    button.addEventListener("click", async () => {
      await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ id: variantId, quantity: qty }] })
      });
      location.href = "/cart";
    });
  })();
})();
