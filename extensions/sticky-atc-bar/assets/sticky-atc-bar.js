(() => {
  const bar = document.getElementById("bdm-sticky-atc");
  if (!bar) return;

  const title = bar.querySelector("#bdm-title");
  const price = bar.querySelector("#bdm-price");
  const button = bar.querySelector("#bdm-atc");
  const qtyInput = bar.querySelector("#bdm-qty");

  async function getProduct() {
    try {
      const handle = window.location.pathname.split("/products/")[1];
      if (!handle) return null;
      const res = await fetch(`/products/${handle}.js`);
      return await res.json();
    } catch {
      return null;
    }
  }

  function formatMoney(cents) {
    return `$${(cents / 100).toFixed(2)}`;
  }

  (async () => {
    const product = await getProduct();
    if (!product) return;

    if (title) title.textContent = product.title;
    if (price) price.textContent = formatMoney(product.price);

    bar.classList.add("is-visible");

    button.addEventListener("click", async () => {
      const quantity = qtyInput ? parseInt(qtyInput.value, 10) || 1 : 1;

      await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ id: product.variants[0].id, quantity }]
        })
      });

      window.location.href = "/cart";
    });
  })();
})();
