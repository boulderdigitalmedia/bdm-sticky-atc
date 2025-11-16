(function () {
  const bar = document.getElementById('bdm-sticky-atc-bar');
  if (!bar) return;

  // Parse product data
  const productJson = bar.getAttribute('data-product');
  if (!productJson) return;

  let product;
  try {
    product = JSON.parse(productJson);
  } catch (e) {
    console.error('[BDM Sticky ATC] Failed to parse product JSON', e);
    return;
  }

  const qtyInput = document.getElementById('bdm-sticky-atc-qty-input');
  const atcButton = document.getElementById('bdm-sticky-atc-button');
  const priceEl = document.getElementById('bdm-sticky-atc-price');

  const variantSelects = Array.from(
    bar.querySelectorAll('.bdm-sticky-atc-variant__select')
  );

  // Settings from theme editor (read via CSS custom properties or data-* if you add them)
  // For now, we just handle visibility toggling of quantity/price/variants via classes:
  const showPrice = true; // you can inject settings via data-* attributes
  const showQuantity = true;
  const showVariants = true;

  if (!showPrice && priceEl) priceEl.style.display = 'none';
  if (!showQuantity && qtyInput) qtyInput.parentElement.style.display = 'none';
  if (!showVariants && variantSelects.length) {
    variantSelects.forEach(sel => (sel.style.display = 'none'));
  }

  // Quantity increment/decrement
  if (qtyInput) {
    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('.bdm-sticky-atc-qty__btn');
      if (!btn) return;

      const action = btn.getAttribute('data-action');
      let current = parseInt(qtyInput.value, 10) || 1;

      if (action === 'increment') current++;
      if (action === 'decrement') current = Math.max(1, current - 1);

      qtyInput.value = current;
    });
  }

  function getSelectedVariant() {
    if (!product || !product.variants || !product.variants.length) return null;

    if (product.has_only_default_variant) {
      return product.variants[0];
    }

    const selectedOptions = [];
    variantSelects.forEach((select) => {
      const position = parseInt(select.getAttribute('data-option-position'), 10);
      selectedOptions[position - 1] = select.value;
    });

    return product.variants.find((variant) => {
      if (!variant) return false;
      return selectedOptions.every((val, i) => {
        return variant[`option${i + 1}`] === val;
      });
    }) || null;
  }

  function updatePriceForVariant(variant) {
    if (!priceEl || !variant) return;
    priceEl.innerHTML = '';

    const current = document.createElement('span');
    current.className = 'bdm-sticky-atc-price__current';
    current.textContent = Shopify.formatMoney
      ? Shopify.formatMoney(variant.price)
      : (variant.price / 100).toFixed(2);

    priceEl.appendChild(current);

    if (variant.compare_at_price && variant.compare_at_price > variant.price) {
      const compare = document.createElement('span');
      compare.className = 'bdm-sticky-atc-price__compare';
      compare.textContent = Shopify.formatMoney
        ? Shopify.formatMoney(variant.compare_at_price)
        : (variant.compare_at_price / 100).toFixed(2);
      priceEl.appendChild(compare);
    }
  }

  // Variant change handlers
  variantSelects.forEach((select) => {
    select.addEventListener('change', () => {
      const variant = getSelectedVariant();
      if (!variant || !variant.available) {
        atcButton.disabled = true;
        atcButton.textContent = 'Sold out';
      } else {
        atcButton.disabled = false;
        atcButton.textContent = bar.dataset.buttonLabel || 'Add to cart';
      }
      updatePriceForVariant(variant);
    });
  });

  // initial state
  const initialVariant = getSelectedVariant() || product.variants[0];
  updatePriceForVariant(initialVariant);

  // AJAX add to cart
  if (atcButton) {
    atcButton.addEventListener('click', () => {
      const variant = getSelectedVariant() || product.variants[0];
      if (!variant || !variant.available) return;

      const quantity = qtyInput ? parseInt(qtyInput.value, 10) || 1 : 1;

      atcButton.disabled = true;

      fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          id: variant.id,
          quantity
          // For subscription apps, recharge/appstle usually hook into the main product form.
          // Advanced: you can detect selling_plan_id and add it here in future.
        })
      })
        .then((res) => res.json())
        .then((data) => {
          // Fire analytics event to your app backend
          try {
            fetch('/apps/bdm-sticky-atc/track', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                type: 'sticky_atc_click',
                productId: product.id,
                variantId: variant.id,
                quantity
              })
            });
          } catch (e) {
            console.warn('[BDM Sticky ATC] Tracking failed', e);
          }

          // Optional: Open cart drawer if theme supports it
          document.dispatchEvent(new CustomEvent('bdm:sticky-atc:added', {
            detail: { product, variant, quantity, cartItem: data }
          }));

          // Give quick visual feedback
          const originalText = atcButton.textContent;
          atcButton.textContent = 'Added!';
          setTimeout(() => {
            atcButton.textContent = originalText;
            atcButton.disabled = false;
          }, 1200);
        })
        .catch((err) => {
          console.error('[BDM Sticky ATC] Add to cart failed', err);
          atcButton.disabled = false;
        });
    });
  }

  // Show only when main ATC is off-screen (optional)
  const showOnlyWhenMainAtcHidden = true; // tie to settings.show_only_when_main_atc_hidden
  if (showOnlyWhenMainAtcHidden) {
    const mainAtc =
      document.querySelector('form[action*="/cart/add"] [type="submit"]') ||
      document.querySelector('button[name="add"]');

    if (mainAtc && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              bar.style.transform = 'translateY(100%)';
            } else {
              bar.style.transform = 'translateY(0)';
            }
          });
        },
        {
          root: null,
          threshold: 0.1
        }
      );

      observer.observe(mainAtc);
    }
  }

  // Apply colors & height from settings via inline style (you can inject via data attributes)
  // Example if you add data attributes on the container from Liquid:
  // bar.style.backgroundColor = bar.dataset.backgroundColor;
})();
