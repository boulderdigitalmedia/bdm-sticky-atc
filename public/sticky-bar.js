(function() {
  if (!window.Shopify || !window.meta || !window.meta.product) return;

  const product = window.meta.product;
  const variants = product.variants;

  const bar = document.createElement("div");
  bar.id = "sticky-bar";
  bar.innerHTML = `
    <style>
      #sticky-bar {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: white;
        border-top: 1px solid #ddd;
        box-shadow: 0 -2px 6px rgba(0,0,0,0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        font-family: inherit;
        z-index: 9999;
      }
      #sticky-bar select, #sticky-bar button {
        padding: 10px;
        font-size: 16px;
      }
      #sticky-bar button {
        background: #1a73e8;
        color: white;
        border: none;
        cursor: pointer;
        border-radius: 4px;
      }
      #sticky-bar button:hover {
        background: #155ab6;
      }
    </style>
    <div>
      <strong>${product.title}</strong><br>
      <select id="variantSelect">
        ${variants.map(v => `<option value="${v.id}">${v.title}</option>`).join("")}
      </select>
    </div>
    <button id="addToCart">Add to Cart</button>
  `;
  document.body.appendChild(bar);

  document.getElementById("addToCart").addEventListener("click", async () => {
    const variantId = document.getElementById("variantSelect").value;

    const res = await fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: variantId, quantity: 1 }),
    });

    if (res.ok) {
      window.location.reload(); // auto-refresh cart data
    } else {
      alert("Failed to add item");
    }
  });
})();
