(function() {
  // Check if we are on a product page
  if (!window.meta || !window.meta.product) return;

  const product = window.meta.product;

  // Create sticky bar container
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
  product.variants.forEach(variant => {
    const option = document.createElement("option");
    option.value = variant.id;
    option.textContent = variant.title + (variant.available ? "" : " (Sold Out)");
    option.disabled = !variant.available;
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

  // Append the bar to the body
  document.body.appendChild(bar);

  // Add-to-cart click handler
  addButton.addEventListener("click", async () => {
    const variantId = variantSelect.value;
    const quantity = parseInt(qtyInput.value, 10) || 1;

    try {
      const response = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: variantId, quantity }),
      });

      const data = await response.json();
      alert(`Added to cart: ${data.title} x${quantity}`);
    } catch (err) {
      console.error("Add-to-cart failed", err);
      alert("Something went wrong adding the product to the cart.");
    }
  });
})();
