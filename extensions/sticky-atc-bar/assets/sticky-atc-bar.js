(() => {
  if (window.__BDM_STICKY_ATC_INIT__) return;
  window.__BDM_STICKY_ATC_INIT__ = true;

  const bar = document.querySelector('[data-bdm-sticky-atc]');
  if (!bar) return;

  /* ---------------- Utilities ---------------- */

  const attrBool = (name, fallback = true) => {
    const v = bar.getAttribute(name);
    if (v === null || v === '') return fallback;
    return v !== 'false';
  };

  const getVar = (name, fallback) =>
    getComputedStyle(bar).getPropertyValue(name).trim() || fallback;

  const formatMoney = (cents) =>
    `$${(cents / 100).toFixed(2)}`;

  /* ---------------- Visibility ---------------- */

  const showOnScroll = attrBool('data-show-on-scroll', false);
  const scrollOffset = Number(bar.getAttribute('data-scroll-offset')) || 300;

  if (!showOnScroll) {
    bar.classList.add('is-visible');
  } else {
    const onScroll = () => {
      if (window.scrollY >= scrollOffset) {
        bar.classList.add('is-visible');
        window.removeEventListener('scroll', onScroll);
      }
    };
    window.addEventListener('scroll', onScroll);
  }

  /* ---------------- Product Resolution ---------------- */

  const metaProduct = window.ShopifyAnalytics?.meta?.product;
  if (!metaProduct?.handle) {
    console.warn('[BDM Sticky ATC] No product handle found');
    return;
  }

  fetch(`/products/${metaProduct.handle}.js`)
    .then((r) => r.json())
    .then((product) => init(product))
    .catch(() => {
      console.warn('[BDM Sticky ATC] Failed to load product JSON');
    });

  /* ---------------- Init ---------------- */

  function init(product) {
    if (!product?.variants?.length) return;

    const titleEl = bar.querySelector('#bdm-title');
    const priceEl = bar.querySelector('#bdm-price');
    const qtyEl = bar.querySelector('#bdm-qty');
    const btn = bar.querySelector('#bdm-atc');
    const right = bar.querySelector('.bdm-right');

    let variantId = product.variants[0].id;
    let quantity = 1;

    /* ---------- Populate ---------- */

    if (attrBool('data-show-title') && titleEl) {
      titleEl.textContent = product.title;
      titleEl.style.display = '';
    }

    if (attrBool('data-show-price') && priceEl) {
      priceEl.textContent = formatMoney(product.price);
      priceEl.style.display = '';
    }

    if (!attrBool('data-show-qty') && qtyEl) {
      qtyEl.remove();
    } else if (qtyEl) {
      qtyEl.addEventListener('change', () => {
        quantity = Math.max(1, Number(qtyEl.value) || 1);
      });
    }

    /* ---------- Variant selector ---------- */

    if (attrBool('data-show-variant') && product.variants.length > 1) {
      const select = document.createElement('select');
      select.className = 'bdm-atc-variants';

      product.variants.forEach((v) => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.title;
        select.appendChild(opt);
      });

      select.addEventListener('change', () => {
        variantId = Number(select.value);
      });

      right.insertBefore(select, btn);
    }

    /* ---------- Button ---------- */

    btn.textContent = btn.textContent?.trim() || 'Add to cart';

    btn.addEventListener('click', async () => {
      track('sticky_atc_click', { productId: product.id, variantId });

      await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          items: [{ id: variantId, quantity }],
        }),
      });

      track('sticky_atc_add', { productId: product.id, variantId, quantity });

      window.location.href = '/cart';
    });

    /* ---------- Impression ---------- */

    track('sticky_atc_impression', {
      productId: product.id,
      variantId,
    });
  }

  /* ---------------- Analytics ---------------- */

  function track(event, payload = {}) {
    fetch('/apps/bdm-sticky-atc/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        payload,
        ts: Date.now(),
      }),
      keepalive: true,
    }).catch(() => {});
  }
})();
