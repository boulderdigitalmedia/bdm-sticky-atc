(function () {
  if (!window.location.pathname.includes("/products/")) return;

  function init() {
    const bar = document.getElementById("bdm-sticky-atc");
    const inner = document.getElementById("bdm-sticky-atc-inner");

    if (!bar || !inner) return false;

    const form = document.querySelector('form[action^="/cart/add"]');
    if (!form) return false;

    // Prevent double init
    if (bar.dataset.initialized) return true;
    bar.dataset.initialized = "true";

    // Create placeholder so layout doesn't jump
    const placeholder = document.createElement("div");
    placeholder.style.height = `${form.offsetHeight}px`;
    form.parentNode.insertBefore(placeholder, form);

    // Move REAL form into sticky bar
    inner.appendChild(form);

    // Observe placeholder (when it leaves viewport, show bar)
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          bar.classList.remove("visible");
        } else {
          bar.classList.add("visible");
        }
      },
      { threshold: 0 }
    );

    observer.observe(placeholder);

    return true;
  }

  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    if (init() || attempts > 30) {
      clearInterval(interval);
    }
  }, 250);
})();
