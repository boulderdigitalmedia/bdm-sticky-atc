(() => {
  const BAR_ID = "bdm-sticky-atc";
  const bar = document.getElementById(BAR_ID);
  if (!bar) return;

  const title = bar.querySelector("#bdm-title");
  const price = bar.querySelector("#bdm-price");
  const button = bar.querySelector("#bdm-atc");
  const qtyInput = bar.querySelector("#bdm-qty");

  /* -------------------------------------------------
     Force repaint in Shopify Theme Editor
     (required for app embed settings updates)
  ------------------------------------------------- */
  if (document.documentElement.hasAttribute("data-shopify-editor")) {
    bar.style.display = "none";
    bar.offsetHeight; // force reflow
    bar.style.display = "";
  }

  /* -------------------------------------------------
     Helpers
  ------------------------------------------------- */

  function formatMoney(cents) {
    return `$${(cents / 100).toFixed(2)}`;
  }

  async function getProduct() {
    try {
      const path = window.location.pathname;
      if (!path.includes("/products/")) return null;

      const handle = path.split("/products/")[1].split("/")[0].split("?")[0];
      const res = await fetch(`/products/${handle}.js`, {
        credentials: "same-origin"
      });

      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /* -------------------------------------------------
     Init
  ------------------------------------------------- */

  (async () => {
    const product = await getProduct();
    if (!product || !product.variants?.length) return;

    if (title) title.textContent = product.title;
    if (price) price.textContent = formatMoney(product.price);

    bar.classList.add("is-visible");

    button.addEventListener("click", async () => {
      const quantity = qtyInput
        ? Math.max(1, parseInt(qtyInput.value, 10) || 1)
        : 1;

      await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          items: [{ id: product.variants[0].id, quantity }]
        })
      });

      window.location.href = "/cart";
    });
  })();
})();
