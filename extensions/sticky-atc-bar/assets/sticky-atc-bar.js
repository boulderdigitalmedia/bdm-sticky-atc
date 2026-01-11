(function () {
  if (!window.location.pathname.includes("/products/")) return;

  function waitForHydratedForm(callback) {
    const interval = setInterval(() => {
      const form = document.querySelector('form[action^="/cart/add"]');

      if (!form) return;

      // Shopify hydration signal:
      // variant selects OR quantity input OR submit button exists
      const hydrated =
        form.querySelector("select") ||
        form.querySelector('input[name="quantity"]') ||
        form.querySelector('button[type="submit"]');

      if (hydrated) {
        clearInterval(interval);
        callback(form);
      }
    }, 200);
  }

  waitForHydratedForm((form) => {
    const bar = document.getElementById("bdm-sticky-atc");
    const inner = document.getElementById("bdm-sticky-atc-inner");

    if (!bar || !inner) return;

    // Prevent double init
    if (bar.dataset.initialized) return;
    bar.dataset.initialized = "true";

    // Placeholder to preserve layout
    const placeholder = document.createElement("div");
    placeholder.style.height = `${form.offsetHeight}px`;
    form.parentNode.insertBefore(placeholder, form);

    // Move the REAL, hydrated form
    inner.appendChild(form);

    // Show sticky bar when placeholder leaves viewport
    const observer = new IntersectionObserver(
      ([entry]) => {
        bar.classList.toggle("visible", !entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(placeholder);
  });
})();
