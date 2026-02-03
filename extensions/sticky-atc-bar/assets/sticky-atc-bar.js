(() => {
  if (window.__BDM_STICKY_ATC_INIT__) return;
  window.__BDM_STICKY_ATC_INIT__ = true;

  const bar = document.getElementById("bdm-sticky-atc");
  if (!bar) return;

  const $ = (s) => bar.querySelector(s);

  /* ---------------------------
     Read settings from block
  ---------------------------- */
  const cfg = {
    showTitle: bar.dataset.showTitle === "true",
    showPrice: bar.dataset.showPrice === "true",
    showQty: bar.dataset.showQty === "true",
    showOnScroll: bar.dataset.showOnScroll === "true",
    scrollOffset: parseInt(bar.dataset.scrollOffset || "0", 10),
  };

  /* ---------------------------
     Elements
  ---------------------------- */
  const titleEl = $("#bdm-title");
  const priceEl = $("#bdm-price");
  const qtyEl = $("#bdm-qty");
  const atcBtn = $("#bdm-atc");

  if (titleEl) titleEl.style.display = cfg.showTitle ? "" : "none";
  if (priceEl) priceEl.style.display = cfg.showPrice ? "" : "none";
  if (qtyEl) qtyEl.style.display = cfg.showQty ? "" : "none";

  /* ---------------------------
     Get product data
  ---------------------------- */
  const product =
    window.ShopifyAnalytics?.meta?.product ||
    window.meta?.product ||
    null;

  if (!product) return;

  let currentVariant =
    product.variants?.find((v) => v.id === product.selectedVariantId) ||
    product.variants?.[0];

  /* ---------------------------
     Populate UI
  ---------------------------- */
  function render() {
    if (!currentVariant) return;

    if (titleEl) titleEl.textContent = product.title;
    if (priceEl)
      priceEl.textContent =
        (currentVariant.price / 100).toLocaleString(undefined, {
          style: "currency",
          currency: Shopify.currency.active,
        });

    atcBtn.disabled = !currentVariant.available;
  }

  render();

  /* ---------------------------
     Variant syncing
  ---------------------------- */
  document.addEventListener("change", (e) => {
    if (!e.target.name?.includes("options")) return;

    const selected = [...document.querySelectorAll("input[name^='options']:checked, select[name^='options']")]
      .map((el) => el.value);

    currentVariant =
      product.variants.find((v) =>
        v.options.every((opt, i) => opt === selected[i])
      ) || currentVariant;

    render();
  });

  /* ---------------------------
     Selling plans
  ---------------------------- */
  function getSellingPlanId() {
    const el = document.querySelector(
      'input[name="selling_plan"]:checked'
    );
    return el ? el.value : null;
  }

  /* ---------------------------
     Add to cart
  ---------------------------- */
  atcBtn.addEventListener("click", async () => {
    const quantity = qtyEl ? parseInt(qtyEl.value || "1", 10) : 1;

    await fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: currentVariant.id,
        quantity,
        selling_plan: getSellingPlanId(),
      }),
    });

    document.dispatchEvent(new CustomEvent("bdm:added_to_cart"));
  });

  /* ---------------------------
     Scroll behavior
  ---------------------------- */
  if (cfg.showOnScroll) {
    const onScroll = () => {
      bar.setAttribute(
        "aria-hidden",
        window.scrollY < cfg.scrollOffset
      );
    };
    window.addEventListener("scroll", onScroll);
    onScroll();
  } else {
    bar.setAttribute("aria-hidden", "false");
  }
})();
