(async function() {
  // 1️⃣ Get product handle from URL
  const pathParts = window.location.pathname.split('/');
  const handleIndex = pathParts.indexOf('products') + 1;
  const productHandle = pathParts[handleIndex];
  if (!productHandle) return;

  // 2️⃣ Fetch product JSON via Shopify’s JSON endpoint
  let product;
  try {
    const res = await fetch(`/products/${productHandle}.js`);
    product = await res.json();
  } catch (err) {
    console.error("Failed to fetch product JSON:", err);
    return;
  }

  if (!product || !product.variants || product.variants.length === 0) return;

  // 3️⃣ Build sticky bar
  const bar = document.createElement("div");
  bar.id = "sticky-add-to-cart";
  bar.style = `
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    background: #333;
    color: #fff;
    padding: 15px;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    z-index: 9999;
    font-family: sans-serif;
  `;

  // Variant selector
  const variantSelect = document.createElement("select");
  variantSelect.style.padding = "5px";
  product.variants.forEach(v => {
    const option = document.createElement("option");
    option.value = v.id;
    option.textContent = `${v.title}${v.available ? '' : ' (Sold Out)'}`;
    option.disabled = !v.available;
    variantSelect.appendChild(option);
  });
  bar.appendChild(variantSelect);

  // Quantity input
  const qtyInput = document.createElement("input");
  qtyInput.type = "number";
  qtyInput.min = 1;
  qtyInput.value = 1;
  qtyInput.style.width = "50px";
  qtyInput.style.padding = "5px";
  bar.appendChild(qtyInput);

  // Add-to-cart button
  const addButton = document.createElement("button");
  addButton.textContent = "Add to Cart";
  addButton.style = `
    background: #ff6f61;
    color: #fff;
    border: none;
    padding: 8px 15px;
    cursor: pointer;
    font-size: 16px;
  `;
  bar.appendChild(addButton);

  document.body.appendChild(bar);

  // Add-to-cart handler
  addButton.addEventListener("click", async () => {
    const variantId = variantSelect.value;
    const quantity = parseInt(qtyInput.value, 10) || 1;

    try {
      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: variantId, quantity })
      });
      const data = await res.json();
      alert(`Added to cart: ${data.title} x${quantity}`);
    } catch (err) {
      console.error('Add-to-cart failed', err);
      alert('Failed to add to cart');
    }
  });
})();
