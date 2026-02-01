(() => {
  const bar = document.getElementById("bdm-sticky-atc");
  if (!bar) return;

  const button = bar.querySelector("#bdm-atc");
  const qtyInput = bar.querySelector("#bdm-qty");

  /* -------------------------------------------------
     Force repaint in Shopify Theme Editor
  ------------------------------------------------- */
  if (document.documentElement.hasAttribute("data-shopify-editor")) {
    bar.style.display = "none";
    bar.offsetHeight; // force reflow
    bar.style.display = "";
  }

  /* -------------------------------------------------
     Helpers
  ------------------------------------------------- */

  function getCurrentVariantId() {
    const input =
      document.querySelector('input[name="id"]') ||
      document.querySelector('select[name="id"]');

    return input ? input.value : null;
  }

  /* -------------------------------------------------
     Init
  ------------------------------------------------- */

  function init() {
    const variantId = getCurrentVariantId();
    if (!variantId) return;

    bar.classList.add("is-visible");

    button.addEventListener("click", async () => {
      const quantity = qtyInput
        ? Math.max(1, parseInt(qtyInput.value, 10) || 1)
        : 1;

      await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          items: [{ id: variantId, quantity }]
        })
      });

      window.location.href = "/cart";
    });
  }

  /* Shopify dynamic sections safety */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
