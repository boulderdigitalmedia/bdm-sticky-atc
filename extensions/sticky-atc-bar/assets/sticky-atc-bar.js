// Sticky Add to Cart Bar JS with universal cart update
(function () {
  function updateCartIconAndDrawer() {
    document.dispatchEvent(new CustomEvent('cart:refresh'));
    if (window.fetchCart) window.fetchCart();
    if (window.updateCart) window.updateCart();
    fetch('/cart.js')
      .then(res => res.json())
      .then(cart => {
        const cartCountEls = document.querySelectorAll('.cart-count, .cart-count-bubble, [data-cart-count]');
        cartCountEls.forEach(el => {
          el.textContent = cart.item_count;
          el.dataset.cartCount = cart.item_count;
        });
        document.dispatchEvent(new CustomEvent('cartcount:update', { detail: { count: cart.item_count } }));
      })
      .catch(err => console.error('Error updating cart count', err));
    const toggles = document.querySelectorAll('[data-cart-toggle], [data-drawer-toggle], [aria-controls="CartDrawer"], .js-cart-toggle');
    if (toggles.length) toggles[0].click();
  }

  function initStickyBar() {
    const root = document.getElementById('bdm-sticky-atc-bar-root');
    if (!root) return;

    const productForm = document.querySelector('form[action*="/cart/add"]');
    if (!productForm) return;

    const productTitle = root.dataset.productTitle || document.title;
    let variants = (window.ShopifyAnalytics?.meta?.product?.variants) || [];
    const variantSelect = productForm.querySelector('select[name="id"]');
    let currentVariantId = variantSelect ? variantSelect.value : variants[0]?.id;

    const findVariantById = id => variants.find(v => String(v.id) === String(id));
    const getCurrency = () => Shopify?.currency?.active || 'USD';
    const formatMoney = cents => ((cents || 0) / 100).toLocaleString(undefined, { style: 'currency', currency: getCurrency() });

    let currentPrice = findVariantById(currentVariantId)?.price;

    const bar = document.createElement('div');
    bar.className = 'bdm-sticky-atc-bar-container';

    const inner = document.createElement('div');
    inner.className = 'bdm-sticky-atc-bar-inner';

    const productInfo = document.createElement('div');
    productInfo.className = 'bdm-sticky-atc-product';
    productInfo.innerHTML = `<div class="bdm-sticky-atc-title">${productTitle}</div>
      <div class="bdm-sticky-atc-price">${currentPrice ? formatMoney(currentPrice) : ''}</div>`;

    const controls = document.createElement('div');
    controls.className = 'bdm-sticky-atc-controls';

    const variantWrapper = document.createElement('div');
    variantWrapper.className = 'bdm-sticky-atc-variant';

    if (variants.length > 1) {
      const select = document.createElement('select');
      variants.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.public_title || v.title || `Variant ${v.id}`;
        if (String(v.id) === String(currentVariantId)) opt.selected = true;
        select.appendChild(opt);
      });

      select.addEventListener('change', () => {
        currentVariantId = select.value;
        const v = findVariantById(currentVariantId);
        currentPrice = v?.price;
        const priceEl = productInfo.querySelector('.bdm-sticky-atc-price');
        if (priceEl) priceEl.textContent = formatMoney(v.price);
        if (variantSelect) {
          variantSelect.value = currentVariantId;
          variantSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });

      variantWrapper.appendChild(select);
    }

    const qtyWrapper = document.createElement('div');
    qtyWrapper.className = 'bdm-sticky-atc-qty';

    const minusBtn = document.createElement('button');
    minusBtn.textContent = '−';
    const qtyInput = document.createElement('input');
    qtyInput.type = 'number'; qtyInput.min = '1'; qtyInput.value = '1';
    const plusBtn = document.createElement('button'); plusBtn.textContent = '+';

    minusBtn.onclick = () => qtyInput.value = Math.max(1, qtyInput.value - 1);
    plusBtn.onclick = () => qtyInput.value = Math.max(1, Number(qtyInput.value) + 1);

    qtyWrapper.append(minusBtn, qtyInput, plusBtn);

    const atcButton = document.createElement('button');
    atcButton.className = 'bdm-sticky-atc-button';
    atcButton.textContent = 'Add to cart';

    atcButton.addEventListener('click', async () => {
      const quantity = Math.max(1, parseInt(qtyInput.value, 10));
      const variantIdToUse = currentVariantId || variantSelect?.value;

      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ id: variantIdToUse, quantity })
      });

      if (!res.ok) {
        alert('Could not add to cart');
        return;
      }

      updateCartIconAndDrawer();
    });

    controls.append(variantWrapper, qtyWrapper, atcButton);

    inner.append(productInfo, controls);
    bar.appendChild(inner);
    document.body.appendChild(bar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStickyBar);
  } else {
    initStickyBar();
  }
})();
