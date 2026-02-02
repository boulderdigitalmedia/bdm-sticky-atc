(() => {
  const bar = document.querySelector('[data-bdm-sticky-atc]');
  if (!bar) return;

  // 🔥 IMPORTANT: element-scoped init (NOT global)
  if (bar.dataset.bdmInit === 'true') return;
  bar.dataset.bdmInit = 'true';

  /* ---------------- Settings ---------------- */

  const bool = (val, fallback = true) =>
    val === '' ? true : val === 'true' ? true : val === 'false' ? false : fallback;

  const settings = {
    enableDesktop: bool(bar.dataset.enableDesktop),
    enableMobile: bool(bar.dataset.enableMobile),
    showOnScroll: bool(bar.dataset.showOnScroll),
    scrollOffset: Number(bar.dataset.scrollOffset || 300),
    showTitle: bool(bar.dataset.showTitle),
    showPrice: bool(bar.dataset.showPrice),
    showQty: bool(bar.dataset.showQty),
    showVariant: bool(bar.dataset.showVariant),
    showSellingPlan: bool(bar.dataset.showSellingPlan),
  };

  /* ---------------- Device gating ---------------- */

  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

  if (isMobile() && !settings.enableMobile) return;
  if (!isMobile() && !settings.enableDesktop) return;

  /* ---------------- Visibility ---------------- */

  const showBar = () => {
    bar.classList.add('is-visible');
    bar.setAttribute('aria-hidden', 'false');
  };

  if (!settings.showOnScroll) {
    showBar();
  } else {
    const onScroll = () => {
      if (window.scrollY >= settings.scrollOffset) {
        showBar();
        window.removeEventListener('scroll', onScroll);
      }
    };
    window.addEventListener('scroll', onScroll);
  }

  /* ---------------- Product data ---------------- */

  const titleEl = bar.querySelector('#bdm-title');
  const priceEl = bar.querySelector('#bdm-price');
  const qtyEl = bar.querySelector('#bdm-qty');
  const btn = bar.querySelector('#bdm-atc');

  if (titleEl && !settings.showTitle) titleEl.style.display = 'none';
  if (priceEl && !settings.showPrice) priceEl.style.display = 'none';
  if (qtyEl && !settings.showQty) qtyEl.style.display = 'none';

  /* ---------------- Add to cart ---------------- */

  btn?.addEventListener('click', async () => {
    const variantId =
      document.querySelector('[name="id"]')?.value ||
      window.ShopifyAnalytics?.meta?.selectedVariantId;

    if (!variantId) return;

    await fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ id: Number(variantId), quantity: Number(qtyEl?.value || 1) }],
      }),
    });

    // Analytics hook (safe)
    fetch('/apps/bdm-sticky-atc/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'sticky_atc_click', variantId }),
    }).catch(() => {});
  });
})();
