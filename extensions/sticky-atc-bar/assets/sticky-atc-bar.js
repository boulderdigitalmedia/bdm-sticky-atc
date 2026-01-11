(function () {
  if (!window.location.pathname.includes("/products/")) return;

  function waitForProductInfo(callback) {
    const interval = setInterval(() => {
      const productInfo =
        document.querySelector(".product__info-container") ||
        document.querySelector("[data-product-info]");

      if (!productInfo) return;

      // Ensure selling plans or ATC exist
      const hydrated =
        productInfo.querySelector('form[action^="/cart/add"]') &&
        (productInfo.querySelector('button[type="submit"]') ||
          productInfo.querySelector('[name="selling_plan"]'));

      if (hydrated) {
        clearInterval(interval);
        callback(productInfo);
      }
    }, 200);
  }

  waitForProductInfo((productInfo) => {
    const bar = document.getElementById("bdm-sticky-atc");
    const inner = document.getElementById("bdm-sticky-atc-inner");

    if (!bar || !inner) return;
    if (bar.dataset.initialized) return;
    bar.dataset.initialized = "true";

    // Preserve layout
    const placeholder = document.createElement("div");
    placeholder.style.height = `${productInfo.offsetHeight}px`;
    productInfo.parentNode.insertBefore(placeholder, productInfo);

    // Move EVERYTHING (price, selling plans, variants, qty, buttons)
    inner.appendChild(productInfo);

    // Scroll-based visibility
    const observer = new IntersectionObserver(
      ([entry]) => {
        bar.classList.toggle("visible", !entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(placeholder);
  });
})();
