(function() {
  document.addEventListener('DOMContentLoaded', async () => {
    // Only run on product pages
    if (!window.location.pathname.includes('/products/')) return;

    const pathParts = window.location.pathname.split('/products/');
    if (pathParts.length < 2) return;
    const productHandle = pathParts[1];

    try {
      const res = await fetch(`/products/${productHandle}.js`);
      if (!res.ok) return;
      const product = await res.json();

      if (!product.variants || product.variants.length === 0) return;

      // Sticky bar container
      const bar = document.createElement('div');
      bar.id = 'sticky-bar';
      bar.style.cssText = `
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100%;
        background: #fff;
        border-top: 1px solid #ddd;
        box-shadow: 0 -2px 5px rgba(0,0,0,0.1);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        z-index: 9999;
        font-family: sans-serif;
      `;

      const title = document.createElement('span');
      title.textContent = product.title;

      const variantSelect = document.createElement('select');
      product.variants.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.title + (v.available ? '' : ' (Sold out)');
        opt.disabled = !v.available;
        variantSelect.appendChild(opt);
      });

      const addBtn = document.createElement('button');
      addBtn.textContent = 'Add to Cart';
      addBtn.style.cssText = `
        background: #1a73e8;
        color: white;
        border: none;
        padding: 10px 18px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 15px;
      `;

      // Sync with theme variant selector if present
      const themeVariantSelector = document.querySelector('form[action*="/cart/add"] select');
      if (themeVariantSelector) {
        themeVariantSelector.addEventListener('change', () => {
          variantSelect.value = themeVariantSelector.value;
        });
        variantSelect.addEventListener('change', () => {
          themeVariantSelector.value = variantSelect.value;
          themeVariantSelector.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }

      addBtn.addEventListener('click', async () => {
        const variantId = variantSelect.value;
        const quantity = 1;

        const response = await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: variantId, quantity })
        });

        if (response.ok) {
          addBtn.textContent = 'Added!';
          setTimeout(() => addBtn.textContent = 'Add to Cart', 1500);
        } else {
          alert('Failed to add to cart.');
        }
      });

      bar.appendChild(title);
      bar.appendChild(variantSelect);
      bar.appendChild(addBtn);
      document.body.appendChild(bar);

    } catch (err) {
      console.error('Sticky Bar Error:', err);
    }
  });
})();
