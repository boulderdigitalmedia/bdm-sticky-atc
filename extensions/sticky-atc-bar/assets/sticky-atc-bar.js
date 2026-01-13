(function () {
  const bar = document.getElementById("bdm-sticky-atc");
  if (!bar) return;

  const stickyATC = document.getElementById("bdm-atc");
  const stickyQty = document.getElementById("bdm-qty");
  const stickyVariant = document.getElementById("bdm-variant");
  const stickyTitle = document.getElementById("bdm-title");
  const stickyPrice = document.getElementById("bdm-price");

  /* -----------------------------
     Get product data from Shopify
  ------------------------------ */
  const productJsonEl = document.querySelector('script[type="application/json"][data-product-json], script#ProductJson');
  if (!productJsonEl) return;

  const product = JSON.parse(productJsonEl.textContent);

  stickyTitle.textContent = product.title;

  /* -----------------------------
     Populate variants
  ------------------------------ */
  product.variants.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v.id;
    opt.textContent = v.title;
    stickyVariant.appendChild(opt);
  });

  stickyVariant.value = product.variants.find(v => v.available)?.id || product.variants[0].id;

  function updatePrice() {
    const variant = product.variants.find(v => v.id == stickyVariant.value);
    if (!variant) return;
    stickyPrice.textContent =
      (variant.price / 100).toLocaleString(undefined, {
        style: "currency",
        currency: product.currency || "USD",
      });
  }

  updatePrice();
  stickyVariant.addEventListener("change", updatePrice);

  /* -----------------------------
     Add to cart (robust method)
  ------------------------------ */
  stickyATC.addEventListener("click", async () => {
    stickyATC.disabled = true;

    await fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: Number(stickyVariant.value),
        quantity: Number(stickyQty.value || 1),
      }),
    });

    stickyATC.disabled = false;

    // Optional: open cart drawer
    document.dispatchEvent(new CustomEvent("cart:refresh"));
  });

  /* -----------------------------
     Show on scroll
  ------------------------------ */
  const trigger = document.querySelector("form[action='/cart/add']")?.getBoundingClientRect().bottom + window.scrollY || 400;

  window.addEventListener("scroll", () => {
    bar.classList.toggle("visible", window.scrollY > trigger);
  });
})();
