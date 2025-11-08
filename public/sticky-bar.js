(async () => {
  // Only run on product pages
  if (!window.location.pathname.includes('/products/')) return;

  // Get product handle from URL
  const handle = window.location.pathname.split('/products/')[1].split('/')[0];

  try {
    // Fetch product JSON data
    const res = await fetch(`/products/${handle}.js`);
    const product = await res.json();

    // Create sticky bar container
    const bar = document.createElement('div');
    bar.id = 'sticky-bar';
    bar.innerHTML = `
      <div id="sticky-bar-content">
        <div id="sticky-bar-info">
          <img src="${product.images[0]}" alt="${product.title}" style="height:40px;border-radius:4px;margin-right:10px;">
          <span>${product.title}</span>
        </div>
        <select id="variant-select" style="margin-right:10px;"></select>
        <input type="number" id="qty" min="1" value="1" style="width:50px;margin-right:10px;">
        <button id="sticky-add" style="background:#2c6ecb;color:white;padding:8px 14px;border:none;border-radius:6px;">Add to Cart</button>
      </div>
    `;
    document.body.appendChild(bar);

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
      #sticky-bar {
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100%;
        background: white;
        border-top: 1px solid #ddd;
        box-shadow: 0 -2px 5px rgba(0,0,0,0.05);
        padding: 10px;
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
      }
      #sticky-bar-content {
        display: flex;
        align-items: center;
        max-width: 800px;
        width: 100%;
        justify-content: space-between;
      }
      #sticky-bar-info {
        display: flex;
        align-items: center;
        font-weight: 500;
      }
    `;
    document.head.appendChild(style);

    // Populate variants
    const variantSelect = document.getElementById('variant-select');
    product.variants.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = `${v.title} - ${Shopify.formatMoney(v.price)}`;
      variantSelect.appendChild(opt);
    });

    // Add to cart logic
    document.getElementById('sticky-add').addEventListener('click', async () => {
      const variantId = variantSelect.value;
      const qty = parseInt(document.getElementById('qty').value);

      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: variantId, quantity: qty })
      });

      if (res.ok) {
        alert('Added to cart!');
      } else {
        alert('Failed to add item');
      }
    });
  } catch (err) {
    console.error('Sticky bar error:', err);
  }
})();
