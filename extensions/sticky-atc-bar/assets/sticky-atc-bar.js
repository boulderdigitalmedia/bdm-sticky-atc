(function () {
  if (!window.location.pathname.includes("/products/")) return;

  const SCROLL_THRESHOLD = 300;

  function init() {
    const bar = document.getElementById("bdm-sticky-atc");
    const inner = document.getElementById("bdm-sticky-atc-inner");

    if (!bar || !inner) return false;

    const originalForm = document.querySelector('form[action^="/cart/add"]');
    if (!originalForm) return false;

    // Prevent double-init
    if (bar.dataset.initialized) return true;
    bar.dataset.initialized = "true";

    // Create placeholder so layout doesn’t jump
    const placeholder = document.createElement("div");
    placeholder.style.display = "none";
    originalForm.parentNode.insertBefore(placeholder, originalForm);

    // Move the REAL form (do not clone)
    inner.appendChild(originalForm);

    // Scroll logic
    function onScroll() {
      if (window.scrollY >= SCROLL_THRESHOLD) {
        bar.classList.add("visible");
        placeholder.style.display = "block";
      } else {
        bar.classList.remove("visible");
        placeholder.style.display = "none";
      }
    }

    window.addEventListener("scroll", onScroll);

    // Force initial check
    onScroll();

    return true;
  }

  // Retry until Shopify theme JS has initialized
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    if (init() || attempts > 30) {
      clearInterval(interval);
    }
  }, 250);
})();
