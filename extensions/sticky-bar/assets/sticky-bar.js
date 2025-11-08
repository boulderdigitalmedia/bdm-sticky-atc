(function() {
  function initStickyBar() {
    try {
      // Only run on product pages
      const productHandle = document.querySelector('meta[name="shopify-product-handle"]')?.content;
      if (!productHandle) return;

      fetch(`/products/${productHandle}.js`)
        .then(res => res.json())
        .then(product => {
          if (!product || !product.variants || product.variants.length === 0) return;

          // Prevent multiple bars
          if (document.getElementById('sticky-bar')) return;

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

          // Product title
          const title = document.createElement('span');
          title.textContent = product.title;

          // Variant selector
          const variantSelect = document.createElement('select');
          product.variants.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = v.title + (v.available ? '' : ' (Sold out)');
            opt.disabled = !v.available;
            variantSelect.appendChild(opt);
          });

          // Add to Cart button
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

          // Sync with theme variant selector if exists
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

          // Add to cart functionality
          addBtn.addEventListener('click', async () => {
            const variantId = variantSelect.value;
            const quantity = 1;

            try {
              const response = await fetch('/cart/add.js', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: variantId, quantity }),
              });

              if (response.ok) {
                addBtn.textContent = 'Added!';
                setTimeout(() => (addBtn.textContent = 'Add to Cart'), 1500);
              } else {
                const err = await response.json();
                alert(err.description || 'Failed to add to cart');
              }
            } catch (err) {
              console.error('Add to cart error:', err);
              alert('Failed to add to cart');
            }
          });

          // Build bar
          bar.appendChild(title);
          bar.appendChild(variantSelect);
          bar.appendChild(addBtn);
          document.body.appendChild(bar);
        })
        .catch(err => console.error('Sticky bar fetch error:', err));

    } catch (e) {
      console.error('Sticky bar init error:', e);
    }
  }

  // Run after DOM ready
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initStickyBar();
  } else {
    document.addEventListener('DOMContentLoaded', initStickyBar);
  }
})();
