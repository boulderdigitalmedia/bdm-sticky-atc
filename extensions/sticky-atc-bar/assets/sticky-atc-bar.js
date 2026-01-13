(function () {
  const bar = document.getElementById("bdm-sticky-atc");
  if (!bar) return;

  const stickyATC = document.getElementById("bdm-atc");
  const stickyQty = document.getElementById("bdm-qty");
  const stickyVariant = document.getElementById("bdm-variant");
  const stickyTitle = document.getElementById("bdm-title");
  const stickyPrice = document.getElementById("bdm-price");

  // Always show title
  const titleEl = document.querySelector("h1");
  if (titleEl) stickyTitle.textContent = titleEl.textContent;

  // Try to detect variant ID from theme
  function getCurrentVariantId() {
    // Dawn / modern themes
    const idInput = document.querySelector('input[name="id"]');
    if (idInput) return idInput.value;

    // Fallback: select
    const select = document.querySelector('select[name="id"]');
    if (select) return select.value;

    return null;
  }

  // Populate variant dropdown dynamically
  const idInput = document.querySelector('input[name="id"]');
  if (idInput) {
    stickyVariant.style.display = "none";
  }

  // Add to cart
  stickyATC.addEventListener("click", async () => {
    const variantId = getCurrentVariantId();
    if (!variantId) {
      console.warn("No variant ID found");
      return;
    }

    await fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: Number(variantId),
        quantity: Number(stickyQty.value || 1),
      }),
    });

    document.dispatchEvent(new CustomEvent("cart:refresh"));
  });

  // Scroll logic (never exits)
  const trigger = 400;

  window.addEventListener("scroll", () => {
    bar.classList.toggle("visible", window.scrollY > trigger);
  });
})();
